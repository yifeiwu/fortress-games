import { createRoundSeed, mulberry32, stringToSeed } from "@/lib/game/rng";
import { chooseLiarsDiceMove } from "@/lib/game/bots/liars-dice-bot";
import {
  DICE_PER_PLAYER,
  DIE_FACES,
  LIARS_DICE_PHASE_DURATIONS_MS,
  isHigherBid,
  liveDicePlayers,
  minLegalRaise,
  nextLivePlayerId,
  tableFaceCount,
  totalDiceInPlay
} from "@/lib/game/plugins/liars-dice-rules";
import type { GameDefinition, GameRoundResult } from "@/lib/game/contracts";
import type {
  GameState,
  LiarsDiceBid,
  LiarsDiceGameState,
  LiarsDiceLogEntry,
  LiarsDicePlayerState,
  Player,
  Room
} from "@/lib/types";

const NO_RESULT: GameRoundResult = { wasClosed: false, matchedPlayerIds: [] };

/**
 * Deterministically rolls a player's dice for a round from the committed seed.
 * The same seed/round/player always yields the same dice, so the reveal can be
 * verified against the published seed hash (no roll was fabricated after bids).
 */
function rollDice(seedPlain: string | undefined, roundIndex: number, playerId: string, count: number): number[] {
  const rand = mulberry32(stringToSeed(`${seedPlain ?? "fallback"}:${roundIndex}:${playerId}`));
  const dice: number[] = [];
  for (let i = 0; i < count; i += 1) {
    dice.push(Math.floor(rand() * DIE_FACES) + 1);
  }
  return dice;
}

function createEmptyScores(players: Player[]): Record<string, number> {
  const scores: Record<string, number> = {};
  players.forEach((player) => {
    scores[player.id] = 0;
  });
  return scores;
}

/** Mirror each player's remaining dice into the generic score map. */
function scoresFromDice(players: LiarsDicePlayerState[]): Record<string, number> {
  const scores: Record<string, number> = {};
  players.forEach((player) => {
    scores[player.playerId] = player.diceCount;
  });
  return scores;
}

function appendLog(log: LiarsDiceLogEntry[], message: string, roundIndex: number): LiarsDiceLogEntry[] {
  const entry: LiarsDiceLogEntry = {
    id: `ld-log-${Date.now()}-${log.length}`,
    message,
    roundIndex
  };
  return [entry, ...log].slice(0, 60);
}

function rollAllPlayers(players: LiarsDicePlayerState[], seedPlain: string | undefined, roundIndex: number): LiarsDicePlayerState[] {
  return players.map((player) =>
    player.eliminated
      ? { ...player, dice: [] }
      : { ...player, dice: rollDice(seedPlain, roundIndex, player.playerId, player.diceCount) }
  );
}

function seedRecord(roundIndex: number) {
  const seed = createRoundSeed();
  return {
    roundIndex,
    seedHash: seed.seedHash,
    seedPlain: seed.seedPlain,
    rngAlgo: "mulberry32" as const
  };
}

/** Builds the fresh dice roster from the current room and rolls round 0. */
function beginMatch(room: Room, state: GameState, now: number): GameState {
  const seed = seedRecord(0);
  const dicePlayers: LiarsDicePlayerState[] = room.players.map((player) => ({
    playerId: player.id,
    diceCount: DICE_PER_PLAYER,
    dice: rollDice(seed.seedPlain, 0, player.id, DICE_PER_PLAYER),
    eliminated: false
  }));
  const starter = room.players[0]?.id;
  const liarsDice: LiarsDiceGameState = {
    players: dicePlayers,
    activePlayerId: starter,
    startPlayerId: starter,
    currentBid: undefined,
    reveal: undefined,
    log: appendLog([], "The cups are shaken — bidding begins.", 0)
  };
  return {
    ...state,
    state: "dice_roll",
    roundIndex: 0,
    maxRounds: 999,
    roundDeadlineAt: now + LIARS_DICE_PHASE_DURATIONS_MS.dice_roll,
    scores: scoresFromDice(dicePlayers),
    liarsDice,
    version: state.version + 1
  };
}

function placeBid(room: Room, state: GameState, bid: LiarsDiceBid, now: number): GameState {
  const liars = state.liarsDice;
  if (!liars) return state;
  const nextActive = nextLivePlayerId(room, state, bid.playerId);
  return {
    ...state,
    roundDeadlineAt: now + LIARS_DICE_PHASE_DURATIONS_MS.bidding,
    liarsDice: {
      ...liars,
      currentBid: bid,
      activePlayerId: nextActive,
      log: appendLog(
        liars.log,
        `Bid raised to ${bid.quantity} × ${bid.face}'s${bid.autoSubmitted ? " (auto)" : ""}.`,
        state.roundIndex
      )
    },
    version: state.version + 1
  };
}

