// Rules and helpers for Liar's Dice. Intentionally a pure module with no
// Node-only imports so it can be shared by both the server plugin and the
// client UI. Seeded dice rolling (which needs the crypto-backed RNG) lives in
// the server-only plugin module instead.

import type { GameState, LiarsDicePlayerState, Room } from "@/lib/types";

/** Cups each player starts with. */
export const DICE_PER_PLAYER = 5;
export const DIE_FACES = 6;

export const LIARS_DICE_PHASE_DURATIONS_MS = {
  /** Brief "rolling the cups" beat before bidding opens. */
  dice_roll: 3_000,
  /** Per-turn timer for a raise or a call. */
  bidding: 30_000,
  /** How long the table stays revealed after a call resolves. */
  dice_reveal: 5_000
} as const;

/** Counts how many of `dice` show `face` (no wilds — exact matches only). */
export function countFace(dice: number[], face: number): number {
  return dice.reduce((total, die) => (die === face ? total + 1 : total), 0);
}

/** Total dice still in play across every non-eliminated player. */
export function totalDiceInPlay(players: LiarsDicePlayerState[]): number {
  return players.reduce((total, player) => total + (player.eliminated ? 0 : player.diceCount), 0);
}

/** Count of `face` across the whole table (all players' current dice). */
export function tableFaceCount(players: LiarsDicePlayerState[], face: number): number {
  return players.reduce((total, player) => total + countFace(player.dice, face), 0);
}

/**
 * A bid is strictly higher when its (quantity, face) pair is lexicographically
 * greater: raise the quantity (any face), or hold the quantity and raise the
 * face.
 */
export function isHigherBid(next: { quantity: number; face: number }, prev: { quantity: number; face: number }): boolean {
  if (next.quantity !== prev.quantity) return next.quantity > prev.quantity;
  return next.face > prev.face;
}

/** The smallest legal raise over `prev`, capped at the dice left on the table. */
export function minLegalRaise(
  prev: { quantity: number; face: number },
  totalDice: number
): { quantity: number; face: number } | null {
  if (prev.face < DIE_FACES) {
    return { quantity: prev.quantity, face: prev.face + 1 };
  }
  if (prev.quantity < totalDice) {
    return { quantity: prev.quantity + 1, face: 1 };
  }
  return null;
}

/**
 * Players still in the hand, in seated (join) order, restricted to those who
 * are both non-eliminated and still present in the room. Left players are
 * skipped so the turn never stalls on an absent seat.
 */
export function liveDicePlayers(room: Room, state: GameState): LiarsDicePlayerState[] {
  const dice = state.liarsDice?.players ?? [];
  const order = new Map(room.players.map((player, index) => [player.id, index]));
  return dice
    .filter((player) => !player.eliminated && order.has(player.playerId))
    .sort((a, b) => (order.get(a.playerId) ?? 0) - (order.get(b.playerId) ?? 0));
}

/** The live player seated after `playerId` (wraps around). */
export function nextLivePlayerId(room: Room, state: GameState, playerId: string | undefined): string | undefined {
  const live = liveDicePlayers(room, state);
  if (!live.length) return undefined;
  if (!playerId) return live[0].playerId;
  const idx = live.findIndex((player) => player.playerId === playerId);
  if (idx === -1) return live[0].playerId;
  return live[(idx + 1) % live.length].playerId;
}
