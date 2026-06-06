import { mulberry32, stringToSeed } from "@/lib/game/rng";
import { TAROT_CARDS, TAROT_POSITIONS } from "@/lib/game/plugins/tarot-data";
import type { GameDefinition } from "@/lib/game/contracts";
import type { GameState, Player, TarotDrawnCard } from "@/lib/types";

const MAX_NAME_LENGTH = 40;
const MAX_QUESTION_LENGTH = 200;

function createEmptyScores(players: Player[]): Record<string, number> {
  const scores: Record<string, number> = {};
  players.forEach((player) => {
    scores[player.id] = 0;
  });
  return scores;
}

/**
 * Deterministically draws the spread from the seeker's name + question. The same
 * seeds always yield the same cards and orientations, so a reading is reproducible
 * (and provably tied to what the seeker asked).
 */
export function drawSpread(seekerName: string, question: string): TarotDrawnCard[] {
  const rand = mulberry32(stringToSeed(`${seekerName}::${question}`));
  // Fisher-Yates over a copy of the deck.
  const deck = TAROT_CARDS.map((card) => card.id);
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return TAROT_POSITIONS.map((positionLabel, index) => ({
    cardId: deck[index],
    positionLabel,
    reversed: rand() < 0.4
  }));
}

function clampText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export const tarotGameDefinition: GameDefinition = {
  gameType: "tarot",
  supportsBots: false,
  autoFillBot: true,
  createInitialState(args) {
    return {
      gameType: "tarot",
      state: "waiting",
      roundIndex: 0,
      maxRounds: 1,
      scores: createEmptyScores(args.players),
      choicesByRound: {},
      rngByRound: {},
      tarot: {
        cards: [],
        revealedCount: 0
      },
      version: 1
    };
  },
  parseAction(payload) {
    if (payload.action === "submit_seeds") {
      const seekerName = clampText(payload.seekerName, MAX_NAME_LENGTH);
      const question = clampText(payload.question, MAX_QUESTION_LENGTH);
      if (!seekerName || !question) {
        throw new Error("Enter your name and a question to begin the reading.");
      }
      return { type: "submit_seeds", seekerName, question };
    }
    if (payload.action === "flip_card") {
      return { type: "flip_card" };
    }
    return null;
  },
  applyCommand({ state, command }) {
    if (command.type === "start_game" && state.state === "waiting") {
      return {
        ...state,
        state: "tarot_setup",
        tarot: { cards: [], revealedCount: 0 },
        version: state.version + 1
      };
    }

    if (command.type === "submit_seeds" && state.state === "tarot_setup") {
      const seekerName = String(command.seekerName ?? "").trim();
      const question = String(command.question ?? "").trim();
      if (!seekerName || !question) {
        return state;
      }
      return {
        ...state,
        state: "tarot_reading",
        tarot: {
          seekerName,
          question,
          cards: drawSpread(seekerName, question),
          revealedCount: 0
        },
        version: state.version + 1
      };
    }

    if (command.type === "flip_card" && state.state === "tarot_reading" && state.tarot) {
      const total = state.tarot.cards.length;
      const nextRevealed = Math.min(total, state.tarot.revealedCount + 1);
      if (nextRevealed === state.tarot.revealedCount) {
        return state;
      }
      return {
        ...state,
        state: nextRevealed >= total ? "finished" : "tarot_reading",
        tarot: {
          ...state.tarot,
          revealedCount: nextRevealed
        },
        version: state.version + 1
      };
    }

    return state;
  },
  // The reading is entirely action-driven, so there is no round to time out.
  closeRound({ state }) {
    return { nextState: state, result: { wasClosed: false, matchedPlayerIds: [] } };
  },
  shouldAdvanceTime() {
    return false;
  }
};
