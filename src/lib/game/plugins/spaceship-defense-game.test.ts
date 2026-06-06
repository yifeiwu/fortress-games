import test from "node:test";
import assert from "node:assert/strict";
import { emergencyJumpChance, spaceshipDefenseGameDefinition } from "@/lib/game/plugins/spaceship-defense-game";
import type { Player, Room } from "@/lib/types";

function createPlayers(): Player[] {
  return [
    { id: "p1", name: "A", isBot: false, isHost: true, connected: true, joinOrder: 0 },
    { id: "p2", name: "B", isBot: false, isHost: false, connected: true, joinOrder: 1 }
  ];
}

function createRoom(players: Player[]): Room {
  const game = spaceshipDefenseGameDefinition.createInitialState({ players, now: 1000 });
  return {
    code: "ABCDEF",
    gameType: "spaceship_defense",
    status: "in_game",
    createdAt: 1000,
    hostPlayerId: "p1",
    players,
    chat: [],
    game
  };
}

function startGame(room: Room) {
  return spaceshipDefenseGameDefinition.applyCommand({
    room,
    state: room.game,
    command: { type: "start_game" },
    context: { now: 2000, actorPlayerId: "p1" }
  });
}

test("start_game creates ship and starting threats", () => {
  const room = createRoom(createPlayers());
  const state = startGame(room);

  assert.equal(state.state, "player_turn");
  assert.equal(state.spaceship?.ship.hull, 10);
  assert.equal(state.spaceship?.ship.jumpTarget, 8);
  assert.equal(state.spaceship?.activePlayerId, "p1");
  // The battle always opens with a fixed set: 2 missiles + 1 raider.
  assert.equal(state.spaceship?.threats.length, 3);
  assert.equal(state.spaceship?.threats.filter((threat) => threat.kind === "missile").length, 2);
  assert.equal(state.spaceship?.threats.filter((threat) => threat.kind === "raider").length, 1);
  // The first reinforcement wave is a random 3-5 set, due in 3 rounds.
  const reinforcements = state.spaceship?.reinforcements ?? [];
  assert.ok(reinforcements.length >= 3 && reinforcements.length <= 5);
  assert.ok(state.spaceship?.threats.every((threat) => threat.attacksInTurns >= 1 && threat.attacksInTurns <= 5));
  assert.ok(reinforcements.every((entry) => entry.arrivesInRounds === 3));
});

test("a reinforcement wave jumps in and queues the next wave", () => {
  const room = createRoom(createPlayers());
  let state = startGame(room);
  assert.ok(state.spaceship);
  const incomingWave = state.spaceship.reinforcements;
  assert.ok(incomingWave.length >= 3 && incomingWave.length <= 5);

  // Make the queued wave due next round and clear the field so the round
  // completes into the enemy phase.
  state.spaceship = {
    ...state.spaceship,
    threats: [],
    reinforcements: incomingWave.map((entry) => ({ ...entry, arrivesInRounds: 1 }))
  };
  state = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "pass" },
    context: { now: 3000, actorPlayerId: "p1" }
  });
  state = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "pass" },
    context: { now: 4000, actorPlayerId: "p2" }
  });
  assert.equal(state.state, "enemy_phase");

  const opened = spaceshipDefenseGameDefinition.closeRound({ room, state, now: 9000 }).nextState;
  assert.equal(opened.roundIndex, 1);
  // The whole due wave spawns into the threat row.
  assert.equal(opened.spaceship?.threats.length, incomingWave.length);
  // A fresh random wave (3-5) is queued to keep reinforcements coming, due in
  // another full interval.
  const queued = opened.spaceship?.reinforcements ?? [];
  assert.ok(queued.length >= 3 && queued.length <= 5);
  assert.ok(queued.every((entry) => entry.arrivesInRounds === 3));
  // Spawned threats carry their pre-rolled countdown.
  assert.ok(opened.spaceship?.threats.every((threat) => threat.attacksInTurns >= 1 && threat.attacksInTurns <= 5));
});

