import { createRoundSeed, mulberry32, stringToSeed } from "@/lib/game/rng";
import { arrowBotStrategy } from "@/lib/game/bots/arrow-bot";
import {
  ARROW_DIRECTIONS,
  ARROW_DODGE_POINTS,
  ARROW_PHASE_DURATIONS_MS,
  leaderCatchScore
} from "@/lib/game/plugins/arrow-game-rules";
import type { GameDefinition, GameRoundResult } from "@/lib/game/contracts";
import type { Direction, GameState, Room } from "@/lib/types";

function pickRandomDirection(seedPlain: string | undefined, salt: string): Direction {
  const rand = mulberry32(stringToSeed(`${seedPlain ?? "fallback"}:${salt}`));
  return ARROW_DIRECTIONS[Math.floor(rand() * ARROW_DIRECTIONS.length)];
}

function nextLeaderId(room: Room, roundIndex: number): string | undefined {
  if (!room.players.length) return undefined;
  const idx = roundIndex % room.players.length;
  return room.players[idx]?.id;
}

function createEmptyScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  players.forEach((player) => {
    scores[player.id] = 0;
  });
  return scores;
}

function finalizeRound(room: Room, state: GameState, now: number): { nextState: GameState; result: GameRoundResult } {
  if (state.state !== "round_open") {
    return { nextState: state, result: { wasClosed: false, matchedPlayerIds: [] } };
  }

  const round = state.roundIndex;
  const roundChoices = { ...(state.choicesByRound[round] ?? {}) };
  const seedPlain = state.rngByRound[round]?.seedPlain;
  const leaderPlayerId = state.leaderPlayerId;

  // The leader "points" a direction. If they idle out, point a provably-fair random way.
  let leaderDirection: Direction | undefined;
  if (leaderPlayerId) {
    leaderDirection = roundChoices[leaderPlayerId]?.direction;
    if (!leaderDirection) {
      leaderDirection = pickRandomDirection(seedPlain, `${leaderPlayerId}:leader`);
      roundChoices[leaderPlayerId] = {
        playerId: leaderPlayerId,
        direction: leaderDirection,
        submittedAt: now,
        autoSubmitted: true
      };
    }
  }

  // Non-leaders try to dodge. Anyone who freezes gets caught looking the leader's way.
  room.players.forEach((player) => {
    if (player.id === leaderPlayerId) return;
    if (!roundChoices[player.id]) {
      roundChoices[player.id] = {
        playerId: player.id,
        direction: leaderDirection ?? pickRandomDirection(seedPlain, `${player.id}:auto`),
        submittedAt: now,
        autoSubmitted: true
      };
    }
  });

  // Caught = matched the leader's direction. Dodgers (mismatch) score; the leader scores per catch.
  const matchedPlayerIds: string[] = [];
  const scores = { ...state.scores };
  if (leaderDirection && leaderPlayerId) {
    Object.values(roundChoices).forEach((choice) => {
      if (choice.playerId === leaderPlayerId) return;
      if (choice.direction === leaderDirection) {
        matchedPlayerIds.push(choice.playerId);
      } else {
        scores[choice.playerId] = (scores[choice.playerId] ?? 0) + ARROW_DODGE_POINTS;
      }
    });
    scores[leaderPlayerId] = (scores[leaderPlayerId] ?? 0) + leaderCatchScore(matchedPlayerIds.length);
  }

  const currentRng = state.rngByRound[round];
  const rngByRound = {
    ...state.rngByRound,
    [round]: {
      ...currentRng,
      revealedAt: now
    }
  };

  const nextRoundIndex = round + 1;
  const finished = nextRoundIndex >= state.maxRounds;
  let nextState: GameState;
  if (finished) {
    nextState = {
      ...state,
      state: "finished",
      roundDeadlineAt: undefined,
      choicesByRound: { ...state.choicesByRound, [round]: roundChoices },
      scores,
      rngByRound,
      version: state.version + 1
    };
  } else {
    nextState = {
      ...state,
      state: "round_revealed",
      roundDeadlineAt: now + ARROW_PHASE_DURATIONS_MS.round_revealed,
      choicesByRound: { ...state.choicesByRound, [round]: roundChoices },
      scores,
      rngByRound,
      version: state.version + 1
    };
  }

  return {
    nextState,
    result: {
      wasClosed: true,
      matchedPlayerIds,
      leaderPlayerId
    }
  };
}

function advanceFromIntro(state: GameState, now: number): GameState {
  if (state.state !== "intro") {
    return state;
  }
  return {
    ...state,
    state: "round_open",
    roundDeadlineAt: now + ARROW_PHASE_DURATIONS_MS.round_open,
    version: state.version + 1
  };
}

