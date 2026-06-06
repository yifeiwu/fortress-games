import { createEmptySession } from "@/lib/session";
import type { GameStore } from "@/lib/store/game-store";
import type { PlayerSession } from "@/lib/types";

/** A username only blocks others while its session has been active this recently. */
const ACTIVE_USERNAME_WINDOW_MS = 60 * 60 * 1000;

/**
 * Owns player-session bookkeeping: username normalisation/uniqueness and the
 * binding between a session and the room+player it currently occupies. Lives
 * separately from GameSessionService so room/game orchestration isn't tangled
 * with session identity rules. TTL-based session expiry stays in the service
 * since it's part of the same sweep that culls rooms.
 */
export class SessionDirectory {
  constructor(
    private readonly store: GameStore,
    private readonly normalizeRoomCode: (code: string) => string
  ) {}

  normalizeUsername(username: string): string {
    return username.trim().slice(0, 30);
  }

  private isActive(session: PlayerSession): boolean {
    return Date.now() - session.updatedAt <= ACTIVE_USERNAME_WINDOW_MS;
  }

  isUsernameTaken(username: string, sessionIdToIgnore: string): boolean {
    const normalized = this.normalizeUsername(username).toLowerCase();
    if (!normalized) {
      return false;
    }
    return [...this.store.sessions.values()].some((session) => {
      if (session.id === sessionIdToIgnore || !session.username || !this.isActive(session)) {
        return false;
      }
      return this.normalizeUsername(session.username).toLowerCase() === normalized;
    });
  }

  getOrCreate(sessionId: string): PlayerSession {
    const existing = this.store.sessions.get(sessionId);
    if (existing) {
      existing.updatedAt = Date.now();
      return existing;
    }
    const next = createEmptySession(sessionId);
    this.store.sessions.set(sessionId, next);
    return next;
  }

  requireNamed(sessionId: string): PlayerSession {
    const session = this.getOrCreate(sessionId);
    if (!session.username) {
      throw new Error("Name is required.");
    }
    return session;
  }

  bindToPlayer(sessionId: string, roomCode: string, playerId: string): void {
    const session = this.getOrCreate(sessionId);
    session.roomCode = this.normalizeRoomCode(roomCode);
    session.playerId = playerId;
    session.updatedAt = Date.now();
  }

  clearPlayer(sessionId: string): void {
    const session = this.getOrCreate(sessionId);
    session.roomCode = undefined;
    session.playerId = undefined;
    session.updatedAt = Date.now();
  }

  getPlayerId(sessionId: string, roomCode: string): string | null {
    const session = this.getOrCreate(sessionId);
    const normalizedRoomCode = this.normalizeRoomCode(roomCode);
    const sessionRoomCode = session.roomCode ? this.normalizeRoomCode(session.roomCode) : undefined;
    if (sessionRoomCode !== normalizedRoomCode) {
      return null;
    }
    return session.playerId ?? null;
  }

  requirePlayer(sessionId: string, roomCode: string): string {
    const playerId = this.getPlayerId(sessionId, roomCode);
    if (!playerId) {
      throw new Error("Session is not a member of this room.");
    }
    return playerId;
  }
}