test("shoot rolls bounded damage and reveals stealth ships", () => {
  const room = createRoom(createPlayers());
  let state = startGame(room);
  assert.ok(state.spaceship);
  // Drop a stealth ship onto the field — the starting set is missiles + a raider.
  // Give it more health than the max single-shot roll (4) so it always survives
  // one shot; otherwise the assertions below would be skipped whenever the roll
  // happened to kill it.
  state.spaceship = {
    ...state.spaceship,
    threats: [
      {
        id: "threat-stealth",
        kind: "stealth_ship",
        name: "Stealth Ship",
        health: 8,
        maxHealth: 8,
        attack: 2,
        attackRevealed: false,
        attacksInTurns: 2,
        attackInterval: 2,
        oneShot: false
      }
    ]
  };
  const stealth = state.spaceship?.threats.find((threat) => threat.kind === "stealth_ship");
  assert.ok(stealth);
  assert.equal(stealth.attackRevealed, false);

  state = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "shoot", targetThreatId: stealth.id },
    context: { now: 3000, actorPlayerId: "p1" }
  });

  const updated = state.spaceship?.threats.find((threat) => threat.id === stealth.id);
  assert.ok(updated, "the stealth ship survives a single bounded shot");
  assert.equal(updated.attackRevealed, true);
  // shoot rolls 0-4 damage, so health lands within that bound.
  assert.ok(updated.health >= stealth.health - 4);
  assert.ok(updated.health <= stealth.health);
  assert.equal(state.spaceship?.activePlayerId, "p2");
});

test("enemy countdowns attack after a full crew round", () => {
  const room = createRoom(createPlayers());
  let state = startGame(room);
  assert.ok(state.spaceship);
  state.spaceship = {
    ...state.spaceship,
    // Plenty of energy so both crew actions can resolve this round.
    ship: { ...state.spaceship.ship, energy: 10 },
    threats: [
      {
        id: "threat-test",
        kind: "raider",
        name: "Raider",
        health: 2,
        maxHealth: 2,
        attack: 1,
        attackRevealed: true,
        attacksInTurns: 1,
        attackInterval: 2,
        oneShot: false
      }
    ]
  };

  state = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "shield" },
    context: { now: 3000, actorPlayerId: "p1" }
  });
  state = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "charge_jump" },
    context: { now: 4000, actorPlayerId: "p2" }
  });

  // A full crew round enters the enemy-phase reveal: the resolution is already
  // applied (shields charged to the cap of 6 then soaked the raider's 1 damage,
  // its timer reset) but the round hasn't advanced yet — the reveal plays first.
  assert.equal(state.state, "enemy_phase");
  assert.equal(state.roundIndex, 0);
  assert.equal(state.spaceship?.ship.shields, 5);
  assert.equal(state.spaceship?.ship.hull, 10);
  assert.equal(state.spaceship?.threats[0]?.attacksInTurns, 2);
  assert.ok((state.spaceship?.revealSteps?.length ?? 0) >= 2);

  // Closing the reveal (deadline) opens the next crew round.
  const closed = spaceshipDefenseGameDefinition.closeRound({ room, state, now: 9000 });
  assert.equal(closed.nextState.state, "player_turn");
  assert.equal(closed.nextState.roundIndex, 1);
  assert.equal(closed.nextState.spaceship?.activePlayerId, "p1");
  assert.equal(closed.nextState.spaceship?.revealSteps, undefined);
});

test("a fatal enemy phase reveals then finishes as a loss", () => {
  const room = createRoom(createPlayers());
  let state = startGame(room);
  assert.ok(state.spaceship);
  state.spaceship = {
    ...state.spaceship,
    ship: { ...state.spaceship.ship, hull: 1, shields: 0 },
    threats: [
      {
        id: "threat-killer",
        kind: "missile",
        name: "Missile",
        health: 1,
        maxHealth: 1,
        attack: 3,
        attackRevealed: true,
        attacksInTurns: 1,
        attackInterval: 1,
        oneShot: true
      }
    ]
  };

  state = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "charge_jump" },
    context: { now: 3000, actorPlayerId: "p1" }
  });
  state = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "charge_jump" },
    context: { now: 4000, actorPlayerId: "p2" }
  });

  // The reveal still plays even on a lethal hit.
  assert.equal(state.state, "enemy_phase");
  assert.equal(state.spaceship?.ship.hull, 0);

  const closed = spaceshipDefenseGameDefinition.closeRound({ room, state, now: 9000 });
  assert.equal(closed.nextState.state, "finished");
  assert.equal(closed.nextState.spaceship?.outcome, "lost");
});

