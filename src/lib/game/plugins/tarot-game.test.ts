import test from "node:test";
import assert from "node:assert/strict";
import { drawSpread, tarotGameDefinition } from "@/lib/game/plugins/tarot-game";
import { TAROT_CARDS_BY_ID, TAROT_POSITIONS } from "@/lib/game/plugins/tarot-data";
import type { GameState, Player, Room } from "@/lib/types";

function createPlayers(): Player[] {
  return [
    { id: "p1", name: "Seeker", isBot: false, isHost: true, connected: true, joinOrder: 0 },
    { id: "reader", name: "The Reader", isBot: true, isHost: false, connected: true, joinOrder: 1 }
  ];
}

function createRoom(players: Player[]): Room {
  const game = tarotGameDefinition.createInitialState({ players, now: 1000 });
  return {
    code: "ABCDEF",
    gameType: "tarot",
    status: "in_game",
    createdAt: 1000,
    hostPlayerId: "p1",
    players,
    chat: [],
    game
  };
}

function apply(room: Room, state: GameState, command: { type: string; [key: string]: unknown }): GameState {
  return tarotGameDefinition.applyCommand({
    room,
    state,
    command,
    context: { now: 2000, actorPlayerId: "p1" }
  });
}

test("drawSpread is deterministic for the same name + question", () => {
  const a = drawSpread("Ada", "Will the project ship?");
  const b = drawSpread("Ada", "Will the project ship?");
  assert.deepEqual(a, b);
});

test("drawSpread changes when the question changes", () => {
  const a = drawSpread("Ada", "Will the project ship?");
  const b = drawSpread("Ada", "Should I take the new job?");
  assert.notDeepEqual(a, b);
});

test("drawSpread fills every position with a valid, non-repeating card", () => {
  const spread = drawSpread("Ada", "What lies ahead?");
  assert.equal(spread.length, TAROT_POSITIONS.length);
  spread.forEach((card, index) => {
    assert.equal(card.positionLabel, TAROT_POSITIONS[index]);
    assert.ok(TAROT_CARDS_BY_ID[card.cardId], `unknown card ${card.cardId}`);
    assert.equal(typeof card.reversed, "boolean");
  });
  const uniqueCards = new Set(spread.map((card) => card.cardId));
  assert.equal(uniqueCards.size, spread.length);
});

test("start_game moves into setup, submit_seeds draws, flipping reaches finished", () => {
  const room = createRoom(createPlayers());

  let state = apply(room, room.game, { type: "start_game" });
  assert.equal(state.state, "tarot_setup");

  state = apply(room, state, { type: "submit_seeds", seekerName: "Ada", question: "What lies ahead?" });
  assert.equal(state.state, "tarot_reading");
  assert.equal(state.tarot?.cards.length, TAROT_POSITIONS.length);
  assert.equal(state.tarot?.revealedCount, 0);
  assert.deepEqual(
    state.tarot?.cards,
    drawSpread("Ada", "What lies ahead?")
  );

  const total = state.tarot?.cards.length ?? 0;
  for (let i = 1; i <= total; i += 1) {
    state = apply(room, state, { type: "flip_card" });
    assert.equal(state.tarot?.revealedCount, i);
    assert.equal(state.state, i >= total ? "finished" : "tarot_reading");
  }

  // Flipping past the end is a no-op.
  const after = apply(room, state, { type: "flip_card" });
  assert.equal(after.version, state.version);
  assert.equal(after.state, "finished");
});

test("parseAction rejects empty seeds and unknown actions", () => {
  assert.throws(() => tarotGameDefinition.parseAction?.({ action: "submit_seeds", seekerName: " ", question: "x" }));
  assert.equal(tarotGameDefinition.parseAction?.({ action: "nope" }), null);
  assert.deepEqual(tarotGameDefinition.parseAction?.({ action: "flip_card" }), { type: "flip_card" });
});

test("shouldAdvanceTime is always false (no deadlines)", () => {
  const room = createRoom(createPlayers());
  assert.equal(tarotGameDefinition.shouldAdvanceTime?.(room.game), false);
});
