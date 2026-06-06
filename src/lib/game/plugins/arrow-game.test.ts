import test from "node:test";
import assert from "node:assert/strict";
import { arrowGameDefinition } from "@/lib/game/plugins/arrow-game";
import type { Player, Room } from "@/lib/types";

function createPlayers(): Player[] {
  return [
    { id: "p1", name: "A", isBot: false, isHost: true, connected: true, joinOrder: 0 },
    { id: "p2", name: "B", isBot: false, isHost: false, connected: true, joinOrder: 1 }
  ];
}

function createRoom(players: Player[]): Room {
  const game = arrowGameDefinition.createInitialState({ players, now: 1000 });
  return {
    code: "ABCDEF",
    gameType: "arrow_predict",
    status: "in_game",
    createdAt: 1000,
    hostPlayerId: "p1",
    players,
    chat: [],
    game
  };
}

function startAndOpen(room: Room) {
  const intro = arrowGameDefinition.applyCommand({
    room,
    state: room.game,
    command: { type: "start_game" },
    context: { now: 2000, actorPlayerId: "p1" }
  });
  // Advance the intro phase into the first decision round.
  return arrowGameDefinition.closeRound({ room, state: intro, now: 5000 }).nextState;
}

test("start_game opens the intro phase first", () => {
  const players = createPlayers();
  const room = createRoom(players);
  const intro = arrowGameDefinition.applyCommand({
    room,
    state: room.game,
    command: { type: "start_game" },
    context: { now: 2000, actorPlayerId: "p1" }
  });
  assert.equal(intro.state, "intro");
  const opened = arrowGameDefinition.closeRound({ room, state: intro, now: 5000 }).nextState;
  assert.equal(opened.state, "round_open");
});

test("leader catches a player who fails to dodge", () => {
  const players = createPlayers();
  const room = createRoom(players);
  let state = startAndOpen(room);
  // p1 is the leader for round 0 and points left; p2 matches it and gets caught.
  state = arrowGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_direction", direction: "left" },
    context: { now: 5100, actorPlayerId: "p1" }
  });
  state = arrowGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_direction", direction: "left" },
    context: { now: 5200, actorPlayerId: "p2" }
  });
  const round = arrowGameDefinition.closeRound({ room, state, now: 16000 });
  assert.equal(round.nextState.scores.p1, 1);
  assert.equal(round.nextState.scores.p2, 0);
  assert.deepEqual(round.result.matchedPlayerIds, ["p2"]);
});

test("leader earns an escalating jackpot for catching multiple players", () => {
  const players: Player[] = [
    { id: "p1", name: "A", isBot: false, isHost: true, connected: true, joinOrder: 0 },
    { id: "p2", name: "B", isBot: false, isHost: false, connected: true, joinOrder: 1 },
    { id: "p3", name: "C", isBot: false, isHost: false, connected: true, joinOrder: 2 }
  ];
  const room = createRoom(players);
  let state = startAndOpen(room);
  // p1 leads round 0 and points up; both p2 and p3 get caught looking up.
  for (const id of ["p1", "p2", "p3"]) {
    state = arrowGameDefinition.applyCommand({
      room,
      state,
      command: { type: "submit_direction", direction: "up" },
      context: { now: 5100, actorPlayerId: id }
    });
  }
  const round = arrowGameDefinition.closeRound({ room, state, now: 16000 });
  // 2 catches -> triangular jackpot of 3 (instead of a flat 2).
  assert.equal(round.nextState.scores.p1, 3);
  assert.equal(round.nextState.scores.p2, 0);
  assert.equal(round.nextState.scores.p3, 0);
  assert.deepEqual(round.result.matchedPlayerIds.sort(), ["p2", "p3"]);
});

test("a player who dodges the leader scores", () => {
  const players = createPlayers();
  const room = createRoom(players);
  let state = startAndOpen(room);
  state = arrowGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_direction", direction: "left" },
    context: { now: 5100, actorPlayerId: "p1" }
  });
  state = arrowGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_direction", direction: "right" },
    context: { now: 5200, actorPlayerId: "p2" }
  });
  const round = arrowGameDefinition.closeRound({ room, state, now: 16000 });
  assert.equal(round.nextState.scores.p1, 0);
  assert.equal(round.nextState.scores.p2, 1);
  assert.deepEqual(round.result.matchedPlayerIds, []);
});

test("timeout catches non-leaders looking the leader's way", () => {
  const players = createPlayers();
  const room = createRoom(players);
  let state = startAndOpen(room);
  state = arrowGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_direction", direction: "up" },
    context: { now: 5100, actorPlayerId: "p1" }
  });
  const round = arrowGameDefinition.closeRound({ room, state, now: 16000 });
  const p2Choice = round.nextState.choicesByRound[0]?.p2;
  assert.equal(p2Choice?.direction, "up");
  assert.equal(p2Choice?.autoSubmitted, true);
  assert.equal(round.nextState.scores.p1, 1);
  assert.equal(round.nextState.scores.p2, 0);
});

test("round reveals before advancing to next round", () => {
  const players = createPlayers();
  const room = createRoom(players);
  let state = startAndOpen(room);
  state = arrowGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_direction", direction: "left" },
    context: { now: 5100, actorPlayerId: "p1" }
  });
  state = arrowGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_direction", direction: "left" },
    context: { now: 5200, actorPlayerId: "p2" }
  });

  const revealed = arrowGameDefinition.closeRound({ room, state, now: 16_000 }).nextState;
  assert.equal(revealed.state, "round_revealed");
  assert.equal(revealed.roundIndex, 0);

  const next = arrowGameDefinition.closeRound({ room, state: revealed, now: 21_000 }).nextState;
  assert.equal(next.state, "round_open");
  assert.equal(next.roundIndex, 1);
});
