import { getGameDefinition } from "@/lib/game/registry";
import { ChatRateLimiter } from "@/lib/game/chat-rate-limiter";
import { PresenceTracker } from "@/lib/game/presence-tracker";
import { RuntimeReaper } from "@/lib/game/runtime-reaper";
import { SessionDirectory } from "@/lib/game/session-directory";
import {
  applyGameBots,
  chooseRandomHuman,
  createPlayer,
  maybeCloseRound,
  normalizeHost,
  refreshPlayerScores
} from "@/lib/game/room-mechanics";
import type { GameActionPayload } from "@/lib/game/contracts";
import { MAX_ROOM_PLAYERS } from "@/lib/constants";
import type { GameStore } from "@/lib/store/game-store";
import { getSupabaseGameStore } from "@/lib/store/supabase-store";
import { isRuntimeStateConflictError, purgeStaleRuntimeStateRows } from "@/lib/supabase/runtime-state";
import type { ChatMessage, Player, PlayerSession, Room } from "@/lib/types";
import { createRoomCode, randomId } from "@/lib/utils/ids";

function clone<T>(value: T): T {
  // structuredClone (Node 18+) is markedly faster than JSON round-tripping for
  // the large room payloads cloned on every read. Room state is plain JSON-like
  // data (no functions/DOM nodes), so it clones cleanly.
  return structuredClone(value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const ROOM_INACTIVITY_TTL_MS = 30 * 60 * 1000;
const MAX_CONFLICT_RETRIES = 4;
const CHAT_RATE_WINDOW_MS = 10_000;
const CHAT_RATE_MAX_MESSAGES = 10;

interface RoomViewFingerprint {
  gameVersion: number;
  chatCount: number;
  viewerPlayerId: string | null;
  roomStatus: Room["status"];
  hostPlayerId: string;
  playerPresenceSignature: string;
}

interface RoomSyncResult {
  room: Room;
  roomCode: string;
}

class GameSessionService {
  private store: GameStore;
  private chatRateLimiter = new ChatRateLimiter(CHAT_RATE_WINDOW_MS, CHAT_RATE_MAX_MESSAGES);
  private presence: PresenceTracker;
  private sessions: SessionDirectory;
  private reaper: RuntimeReaper;

  constructor(store: GameStore = getSupabaseGameStore()) {
    this.store = store;
    const normalize = (code: string) => this.normalizeRoomCode(code);
    this.presence = new PresenceTracker(this.store, normalize);
    this.sessions = new SessionDirectory(this.store, normalize);
    this.reaper = new RuntimeReaper(this.store, this.presence, normalize, ROOM_INACTIVITY_TTL_MS);
  }

  /**
   * Re-runs a mutating operation when the persistence layer reports an
   * optimistic-lock conflict. Each attempt re-hydrates fresh state (the store
   * reloads on conflict) and re-applies the command, so concurrent player
   * actions no longer drop moves with a 409.
   */
  private async withConflictRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!isRuntimeStateConflictError(error)) {
          throw error;
        }
        lastError = error;
        if (attempt < MAX_CONFLICT_RETRIES) {
          await delay(15 * (attempt + 1));
        }
      }
    }
    throw lastError;
  }

  private async ensureHydrated() {
    await this.store.hydrate(true);
  }

  private async ensureSessionHydrated(sessionId: string) {
    // Honour the store's short freshness window instead of forcing a DB read on
    // every request. Writes stay correct because a stale optimistic version
    // triggers a conflict, and the store force-rehydrates before each retry.
    await this.store.hydrateSession(sessionId, false);
  }

  private async ensureRoomHydrated(code: string) {
    const roomCode = this.normalizeRoomCode(code);
    await this.store.hydrateRoom(roomCode, false);
    return roomCode;
  }

  private async ensureRoomAndSessionHydrated(code: string, sessionId: string) {
    const roomCode = this.normalizeRoomCode(code);
    await Promise.all([this.store.hydrateRoom(roomCode, false), this.store.hydrateSession(sessionId, false)]);
    return roomCode;
  }

  private async persistStore() {
    await this.store.persist();
  }

  private normalizeRoomCode(code: string): string {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      throw new Error("Room code is required.");
    }
    return normalized;
  }

  private touchRoom(room: Room, at = Date.now()) {
    room.lastActivityAt = at;
  }

  private playerPresenceSignature(room: Room): string {
    return room.players.map((player) => `${player.id}:${player.connected ? "1" : "0"}`).join("|");
  }

  private getChat(code: string): ChatMessage[] {
    return this.store.chats.get(this.normalizeRoomCode(code)) ?? [];
  }

  async getSession(sessionId: string): Promise<PlayerSession> {
    await this.ensureSessionHydrated(sessionId);
    return clone(this.sessions.getOrCreate(sessionId));
  }

  async setSessionUsername(sessionId: string, username: string): Promise<PlayerSession> {
    return this.withConflictRetry(async () => {
      await this.ensureHydrated();
      const normalizedUsername = this.sessions.normalizeUsername(username);
      if (!normalizedUsername) {
        throw new Error("Name is required.");
      }
      if (this.sessions.isUsernameTaken(normalizedUsername, sessionId)) {
        throw new Error("Name is already taken.");
      }
      const session = this.sessions.getOrCreate(sessionId);
      session.username = normalizedUsername;
      session.updatedAt = Date.now();
      await this.persistStore();
      return clone(session);
    });
  }

  /** The player id this session occupies in `roomCode`, or null if not a member. */
  getSessionPlayerId(sessionId: string, roomCode: string): string | null {
    return this.sessions.getPlayerId(sessionId, roomCode);
  }

  private toClientRoom(room: Room): Room {
    const publicRoom = clone(room);
    const now = Date.now();
    // Chat and presence live in their own rows; re-attach them to the
    // client-facing room snapshot so the API shape is unchanged.
    publicRoom.chat = clone(this.getChat(room.code));
    const presence = this.presence.get(room.code);
    publicRoom.players.forEach((player) => {
      player.connected = this.presence.isConnected(room.code, player, now, presence);
    });
    // Commit-reveal fairness: expose the seed commitment hash while a round is
    // in progress, and only reveal the plaintext seed once the round has been
    // revealed (so clients can verify the hash after the fact).
    Object.values(publicRoom.game.rngByRound).forEach((roundRecord) => {
      if (!roundRecord.revealedAt) {
        delete roundRecord.seedPlain;
      }
    });
    return publicRoom;
  }

  async listRooms() {
    // Use the lightweight summary read so the lobby doesn't full-hydrate the
    // entire fleet into the in-memory singleton (and grow its persist scan).
    const summaries = await this.store.listRoomSummaries();
    const now = Date.now();
    return summaries
      .filter((room) => room.status !== "ended" && now - room.lastActivityAt <= ROOM_INACTIVITY_TTL_MS)
      .map(({ code, gameType, status, playerCount }) => ({ code, gameType, status, playerCount }));
  }

  async createRoomForSession(sessionId: string, gameType: string) {
    // Only the caller's session needs hydrating; room-code collisions are
    // resolved by the unique primary key + conflict retry rather than loading
    // every room up front.
    return this.withConflictRetry(async () => {
      await this.ensureSessionHydrated(sessionId);
      const session = this.sessions.requireNamed(sessionId);
      const result = this.createRoom(session.username ?? "Player", gameType);
      this.sessions.bindToPlayer(sessionId, result.room.code, result.playerId);
      await this.persistStore();
      return result.room;
    });
  }

  createRoom(hostName: string, gameType: string) {
    const now = Date.now();
    const code = createRoomCode(new Set(this.store.rooms.keys()));
    const definition = getGameDefinition(gameType);
    const host = createPlayer(hostName, true, 0, false);
    // Solo games seat a single bot so the room already has 2 players and the
    // standard host Start flow / score bookkeeping work without special cases.
    const players: Player[] = [host];
    if (definition.autoFillBot) {
      players.push(createPlayer("The Reader", false, players.length, true));
    }
    const initialGame = definition.createInitialState({
      players,
      now
    });
    const room: Room = {
      code,
      gameType,
      status: "lobby",
      createdAt: now,
      lastActivityAt: now,
      hostPlayerId: host.id,
      players,
      chat: [],
      game: initialGame
    };
    this.store.rooms.set(code, room);
    this.store.chats.set(code, []);
    this.presence.mark(code, host.id, now);
    return { room: this.toClientRoom(room), playerId: host.id };
  }

  async joinRoomForSession(sessionId: string, code: string) {
    return this.withConflictRetry(async () => {
      const normalizedCode = await this.ensureRoomAndSessionHydrated(code, sessionId);
      const session = this.sessions.requireNamed(sessionId);
      const existingPlayerId = this.getSessionPlayerId(sessionId, normalizedCode);
      if (existingPlayerId) {
        const room = this.mustGetRoom(normalizedCode);
        const hasPlayer = room.players.some((player) => player.id === existingPlayerId);
        if (hasPlayer) {
          return this.toClientRoom(room);
        }
      }
      const result = this.joinRoom(normalizedCode, session.username ?? "Player");
      this.sessions.bindToPlayer(sessionId, result.room.code, result.playerId);
      await this.persistStore();
      return result.room;
    });
  }

  joinRoom(code: string, playerName: string) {
    const room = this.mustGetRoom(code);
    if (room.status === "ended") {
      throw new Error("Room has ended.");
    }
    if (room.players.length >= MAX_ROOM_PLAYERS) {
      throw new Error(`Room is full (max ${MAX_ROOM_PLAYERS} players).`);
    }
    const player = createPlayer(playerName, false, room.players.length);
    room.players.push(player);
    room.game = refreshPlayerScores(room.game, room.players);
    this.presence.mark(code, player.id, Date.now());
    this.touchRoom(room);
    return { room: this.toClientRoom(room), playerId: player.id };
  }

  async getRoom(code: string) {
    return this.withConflictRetry(async () => {
      const { room } = await this.syncRoomState(code);
      return this.toClientRoom(room);
    });
  }

  private async syncRoomState(code: string): Promise<RoomSyncResult> {
    const roomCode = await this.ensureRoomHydrated(code);
    const room = this.mustGetRoom(roomCode);
    const beforeStateVersion = room.game.version;
    const beforeStatus = room.status;
    const beforeHost = room.hostPlayerId;
    const beforePresence = this.playerPresenceSignature(room);
    this.reconcilePresence(room);
    maybeCloseRound(room);
    const afterPresence = this.playerPresenceSignature(room);
    const changed =
      room.game.version !== beforeStateVersion ||
      room.status !== beforeStatus ||
      room.hostPlayerId !== beforeHost ||
      afterPresence !== beforePresence;
    if (changed) {
      this.touchRoom(room);
      await this.persistStore();
    }
    return { room, roomCode };
  }

  async getRoomForSession(code: string, sessionId: string) {
    const roomCode = await this.ensureRoomAndSessionHydrated(code, sessionId);
    const room = await this.getRoom(roomCode);
    const viewerPlayerId = this.getSessionPlayerId(sessionId, room.code);
    // Don't leak room chat to clients that haven't actually joined the room.
    if (!viewerPlayerId) {
      room.chat = [];
    }
    return { room, viewerPlayerId };
  }

  async getRoomForSessionConditional(code: string, sessionId: string, known?: Partial<RoomViewFingerprint>) {
    return this.withConflictRetry(async () => {
      const roomCode = await this.ensureRoomAndSessionHydrated(code, sessionId);
      const { room } = await this.syncRoomState(roomCode);
      const viewerPlayerId = this.getSessionPlayerId(sessionId, room.code);
      const chatCount = this.getChat(room.code).length;
      const playerPresenceSignature = this.playerPresenceSignature(room);
      const fingerprint: RoomViewFingerprint = {
        gameVersion: room.game.version,
        chatCount,
        viewerPlayerId,
        roomStatus: room.status,
        hostPlayerId: room.hostPlayerId,
        playerPresenceSignature
      };

      const unchanged = Boolean(
        known &&
          known.gameVersion === fingerprint.gameVersion &&
          known.chatCount === fingerprint.chatCount &&
          known.viewerPlayerId === fingerprint.viewerPlayerId &&
          known.roomStatus === fingerprint.roomStatus &&
          known.hostPlayerId === fingerprint.hostPlayerId &&
          known.playerPresenceSignature === fingerprint.playerPresenceSignature
      );

      if (unchanged) {
        return {
          unchanged: true as const,
          viewerPlayerId,
          fingerprint,
          room: {
            code: room.code,
            status: room.status,
            game: {
              state: room.game.state,
              roundIndex: room.game.roundIndex,
              roundDeadlineAt: room.game.roundDeadlineAt,
              version: room.game.version
            }
          }
        };
      }

      const clientRoom = this.toClientRoom(room);
      if (!viewerPlayerId) {
        clientRoom.chat = [];
      }
      return { unchanged: false as const, viewerPlayerId, room: clientRoom, fingerprint };
    });
  }

  async leaveRoomForSession(code: string, sessionId: string) {
    return this.withConflictRetry(async () => {
      const roomCode = await this.ensureRoomAndSessionHydrated(code, sessionId);
      const playerId = this.sessions.requirePlayer(sessionId, roomCode);
      const room = this.leaveRoom(roomCode, playerId);
      this.sessions.clearPlayer(sessionId);
      // Reaping is intentionally checked only on explicit leave actions.
      this.reaper.sweepRoom(roomCode);
      this.reaper.sweepSession(sessionId, roomCode);
      await this.persistStore();
      return room;
    });
  }

  leaveRoom(code: string, playerId: string) {
    const room = this.mustGetRoom(code);
    const leaving = room.players.find((p) => p.id === playerId);
    if (!leaving) return this.toClientRoom(room);

    room.players = room.players.filter((p) => p.id !== playerId);
    this.presence.drop(code, playerId);
    if (!leaving.isBot) {
      const preferredHostId = leaving.isHost ? chooseRandomHuman(room)?.id : room.hostPlayerId;
      normalizeHost(room, preferredHostId);
    }
    room.game = refreshPlayerScores(room.game, room.players);
    this.touchRoom(room);
    return this.toClientRoom(room);
  }

  async sendChatForSession(code: string, sessionId: string, content: string) {
    return this.withConflictRetry(async () => {
      const roomCode = await this.ensureRoomAndSessionHydrated(code, sessionId);
      const playerId = this.sessions.requirePlayer(sessionId, roomCode);
      this.sendChat(roomCode, playerId, content);
      await this.persistStore();
      return this.toClientRoom(this.mustGetRoom(roomCode));
    });
  }

  sendChat(code: string, playerId: string, content: string) {
    const roomCode = this.normalizeRoomCode(code);
    const room = this.mustGetRoom(roomCode);
    const player = room.players.find((p) => p.id === playerId);
    if (!player) throw new Error("Player not in room.");
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("Message cannot be empty.");
    }
    this.chatRateLimiter.check(roomCode, playerId);
    const message: ChatMessage = {
      id: randomId("msg"),
      playerId,
      playerName: player.name,
      content: trimmed.slice(0, 300),
      createdAt: new Date().toISOString()
    };
    // Chat is appended to its own row, not the room payload, so a flurry of
    // messages mid-round doesn't conflict with players' game moves. TTL still
    // sees the message via getRoomLastActivity, so no room touch is needed.
    const chat = [...this.getChat(roomCode), message];
    this.store.chats.set(roomCode, chat);
    return clone(message);
  }

  async startGameForSession(code: string, sessionId: string) {
    return this.withConflictRetry(async () => {
      const roomCode = await this.ensureRoomAndSessionHydrated(code, sessionId);
      const playerId = this.sessions.requirePlayer(sessionId, roomCode);
      const room = this.startGame(roomCode, playerId);
      await this.persistStore();
      return room;
    });
  }

  startGame(code: string, actorId: string) {
    const room = this.mustGetRoom(code);
    if (room.hostPlayerId !== actorId) {
      throw new Error("Only host can start game.");
    }
    if (room.players.length < 2) {
      throw new Error("Need at least 2 players to start. Add another player or a bot.");
    }
    const definition = getGameDefinition(room.gameType);
    room.status = "in_game";
    room.game = definition.applyCommand({
      room,
      state: room.game,
      command: { type: "start_game" },
      context: { now: Date.now(), actorPlayerId: actorId }
    });
    applyGameBots(room);
    maybeCloseRound(room);
    this.touchRoom(room);
    return this.toClientRoom(room);
  }

  async restartGameForSession(code: string, sessionId: string) {
    return this.withConflictRetry(async () => {
      const roomCode = await this.ensureRoomAndSessionHydrated(code, sessionId);
      const playerId = this.sessions.requirePlayer(sessionId, roomCode);
      const room = this.restartGame(roomCode, playerId);
      await this.persistStore();
      return room;
    });
  }

  restartGame(code: string, actorId: string) {
    const room = this.mustGetRoom(code);
    if (room.hostPlayerId !== actorId) {
      throw new Error("Only host can restart game.");
    }
    const definition = getGameDefinition(room.gameType);
    room.status = "lobby";
    room.game = definition.createInitialState({
      players: room.players,
      now: Date.now()
    });
    this.touchRoom(room);
    return this.toClientRoom(room);
  }

  async submitGameActionForSession(code: string, sessionId: string, payload: GameActionPayload) {
    return this.withConflictRetry(async () => {
      const roomCode = await this.ensureRoomAndSessionHydrated(code, sessionId);
      const playerId = this.sessions.requirePlayer(sessionId, roomCode);
      const room = this.submitGameAction(roomCode, playerId, payload);
      await this.persistStore();
      return room;
    });
  }

  submitGameAction(code: string, playerId: string, payload: GameActionPayload) {
    const room = this.mustGetRoom(code);
    const definition = getGameDefinition(room.gameType);
    const command = definition.parseAction?.(payload);
    if (!command) {
      throw new Error("Invalid game action.");
    }
    room.game = definition.applyCommand({
      room,
      state: room.game,
      command,
      context: { now: Date.now(), actorPlayerId: playerId }
    });
    applyGameBots(room);
    maybeCloseRound(room);
    this.touchRoom(room);
    return this.toClientRoom(room);
  }

  async addBotForSession(code: string, sessionId: string) {
    return this.withConflictRetry(async () => {
      const roomCode = await this.ensureRoomAndSessionHydrated(code, sessionId);
      const playerId = this.sessions.requirePlayer(sessionId, roomCode);
      const room = this.addBot(roomCode, playerId);
      await this.persistStore();
      return room;
    });
  }

  addBot(code: string, actorId: string) {
    const room = this.mustGetRoom(code);
    if (room.hostPlayerId !== actorId) {
      throw new Error("Only host can add bot players.");
    }
    if (room.players.length >= MAX_ROOM_PLAYERS) {
      throw new Error(`Room is full (max ${MAX_ROOM_PLAYERS} players).`);
    }
    const definition = getGameDefinition(room.gameType);
    if (definition.maxActivePlayers != null && room.players.length >= definition.maxActivePlayers) {
      throw new Error(
        `This game seats ${definition.maxActivePlayers} players. Extra humans can still join as spectators.`
      );
    }
    const bot = createPlayer(`fortress-bot ${room.players.filter((p) => p.isBot).length + 1}`, false, room.players.length, true);
    room.players.push(bot);
    room.game = refreshPlayerScores(room.game, room.players);
    this.touchRoom(room);
    return this.toClientRoom(room);
  }

  async heartbeatForSession(code: string, sessionId: string): Promise<void> {
    return this.withConflictRetry(async () => {
      const roomCode = await this.ensureRoomAndSessionHydrated(code, sessionId);
      const playerId = this.sessions.requirePlayer(sessionId, roomCode);
      this.heartbeat(roomCode, playerId);
      await this.persistStore();
    });
  }

  heartbeat(code: string, playerId: string): void {
    const roomCode = this.normalizeRoomCode(code);
    const room = this.mustGetRoom(roomCode);
    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error("Player not in room.");
    }
    // A heartbeat only bumps the presence row, never the room row. Disconnect
    // detection, host migration, and TTL all read presence lazily on the next
    // getRoom, so a 12-player room's heartbeats no longer contend with moves.
    // The caller ignores the response, so we skip the full client-room clone.
    this.presence.mark(roomCode, playerId, Date.now());
  }

  private reconcilePresence(room: Room) {
    const now = Date.now();
    const presence = this.presence.get(room.code);
    room.players.forEach((player) => {
      if (player.isBot) return;
      player.connected = this.presence.isConnected(room.code, player, now, presence);
    });

    const host = room.players.find((player) => player.id === room.hostPlayerId && !player.isBot);
    if (!host) {
      normalizeHost(room);
      return;
    }

    if (!host.connected) {
      const replacement = chooseRandomHuman(room, host.id);
      if (replacement) {
        normalizeHost(room, replacement.id);
      }
    }

    const humanPlayers = room.players.filter((player) => !player.isBot);
    if (!humanPlayers.length) {
      room.status = "ended";
    }
  }

  private mustGetRoom(code: string): Room {
    const room = this.store.rooms.get(this.normalizeRoomCode(code));
    if (!room) {
      throw new Error("Room not found.");
    }
    return room;
  }

  async clearRoomRuntimeState() {
    await this.store.clearRooms();
  }

  /**
   * TTL cleanup: drop only runtime rows idle longer than the inactivity window,
   * across rooms, sessions, chat, and presence. Unlike clearRoomRuntimeState
   * this preserves live rooms and recently-active sessions.
   */
  async purgeStaleRuntimeState(olderThanMs: number = ROOM_INACTIVITY_TTL_MS) {
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    await purgeStaleRuntimeStateRows(cutoff);
  }

  async resetForTests() {
    await this.store.hardReset();
  }

  async setLastSeenForTests(code: string, playerId: string, lastSeenAt: number) {
    const roomCode = await this.ensureRoomHydrated(code);
    const room = this.mustGetRoom(roomCode);
    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) {
      throw new Error("Player not found.");
    }
    this.presence.mark(roomCode, playerId, lastSeenAt);
    await this.persistStore();
  }

  async setRoundDeadlineForTests(code: string, deadlineAt: number) {
    const roomCode = await this.ensureRoomHydrated(code);
    const room = this.mustGetRoom(roomCode);
    room.game.roundDeadlineAt = deadlineAt;
    await this.persistStore();
  }

  async setRoomLastActivityForTests(code: string, lastActivityAt: number) {
    const roomCode = await this.ensureRoomHydrated(code);
    const room = this.mustGetRoom(roomCode);
    room.lastActivityAt = lastActivityAt;
    // Presence and chat also feed the TTL, so age them too — otherwise the
    // host's create-time heartbeat would keep the room looking active.
    const agedPresence: Record<string, number> = {};
    Object.keys(this.presence.get(roomCode)).forEach((id) => {
      agedPresence[id] = lastActivityAt;
    });
    this.presence.set(roomCode, agedPresence);
    await this.persistStore();
  }
}

const globalService = globalThis as unknown as { __fortressGameService?: GameSessionService };

export function getGameSessionService() {
  if (!globalService.__fortressGameService) {
    globalService.__fortressGameService = new GameSessionService();
  }
  return globalService.__fortressGameService;
}

/** Build a fresh service over a provided store (e.g. an in-memory store for tests). */
export function createGameSessionService(store?: GameStore) {
  return new GameSessionService(store);
}
