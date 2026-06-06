import test from "node:test";
import assert from "node:assert/strict";
import { liarsDiceGameDefinition } from "@/lib/game/plugins/liars-dice-game";
import type { GameState, Player, Room } from "@/lib/types";

function createPlayers(count = 2): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `P${i + 1}`,
    isBot: false,
    isHost: i === 0,
    connected: true,
    joinOrder: i
  }));
}

function createRoom(players: Player[]): Room {
  const game = liarsDiceGameDefinition.createInitialState({ players, now: 1000 });
  return {
    code: "ABCDEF",
    gameType: "liars_dice",
    status: "in_game",
    createdAt: 1000,
    hostPlayerId: players[0].id,
    players,
    chat: [],
    game
  };
}

/** Start the match and advance the rolling beat into the bidding phase. */
function startAndBid(room: Room): GameState {
  const rolled = liarsDiceGameDefinition.applyCommand({
    room,
    state: room.game,
    command: { type: "start_game" },
    context: { now: 2000, actorPlayerId: "p1" }
  });
  return liarsDiceGameDefinition.closeRound({ room, state: rolled, now: 6000 }).nextState;
}

/** Overwrite each player's dice with fixed values for deterministic counts. */
function setDice(state: GameState, dice: Record<string, number[]>): GameState {
  const players = (state.liarsDice?.players ?? []).map((player) => ({
    ...player,
    dice: dice[player.playerId] ?? player.dice,
    diceCount: dice[player.playerId]?.length ?? player.diceCount
  }));
  return { ...state, liarsDice: { ...state.liarsDice!, players } };
}

test("start_game deals five dice to each player and opens the rolling phase", () => {
  const room = createRoom(createPlayers());
  const state = liarsDiceGameDefinition.applyCommand({
    room,
    state: room.game,
    command: { type: "start_game" },
    context: { now: 2000, actorPlayerId: "p1" }
  });
  assert.equal(state.state, "dice_roll");
  assert.equal(state.liarsDice?.players.length, 2);
  for (const player of state.liarsDice!.players) {
    assert.equal(player.diceCount, 5);
    assert.equal(player.dice.length, 5);
    assert.equal(state.scores[player.playerId], 5);
  }
});

test("rolling phase opens bidding with the starting player active", () => {
  const room = createRoom(createPlayers());
  const state = startAndBid(room);
  assert.equal(state.state, "bidding");
  assert.equal(state.liarsDice?.activePlayerId, "p1");
  assert.equal(state.liarsDice?.currentBid, undefined);
});

test("a bid passes the turn and a raise must be strictly higher", () => {
  const room = createRoom(createPlayers());
  let state = startAndBid(room);
  state = liarsDiceGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_bid", quantity: 2, face: 3 },
    context: { now: 6100, actorPlayerId: "p1" }
  });
  assert.equal(state.liarsDice?.activePlayerId, "p2");
  assert.deepEqual(
    { quantity: state.liarsDice?.currentBid?.quantity, face: state.liarsDice?.currentBid?.face },
    { quantity: 2, face: 3 }
  );

  // Not higher → rejected.
  assert.throws(() =>
    liarsDiceGameDefinition.applyCommand({
      room,
      state,
      command: { type: "submit_bid", quantity: 2, face: 3 },
      context: { now: 6200, actorPlayerId: "p2" }
    })
  );

  // Same quantity, higher face → allowed.
  const raised = liarsDiceGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_bid", quantity: 2, face: 4 },
    context: { now: 6200, actorPlayerId: "p2" }
  });
  assert.equal(raised.liarsDice?.activePlayerId, "p1");
});

test("a bid out of turn is ignored", () => {
  const room = createRoom(createPlayers());
  const state = startAndBid(room);
  const after = liarsDiceGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_bid", quantity: 1, face: 2 },
    context: { now: 6100, actorPlayerId: "p2" }
  });
  assert.equal(after.liarsDice?.currentBid, undefined);
  assert.equal(after.liarsDice?.activePlayerId, "p1");
});

test("calling a true bid costs the caller a die", () => {
  const room = createRoom(createPlayers());
  let state = startAndBid(room);
  state = setDice(state, { p1: [3, 3, 1, 1, 1], p2: [3, 2, 2, 2, 2] }); // three 3s on the table
  state = liarsDiceGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_bid", quantity: 2, face: 3 },
    context: { now: 6100, actorPlayerId: "p1" }
  });
  state = liarsDiceGameDefinition.applyCommand({
    room,
    state,
    command: { type: "call_liar" },
    context: { now: 6200, actorPlayerId: "p2" }
  });
  assert.equal(state.state, "dice_reveal");
  assert.equal(state.liarsDice?.reveal?.bidHeld, true);
  assert.equal(state.liarsDice?.reveal?.actualCount, 3);
  assert.equal(state.liarsDice?.reveal?.loserPlayerId, "p2");
  assert.equal(state.liarsDice?.players.find((p) => p.playerId === "p2")?.diceCount, 4);
  assert.equal(state.liarsDice?.players.find((p) => p.playerId === "p1")?.diceCount, 5);
});