/** Resolves a "Liar!" call: counts the table, knocks a die off the loser. */
function resolveCall(room: Room, state: GameState, now: number): GameState {
  const liars = state.liarsDice;
  if (!liars?.currentBid || !liars.activePlayerId) return state;
  const bid = liars.currentBid;
  const callerPlayerId = liars.activePlayerId;
  const actualCount = tableFaceCount(liars.players, bid.face);
  const bidHeld = actualCount >= bid.quantity;
  const loserPlayerId = bidHeld ? callerPlayerId : bid.playerId;

  const diceSnapshot: Record<string, number[]> = {};
  liars.players.forEach((player) => {
    diceSnapshot[player.playerId] = [...player.dice];
  });

  let loserEliminated = false;
  const players = liars.players.map((player) => {
    if (player.playerId !== loserPlayerId) return player;
    const diceCount = Math.max(0, player.diceCount - 1);
    loserEliminated = diceCount === 0;
    return { ...player, diceCount, eliminated: diceCount === 0 };
  });

  const callerName = callerPlayerId;
  const message = bidHeld
    ? `Call failed — ${bid.quantity} × ${bid.face}'s held (${actualCount} on the table). Caller loses a die.`
    : `Bluff caught — only ${actualCount} × ${bid.face}'s (bid ${bid.quantity}). Bidder loses a die.`;

  return {
    ...state,
    state: "dice_reveal",
    roundDeadlineAt: now + LIARS_DICE_PHASE_DURATIONS_MS.dice_reveal,
    scores: scoresFromDice(players),
    rngByRound: {
      ...state.rngByRound,
      [state.roundIndex]: {
        ...state.rngByRound[state.roundIndex],
        revealedAt: now
      }
    },
    liarsDice: {
      ...liars,
      players,
      activePlayerId: undefined,
      // The loser opens next round; if knocked out, the seat after them does.
      startPlayerId: loserEliminated
        ? nextLivePlayerId(room, { ...state, liarsDice: { ...liars, players } }, loserPlayerId)
        : loserPlayerId,
      reveal: {
        bid,
        callerPlayerId: callerName,
        actualCount,
        bidHeld,
        loserPlayerId,
        loserEliminated,
        dice: diceSnapshot
      },
      log: appendLog(liars.log, message, state.roundIndex)
    },
    version: state.version + 1
  };
}

/** dice_roll → bidding once the rolling beat elapses. */
function openBidding(state: GameState, now: number): GameState {
  const liars = state.liarsDice;
  if (!liars) return state;
  return {
    ...state,
    state: "bidding",
    roundDeadlineAt: now + LIARS_DICE_PHASE_DURATIONS_MS.bidding,
    liarsDice: {
      ...liars,
      activePlayerId: liars.startPlayerId
    },
    version: state.version + 1
  };
}

/** dice_reveal → next round (re-roll) or finished (one player standing). */
function advanceAfterReveal(room: Room, state: GameState, now: number): GameState {
  const liars = state.liarsDice;
  if (!liars) return state;
  const live = liveDicePlayers(room, state);
  if (live.length <= 1) {
    const winner = live[0]?.playerId;
    return {
      ...state,
      state: "finished",
      roundDeadlineAt: undefined,
      liarsDice: {
        ...liars,
        activePlayerId: undefined,
        currentBid: undefined,
        reveal: undefined,
        winnerPlayerId: winner,
        log: appendLog(liars.log, "Last player standing wins the hoard.", state.roundIndex)
      },
      version: state.version + 1
    };
  }

  const nextRound = state.roundIndex + 1;
  const seed = seedRecord(nextRound);
  const players = rollAllPlayers(liars.players, seed.seedPlain, nextRound);
  const starter = liars.startPlayerId ?? live[0].playerId;
  return {
    ...state,
    state: "dice_roll",
    roundIndex: nextRound,
    roundDeadlineAt: now + LIARS_DICE_PHASE_DURATIONS_MS.dice_roll,
    scores: scoresFromDice(players),
    rngByRound: {
      ...state.rngByRound,
      [nextRound]: seed
    },
    liarsDice: {
      ...liars,
      players,
      currentBid: undefined,
      reveal: undefined,
      activePlayerId: starter,
      startPlayerId: starter,
      log: appendLog(liars.log, "New round — the cups are shaken again.", nextRound)
    },
    version: state.version + 1
  };
}

