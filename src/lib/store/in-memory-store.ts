import type { GameStore, RoomSummary } from "@/lib/store/game-store";
import type { ChatMessage, PlayerSession, Room, RoomPresence } from "@/lib/types";

/**
 * Pure in-memory store with no external persistence. hydrate/persist are
 * no-ops, so synchronously-created state is never wiped. Intended for tests.
 */
export class InMemoryGameStore implements GameStore {
  rooms = new Map<string, Room>();
  sessions = new Map<string, PlayerSession>();
  chats = new Map<string, ChatMessage[]>();
  presence = new Map<string, RoomPresence>();

  async hydrate(): Promise<void> {
    // No external source to hydrate from.
  }

  async hydrateRoom(): Promise<void> {
    // No external source to hydrate from.
  }

  async hydrateSession(): Promise<void> {
    // No external source to hydrate from.
  }

  async listRoomSummaries(): Promise<RoomSummary[]> {
    return [...this.rooms.values()].map((room) => ({
      code: room.code,
      gameType: room.gameType,
      status: room.status,
      playerCount: room.players.length,
      lastActivityAt: room.lastActivityAt ?? room.createdAt
    }));
  }

  async persist(): Promise<void> {
    // Nothing to persist; state lives only in memory.
  }

  deleteRoom(code: string): void {
    this.rooms.delete(code);
    this.chats.delete(code);
    this.presence.delete(code);
  }

  deleteSession(id: string): void {
    this.sessions.delete(id);
  }

  async clearRooms(): Promise<void> {
    this.rooms.clear();
    this.chats.clear();
    this.presence.clear();
  }

  async hardReset(): Promise<void> {
    await this.clearRooms();
    this.sessions.clear();
  }
}
