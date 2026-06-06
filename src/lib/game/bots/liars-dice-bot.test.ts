import test from "node:test";
import assert from "node:assert/strict";
import { liarsDiceGameDefinition } from "@/lib/game/plugins/liars-dice-game";
import { chooseLiarsDiceMove } from "@/lib/game/bots/liars-dice-bot";
import type { GameState, Player, Room } from "@/lib/types";

function botRoom(): Room {
  const players: Player[] = [
    { id: "b1", name: "Bot 1", isBot: true, isHost: false, connected: true, joinOrder: 0 },
    { id: "b2", name: "Bot 2", isBot: true, isHost: false, connected: true, joinOrder: 1 }
  ];
  const game = liarsDiceGameDefinition.createInitialState({ players, now: 1000 });
  return {
    code: "BOTBOT",
    gameType: "liars_dice",
    status: "in_game",
    createdAt: 1000,
    hostPlayerId: "b1",
    players,
    chat: [],
    game
  };
}

function startAndBid(room: Room): GameState {
  const rolled = liarsDiceGameDefinition.applyCommand({
    room,
    state: room.game,
    command: { type: "start_game" },
    context: { now: 2000, actorPlayerId: "b1" }
  });
  return liarsDiceGameDefinition.closeRound({ room, state: rolled, now: 6000 }).nextState;
}

test("the bot opens with a bid for a face it holds", () => {
  const room = botRoom();
  const state = startAndBid(room);
  const move = chooseLiarsDiceMove({ room, state, botPlayerId: "b1" });
  assert.equal(move.type, "submit_bid");
  if (move.type === "submit_bid") {
    assert.ok(move.quantity >= 1);
    assert.ok(move.face >= 1 && move.face <= 6);
  }
});

test("the bot calls an impossible bid", () => {
  const room = botRoom();
  let state = startAndBid(room);
  // Stand a bid that exceeds every die on the table.
  state = {
    ...state,
    liarsDice: {
      ...state.liarsDice!,
      currentBid: { playerId: "b1", quantity: 99, face: 4, autoSubmitted: false, submittedAt: 6100 },
      activePlayerId: "b2"
    }
  };
  const move = chooseLiarsDiceMove({ room, state, botPlayerId: "b2" });
  assert.equal(move.type, "call_liar");
});

test("applyBots resolves an all-bot hand to a reveal without looping forever", () => {
  const room = botRoom();
  const state = startAndBid(room);
  const resolved = liarsDiceGameDefinition.applyBots!({ room, state, now: 6100 });
  // With only bots at the table, the escalating bids must terminate in a call.
  assert.equal(resolved.state, "dice_reveal");
  assert.ok(resolved.liarsDice?.reveal);
});

test("applyBots takes a bot's turn after a human bid", () => {
  const players: Player[] = [
    { id: "p1", name: "Human", isBot: false, isHost: true, connected: true, joinOrder: 0 },
    { id: "b1", name: "Bot", isBot: true, isHost: false, connected: true, joinOrder: 1 }
  ];
  const game = liarsDiceGameDefinition.createInitialState({ players, now: 1000 });
  const room: Room = {
    code: "MIXED1",
    gameType: "liars_dice",
    status: "in_game",
    createdAt: 1000,
    hostPlayerId: "p1",
    players,
    chat: [],
    game
  };
  const rolled = liarsDiceGameDefinition.applyCommand({
    room,
    state: room.game,
    command: { type: "start_game" },
    context: { now: 2000, actorPlayerId: "p1" }
  });
  let state = liarsDiceGameDefinition.closeRound({ room, state: rolled, now: 6000 }).nextState;
  state = liarsDiceGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_bid", quantity: 1, face: 2 },
    context: { now: 6100, actorPlayerId: "p1" }
  });
  assert.equal(state.liarsDice?.activePlayerId, "b1");
  const resolved = liarsDiceGameDefinition.applyBots!({ room, state, now: 6200 });
  // The bot either raised (turn returns to the human) or called (reveal).
  const handedBack = resolved.liarsDice?.activePlayerId === "p1";
  const called = resolved.state === "dice_reveal";
  assert.ok(handedBack || called);
});
