import type { GameDefinition, GameRoundResult } from "@/lib/game/contracts";
import { createRoundSeed, mulberry32, stringToSeed } from "@/lib/game/rng";
import type { GameState, Player, Room, SpaceshipActionType, SpaceshipCrewAction, SpaceshipGameState, SpaceshipHitDetail, SpaceshipReinforcement, SpaceshipRevealStep, SpaceshipShipState, SpaceshipThreat, SpaceshipThreatKind } from "@/lib/types";

const TURN_DURATION_MS = 40_000;
// The round reveal plays crew actions then enemy fire one frame at a time; the
// window scales with how many frames there are so playback isn't rushed.
const REVEAL_BASE_MS = 1_800;
const REVEAL_PER_STEP_MS = 750;
const REVEAL_MIN_MS = 4_000;
const REVEAL_MAX_MS = 12_000;

function revealDurationMs(stepCount: number): number {
  return Math.max(REVEAL_MIN_MS, Math.min(REVEAL_MAX_MS, REVEAL_BASE_MS + stepCount * REVEAL_PER_STEP_MS));
}
// Keep enough history that the UI can always render the last two full rounds,
// even with a large crew and a doubled threat row.
const MAX_LOG_ENTRIES = 60;
const STARTING_HULL = 10;
const SHIELD_CAP = 6;
const MAX_ATTACK_COUNTDOWN = 5;
// Shared crew energy. The reserve regenerates by ENERGY_PER_TURN at the start of
// every player's turn, and most actions spend energy — so "passing" (or timing
// out) is what banks that regen for later.
const STARTING_ENERGY = 2;
const ENERGY_CAP = 10;
const ENERGY_PER_TURN = 1;
const ACTION_ENERGY_COST: Record<SpaceshipActionType, number> = {
  shoot: 1,
  // Pricey, but raises shields straight to the cap.
  shield: 3,
  charge_jump: 2,
  // Escaping is the win condition — never gate it behind energy.
  jump_away: 0,
  // Jumping itself is free; the only cost is the risk of destruction.
  emergency_jump: 0,
  // Passing spends nothing; the crew keeps the energy regenerated this turn.
  pass: 0
};

/**
 * Success odds (0–100) for a non-deterministic "emergency jump": forcing the
 * drive before it's fully charged. Scales with how close the jump drive already
 * is to its target — a nearly-charged drive is a near sure thing, a cold drive
 * is hopeless. (Energy is irrelevant — the jump itself is free.)
 */
export function emergencyJumpChance(ship: SpaceshipShipState): number {
  if (ship.jumpTarget <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((ship.jumpCharge / ship.jumpTarget) * 100)));
}

const THREAT_LIBRARY: Record<SpaceshipThreatKind, Omit<SpaceshipThreat, "id" | "attacksInTurns">> = {
  raider: {
    kind: "raider",
    name: "Raider",
    health: 2,
    maxHealth: 2,
    attack: 1,
    attackRevealed: true,
    attackInterval: 2,
    oneShot: false
  },
  destroyer: {
    kind: "destroyer",
    name: "Destroyer",
    health: 4,
    maxHealth: 4,
    attack: 2,
    attackRevealed: true,
    attackInterval: 3,
    oneShot: false
  },
  missile: {
    kind: "missile",
    name: "Missile",
    health: 1,
    maxHealth: 1,
    attack: 3,
    attackRevealed: true,
    attackInterval: 1,
    oneShot: true
  },
  stealth_ship: {
    kind: "stealth_ship",
    name: "Stealth Ship",
    health: 3,
    maxHealth: 3,
    attack: 2,
    attackRevealed: false,
    attackInterval: 2,
    oneShot: false
  }
};

function createEmptyScores(players: Player[]): Record<string, number> {
  const scores: Record<string, number> = {};
  players.forEach((player) => {
    scores[player.id] = 0;
  });
  return scores;
}

function orderedPlayers(room: Room): Player[] {
  return [...room.players].sort((a, b) => a.joinOrder - b.joinOrder);
}

function firstPlayerId(room: Room): string | undefined {
  return orderedPlayers(room)[0]?.id;
}

function nextPlayerId(room: Room, actedPlayerIds: string[], currentPlayerId?: string): string | undefined {
  const players = orderedPlayers(room);
  if (!players.length) return undefined;
  const acted = new Set(actedPlayerIds);
  const currentIndex = Math.max(0, players.findIndex((player) => player.id === currentPlayerId));
  for (let offset = 1; offset <= players.length; offset += 1) {
    const player = players[(currentIndex + offset) % players.length];
    if (!acted.has(player.id)) {
      return player.id;
    }
  }
  return players[0]?.id;
}

