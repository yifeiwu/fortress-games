import type { GameStore, RoomSummary } from "@/lib/store/game-store";
import type { ChatMessage, PlayerSession, Room, RoomPresence } from "@/lib/types";
import {
  clearRoomRuntimeStateRows,
  clearVersionedRuntimeStateRows,
  deleteRoomRuntimeState,
  deleteSessionRuntimeState,
  fetchRoomRuntimeState,
  fetchRoomRuntimeStates,
  fetchSessionRuntimeState,
  fetchSessionRuntimeStates,
  insertRoomRuntimeState,
  insertSessionRuntimeState,
  roomChatRuntimeState,
  roomPresenceRuntimeState,
  updateRoomRuntimeState,
  updateSessionRuntimeState,
  type RoomKeyedRuntimeStateRepository,
  type VersionedRoomKeyedState,
  type VersionedRoomState,
  type VersionedSessionState
} from "@/lib/supabase/runtime-state";

const HYDRATE_FRESHNESS_MS = 1_000;

export interface RuntimeStateRepository {
  fetchRooms(): Promise<VersionedRoomState[]>;
  fetchRoom(roomCode: string): Promise<VersionedRoomState | null>;
  fetchSessions(): Promise<VersionedSessionState[]>;
  fetchSession(sessionId: string): Promise<VersionedSessionState | null>;
  insertRoom(roomCode: string, payload: Room): Promise<number>;
  updateRoom(roomCode: string, payload: Room, expectedVersion: number): Promise<number>;
  deleteRoom(roomCode: string, expectedVersion: number): Promise<void>;
  insertSession(sessionId: string, payload: PlayerSession): Promise<number>;
  updateSession(sessionId: string, payload: PlayerSession, expectedVersion: number): Promise<number>;
  deleteSession(sessionId: string, expectedVersion: number): Promise<void>;
  chat: RoomKeyedRuntimeStateRepository<ChatMessage[]>;
  presence: RoomKeyedRuntimeStateRepository<RoomPresence>;
  clearRooms(): Promise<void>;
  clear(): Promise<void>;
}

const supabaseRuntimeStateRepository: RuntimeStateRepository = {
  fetchRooms: fetchRoomRuntimeStates,
  fetchRoom: fetchRoomRuntimeState,
  fetchSessions: fetchSessionRuntimeStates,
  fetchSession: fetchSessionRuntimeState,
  insertRoom: insertRoomRuntimeState,
  updateRoom: updateRoomRuntimeState,
  deleteRoom: deleteRoomRuntimeState,
  insertSession: insertSessionRuntimeState,
  updateSession: updateSessionRuntimeState,
  deleteSession: deleteSessionRuntimeState,
  chat: roomChatRuntimeState,
  presence: roomPresenceRuntimeState,
  clearRooms: clearRoomRuntimeStateRows,
  clear: clearVersionedRuntimeStateRows
};

