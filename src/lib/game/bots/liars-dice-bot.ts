import { mulberry32, stringToSeed } from "@/lib/game/rng";
import {
  DIE_FACES,
  countFace,
  isHigherBid,
  minLegalRaise,
  totalDiceInPlay
} from "@/lib/game/plugins/liars-dice-rules";
import type { GameState, LiarsDiceBid, LiarsDicePlayerState, Room } from "@/lib/types";

export type LiarsDiceBotMove =
  | { type: "submit_bid"; quantity: number; face: number }
  | { type: "call_liar" };

interface BotMoveArgs {
  room: Room;
  state: GameState;
  botPlayerId: string;
}

/** The bot's own dice for this round (empty if it isn't seated, defensively). */
function botDice(state: GameState, botPlayerId: string): LiarsDicePlayerState | undefined {
  return state.liarsDice?.players.find((player) => player.playerId === botPlayerId);
}

/**
 * A simple no-wilds estimator. The bot knows its own dice and how many dice are
 * on the table; it assumes opponents' dice are uniform (≈ 1/6 per face). It
 * calls when the standing bid clearly exceeds that estimate, otherwise nudges
 * the bid toward a face it actually holds. Seeded so its play is reproducible.
 */
export function chooseLiarsDiceMove({ room, state, botPlayerId }: BotMoveArgs): LiarsDiceBotMove {
  const liars = state.liarsDice;
  const me = botDice(state, botPlayerId);
  const players = liars?.players ?? [];
  const totalDice = totalDiceInPlay(players);
  const currentBid: LiarsDiceBid | undefined = liars?.currentBid;

  const myDice = me?.dice ?? [];
  const myDiceCount = me?.diceCount ?? myDice.length;
  const othersDice = Math.max(0, totalDice - myDiceCount);

  const rand = mulberry32(
    stringToSeed(
      `${state.rngByRound[state.roundIndex]?.seedPlain ?? "fallback"}:${botPlayerId}:${room.code}:${state.roundIndex}:${currentBid?.quantity ?? 0}:${currentBid?.face ?? 0}`
    )
  );

  // Expected total count of `face` across the table given the bot's own dice.
  const estimateForFace = (face: number) => countFace(myDice, face) + othersDice / DIE_FACES;

  // Opening bid: claim a face the bot actually holds, sized to what it sees.
  if (!currentBid) {
    const face = bestFace(myDice, rand);
    const quantity = Math.max(1, Math.round(estimateForFace(face)));
    return { type: "submit_bid", quantity: Math.min(quantity, Math.max(1, totalDice)), face };
  }

  const estimate = estimateForFace(currentBid.face);
  // Slack makes the bot bluff-tolerant and not perfectly predictable.
  const slack = 1 + rand();
  const impossible = currentBid.quantity > totalDice;
  if (impossible || currentBid.quantity > estimate + slack) {
    return { type: "call_liar" };
  }

  // Otherwise raise. Prefer a face the bot holds well; pick the minimal legal
  // raise toward it, falling back to the smallest legal raise.
  const targetFace = bestFace(myDice, rand);
  const desiredQuantity = Math.max(currentBid.quantity, Math.round(estimateForFace(targetFace)));
  const candidate = { quantity: Math.min(desiredQuantity, totalDice), face: targetFace };
  if (isHigherBid(candidate, currentBid)) {
    return { type: "submit_bid", quantity: candidate.quantity, face: candidate.face };
  }

  const minimal = minLegalRaise(currentBid, totalDice);
  if (minimal) {
    return { type: "submit_bid", quantity: minimal.quantity, face: minimal.face };
  }

  // No legal raise left (bid already maxed) — challenge instead.
  return { type: "call_liar" };
}

/** The face the bot holds the most of, breaking ties with the seeded RNG. */
function bestFace(dice: number[], rand: () => number): number {
  let bestCount = -1;
  let best = Math.floor(rand() * DIE_FACES) + 1;
  for (let face = 1; face <= DIE_FACES; face += 1) {
    const count = countFace(dice, face);
    if (count > bestCount) {
      bestCount = count;
      best = face;
    }
  }
  return best;
}