function appendLog(spaceship: SpaceshipGameState, message: string, now: number, roundIndex: number): SpaceshipGameState {
  return {
    ...spaceship,
    log: [
      { id: `log-${now}-${spaceship.log.length}`, message, createdAt: now, roundIndex },
      ...spaceship.log
    ].slice(0, MAX_LOG_ENTRIES)
  };
}

function rollInt(state: GameState, salt: string, min: number, max: number): number {
  const seedPlain = state.rngByRound[0]?.seedPlain ?? "fallback";
  const cursor = state.spaceship?.rngCursor ?? 0;
  const rand = mulberry32(stringToSeed(`${seedPlain}:${salt}:${cursor}`));
  return min + Math.floor(rand() * (max - min + 1));
}

// The battle always opens with this fixed set of threats on the field.
const INITIAL_THREAT_KINDS: SpaceshipThreatKind[] = ["missile", "missile", "raider"];
// Reinforcement waves are drawn from this pool.
const REINFORCEMENT_KINDS: SpaceshipThreatKind[] = ["raider", "destroyer", "missile", "stealth_ship"];
// A fresh reinforcement wave jumps in on this cadence (rounds), each carrying a
// random number of enemies in [REINFORCEMENT_MIN_SIZE, REINFORCEMENT_MAX_SIZE].
const REINFORCEMENT_INTERVAL_ROUNDS = 3;
const REINFORCEMENT_MIN_SIZE = 3;
const REINFORCEMENT_MAX_SIZE = 5;

function createThreats(state: GameState, kinds: SpaceshipThreatKind[]): SpaceshipThreat[] {
  return kinds.map((kind, index) => {
    const template = THREAT_LIBRARY[kind];
    return {
      ...template,
      id: `threat-${index + 1}`,
      attacksInTurns: rollInt(state, `threat-${index + 1}:countdown`, 1, MAX_ATTACK_COUNTDOWN)
    };
  });
}

// Roll a single reinforcement wave: a random 3-5 enemies drawn from the pool
// that jump in after REINFORCEMENT_INTERVAL_ROUNDS. Composition comes from the
// seeded RNG (with a per-wave salt) so the encounter replays deterministically.
function createReinforcementWave(state: GameState, waveLabel: string): SpaceshipReinforcement[] {
  const size = rollInt(state, `${waveLabel}:size`, REINFORCEMENT_MIN_SIZE, REINFORCEMENT_MAX_SIZE);
  return Array.from({ length: size }, (_unused, index) => {
    const kind = REINFORCEMENT_KINDS[rollInt(state, `${waveLabel}:kind:${index}`, 0, REINFORCEMENT_KINDS.length - 1)];
    return {
      id: `reinf-${waveLabel}-${index + 1}`,
      kind,
      name: THREAT_LIBRARY[kind].name,
      arrivesInRounds: REINFORCEMENT_INTERVAL_ROUNDS,
      attackCountdown: rollInt(state, `${waveLabel}:countdown:${index}`, 1, MAX_ATTACK_COUNTDOWN)
    };
  });
}

// Tick every queued reinforcement down a round; any that reach 0 jump into the
// threat row with their pre-rolled attack countdown. Whenever a wave lands we
// queue a fresh random wave so reinforcements keep arriving on the same cadence.
// Called as a new round opens.
function spawnDueReinforcements(state: GameState, spaceship: SpaceshipGameState, now: number, roundIndex: number): SpaceshipGameState {
  const pending = spaceship.reinforcements ?? [];
  if (!pending.length) return spaceship;

  const ticked = pending.map((entry) => ({ ...entry, arrivesInRounds: entry.arrivesInRounds - 1 }));
  const due = ticked.filter((entry) => entry.arrivesInRounds <= 0);
  const remaining = ticked.filter((entry) => entry.arrivesInRounds > 0);
  if (!due.length) {
    return { ...spaceship, reinforcements: remaining };
  }

  const newThreats: SpaceshipThreat[] = due.map((entry) => ({
    ...THREAT_LIBRARY[entry.kind],
    id: entry.id,
    attacksInTurns: entry.attackCountdown
  }));
  const nextWave = createReinforcementWave(state, `wave-r${roundIndex}`);
  return appendLog(
    {
      ...spaceship,
      threats: [...spaceship.threats, ...newThreats],
      reinforcements: [...remaining, ...nextWave],
      rngCursor: spaceship.rngCursor + 1
    },
    `Reinforcements jump in: ${due.map((entry) => entry.name).join(", ")}.`,
    now,
    roundIndex
  );
}