function snapshot(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Local cache for a versioned, room-code-keyed satellite table (chat, presence).
 * Tracks per-row versions/baselines so {@link persist} only writes rows that
 * actually changed, mirroring the room/session bookkeeping in
 * {@link SupabaseGameStore} but without coupling to the room's version.
 */
class RoomKeyedLocalState<T> {
  values = new Map<string, T>();
  private versions = new Map<string, number>();
  private baselines = new Map<string, string>();
  private hydratedAt = new Map<string, number>();
  private deleted = new Set<string>();

  constructor(
    private readonly repository: RoomKeyedRuntimeStateRepository<T>,
    private readonly freshnessMs: number
  ) {}

  delete(roomCode: string) {
    this.values.delete(roomCode);
    this.deleted.add(roomCode);
  }

  clearLocal() {
    this.values.clear();
    this.versions.clear();
    this.baselines.clear();
    this.hydratedAt.clear();
    this.deleted.clear();
  }

  async hydrateAll() {
    const rows = await this.repository.fetchAll();
    this.values = new Map(rows.map((row) => [row.roomCode, row.payload]));
    this.versions = new Map(rows.map((row) => [row.roomCode, row.version]));
    this.baselines = new Map(rows.map((row) => [row.roomCode, snapshot(row.payload)]));
    this.hydratedAt = new Map(rows.map((row) => [row.roomCode, Date.now()]));
    this.deleted.clear();
  }

  async hydrateOne(roomCode: string, force = false) {
    if (!force && this.hydratedAt.has(roomCode) && Date.now() - this.hydratedAt.get(roomCode)! < this.freshnessMs) {
      return;
    }
    const row = await this.repository.fetchOne(roomCode);
    if (!row) {
      this.values.delete(roomCode);
      this.versions.delete(roomCode);
      this.baselines.delete(roomCode);
      this.hydratedAt.set(roomCode, Date.now());
      return;
    }
    this.values.set(row.roomCode, row.payload);
    this.versions.set(row.roomCode, row.version);
    this.baselines.set(row.roomCode, snapshot(row.payload));
    this.deleted.delete(row.roomCode);
    this.hydratedAt.set(row.roomCode, Date.now());
  }

  async persist() {
    for (const roomCode of this.deleted) {
      const version = this.versions.get(roomCode);
      if (version === undefined) continue;
      await this.repository.remove(roomCode, version);
      this.versions.delete(roomCode);
      this.baselines.delete(roomCode);
      this.hydratedAt.delete(roomCode);
    }
    for (const [roomCode, payload] of this.values.entries()) {
      if (this.deleted.has(roomCode)) continue;
      const currentSnapshot = snapshot(payload);
      if (this.baselines.get(roomCode) === currentSnapshot) continue;
      const version = this.versions.get(roomCode);
      const nextVersion =
        version === undefined
          ? await this.repository.insert(roomCode, payload)
          : await this.repository.update(roomCode, payload, version);
      this.versions.set(roomCode, nextVersion);
      this.baselines.set(roomCode, currentSnapshot);
      this.hydratedAt.set(roomCode, Date.now());
    }
    this.deleted.clear();
  }
}

class SupabaseGameStore implements GameStore {
  rooms = new Map<string, Room>();
  sessions = new Map<string, PlayerSession>();
  private deletedRoomCodes = new Set<string>();
  private deletedSessionIds = new Set<string>();
  private roomVersions = new Map<string, number>();
  private sessionVersions = new Map<string, number>();
  private roomBaselines = new Map<string, string>();
  private sessionBaselines = new Map<string, string>();
  private roomHydratedAt = new Map<string, number>();
  private sessionHydratedAt = new Map<string, number>();
  private readonly chatState: RoomKeyedLocalState<ChatMessage[]>;
  private readonly presenceState: RoomKeyedLocalState<RoomPresence>;
  private hydrated = false;
  private lastHydratedAt = 0;
  private hydratePromise: Promise<void> | null = null;

  constructor(private readonly repository: RuntimeStateRepository = supabaseRuntimeStateRepository) {
    this.chatState = new RoomKeyedLocalState(repository.chat, HYDRATE_FRESHNESS_MS);
    this.presenceState = new RoomKeyedLocalState(repository.presence, HYDRATE_FRESHNESS_MS);
  }

  get chats(): Map<string, ChatMessage[]> {
    return this.chatState.values;
  }

  get presence(): Map<string, RoomPresence> {
    return this.presenceState.values;
  }

  deleteRoom(code: string) {
    this.rooms.delete(code);
    this.deletedRoomCodes.add(code);
    this.chatState.delete(code);
    this.presenceState.delete(code);
  }

  deleteSession(id: string) {
    this.sessions.delete(id);
    this.deletedSessionIds.add(id);
  }

  async hardReset() {
    this.clearLocalRooms();
    this.clearLocalSessions();
    await this.repository.clear();
    this.hydrated = true;
    this.lastHydratedAt = Date.now();
  }

  async clearRooms() {
    this.clearLocalRooms();
    await this.repository.clearRooms();
  }

  private clearLocalRooms() {
    this.rooms.clear();
    this.deletedRoomCodes.clear();
    this.roomVersions.clear();
    this.roomBaselines.clear();
    this.roomHydratedAt.clear();
    this.chatState.clearLocal();
    this.presenceState.clearLocal();
  }

  private clearLocalSessions() {
    this.sessions.clear();
    this.deletedSessionIds.clear();
    this.sessionVersions.clear();
    this.sessionBaselines.clear();
    this.sessionHydratedAt.clear();
  }

  async listRoomSummaries(): Promise<RoomSummary[]> {
    // Read straight from the repository without populating the local maps, so
    // listing the lobby doesn't grow the warm singleton's cache or its persist
    // scan. (The full room payload is still fetched, but never retained.)
    const rooms = await this.repository.fetchRooms();
    return rooms.map((row) => ({
      code: row.payload.code,
      gameType: row.payload.gameType,
      status: row.payload.status,
      playerCount: row.payload.players.length,
      lastActivityAt: row.payload.lastActivityAt ?? row.payload.createdAt
    }));
  }

  async hydrate(force = false) {
    if (!force && this.hydrated && Date.now() - this.lastHydratedAt < HYDRATE_FRESHNESS_MS) {
      return;
    }
    if (this.hydratePromise) {
      await this.hydratePromise;
      return;
    }
    this.hydratePromise = this.hydrateFromDatabase().finally(() => {
      this.hydratePromise = null;
    });
    await this.hydratePromise;
    this.hydrated = true;
    this.lastHydratedAt = Date.now();
  }

  async hydrateRoom(code: string, force = false) {
    // Chat and presence live in their own rows but share the room's lifecycle,
    // so they're hydrated alongside it (reconcile/TTL read presence, the client
    // room reads chat).
    await Promise.all([this.chatState.hydrateOne(code, force), this.presenceState.hydrateOne(code, force)]);
    if (!force && this.roomHydratedAt.has(code) && Date.now() - this.roomHydratedAt.get(code)! < HYDRATE_FRESHNESS_MS) {
      return;
    }
    const row = await this.repository.fetchRoom(code);
    if (!row) {
      this.rooms.delete(code);
      this.roomVersions.delete(code);
      this.roomBaselines.delete(code);
      this.roomHydratedAt.set(code, Date.now());
      return;
    }
    this.rooms.set(row.roomCode, row.payload);
    this.roomVersions.set(row.roomCode, row.version);
    this.roomBaselines.set(row.roomCode, snapshot(row.payload));
    this.deletedRoomCodes.delete(row.roomCode);
    this.roomHydratedAt.set(row.roomCode, Date.now());
  }

  async hydrateSession(id: string, force = false) {
    if (!force && this.sessionHydratedAt.has(id) && Date.now() - this.sessionHydratedAt.get(id)! < HYDRATE_FRESHNESS_MS) {
      return;
    }
    const row = await this.repository.fetchSession(id);
    if (!row) {
      this.sessions.delete(id);
      this.sessionVersions.delete(id);
      this.sessionBaselines.delete(id);
      this.sessionHydratedAt.set(id, Date.now());
      return;
    }
    this.sessions.set(row.sessionId, row.payload);
    this.sessionVersions.set(row.sessionId, row.version);
    this.sessionBaselines.set(row.sessionId, snapshot(row.payload));
    this.deletedSessionIds.delete(row.sessionId);
    this.sessionHydratedAt.set(row.sessionId, Date.now());
  }

  async persist() {
    try {
      await this.persistDeletedRooms();
      await this.persistDeletedSessions();
      await this.persistRooms();
      await this.persistSessions();
      // Chat and presence are versioned independently of the room, so these
      // writes don't contend with concurrent game moves on the same room row.
      await this.chatState.persist();
      await this.presenceState.persist();
      this.deletedRoomCodes.clear();
      this.deletedSessionIds.clear();
      this.hydrated = true;
      this.lastHydratedAt = Date.now();
    } catch (error) {
      await this.hydrate(true);
      throw error;
    }
  }

  private async hydrateFromDatabase() {
    const [rooms, sessions] = await Promise.all([
      this.repository.fetchRooms(),
      this.repository.fetchSessions(),
      this.chatState.hydrateAll(),
      this.presenceState.hydrateAll()
    ]);
    this.rooms = new Map(rooms.map((row) => [row.roomCode, row.payload]));
    this.sessions = new Map(sessions.map((row) => [row.sessionId, row.payload]));
    this.roomVersions = new Map(rooms.map((row) => [row.roomCode, row.version]));
    this.sessionVersions = new Map(sessions.map((row) => [row.sessionId, row.version]));
    this.roomBaselines = new Map(rooms.map((row) => [row.roomCode, snapshot(row.payload)]));
    this.sessionBaselines = new Map(sessions.map((row) => [row.sessionId, snapshot(row.payload)]));
    this.roomHydratedAt = new Map(rooms.map((row) => [row.roomCode, Date.now()]));
    this.sessionHydratedAt = new Map(sessions.map((row) => [row.sessionId, Date.now()]));
    this.deletedRoomCodes.clear();
    this.deletedSessionIds.clear();
  }

  private async persistDeletedRooms() {
    for (const roomCode of this.deletedRoomCodes) {
      const version = this.roomVersions.get(roomCode);
      if (version === undefined) continue;
      await this.repository.deleteRoom(roomCode, version);
      this.roomVersions.delete(roomCode);
      this.roomBaselines.delete(roomCode);
      this.roomHydratedAt.delete(roomCode);
    }
  }

  private async persistDeletedSessions() {
    for (const sessionId of this.deletedSessionIds) {
      const version = this.sessionVersions.get(sessionId);
      if (version === undefined) continue;
      await this.repository.deleteSession(sessionId, version);
      this.sessionVersions.delete(sessionId);
      this.sessionBaselines.delete(sessionId);
      this.sessionHydratedAt.delete(sessionId);
    }
  }

  private async persistRooms() {
    for (const [roomCode, room] of this.rooms.entries()) {
      if (this.deletedRoomCodes.has(roomCode)) continue;
      const currentSnapshot = snapshot(room);
      if (this.roomBaselines.get(roomCode) === currentSnapshot) continue;

      const version = this.roomVersions.get(roomCode);
      const nextVersion =
        version === undefined
          ? await this.repository.insertRoom(roomCode, room)
          : await this.repository.updateRoom(roomCode, room, version);
      this.roomVersions.set(roomCode, nextVersion);
      this.roomBaselines.set(roomCode, currentSnapshot);
      this.roomHydratedAt.set(roomCode, Date.now());
    }
  }

  private async persistSessions() {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (this.deletedSessionIds.has(sessionId)) continue;
      const currentSnapshot = snapshot(session);
      if (this.sessionBaselines.get(sessionId) === currentSnapshot) continue;

      const version = this.sessionVersions.get(sessionId);
      const nextVersion =
        version === undefined
          ? await this.repository.insertSession(sessionId, session)
          : await this.repository.updateSession(sessionId, session, version);
      this.sessionVersions.set(sessionId, nextVersion);
      this.sessionBaselines.set(sessionId, currentSnapshot);
      this.sessionHydratedAt.set(sessionId, Date.now());
    }
  }
}

const globalStore = globalThis as unknown as { __fortressStore?: SupabaseGameStore };

export function getSupabaseGameStore(): SupabaseGameStore {
  if (!globalStore.__fortressStore) {
    globalStore.__fortressStore = new SupabaseGameStore();
  }
  return globalStore.__fortressStore;
}

export { SupabaseGameStore };
