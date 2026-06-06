import test from "node:test";
import assert from "node:assert/strict";
import { createGameSessionService, ROOM_INACTIVITY_TTL_MS } from "@/lib/game/session-service";
import { PRESENCE_STALE_AFTER_MS } from "@/lib/game/presence-tracker";
import { InMemoryGameStore } from "@/lib/store/in-memory-store";

// A last-seen this far in the past is unambiguously stale (past the presence
// window) without depending on the exact threshold value.
const STALE_AGO_MS = PRESENCE_STALE_AFTER_MS + 5_000;

test("host disconnect after game start promotes another human host", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  const created = service.createRoom("Host", "arrow_predict");
  const code = created.room.code;
  const hostId = created.playerId;
  const p2 = service.joinRoom(code, "Player2").playerId;
  service.startGame(code, hostId);

  await service.setLastSeenForTests(code, hostId, Date.now() - STALE_AGO_MS);
  await service.setLastSeenForTests(code, p2, Date.now());

  const roomAfter = await service.getRoom(code);
  assert.equal(roomAfter.status, "in_game");
  assert.equal(roomAfter.hostPlayerId, p2);
});

test("host disconnect in lobby promotes another human host", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  const created = service.createRoom("Host", "arrow_predict");
  const code = created.room.code;
  const hostId = created.playerId;
  const p2 = service.joinRoom(code, "Player2").playerId;

  await service.setLastSeenForTests(code, hostId, Date.now() - STALE_AGO_MS);
  await service.setLastSeenForTests(code, p2, Date.now());

  const roomAfter = await service.getRoom(code);
  assert.equal(roomAfter.status, "lobby");
  assert.equal(roomAfter.hostPlayerId, p2);
});

test("seed commitments are exposed but plaintext stays hidden until reveal", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  const created = service.createRoom("Host", "arrow_predict");
  const code = created.room.code;
  const hostId = created.playerId;
  service.addBot(code, hostId);
  service.startGame(code, hostId);
  const room = await service.getRoom(code);
  const firstRound = room.game.rngByRound[0];

  // Commitment hash is published so clients can verify fairness after reveal,
  // but the plaintext seed must stay hidden while the round is unresolved.
  assert.equal(typeof firstRound.seedHash, "string");
  assert.equal(firstRound.revealedAt, undefined);
  assert.equal("seedPlain" in firstRound, false);
});

test("room closes when all human players leave", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  const created = service.createRoom("Solo", "arrow_predict");
  const code = created.room.code;
  const hostId = created.playerId;
  service.addBot(code, hostId);
  const room = service.leaveRoom(code, hostId);

  assert.equal(room.status, "ended");
});

test("added bots use fortress-bot naming", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  const created = service.createRoom("Host", "arrow_predict");
  const room = service.addBot(created.room.code, created.playerId);

  assert.equal(room.players.find((player) => player.isBot)?.name, "fortress-bot 1");
});

test("username must be unique across active sessions", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  await service.setSessionUsername("session-a", "Alex");
  await assert.rejects(() => service.setSessionUsername("session-b", "alex"), /already taken/i);
});

test("setting the same username for the same session is allowed", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  await service.setSessionUsername("session-a", "Alex");
  const updated = await service.setSessionUsername("session-a", "alex");
  assert.equal(updated.username, "alex");
});

test("room lookups tolerate whitespace and lowercase codes", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  await service.setSessionUsername("session-a", "Host");
  const created = await service.createRoomForSession("session-a", "arrow_predict");
  const code = created.code;

  const joined = await service.joinRoomForSession("session-a", ` ${code.toLowerCase()} `);
  assert.equal(joined.code, code);

  const fetched = await service.getRoom(` ${code.toLowerCase()} `);
  assert.equal(fetched.code, code);
});

test("inactive rooms are cleaned up after the inactivity TTL", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  await service.setSessionUsername("session-a", "Host");
  const created = await service.createRoomForSession("session-a", "arrow_predict");
  const code = created.code;
  await service.setRoomLastActivityForTests(code, Date.now() - ROOM_INACTIVITY_TTL_MS - 60_000);

  const rooms = await service.listRooms();
  assert.equal(rooms.length, 0);
  await assert.rejects(() => service.getRoom(code), /room not found/i);
});

test("max rounds stay fixed after game starts", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  const created = service.createRoom("Host", "arrow_predict");
  const code = created.room.code;
  const hostId = created.playerId;
  const p2 = service.joinRoom(code, "Player2").playerId;
  service.joinRoom(code, "Player3");

  service.startGame(code, hostId);
  const afterStart = await service.getRoom(code);
  assert.equal(afterStart.game.maxRounds, 3);

  service.leaveRoom(code, p2);
  const afterLeave = await service.getRoom(code);
  assert.equal(afterLeave.game.maxRounds, 3);
});

test("start_game enters the intro phase", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  const created = service.createRoom("Host", "arrow_predict");
  const code = created.room.code;
  const hostId = created.playerId;
  service.joinRoom(code, "Player2");

  const room = service.startGame(code, hostId);
  assert.equal(room.game.state, "intro");
});

test("round does not resolve early when all players submit", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  const created = service.createRoom("Host", "arrow_predict");
  const code = created.room.code;
  const hostId = created.playerId;
  const p2 = service.joinRoom(code, "Player2").playerId;

  service.startGame(code, hostId);
  // Expire the intro phase so the decision round opens.
  await service.setRoundDeadlineForTests(code, Date.now() - 1);
  const opened = await service.getRoom(code);
  assert.equal(opened.game.state, "round_open");

  service.submitGameAction(code, hostId, { action: "submit_direction", direction: "left" });
  service.submitGameAction(code, p2, { action: "submit_direction", direction: "left" });

  const beforeDeadline = await service.getRoom(code);
  assert.equal(beforeDeadline.game.state, "round_open");
});

