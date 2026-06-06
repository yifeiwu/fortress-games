import type { ArrowGameStatus, RoundChoice } from "@/lib/types/games/arrow";
import type { SpaceshipGameState, SpaceshipGameStatus } from "@/lib/types/games/spaceship";
import type { FrankenBeastsGameState, FrankenBeastsGameStatus } from "@/lib/types/games/frankenbeasts";
import type { TarotGameState, TarotGameStatus } from "@/lib/types/games/tarot";
import type { LiarsDiceGameState, LiarsDiceGameStatus } from "@/lib/types/games/liars-dice";

type RoomStatus = "lobby" | "in_game" | "ended";

/**
 * Every phase a game can be in. Composed from a shared base ("waiting" before a
 * match starts, "finished" once it ends) plus each game's own phase union, so a
 * new game contributes its statuses from its own module rather than growing one
 * monolithic list here.
 */
type GameStatus =
  | "waiting"
  | "finished"
  | ArrowGameStatus
  | SpaceshipGameStatus
  | FrankenBeastsGameStatus
  | TarotGameStatus
  | LiarsDiceGameStatus;

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
  joinOrder: number;
}

/**
 * Per-room presence ledger: maps a player id to the epoch ms of their last
 * heartbeat. Stored in its own row (`room_presence_state`) so that frequent
 * heartbeats don't bump the room's optimistic version and contend with game
 * moves. `connected` on {@link Player} is derived from these timestamps.
 */
export type RoomPresence = Record<string, number>;

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  content: string;
  createdAt: string;
}

interface RoundRngRecord {
  roundIndex: number;
  seedHash?: string;
  seedPlain?: string;
  rngAlgo: "mulberry32";
  revealedAt?: number;
}

interface ScoreEntry {
  playerId: string;
  points: number;
}

export interface GameState {
  gameType: string;
  state: GameStatus;
  roundIndex: number;
  maxRounds: number;
  roundDeadlineAt?: number;
  leaderPlayerId?: string;
  scores: Record<string, number>;
  choicesByRound: Record<number, Record<string, RoundChoice>>;
  rngByRound: Record<number, RoundRngRecord>;
  spaceship?: SpaceshipGameState;
  frankenbeasts?: FrankenBeastsGameState;
  tarot?: TarotGameState;
  liarsDice?: LiarsDiceGameState;
  version: number;
}

export interface Room {
  code: string;
  gameType: string;
  status: RoomStatus;
  createdAt: number;
  lastActivityAt?: number;
  hostPlayerId: string;
  players: Player[];
  chat: ChatMessage[];
  game: GameState;
}

export interface PlayerSession {
  id: string;
  username?: string;
  roomCode?: string;
  playerId?: string;
  createdAt: number;
  updatedAt: number;
}