test("energy regenerates on each turn and is spent by actions", () => {
  const room = createRoom(createPlayers());
  let state = startGame(room);
  // Starting energy (2) plus the +1 granted as p1's turn opens.
  assert.equal(state.spaceship?.ship.energy, 3);

  // p1 charges: spends 2 (3 -> 1), then p2's turn opens and regenerates +1.
  state = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "charge_jump" },
    context: { now: 3000, actorPlayerId: "p1" }
  });
  assert.equal(state.spaceship?.activePlayerId, "p2");
  assert.equal(state.spaceship?.ship.energy, 2);
});

test("passing banks energy without spending it", () => {
  const room = createRoom(createPlayers());
  let state = startGame(room);
  assert.equal(state.spaceship?.ship.energy, 3);

  // p1 passes: no spend, then p2's turn opens and regenerates +1 (3 -> 4).
  state = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "pass" },
    context: { now: 3000, actorPlayerId: "p1" }
  });
  assert.equal(state.spaceship?.activePlayerId, "p2");
  assert.equal(state.spaceship?.ship.energy, 4);
});

test("actions are blocked when energy is too low", () => {
  const room = createRoom(createPlayers());
  let state = startGame(room);
  assert.ok(state.spaceship);
  state.spaceship = {
    ...state.spaceship,
    ship: { ...state.spaceship.ship, energy: 0 }
  };

  const blocked = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "charge_jump" },
    context: { now: 3000, actorPlayerId: "p1" }
  });

  // No energy: the action is rejected and the turn stays with p1.
  assert.equal(blocked, state);
  assert.equal(blocked.spaceship?.activePlayerId, "p1");
});

test("crew actions are recorded for the reveal and reset each round", () => {
  const room = createRoom(createPlayers());
  let state = startGame(room);
  assert.ok(state.spaceship);
  // Enough energy for the full-shield (3) and charge (2) actions this round, and a
  // single threat primed to fire this round so the enemy phase always produces a
  // hit frame (the starting threats roll random countdowns and might not attack).
  state.spaceship = {
    ...state.spaceship,
    ship: { ...state.spaceship.ship, energy: 10 },
    threats: [
      {
        id: "threat-firing",
        kind: "raider",
        name: "Raider",
        health: 5,
        maxHealth: 5,
        attack: 1,
        attackRevealed: true,
        attacksInTurns: 1,
        attackInterval: 2,
        oneShot: false
      }
    ]
  };

  state = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "shield" },
    context: { now: 3000, actorPlayerId: "p1" }
  });
  state = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "charge_jump" },
    context: { now: 4000, actorPlayerId: "p2" }
  });

  // Both crew choices are captured as reveal frames (with effects), and they are
  // merged ahead of the enemy fire in the shared reveal timeline.
  assert.equal(state.state, "enemy_phase");
  const crewSteps = state.spaceship?.crewSteps ?? [];
  assert.equal(crewSteps.length, 2);
  const shield = crewSteps.find((step) => step.crew?.action === "shield")?.crew;
  // Shields charge from 0 straight to the cap of 6.
  assert.equal(shield?.shieldsGained, 6);
  assert.equal(shield?.energySpent, 3);
  const charge = crewSteps.find((step) => step.crew?.action === "charge_jump")?.crew;
  assert.equal(charge?.jumpGained, 1);
  assert.equal(charge?.energySpent, 2);

  // The reveal timeline leads with the crew frames before any enemy hit.
  const reveal = state.spaceship?.revealSteps ?? [];
  const lastCrewIndex = reveal.reduce((last, step, index) => (step.crew ? index : last), -1);
  const firstHitIndex = reveal.findIndex((step) => step.hit);
  assert.ok(lastCrewIndex >= 0);
  assert.ok(firstHitIndex >= 0, "the primed threat fires, producing a hit frame");
  assert.ok(lastCrewIndex < firstHitIndex);

  // Opening the next round clears the per-round crew frames.
  const closed = spaceshipDefenseGameDefinition.closeRound({ room, state, now: 9000 });
  assert.equal(closed.nextState.state, "player_turn");
  assert.equal(closed.nextState.spaceship?.crewSteps.length, 0);
});

