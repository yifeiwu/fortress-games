import test from "node:test";
import assert from "node:assert/strict";
import { arrowBotStrategy } from "@/lib/game/bots/arrow-bot";
import type { Room } from "@/lib/types";

test("arrow bot is deterministic per seed and bot id", () => {
  const room = {
    code: "ABCDEF",
    gameType: "arrow_predict",
    status: "in_game",
    createdAt: 1,
    hostPlayerId: "host",
    players: [],
    chat: [],
    game: {
      gameType: "arrow_predict",
      state: "round_open",
      roundIndex: 0,
      maxRounds: 1,
      roundDeadlineAt: 10000,
      leaderPlayerId: "host",
      scores: {},
      choicesByRound: {},
      rngByRound: {
        0: {
          roundIndex: 0,
          seedHash: "hash",
          seedPlain: "seedA",
          rngAlgo: "mulberry32"
        }
      },
      version: 1
    }
  } as Room;

  const a = arrowBotStrategy.chooseDirection({
    botPlayerId: "bot_1",
    room,
    state: room.game,
    now: 5,
    roundChoices: {}
  });
  const b = arrowBotStrategy.chooseDirection({
    botPlayerId: "bot_1",
    room,
    state: room.game,
    now: 1000,
    roundChoices: {}
  });
  assert.equal(a, b);
});