test("starting requires at least two players", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  const created = service.createRoom("Solo", "arrow_predict");
  const code = created.room.code;
  const hostId = created.playerId;

  assert.throws(() => service.startGame(code, hostId), /at least 2 players/i);

  service.addBot(code, hostId);
  const room = service.startGame(code, hostId);
  assert.equal(room.game.state, "intro");
});

test("rooms with no human players are culled on next access", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  await service.setSessionUsername("session-host", "Host");
  const created = await service.createRoomForSession("session-host", "arrow_predict");
  const code = created.code;

  await service.addBotForSession(code, "session-host");
  await service.leaveRoomForSession(code, "session-host");

  await assert.rejects(() => service.getRoom(code), /room not found/i);
});

test("starshield rooms can add fortress-bot players that take turns", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  const created = service.createRoom("Host", "spaceship_defense");
  const code = created.room.code;
  const hostId = created.playerId;
  const withBot = service.addBot(code, hostId);
  const bot = withBot.players.find((player) => player.isBot);
  assert.equal(bot?.name, "fortress-bot 1");

  service.startGame(code, hostId);
  const afterHostTurn = service.submitGameAction(code, hostId, {
    action: "submit_spaceship_action",
    spaceshipAction: "shield"
  });

  // Host acts and the bot auto-takes its turn, completing the crew round, which
  // now opens the enemy-phase reveal rather than jumping straight ahead.
  assert.equal(afterHostTurn.game.state, "enemy_phase");
  assert.equal(afterHostTurn.game.roundIndex, 0);

  // Once the reveal's deadline passes, the next crew round opens with the host
  // (not the bot) active again.
  await service.setRoundDeadlineForTests(code, Date.now() - 1);
  const nextRound = await service.getRoom(code);
  assert.equal(nextRound.game.state, "player_turn");
  assert.equal(nextRound.game.roundIndex, 1);
  assert.notEqual(nextRound.game.spaceship?.activePlayerId, bot?.id);
});

test("frankenbeasts supports bot fighters with extra spectators", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  const created = service.createRoom("Host", "frankenbeasts");
  const code = created.room.code;
  const hostId = created.playerId;
  const withBot = service.addBot(code, hostId);
  const bot = withBot.players.find((player) => player.isBot);
  assert.ok(bot);
  const spectatorId = service.joinRoom(code, "Spectator").playerId;

  const started = service.startGame(code, hostId);
  assert.deepEqual(started.game.frankenbeasts?.fighterIds, [hostId, bot.id]);
  assert.equal(started.game.frankenbeasts?.pendingPicks[bot.id]?.lockedIn, true);
  assert.equal(started.game.frankenbeasts?.pendingPicks[spectatorId], undefined);

  const afterSpectatorPick = service.submitGameAction(code, spectatorId, {
    action: "submit_pick",
    headId: "bear_head",
    bodyId: "muscle_body",
    tailId: "club_tail",
    lockIn: true
  });
  assert.equal(afterSpectatorPick.game.frankenbeasts?.pendingPicks[spectatorId], undefined);

  const fightRound = service.submitGameAction(code, hostId, {
    action: "submit_pick",
    headId: "bear_head",
    bodyId: "muscle_body",
    tailId: "club_tail",
    lockIn: true
  });
  assert.equal(fightRound.game.state, "fight_round");
  assert.ok(fightRound.game.frankenbeasts?.combatStates[bot.id]);
  assert.equal(fightRound.game.frankenbeasts?.combatStates[spectatorId], undefined);
  assert.equal(typeof fightRound.game.frankenbeasts?.roundSelections[bot.id], "string");

  const afterSpectatorAction = service.submitGameAction(code, spectatorId, {
    action: "submit_fb_action",
    abilityId: "pass"
  });
  assert.equal(afterSpectatorAction.game.frankenbeasts?.roundSelections[spectatorId], undefined);
});

test("chat is stored separately from the room payload", async () => {
  const store = new InMemoryGameStore();
  const service = createGameSessionService(store);

  await service.setSessionUsername("session-a", "Host");
  const created = await service.createRoomForSession("session-a", "arrow_predict");
  const code = created.code;

  const room = await service.sendChatForSession(code, "session-a", "hello");

  // The client-facing room still exposes chat...
  assert.equal(room.chat.at(-1)?.content, "hello");
  // ...but the persisted room payload carries none; it lives in its own store.
  assert.equal(store.rooms.get(code)?.chat.length, 0);
  assert.equal(store.chats.get(code)?.length, 1);
});

test("heartbeats drive presence without mutating the room payload", async () => {
  const store = new InMemoryGameStore();
  const service = createGameSessionService(store);

  await service.setSessionUsername("session-a", "Host");
  const created = await service.createRoomForSession("session-a", "arrow_predict");
  const code = created.code;
  const hostId = store.rooms.get(code)!.players[0].id;

  await service.heartbeatForSession(code, "session-a");

  // Presence is tracked in its own ledger, not on the player record.
  assert.equal(typeof store.presence.get(code)?.[hostId], "number");
  assert.equal("lastSeenAt" in store.rooms.get(code)!.players[0], false);
});

test("host can restart a finished game back to the lobby", async () => {
  const service = createGameSessionService(new InMemoryGameStore());

  const created = service.createRoom("Host", "arrow_predict");
  const code = created.room.code;
  const hostId = created.playerId;
  service.joinRoom(code, "Player2");

  service.startGame(code, hostId);
  const restarted = service.restartGame(code, hostId);

  assert.equal(restarted.status, "lobby");
  assert.equal(restarted.game.state, "waiting");
  assert.equal(restarted.game.scores[hostId], 0);
});