test("calling a bluff costs the bidder a die", () => {
  const room = createRoom(createPlayers());
  let state = startAndBid(room);
  state = setDice(state, { p1: [3, 3, 1, 1, 1], p2: [3, 2, 2, 2, 2] }); // three 3s on the table
  state = liarsDiceGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_bid", quantity: 5, face: 3 },
    context: { now: 6100, actorPlayerId: "p1" }
  });
  state = liarsDiceGameDefinition.applyCommand({
    room,
    state,
    command: { type: "call_liar" },
    context: { now: 6200, actorPlayerId: "p2" }
  });
  assert.equal(state.liarsDice?.reveal?.bidHeld, false);
  assert.equal(state.liarsDice?.reveal?.loserPlayerId, "p1");
  assert.equal(state.liarsDice?.players.find((p) => p.playerId === "p1")?.diceCount, 4);
});

test("a timed-out player auto-raises and never auto-calls", () => {
  const room = createRoom(createPlayers());
  let state = startAndBid(room);
  state = liarsDiceGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_bid", quantity: 1, face: 6 },
    context: { now: 6100, actorPlayerId: "p1" }
  });
  // p2 idles out: face is maxed (6), so the minimal raise bumps quantity to 2 face 1.
  const closed = liarsDiceGameDefinition.closeRound({ room, state, now: 999_999 }).nextState;
  assert.equal(closed.state, "bidding");
  assert.equal(closed.liarsDice?.currentBid?.autoSubmitted, true);
  assert.deepEqual(
    { quantity: closed.liarsDice?.currentBid?.quantity, face: closed.liarsDice?.currentBid?.face },
    { quantity: 2, face: 1 }
  );
  assert.equal(closed.liarsDice?.activePlayerId, "p1");
});

test("the opener auto-bids when the timer runs out with no standing bid", () => {
  const room = createRoom(createPlayers());
  const state = startAndBid(room);
  const closed = liarsDiceGameDefinition.closeRound({ room, state, now: 999_999 }).nextState;
  assert.equal(closed.state, "bidding");
  assert.equal(closed.liarsDice?.currentBid?.playerId, "p1");
  assert.equal(closed.liarsDice?.currentBid?.autoSubmitted, true);
});

test("knocking a player to zero dice ends the match", () => {
  const room = createRoom(createPlayers());
  let state = startAndBid(room);
  state = setDice(state, { p1: [3, 3, 3, 3, 3], p2: [3] }); // p2 down to its last die
  state = liarsDiceGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_bid", quantity: 1, face: 3 },
    context: { now: 6100, actorPlayerId: "p1" }
  });
  state = liarsDiceGameDefinition.applyCommand({
    room,
    state,
    command: { type: "call_liar" }, // true bid → caller p2 loses its last die
    context: { now: 6200, actorPlayerId: "p2" }
  });
  assert.equal(state.liarsDice?.reveal?.loserEliminated, true);
  const finished = liarsDiceGameDefinition.closeRound({ room, state, now: 999_999 }).nextState;
  assert.equal(finished.state, "finished");
  assert.equal(finished.liarsDice?.winnerPlayerId, "p1");
});

test("the reveal advances into a fresh round when players remain", () => {
  const room = createRoom(createPlayers(3));
  let state = startAndBid(room);
  state = setDice(state, { p1: [3, 3, 1, 1, 1], p2: [2, 2, 2, 2, 2], p3: [4, 4, 4, 4, 4] });
  state = liarsDiceGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_bid", quantity: 9, face: 3 },
    context: { now: 6100, actorPlayerId: "p1" }
  });
  state = liarsDiceGameDefinition.applyCommand({
    room,
    state,
    command: { type: "call_liar" },
    context: { now: 6200, actorPlayerId: "p2" }
  });
  const next = liarsDiceGameDefinition.closeRound({ room, state, now: 999_999 }).nextState;
  assert.equal(next.state, "dice_roll");
  assert.equal(next.roundIndex, 1);
  // p1 bluffed and lost a die, so p1 opens the next round.
  assert.equal(next.liarsDice?.startPlayerId, "p1");
  assert.equal(next.liarsDice?.players.find((p) => p.playerId === "p1")?.diceCount, 4);
});