function advanceFromReveal(room: Room, state: GameState, now: number): GameState {
  if (state.state !== "round_revealed") {
    return state;
  }
  const nextRoundIndex = state.roundIndex + 1;
  if (nextRoundIndex >= state.maxRounds) {
    return {
      ...state,
      state: "finished",
      roundDeadlineAt: undefined,
      version: state.version + 1
    };
  }
  const nextSeed = createRoundSeed();
  return {
    ...state,
    state: "round_open",
    roundIndex: nextRoundIndex,
    leaderPlayerId: nextLeaderId(room, nextRoundIndex),
    roundDeadlineAt: now + ARROW_PHASE_DURATIONS_MS.round_open,
    rngByRound: {
      ...state.rngByRound,
      [nextRoundIndex]: {
        roundIndex: nextRoundIndex,
        seedHash: nextSeed.seedHash,
        seedPlain: nextSeed.seedPlain,
        rngAlgo: "mulberry32"
      }
    },
    version: state.version + 1
  };
}

export const arrowGameDefinition: GameDefinition = {
  gameType: "arrow_predict",
  supportsBots: true,
  createInitialState(args) {
    const maxRounds = Math.max(1, args.players.length);
    return {
      gameType: "arrow_predict",
      state: "waiting",
      roundIndex: 0,
      maxRounds,
      scores: createEmptyScores(args.players),
      choicesByRound: {},
      rngByRound: {},
      version: 1
    };
  },
  parseAction(payload) {
    if (payload.action !== "submit_direction" || typeof payload.direction !== "string") {
      return null;
    }
    const direction = parseDirection(payload.direction);
    if (!direction) {
      throw new Error("Invalid direction.");
    }
    return { type: "submit_direction", direction };
  },
  applyCommand({ room, state, command, context }) {
    if (command.type === "start_game" && state.state === "waiting") {
      const seed = createRoundSeed();
      return {
        ...state,
        state: "intro",
        roundIndex: 0,
        maxRounds: Math.max(1, room.players.length),
        leaderPlayerId: nextLeaderId(room, 0),
        roundDeadlineAt: context.now + ARROW_PHASE_DURATIONS_MS.intro,
        rngByRound: {
          0: {
            roundIndex: 0,
            seedHash: seed.seedHash,
            seedPlain: seed.seedPlain,
            rngAlgo: "mulberry32"
          }
        },
        version: state.version + 1
      };
    }

    if (
      command.type === "submit_direction" &&
      parseDirection(String(command.direction)) &&
      state.state === "round_open" &&
      context.actorPlayerId &&
      (!state.roundDeadlineAt || context.now <= state.roundDeadlineAt)
    ) {
      const existing = state.choicesByRound[state.roundIndex] ?? {};
      return {
        ...state,
        choicesByRound: {
          ...state.choicesByRound,
          [state.roundIndex]: {
            ...existing,
            [context.actorPlayerId]: {
              playerId: context.actorPlayerId,
              direction: parseDirection(String(command.direction))!,
              submittedAt: context.now,
              autoSubmitted: false
            }
          }
        },
        version: state.version + 1
      };
    }

    if (command.type === "close_round") {
      return finalizeRound(room, state, context.now).nextState;
    }

    return state;
  },
  closeRound({ room, state, now }) {
    if (state.state === "intro") {
      return {
        nextState: advanceFromIntro(state, now),
        result: { wasClosed: false, matchedPlayerIds: [], leaderPlayerId: state.leaderPlayerId }
      };
    }
    if (state.state === "round_revealed") {
      return {
        nextState: advanceFromReveal(room, state, now),
        result: { wasClosed: false, matchedPlayerIds: [], leaderPlayerId: state.leaderPlayerId }
      };
    }
    return finalizeRound(room, state, now);
  },
  shouldAdvanceTime(state) {
    return state.state === "intro" || state.state === "round_open" || state.state === "round_revealed";
  },
  applyBots({ room, state, now }) {
    if (state.state !== "round_open") return state;
    const currentRound = state.roundIndex;
    const existingChoices = state.choicesByRound[currentRound] ?? {};
    let nextState = state;
    room.players.forEach((player) => {
      const latestChoices = nextState.choicesByRound[currentRound] ?? {};
      if (!player.isBot || latestChoices[player.id]) return;
      const direction = arrowBotStrategy.chooseDirection({
        botPlayerId: player.id,
        room,
        state: nextState,
        now,
        roundChoices: existingChoices
      });
      nextState = arrowGameDefinition.applyCommand({
        room,
        state: nextState,
        command: { type: "submit_direction", direction },
        context: { now, actorPlayerId: player.id }
      });
    });
    return nextState;
  }
};

function parseDirection(input: string): Direction | null {
  if (input === "up" || input === "down" || input === "left" || input === "right") {
    return input;
  }
  return null;
}