function createStartedState(room: Room, state: GameState, now: number): GameState {
  const seed = createRoundSeed();
  const seededState: GameState = {
    ...state,
    rngByRound: {
      0: {
        roundIndex: 0,
        seedHash: seed.seedHash,
        seedPlain: seed.seedPlain,
        rngAlgo: "mulberry32"
      }
    },
    spaceship: {
      ship: {
        hull: STARTING_HULL,
        maxHull: STARTING_HULL,
        shields: 0,
        shieldCap: SHIELD_CAP,
        jumpCharge: 0,
        jumpTarget: room.players.length + 6,
        energy: STARTING_ENERGY,
        energyCap: ENERGY_CAP
      },
      threats: [],
      activePlayerId: firstPlayerId(room),
      playersActedThisRound: [],
      rngCursor: 0,
      crewSteps: [],
      reinforcements: [],
      log: []
    }
  };

  const spaceship: SpaceshipGameState = {
    ...seededState.spaceship!,
    threats: createThreats(seededState, INITIAL_THREAT_KINDS),
    // The first reinforcement wave is queued at the start; further waves are
    // rolled as each one lands (see spawnDueReinforcements).
    reinforcements: createReinforcementWave(seededState, "wave-start"),
    rngCursor: 1,
    log: [
      {
        id: `log-${now}-start`,
        message: "Enemy contacts detected. More are inbound — charge the jump drive and hold the hull.",
        createdAt: now,
        roundIndex: 0
      }
    ]
  };

  return {
    ...seededState,
    state: "player_turn",
    roundIndex: 0,
    maxRounds: 7,
    roundDeadlineAt: now + TURN_DURATION_MS,
    spaceship: grantTurnEnergy(spaceship),
    version: state.version + 1
  };
}

function applyDamageToShip(spaceship: SpaceshipGameState, damage: number): SpaceshipGameState {
  const absorbed = Math.min(spaceship.ship.shields, damage);
  const remaining = damage - absorbed;
  return {
    ...spaceship,
    ship: {
      ...spaceship.ship,
      shields: spaceship.ship.shields - absorbed,
      hull: Math.max(0, spaceship.ship.hull - remaining)
    }
  };
}

// Regenerate the crew's energy as a player's turn begins. Called at every
// transition into a `player_turn` (game start, next crew member, next round).
function grantTurnEnergy(spaceship: SpaceshipGameState): SpaceshipGameState {
  return {
    ...spaceship,
    ship: {
      ...spaceship.ship,
      energy: Math.min(spaceship.ship.energyCap, spaceship.ship.energy + ENERGY_PER_TURN)
    }
  };
}

function spendEnergy(spaceship: SpaceshipGameState, amount: number): SpaceshipGameState {
  if (amount <= 0) return spaceship;
  return {
    ...spaceship,
    ship: { ...spaceship.ship, energy: Math.max(0, spaceship.ship.energy - amount) }
  };
}

// Headline for a crew-action playback frame.
function crewStepMessage(crew: Omit<SpaceshipCrewAction, "id">): string {
  const target = crew.targetThreatName ?? "a threat";
  switch (crew.action) {
    case "shoot":
      if (crew.killedTarget) return `${crew.playerName} destroyed ${target}!`;
      return (crew.damageDealt ?? 0) > 0
        ? `${crew.playerName} hit ${target} for ${crew.damageDealt}.`
        : `${crew.playerName} fired at ${target} and missed.`;
    case "shield":
      return `${crew.playerName} charged shields to full.`;
    case "charge_jump":
      return `${crew.playerName} charged the jump drive.`;
    case "emergency_jump":
      return `${crew.playerName}'s emergency jump failed — the reserve is spent.`;
    case "pass":
      return crew.timedOut ? `${crew.playerName} timed out.` : `${crew.playerName} passed and banked energy.`;
    default:
      return `${crew.playerName} acted.`;
  }
}

