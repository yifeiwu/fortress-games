import type { ChatMessage, PlayerSession, Room, RoomPresence } from "@/lib/types";

export interface RoomSummary {
  code: string;
  gameType: string;
  status: string;
  playerCount: number;
  /** Room-row activity timestamp, used to hide long-idle rooms from the lobby. */
  lastActivityAt: number;
}

export interface GameStore {
  rooms: Map<string, Room>;
  sessions: Map<string, PlayerSession>;
  /** Chat history per room, stored separately from the room payload. */
  chats: Map<string, ChatMessage[]>;
  /** Heartbeat ledger per room, stored separately from the room payload. */
  presence: Map<string, RoomPresence>;
  hydrate(force?: boolean): Promise<void>;
  hydrateRoom(code: string, force?: boolean): Promise<void>;
  hydrateSession(id: string, force?: boolean): Promise<void>;
  /**
   * Lightweight lobby listing that does NOT load rooms into the in-memory cache
   * (so the warm singleton doesn't accumulate the whole fleet, and a later
   * persist doesn't re-serialize rooms we only listed).
   */
  listRoomSummaries(): Promise<RoomSummary[]>;
  persist(): Promise<void>;
  deleteRoom(code: string): void;
  deleteSession(id: string): void;
  clearRooms(): Promise<void>;
  hardReset(): Promise<void>;
}
