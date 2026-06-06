import type { Direction, GameState, Player, Room, RoundChoice } from "@/lib/types";

interface GameCommandContext {
  now: number;
  actorPlayerId?: string;
}

export type GameActionPayload = Record<string, unknown>;

type GameCommand = {
  type: string;
  [key: string]: unknown;
};

export interface GameRoundResult {
  wasClosed: boolean;
  matchedPlayerIds: string[];
  leaderPlayerId?: string;
}

export interface GameDefinition {
  gameType: string;
  supportsBots?: boolean;
  /**
   * Caps how many players actively take part. Members beyond this seat
   * spectate, and bots can't be added once it's reached. Leave unset for games
   * where every room member plays (the room-wide MAX_ROOM_PLAYERS still
   * applies). Keeping this on the definition lets the lobby/bot rules stay
   * game-agnostic instead of special-casing individual game types.
   */
  maxActivePlayers?: number;
  /**
   * When set, a single seat-filler bot is auto-added on room creation. Used by
   * solo games (e.g. Tarot) so the room satisfies the codebase's 2-player Start
   * conventions without special-casing the lobby/start flow.
   */
  autoFillBot?: boolean;
  createInitialState(args: { players: Player[]; now: number }): GameState;
  parseAction?(payload: GameActionPayload): GameCommand | null;
  applyCommand(args: {
    room: Room;
    state: GameState;
    command: GameCommand;
    context: GameCommandContext;
  }): GameState;
  closeRound(args: { room: Room; state: GameState; now: number }): { nextState: GameState; result: GameRoundResult };
  shouldAdvanceTime?(state: GameState): boolean;
  applyBots?(args: { room: Room; state: GameState; now: number }): GameState;
}

export interface BotRuntimeContext {
  botPlayerId: string;
  room: Room;
  state: GameState;
  now: number;
  roundChoices: Record<string, RoundChoice>;
}

export interface BotStrategy {
  gameType: string;
  botKey: string;
  chooseDirection(ctx: BotRuntimeContext): Direction;
}