// Record a crew-action playback frame, snapshotting the ship/threat row as it
// stands right after the action so the reveal can animate the crew phase the
// same way it animates enemy fire.
function appendCrewStep(
  spaceship: SpaceshipGameState,
  roundIndex: number,
  details: Omit<SpaceshipCrewAction, "id">
): SpaceshipGameState {
  const crewSteps = spaceship.crewSteps ?? [];
  const crew: SpaceshipCrewAction = { id: `crew-${roundIndex}-${crewSteps.length}`, ...details };
  const step: SpaceshipRevealStep = {
    id: `crewstep-${roundIndex}-${crewSteps.length}`,
    message: crewStepMessage(details),
    ship: { ...spaceship.ship },
    threats: spaceship.threats.map((threat) => ({ ...threat })),
    crew
  };
  return { ...spaceship, crewSteps: [...crewSteps, step] };
}

function resolveEnemyPhase(room: Room, spaceship: SpaceshipGameState, now: number, roundIndex: number): { spaceship: SpaceshipGameState; lost: boolean } {
  let nextSpaceship = appendLog(spaceship, "Enemy attack countdowns advance.", now, roundIndex);

  // `displayThreats` is the threat row as it evolves through the phase, so each
  // reveal step can snapshot countdowns ticking down and threats vanishing as
  // they fire. It converges to the post-phase threat row.
  let displayThreats: SpaceshipThreat[] = spaceship.threats.map((threat) => ({ ...threat }));
  const steps: SpaceshipRevealStep[] = [];
  const recordStep = (message: string, hit?: SpaceshipHitDetail) => {
    steps.push({
      id: `srev-${roundIndex}-${steps.length}`,
      message,
      ship: { ...nextSpaceship.ship },
      threats: displayThreats.map((threat) => ({ ...threat })),
      ...(hit ? { hit } : {})
    });
  };

  // Baseline frame: the ship/threats entering the enemy phase, before any tick.
  // This is the beat where the crew phase hands off to incoming fire.
  recordStep("Enemy contacts open fire…");

  spaceship.threats.forEach((threat) => {
    const countdown = threat.attacksInTurns - 1;
    if (countdown > 0) {
      displayThreats = displayThreats.map((entry) => (entry.id === threat.id ? { ...entry, attacksInTurns: countdown } : entry));
      return;
    }

    const shieldsBefore = nextSpaceship.ship.shields;
    const hullBefore = nextSpaceship.ship.hull;
    nextSpaceship = applyDamageToShip(nextSpaceship, threat.attack);
    const absorbed = Math.min(shieldsBefore, threat.attack);
    const toHull = threat.attack - absorbed;

    // A one-shot threat is spent and leaves the row; others reset their timer.
    displayThreats = threat.oneShot
      ? displayThreats.filter((entry) => entry.id !== threat.id)
      : displayThreats.map((entry) => (entry.id === threat.id ? { ...entry, attacksInTurns: threat.attackInterval } : entry));

    const hit: SpaceshipHitDetail = {
      threatId: threat.id,
      threatName: threat.name,
      threatKind: threat.kind,
      attack: threat.attack,
      revealed: threat.attackRevealed,
      absorbed,
      toHull,
      shieldsBefore,
      shieldsAfter: nextSpaceship.ship.shields,
      hullBefore,
      hullAfter: nextSpaceship.ship.hull
    };

    const breakdown = absorbed > 0 ? `${absorbed} absorbed, ${toHull} to hull` : `${toHull} to hull`;
    const logMsg = threat.attackRevealed
      ? `${threat.name} attacks for ${threat.attack} damage (${breakdown}).`
      : `${threat.name} strikes from the shadows (${breakdown}).`;
    nextSpaceship = appendLog(nextSpaceship, logMsg, now, roundIndex);
    recordStep(logMsg, hit);
  });

  const lost = nextSpaceship.ship.hull <= 0;
  if (lost) {
    nextSpaceship = appendLog(nextSpaceship, "The hull failed. The ship is lost.", now, roundIndex);
    recordStep("The hull buckles — the ship is lost.");
  }

  nextSpaceship = {
    ...nextSpaceship,
    threats: displayThreats,
    // Crew actions play first, then the enemy fire — one shared timeline.
    revealSteps: [...(spaceship.crewSteps ?? []), ...steps]
  };

  return { spaceship: nextSpaceship, lost };
}

