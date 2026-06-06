// Rules and scoring for the Arrow game (Acchi Muite Hoi).
//
// This module is the single source of truth for the arrow game's tunable rules and
// scoring. It is intentionally a pure module with no Node-only imports so it can be
// shared by both the server-side plugin and the client UI component.

import type { Direction } from "@/lib/types";

/** The directions a player can look. */
export const ARROW_DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

/** How long each phase of a round lasts, in milliseconds. */
export const ARROW_PHASE_DURATIONS_MS = {
  intro: 3_000,
  round_open: 10_000,
  round_revealed: 4_000
} as const;

/** Points a dodger earns for looking away from the leader. */
export const ARROW_DODGE_POINTS = 1;

/**
 * Points awarded to the leader for catching `catchCount` players in a single round.
 *
 * Catching multiple players at once pays an escalating jackpot (triangular sum), so
 * reading the crowd and snaring several dodgers together is far more valuable than
 * picking off one at a time:
 *   1 catch   -> 1
 *   2 catches -> 3
 *   3 catches -> 6
 *   4 catches -> 10
 */
export function leaderCatchScore(catchCount: number): number {
  if (catchCount <= 0) return 0;
  return (catchCount * (catchCount + 1)) / 2;
}