test("jump away wins when jump drive is full", () => {
  const room = createRoom(createPlayers());
  let state = startGame(room);
  assert.ok(state.spaceship);
  state.spaceship = {
    ...state.spaceship,
    ship: {
      ...state.spaceship.ship,
      jumpCharge: state.spaceship.ship.jumpTarget
    }
  };

  state = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "jump_away" },
    context: { now: 3000, actorPlayerId: "p1" }
  });

  assert.equal(state.state, "finished");
  assert.equal(state.spaceship?.outcome, "won");
});

test("emergency jump chance scales with the jump charge", () => {
  const base = { hull: 10, maxHull: 10, shields: 0, shieldCap: 6, energy: 0, energyCap: 10 };
  // Odds track how close the drive already is to its target — energy is irrelevant.
  assert.equal(emergencyJumpChance({ ...base, jumpCharge: 8, jumpTarget: 8 }), 100);
  assert.equal(emergencyJumpChance({ ...base, jumpCharge: 4, jumpTarget: 8 }), 50);
  assert.equal(emergencyJumpChance({ ...base, jumpCharge: 0, jumpTarget: 8 }), 0);
});

test("a cold-drive emergency jump (0% odds) always destroys the ship", () => {
  const room = createRoom(createPlayers());
  let state = startGame(room);
  assert.ok(state.spaceship);
  state.spaceship = {
    ...state.spaceship,
    // Plenty of fuel, but the drive is stone cold → 0% odds, a guaranteed overload.
    ship: { ...state.spaceship.ship, jumpCharge: 0, energy: state.spaceship.ship.energyCap }
  };

  state = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "emergency_jump" },
    context: { now: 3000, actorPlayerId: "p1" }
  });

  assert.equal(state.state, "finished");
  assert.equal(state.spaceship?.outcome, "lost");
});

test("an emergency jump always ends the game (win) or destroys the ship (loss)", () => {
  const room = createRoom(createPlayers());
  let state = startGame(room);
  assert.ok(state.spaceship);
  state.spaceship = {
    ...state.spaceship,
    // A half-charged drive → a genuine coin-flip outcome.
    ship: { ...state.spaceship.ship, jumpCharge: Math.floor(state.spaceship.ship.jumpTarget / 2), energy: 3 }
  };

  state = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "emergency_jump" },
    context: { now: 3000, actorPlayerId: "p1" }
  });

  // Win or fail, the attempt resolves the game immediately. The jump is free, so
  // the reserve is left untouched.
  assert.equal(state.state, "finished");
  assert.equal(state.spaceship?.ship.energy, 3);
  assert.ok(state.spaceship?.outcome === "won" || state.spaceship?.outcome === "lost");
});

test("emergency jump is free and only rejected with a fully charged drive", () => {
  const room = createRoom(createPlayers());
  let state = startGame(room);
  assert.ok(state.spaceship);

  // Drive already full → emergency jump is rejected; use the guaranteed jump instead.
  state.spaceship = {
    ...state.spaceship,
    ship: { ...state.spaceship.ship, jumpCharge: state.spaceship.ship.jumpTarget, energy: 5 }
  };
  const alreadyCharged = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "emergency_jump" },
    context: { now: 3000, actorPlayerId: "p1" }
  });
  assert.equal(alreadyCharged, state);

  // No energy is fine — jumping itself costs nothing, so a part-charged drive can
  // still attempt the gamble.
  state.spaceship = {
    ...state.spaceship,
    ship: { ...state.spaceship.ship, jumpCharge: Math.floor(state.spaceship.ship.jumpTarget / 2), energy: 0 }
  };
  const noFuel = spaceshipDefenseGameDefinition.applyCommand({
    room,
    state,
    command: { type: "submit_spaceship_action", action: "emergency_jump" },
    context: { now: 3000, actorPlayerId: "p1" }
  });
  assert.equal(noFuel.state, "finished");
});