function finishState(state: GameState, spaceship: SpaceshipGameState, outcome: "won" | "lost"): GameState {
  return {
    ...state,
    state: "finished",
    roundDeadlineAt: undefined,
    spaceship: {
      ...spaceship,
      outcome,
      activePlayerId: undefined
    },
    version: state.version + 1
  };
}

function advanceTurn(room: Room, state: GameState, spaceship: SpaceshipGameState, actorPlayerId: string, now: number): GameState {
  const acted = [...new Set([...spaceship.playersActedThisRound, actorPlayerId])];
  const roundComplete = acted.length >= orderedPlayers(room).length;
  if (roundComplete) {
    // Resolve the enemy phase now (so state is authoritative), but enter a
    // reveal phase that plays the resolution out hit-by-hit. The reveal's
    // deadline drives the transition to the next round (or to the loss) in
    // `closeRound`.
    const result = resolveEnemyPhase(room, { ...spaceship, playersActedThisRound: acted }, now, state.roundIndex);
    return {
      ...state,
      state: "enemy_phase",
      roundDeadlineAt: now + revealDurationMs(result.spaceship.revealSteps?.length ?? 0),
      spaceship: result.spaceship,
      version: state.version + 1
    };
  }

  return {
    ...state,
    state: "player_turn",
    roundDeadlineAt: now + TURN_DURATION_MS,
    spaceship: grantTurnEnergy({
      ...spaceship,
      playersActedThisRound: acted,
      activePlayerId: nextPlayerId(room, acted, actorPlayerId)
    }),
    version: state.version + 1
  };
}

function applyPlayerAction(room: Room, state: GameState, action: SpaceshipActionType, targetThreatId: string | undefined, now: number): GameState {
  const spaceship = state.spaceship;
  const actorPlayerId = state.spaceship?.activePlayerId;
  if (!spaceship || !actorPlayerId || state.state !== "player_turn") {
    return state;
  }

  const actorName = room.players.find((player) => player.id === actorPlayerId)?.name ?? "A player";
  const cost = ACTION_ENERGY_COST[action] ?? 0;
  // Not enough energy to power this action — reject so the turn stays with the
  // active player (the client also disables these, this is the authoritative guard).
  if (cost > 0 && spaceship.ship.energy < cost) {
    return state;
  }
  let nextSpaceship = spaceship;
  // Effect summary for the enemy-phase reveal recap; filled in per action.
  const crewAction: Omit<SpaceshipCrewAction, "id"> = {
    playerId: actorPlayerId,
    playerName: actorName,
    action,
    timedOut: false,
    energySpent: cost
  };

  if (action === "pass") {
    nextSpaceship = appendLog(nextSpaceship, `${actorName} holds position, banking energy.`, now, state.roundIndex);
  } else if (action === "shoot") {
    if (!targetThreatId) return state;
    const threat = spaceship.threats.find((entry) => entry.id === targetThreatId);
    if (!threat) return state;
    const damage = rollInt(state, `${actorPlayerId}:shoot:${targetThreatId}`, 0, 4);
    const killed = threat.health - damage <= 0;
    const nextThreats = nextSpaceship.threats
      .map((entry) => {
        if (entry.id !== targetThreatId) return entry;
        return {
          ...entry,
          health: entry.health - damage,
          attackRevealed: true
        };
      })
      .filter((entry) => entry.health > 0);
    crewAction.targetThreatName = threat.name;
    crewAction.targetThreatKind = threat.kind;
    crewAction.damageDealt = damage;
    crewAction.killedTarget = killed;
    nextSpaceship = appendLog(
      {
        ...nextSpaceship,
        rngCursor: nextSpaceship.rngCursor + 1,
        threats: nextThreats
      },
      damage > 0 ? `${actorName} hits ${threat.name} for ${damage}.` : `${actorName} fires at ${threat.name} and misses.`,
      now,
      state.roundIndex
    );
  } else if (action === "shield") {
    const shieldsBefore = nextSpaceship.ship.shields;
    // Costly, but charges shields all the way to the cap.
    const shieldsAfter = nextSpaceship.ship.shieldCap;
    crewAction.shieldsGained = shieldsAfter - shieldsBefore;
    nextSpaceship = appendLog(
      {
        ...nextSpaceship,
        ship: {
          ...nextSpaceship.ship,
          shields: shieldsAfter
        }
      },
      `${actorName} charges shields to full.`,
      now,
      state.roundIndex
    );
  } else if (action === "charge_jump") {
    const jumpBefore = nextSpaceship.ship.jumpCharge;
    const jumpAfter = Math.min(nextSpaceship.ship.jumpTarget, jumpBefore + 1);
    crewAction.jumpGained = jumpAfter - jumpBefore;
    nextSpaceship = appendLog(
      {
        ...nextSpaceship,
        ship: {
          ...nextSpaceship.ship,
          jumpCharge: jumpAfter
        }
      },
      `${actorName} charges the jump drive.`,
      now,
      state.roundIndex
    );
  } else if (action === "jump_away") {
    if (nextSpaceship.ship.jumpCharge < nextSpaceship.ship.jumpTarget) return state;
    return finishState(state, appendLog(nextSpaceship, `${actorName} engages the jump drive. The crew escapes!`, now, state.roundIndex), "won");
  } else if (action === "emergency_jump") {
    // Only a fallback when the safe jump isn't available. Jumping itself is free —
    // the gamble is on how charged the drive already is, not on the reserve.
    if (nextSpaceship.ship.jumpCharge >= nextSpaceship.ship.jumpTarget) return state;
    const chance = emergencyJumpChance(nextSpaceship.ship);
    const roll = rollInt(state, `${actorPlayerId}:emergency_jump`, 1, 100);
    const success = roll <= chance;
    // Burns only the rng draw — the jump costs no energy.
    nextSpaceship = {
      ...nextSpaceship,
      rngCursor: nextSpaceship.rngCursor + 1
    };
    if (success) {
      return finishState(
        state,
        appendLog(nextSpaceship, `${actorName} forces an emergency jump (${chance}% odds) — it works! The crew escapes!`, now, state.roundIndex),
        "won"
      );
    }
    // A failed gamble overloads the drive and tears the ship apart — game over.
    return finishState(
      state,
      appendLog(
        nextSpaceship,
        `${actorName} attempts an emergency jump (${chance}% odds) — it fails, the drive overloads and the ship is torn apart.`,
        now,
        state.roundIndex
      ),
      "lost"
    );
  }

  nextSpaceship = spendEnergy(nextSpaceship, cost);
  nextSpaceship = appendCrewStep(nextSpaceship, state.roundIndex, crewAction);
  return advanceTurn(room, { ...state, spaceship: nextSpaceship }, nextSpaceship, actorPlayerId, now);
}

