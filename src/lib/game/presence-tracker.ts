import type { GameStore } from "@/lib/store/game-store";
import type { Player, RoomPresence } from "@/lib/types";

/** A player is considered connected if seen within this window. */
export const PRESENCE_STALE_AFTER_MS = 20_000;

/**
 * Owns the per-room heartbeat ledger. Heartbeats live in their own store row
 * (not the room payload), so a busy room's presence churn doesn't contend with
 * game moves. The tracker reads `store.presence` lazily on every call because
 * the store may swap its Map instance on a full re-hydrate.
 */
export class PresenceTracker {
  constructor(
    private readonly store: GameStore,
    private readonly normalizeRoomCode: (code: string) => string
  ) {}

  get(code: string): RoomPresence {
    return this.store.presence.get(this.normalizeRoomCode(code)) ?? {};
  }

  mark(code: string, playerId: string, at: number): void {
    const roomCode = this.normalizeRoomCode(code);
    const presence = { ...(this.store.presence.get(roomCode) ?? {}) };
    presence[playerId] = at;
    this.store.presence.set(roomCode, presence);
  }

  drop(code: string, playerId: string): void {
    const roomCode = this.normalizeRoomCode(code);
    const existing = this.store.presence.get(roomCode);
    if (!existing || !(playerId in existing)) return;
    const presence = { ...existing };
    delete presence[playerId];
    this.store.presence.set(roomCode, presence);
  }

  /** Overwrites the whole ledger for a room (used by test helpers). */
  set(code: string, presence: RoomPresence): void {
    this.store.presence.set(this.normalizeRoomCode(code), presence);
  }

  isConnected(code: string, player: Player, now: number, presence: RoomPresence = this.get(code)): boolean {
    if (player.isBot) return true;
    const lastSeenAt = presence[player.id];
    return typeof lastSeenAt === "number" && now - lastSeenAt <= PRESENCE_STALE_AFTER_MS;
  }
}
