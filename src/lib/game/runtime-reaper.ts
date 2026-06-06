import type { PresenceTracker } from "@/lib/game/presence-tracker";
import type { GameStore } from "@/lib/store/game-store";
import type { Room } from "@/lib/types";

/**
 * In-memory TTL sweep for the warm store: culls rooms with no humans, ended
 * rooms, and rooms/sessions idle past the inactivity window, and detaches
 * sessions whose room has gone away.
 *
 * This is the per-request hygiene that runs during hydration (distinct from the
 * cron's DB-level {@link purgeStaleRuntimeStateRows}, which hard-deletes rows).
 * A room's payload can sit idle while players are still present, so effective
 * activity folds in the heartbeat ledger and chat rather than the room row
 * alone.
 */
export class RuntimeReaper {
  constructor(
    private readonly store: GameStore,
    private readonly presence: PresenceTracker,
    private readonly normalizeRoomCode: (code: string) => string,
    private readonly ttlMs: number
  ) {}

  private roomLastActivity(room: Room): number {
    let latest = room.lastActivityAt ?? room.createdAt;
    Object.values(this.presence.get(room.code)).forEach((lastSeenAt) => {
      latest = Math.max(latest, lastSeenAt);
    });
    (this.store.chats.get(this.normalizeRoomCode(room.code)) ?? []).forEach((message) => {
      const createdAt = Date.parse(message.createdAt);
      if (!Number.isNaN(createdAt)) {
        latest = Math.max(latest, createdAt);
      }
    });
    return latest;
  }

  private isRoomExpired(room: Room, now: number): boolean {
    const hasHumanPlayer = room.players.some((player) => !player.isBot);
    const expiredByTtl = now - this.roomLastActivity(room) > this.ttlMs;
    return !hasHumanPlayer || room.status === "ended" || expiredByTtl;
  }

  /** Sweeps every room and session. Returns true if anything was changed. */
  sweepAll(): boolean {
    const now = Date.now();
    let changed = false;

    const expiredRoomCodes: string[] = [];
    this.store.rooms.forEach((room, roomCode) => {
      if (this.isRoomExpired(room, now)) {
        expiredRoomCodes.push(roomCode);
      }
    });
    expiredRoomCodes.forEach((roomCode) => {
      this.store.deleteRoom(roomCode);
      changed = true;
    });

    this.store.sessions.forEach((session, sessionId) => {
      if (now - session.updatedAt > this.ttlMs) {
        this.store.deleteSession(sessionId);
        changed = true;
        return;
      }
      if (session.roomCode && !this.store.rooms.has(session.roomCode)) {
        session.roomCode = undefined;
        session.playerId = undefined;
        session.updatedAt = now;
        changed = true;
      }
    });

    return changed;
  }

  /** Sweeps a single room. Returns true if it was culled. */
  sweepRoom(roomCode: string): boolean {
    const room = this.store.rooms.get(roomCode);
    if (!room) return false;
    if (this.isRoomExpired(room, Date.now())) {
      this.store.deleteRoom(roomCode);
      return true;
    }
    return false;
  }

  /**
   * Sweeps a single session: expires it past the TTL, or detaches it from a
   * room that no longer exists. Returns true if anything was changed.
   */
  sweepSession(sessionId: string, roomCode?: string): boolean {
    const session = this.store.sessions.get(sessionId);
    if (!session) return false;
    const now = Date.now();
    if (now - session.updatedAt > this.ttlMs) {
      this.store.deleteSession(sessionId);
      return true;
    }
    if (roomCode && session.roomCode && this.normalizeRoomCode(session.roomCode) === roomCode && !this.store.rooms.has(roomCode)) {
      session.roomCode = undefined;
      session.playerId = undefined;
      session.updatedAt = now;
      return true;
    }
    return false;
  }
}