/**
 * Ends the enemy-phase reveal: either finalises a loss or opens the next crew
 * round. Crew turn order is reset here (not when the phase is resolved) so the
 * reveal keeps showing the round that just ended.
 */
function finishEnemyPhase(room: Room, state: GameState, now: number): GameState {
  const spaceship = state.spaceship;
  if (!spaceship) return state;
  if (spaceship.ship.hull <= 0) {
    return finishState(state, { ...spaceship, revealSteps: undefined }, "lost");
  }
  return {
    ...state,
    state: "player_turn",
    roundIndex: state.roundIndex + 1,
    roundDeadlineAt: now + TURN_DURATION_MS,
    spaceship: grantTurnEnergy(
      spawnDueReinforcements(
        state,
        {
          ...spaceship,
          revealSteps: undefined,
          crewSteps: [],
          playersActedThisRound: [],
          activePlayerId: firstPlayerId(room)
        },
        now,
        state.roundIndex + 1
      )
    ),
    version: state.version + 1
  };
}

function autoPassCurrentTurn(room: Room, state: GameState, now: number): GameState {
  const spaceship = state.spaceship;
  const actorPlayerId = spaceship?.activePlayerId;
  if (!spaceship || !actorPlayerId || state.state !== "player_turn") {
    return state;
  }
  const actorName = room.players.find((player) => player.id === actorPlayerId)?.name ?? "A player";
  let nextSpaceship = appendLog(spaceship, `${actorName} timed out and loses their action.`, now, state.roundIndex);
  nextSpaceship = appendCrewStep(nextSpaceship, state.roundIndex, {
    playerId: actorPlayerId,
    playerName: actorName,
    action: "pass",
    timedOut: true,
    energySpent: 0
  });
  return advanceTurn(room, { ...state, spaceship: nextSpaceship }, nextSpaceship, actorPlayerId, now);
}