/** Auto-action for a player who let the bidding timer run out. Never auto-calls. */
function autoBidOnTimeout(room: Room, state: GameState, now: number): GameState {
  const liars = state.liarsDice;
  if (!liars?.activePlayerId) return state;
  const active = liars.activePlayerId;
  const totalDice = totalDiceInPlay(liars.players);

  if (!liars.currentBid) {
    const bid: LiarsDiceBid = {
      playerId: active,
      quantity: 1,
      face: 2,
      autoSubmitted: true,
      submittedAt: now
    };
    return placeBid(room, state, bid, now);
  }

  const raise = minLegalRaise(liars.currentBid, totalDice);
  if (!raise) {
    // Bid is already maxed and the idler can't raise — force a call so play moves on.
    return resolveCall(room, state, now);
  }
  const bid: LiarsDiceBid = {
    playerId: active,
    quantity: raise.quantity,
    face: raise.face,
    autoSubmitted: true,
    submittedAt: now
  };
  return placeBid(room, state, bid, now);
}

export const liarsDiceGameDefinition: GameDefinition = {
  gameType: "liars_dice",
  supportsBots: true,
  createInitialState(args) {
    return {
      gameType: "liars_dice",
      state: "waiting",
      roundIndex: 0,
      maxRounds: 1,
      scores: createEmptyScores(args.players),
      choicesByRound: {},
      rngByRound: {},
      liarsDice: {
        players: [],
        log: []
      },
      version: 1
    };
  },
  parseAction(payload) {
    if (payload.action === "submit_bid") {
      const quantity = Number(payload.quantity);
      const face = Number(payload.face);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error("Bid quantity must be a positive whole number.");
      }
      if (!Number.isInteger(face) || face < 1 || face > DIE_FACES) {
        throw new Error("Bid face must be between 1 and 6.");
      }
      return { type: "submit_bid", quantity, face };
    }
    if (payload.action === "call_liar") {
      return { type: "call_liar" };
    }
    return null;
  },
  applyCommand({ room, state, command, context }) {
    if (command.type === "start_game" && state.state === "waiting") {
      return beginMatch(room, state, context.now);
    }

    const liars = state.liarsDice;
    const now = context.now;
    const actor = context.actorPlayerId;

    if (command.type === "submit_bid" && liars && state.state === "bidding") {
      if (!actor || actor !== liars.activePlayerId) return state;
      if (state.roundDeadlineAt && now > state.roundDeadlineAt) return state;
      const quantity = Number(command.quantity);
      const face = Number(command.face);
      const totalDice = totalDiceInPlay(liars.players);
      if (quantity > totalDice) {
        throw new Error(`You can't bid more than ${totalDice} dice.`);
      }
      if (liars.currentBid && !isHigherBid({ quantity, face }, liars.currentBid)) {
        throw new Error("A raise must increase the quantity, or keep it and raise the face.");
      }
      const bid: LiarsDiceBid = { playerId: actor, quantity, face, autoSubmitted: false, submittedAt: now };
      return placeBid(room, state, bid, now);
    }

    if (command.type === "call_liar" && liars && state.state === "bidding") {
      if (!actor || actor !== liars.activePlayerId) return state;
      if (!liars.currentBid) {
        throw new Error("There's no bid to call yet — you must open with a bid.");
      }
      return resolveCall(room, state, now);
    }

    return state;
  },
  closeRound({ room, state, now }) {
    if (state.state === "dice_roll") {
      return { nextState: openBidding(state, now), result: NO_RESULT };
    }
    if (state.state === "bidding") {
      return { nextState: autoBidOnTimeout(room, state, now), result: { ...NO_RESULT, wasClosed: true } };
    }
    if (state.state === "dice_reveal") {
      return { nextState: advanceAfterReveal(room, state, now), result: { ...NO_RESULT, wasClosed: true } };
    }
    return { nextState: state, result: NO_RESULT };
  },
  shouldAdvanceTime(state) {
    return state.state === "dice_roll" || state.state === "bidding" || state.state === "dice_reveal";
  },
  applyBots({ room, state, now }) {
    if (state.state !== "bidding") return state;
    let nextState = state;
    // Resolve consecutive bot turns in one pass (a bot's raise can hand the turn
    // straight to another bot). Bounded by the finite bid space + live seat count.
    for (let guard = 0; guard < 64; guard += 1) {
      const liars = nextState.liarsDice;
      if (!liars || nextState.state !== "bidding") break;
      const activeId = liars.activePlayerId;
      const activePlayer = room.players.find((player) => player.id === activeId);
      if (!activePlayer?.isBot) break;
      const move = chooseLiarsDiceMove({ room, state: nextState, botPlayerId: activePlayer.id });
      nextState = liarsDiceGameDefinition.applyCommand({
        room,
        state: nextState,
        command: move,
        context: { now, actorPlayerId: activePlayer.id }
      });
    }
    return nextState;
  }
};
