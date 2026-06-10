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

const FACE_PROBABILITY = 1 / DIE_FACES;

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

  // Probabilistic confidence model: how likely the table can satisfy a claim.
  const bidTruthProbability = (quantity: number, face: number): number => {
    const mine = countFace(myDice, face);
    const neededFromOthers = quantity - mine;
    return probabilityAtLeast(neededFromOthers, othersDice, FACE_PROBABILITY);
  };

  // Opening bid: claim a face the bot actually holds, sized to what it sees.
  if (!currentBid) {
    const face = bestFace(myDice, rand);
    const mine = countFace(myDice, face);
    const expectedOthers = Math.round(othersDice * FACE_PROBABILITY);
    const conservativeBias = rand() < 0.65 ? 1 : 0;
    const quantity = Math.max(1, Math.min(totalDice, mine + Math.max(0, expectedOthers - conservativeBias)));
    return { type: "submit_bid", quantity, face };
  }

  const confidenceCurrent = bidTruthProbability(currentBid.quantity, currentBid.face);
  // Smaller stacks should challenge more often; large stacks can float bluffs.
  const callThreshold = 0.22 + (myDiceCount <= 2 ? 0.08 : 0) + rand() * 0.08;
  const impossible = currentBid.quantity > totalDice;
  if (impossible || confidenceCurrent < callThreshold) {
    return { type: "call_liar" };
  }

  // Otherwise raise. Score a short horizon of legal raises by confidence, then
  // softly prefer lower overcalls so the bot doesn't inflate too wildly.
  const legalMoves = enumerateRaises(currentBid, totalDice, 16);
  let bestMove: { quantity: number; face: number } | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  legalMoves.forEach((move, index) => {
    const confidence = bidTruthProbability(move.quantity, move.face);
    const overcallPenalty = index * 0.02;
    const faceFitBonus = countFace(myDice, move.face) * 0.03;
    const score = confidence + faceFitBonus - overcallPenalty;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  });
  if (bestMove !== undefined && isHigherBid(bestMove, currentBid)) {
    return { type: "submit_bid", quantity: bestMove.quantity, face: bestMove.face };
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

function enumerateRaises(
  currentBid: { quantity: number; face: number },
  totalDice: number,
  limit: number
): Array<{ quantity: number; face: number }> {
  const raises: Array<{ quantity: number; face: number }> = [];
  let cursor = minLegalRaise(currentBid, totalDice);
  while (cursor && raises.length < limit) {
    raises.push(cursor);
    cursor = minLegalRaise(cursor, totalDice);
  }
  return raises;
}

function probabilityAtLeast(requiredSuccesses: number, trials: number, successProbability: number): number {
  if (requiredSuccesses <= 0) return 1;
  if (requiredSuccesses > trials) return 0;
  let total = 0;
  for (let successes = requiredSuccesses; successes <= trials; successes += 1) {
    total +=
      binomialCoefficient(trials, successes) *
      successProbability ** successes *
      (1 - successProbability) ** (trials - successes);
  }
  return total;
}

function binomialCoefficient(n: number, k: number): number {
  const m = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= m; i += 1) {
    result = (result * (n - m + i)) / i;
  }
  return result;
}