export const spaceshipDefenseGameDefinition: GameDefinition = {
  gameType: "spaceship_defense",
  supportsBots: true,
  createInitialState(args) {
    return {
      gameType: "spaceship_defense",
      state: "waiting",
      roundIndex: 0,
      maxRounds: 7,
      scores: createEmptyScores(args.players),
      choicesByRound: {},
      rngByRound: {},
      version: 1
    };
  },
  parseAction(payload) {
    if (payload.action !== "submit_spaceship_action" || typeof payload.spaceshipAction !== "string") {
      return null;
    }
    const action = parseSpaceshipAction(payload.spaceshipAction);
    if (!action) {
      throw new Error("Invalid spaceship action.");
    }
    return {
      type: "submit_spaceship_action",
      action,
      targetThreatId: typeof payload.targetThreatId === "string" ? payload.targetThreatId : undefined
    };
  },
  applyCommand({ room, state, command, context }) {
    if (command.type === "start_game" && state.state === "waiting") {
      return createStartedState(room, state, context.now);
    }

    const action = typeof command.action === "string" ? parseSpaceshipAction(command.action) : null;
    if (command.type === "submit_spaceship_action" && action && context.actorPlayerId === state.spaceship?.activePlayerId) {
      if (state.roundDeadlineAt && context.now > state.roundDeadlineAt) {
        return autoPassCurrentTurn(room, state, context.now);
      }
      return applyPlayerAction(
        room,
        state,
        action,
        typeof command.targetThreatId === "string" ? command.targetThreatId : undefined,
        context.now
      );
    }

    if (command.type === "close_round") {
      return autoPassCurrentTurn(room, state, context.now);
    }

    return state;
  },
  closeRound({ room, state, now }): { nextState: GameState; result: GameRoundResult } {
    if (state.state === "enemy_phase") {
      const nextState = finishEnemyPhase(room, state, now);
      return {
        nextState,
        result: { wasClosed: nextState !== state, matchedPlayerIds: [], leaderPlayerId: nextState.spaceship?.activePlayerId }
      };
    }
    const nextState = autoPassCurrentTurn(room, state, now);
    return {
      nextState,
      result: { wasClosed: nextState !== state, matchedPlayerIds: [], leaderPlayerId: nextState.spaceship?.activePlayerId }
    };
  },
  shouldAdvanceTime(state) {
    return state.state === "player_turn" || state.state === "enemy_phase";
  },
  applyBots({ room, state, now }) {
    let nextState = state;
    let safety = room.players.length + 1;
    while (safety > 0 && nextState.state === "player_turn") {
      safety -= 1;
      const activePlayer = room.players.find((player) => player.id === nextState.spaceship?.activePlayerId);
      if (!activePlayer?.isBot) return nextState;
      const botAction = chooseSpaceshipBotAction(nextState);
      nextState = spaceshipDefenseGameDefinition.applyCommand({
        room,
        state: nextState,
        command: { type: "submit_spaceship_action", ...botAction },
        context: { now, actorPlayerId: activePlayer.id }
      });
    }
    return nextState;
  }
};

function chooseSpaceshipBotAction(state: GameState): { action: SpaceshipActionType; targetThreatId?: string } {
  const spaceship = state.spaceship;
  if (!spaceship) return { action: "charge_jump" };
  const { ship, threats } = spaceship;
  if (ship.jumpCharge >= ship.jumpTarget) {
    return { action: "jump_away" };
  }

  const desired = ((): { action: SpaceshipActionType; targetThreatId?: string } => {
    const incomingSoon = threats
      .filter((threat) => threat.attacksInTurns <= 1)
      .reduce((total, threat) => total + threat.attack, 0);
    if (incomingSoon > ship.shields && ship.shields < ship.shieldCap) {
      return { action: "shield" };
    }
    const target = [...threats].sort((a, b) => {
      const urgency = a.attacksInTurns - b.attacksInTurns;
      if (urgency !== 0) return urgency;
      const attack = b.attack - a.attack;
      if (attack !== 0) return attack;
      return a.health - b.health;
    })[0];
    if (target) {
      return { action: "shoot", targetThreatId: target.id };
    }
    return { action: "charge_jump" };
  })();

  // Can't power the move? Bank energy by passing instead of stalling the turn.
  if ((ACTION_ENERGY_COST[desired.action] ?? 0) > ship.energy) {
    return { action: "pass" };
  }
  return desired;
}

export function parseSpaceshipAction(input: string): SpaceshipActionType | null {
  if (
    input === "shoot" ||
    input === "shield" ||
    input === "charge_jump" ||
    input === "jump_away" ||
    input === "emergency_jump" ||
    input === "pass"
  ) {
    return input;
  }
  return null;
}
