// ─── Arrow / Acchi Muite Hoi ─────────────────────────────────────────────────

export type Direction = "up" | "down" | "left" | "right";

/** Game phases owned by the arrow-prediction game. */
export type ArrowGameStatus = "intro" | "round_open" | "round_revealed";

export interface RoundChoice {
  playerId: string;
  direction: Direction;
  submittedAt: number;
  autoSubmitted: boolean;
}
