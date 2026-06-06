import type { GameDefinition, GameRoundResult } from "@/lib/game/contracts";
import { createRoundSeed, mulberry32, stringToSeed } from "@/lib/game/rng";
import type { GameState, Player, Room, SpaceshipActionType, SpaceshipCrewAction, SpaceshipGameState, SpaceshipHitDetail, SpaceshipRevealStep, SpaceshipShipState, SpaceshipThreat, SpaceshipThreatKind } from "@/lib/types";

const TURN_DURATION_MS = 30_000;
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
// This is an endless survival/escape game: the only outcomes are jumping away
// (win) or losing the hull (loss), with reinforcements arriving indefinitely.
// There's no fixed round limit, so we use the codebase's "endless" sentinel
// (matching liars-dice/frankenbeasts) rather than a misleading hard cap.
const MAX_ROUNDS = 999;
const STARTING_HULL = 10;
const SHIELD_CAP = 6;
// Fixed damage a single `shoot` action deals (no longer a random roll).
const SHOT_DAMAGE = 3;
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
    health: 8,
    maxHealth: 8,
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

// Preferred way to roll inside an action handler: returns the value AND the
// spaceship with its RNG cursor already advanced. Bundling the bump with the
// draw makes it impossible to forget — a forgotten increment would silently
// correlate repeated identical actions (same player + same target) on the same
// salt. (Batch setup like createThreats/createReinforcementWave bumps the cursor
// once per wave instead, since each entry already carries a distinct salt.)
function drawInt(
  state: GameState,
  spaceship: SpaceshipGameState,
  salt: string,
  min: number,
  max: number
): { value: number; spaceship: SpaceshipGameState } {
  return {
    value: rollInt(state, salt, min, max),
    spaceship: { ...spaceship, rngCursor: spaceship.rngCursor + 1 }
  };
}

// Enemies arrive as a continuous per-round stream rather than batched waves.
// New contacts always enter at the far edge (T-3) and march inward as their
// attack countdown ticks each enemy phase, passing through three approach zones
// (T-3 -> T-2 -> T-1) before they fire.
const SPAWN_DISTANCE = 3;
// The random portion of a round's spawn is drawn from this pool (no destroyer —
// destroyers arrive on their own cadence below).
const STREAM_KINDS: SpaceshipThreatKind[] = ["raider", "missile", "stealth_ship"];
// The random stream scales directly with crew size so per-player pressure stays
// roughly constant: an n-player crew faces between n-2 and n contacts per round
// (before the difficulty ramp adds more). Energy regen and the number of actions
// per round both scale linearly with crew size, so the spawn count does too —
// smaller crews face fewer contacts, larger crews more.

/**
 * Upper bound for a round's random spawn count: n for an n-player crew. Pure
 * (and exported) so the rebalance is testable and seeded replays stay
 * deterministic for a given crew. Floored at 1 so even a solo crew sees contacts.
 */
export function spawnStreamMax(playerCount: number): number {
  return Math.max(1, playerCount);
}

/**
 * Lower bound for a round's random spawn count: n - 2 for an n-player crew, so
 * larger crews never coast through near-empty rounds. Pure (and exported) for
 * testability and deterministic seeded replays; floored at 1 (every round brings
 * at least one contact) and always stays <= spawnStreamMax.
 */
export function spawnStreamMin(playerCount: number): number {
  return Math.max(1, playerCount - 2);
}
// A guaranteed Destroyer joins every Nth round (excluding the initial round 0).
const DESTROYER_EVERY = 3;
// Threat level rises one tier every this many rounds. It's the single source of
// truth for the difficulty ramp (each tier adds another contact to the stream)
// and feeds the HUD's escalation meter.
const ROUNDS_PER_THREAT_TIER = 3;

/**
 * The escalation tier for a given round — a pure function so the HUD meter and
 * the spawn intensity can't drift, and seeded replays stay deterministic. Tier 1
 * is the opening; it climbs one tier every ROUNDS_PER_THREAT_TIER rounds.
 */
export function threatLevelForRound(roundIndex: number): number {
  return Math.floor(Math.max(0, roundIndex) / ROUNDS_PER_THREAT_TIER) + 1;
}

// Roll the kinds that spawn at the start of a given round. The random count comes
// from the seeded RNG (salted per round) so the encounter replays deterministically.
// The random range scales with crew size (see spawnStreamMax).
function rollSpawnKinds(state: GameState, roundIndex: number, playerCount: number): SpaceshipThreatKind[] {
  let count = rollInt(state, `spawn-r${roundIndex}:count`, spawnStreamMin(playerCount), spawnStreamMax(playerCount));
  // Difficulty ramp: each threat tier above the first adds another contact.
  count += threatLevelForRound(roundIndex) - 1;
  // Never open the battle empty.
  if (roundIndex === 0) count = Math.max(1, count);

  const kinds: SpaceshipThreatKind[] = [];
  // Heavy on cadence (every 3rd round), excluding the initial round 0.
  if (roundIndex >= DESTROYER_EVERY && roundIndex % DESTROYER_EVERY === 0) {
    kinds.push("destroyer");
  }
  for (let index = 0; index < count; index += 1) {
    kinds.push(STREAM_KINDS[rollInt(state, `spawn-r${roundIndex}:kind:${index}`, 0, STREAM_KINDS.length - 1)]);
  }
  return kinds;
}

// Spawn this round's stream onto the field at T-3. Bumps the RNG cursor once for
// the whole batch (each entry already carries a distinct salt), mirroring the old
// per-wave bump so replays stay deterministic. Called as a new round opens.
function spawnRoundThreats(state: GameState, spaceship: SpaceshipGameState, now: number, roundIndex: number, playerCount: number): SpaceshipGameState {
  const kinds = rollSpawnKinds(state, roundIndex, playerCount);
  if (!kinds.length) {
    return { ...spaceship, rngCursor: spaceship.rngCursor + 1 };
  }
  const newThreats: SpaceshipThreat[] = kinds.map((kind, index) => ({
    ...THREAT_LIBRARY[kind],
    id: `threat-r${roundIndex}-${index + 1}`,
    attacksInTurns: SPAWN_DISTANCE
  }));
  return appendLog(
    {
      ...spaceship,
      threats: [...spaceship.threats, ...newThreats],
      rngCursor: spaceship.rngCursor + 1
    },
    `New contacts on approach: ${newThreats.map((threat) => threat.name).join(", ")}.`,
    now,
    roundIndex
  );
}

function createStartedState(room: Room, state: GameState, now: number): GameState {
  const seed = createRoundSeed();
  const baseSpaceship: SpaceshipGameState = {
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
    threatLevel: threatLevelForRound(0),
    activePlayerId: firstPlayerId(room),
    playersActedThisRound: [],
    rngCursor: 0,
    crewSteps: [],
    log: []
  };
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
    spaceship: baseSpaceship
  };

  // The opening contacts are this round's stream (round 0, floored to >=1); every
  // subsequent round spawns a fresh stream as it opens (see finishEnemyPhase).
  const spaceship: SpaceshipGameState = appendLog(
    spawnRoundThreats(seededState, baseSpaceship, now, 0, room.players.length),
    "Enemy contacts detected. More are inbound — charge the jump drive and hold the hull.",
    now,
    0
  );

  return {
    ...seededState,
    state: "player_turn",
    roundIndex: 0,
    maxRounds: MAX_ROUNDS,
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

// Single source of truth for a crew action's description: feeds both the round
// log and the enemy-phase reveal frame (see appendCrewStep) so they can't drift.
// Only the non-terminal crew actions reach here — the jump actions end the game
// and write their own (odds-aware) messages directly.
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

  // The two jump actions end the game outright, so they resolve up front: they
  // never record a crew step (there's no round left to recap) and write their
  // own odds-aware messages.
  if (action === "jump_away") {
    if (spaceship.ship.jumpCharge < spaceship.ship.jumpTarget) return state;
    return finishState(state, appendLog(spaceship, `${actorName} engages the jump drive. The crew escapes!`, now, state.roundIndex), "won");
  }
  if (action === "emergency_jump") {
    // Only a fallback when the safe jump isn't available. Jumping itself is free —
    // the gamble is on how charged the drive already is, not on the reserve.
    if (spaceship.ship.jumpCharge >= spaceship.ship.jumpTarget) return state;
    const chance = emergencyJumpChance(spaceship.ship);
    const { value: roll, spaceship: bumped } = drawInt(state, spaceship, `${actorPlayerId}:emergency_jump`, 1, 100);
    if (roll <= chance) {
      return finishState(
        state,
        appendLog(bumped, `${actorName} forces an emergency jump (${chance}% odds) — it works! The crew escapes!`, now, state.roundIndex),
        "won"
      );
    }
    // A failed gamble overloads the drive and tears the ship apart — game over.
    return finishState(
      state,
      appendLog(
        bumped,
        `${actorName} attempts an emergency jump (${chance}% odds) — it fails, the drive overloads and the ship is torn apart.`,
        now,
        state.roundIndex
      ),
      "lost"
    );
  }

  // Effect summary for the enemy-phase reveal recap; filled in per action.
  const crewAction: Omit<SpaceshipCrewAction, "id"> = {
    playerId: actorPlayerId,
    playerName: actorName,
    action,
    timedOut: false,
    energySpent: cost
  };
  let nextSpaceship = spaceship;

  if (action === "shoot") {
    if (!targetThreatId) return state;
    const threat = spaceship.threats.find((entry) => entry.id === targetThreatId);
    if (!threat) return state;
    const damage = SHOT_DAMAGE;
    const killed = threat.health - damage <= 0;
    const nextThreats = nextSpaceship.threats
      .map((entry) => (entry.id === targetThreatId ? { ...entry, health: entry.health - damage, attackRevealed: true } : entry))
      .filter((entry) => entry.health > 0);
    crewAction.targetThreatId = threat.id;
    crewAction.targetThreatName = threat.name;
    crewAction.targetThreatKind = threat.kind;
    crewAction.damageDealt = damage;
    crewAction.killedTarget = killed;
    nextSpaceship = { ...nextSpaceship, threats: nextThreats };
  } else if (action === "shield") {
    const shieldsBefore = nextSpaceship.ship.shields;
    // Costly, but charges shields straight to the cap — it's a flat-priced top-up,
    // not a per-point trickle, so re-shielding before they're depleted wastes the
    // unused headroom.
    const shieldsAfter = nextSpaceship.ship.shieldCap;
    crewAction.shieldsGained = shieldsAfter - shieldsBefore;
    nextSpaceship = { ...nextSpaceship, ship: { ...nextSpaceship.ship, shields: shieldsAfter } };
  } else if (action === "charge_jump") {
    const jumpBefore = nextSpaceship.ship.jumpCharge;
    const jumpAfter = Math.min(nextSpaceship.ship.jumpTarget, jumpBefore + 1);
    crewAction.jumpGained = jumpAfter - jumpBefore;
    nextSpaceship = { ...nextSpaceship, ship: { ...nextSpaceship.ship, jumpCharge: jumpAfter } };
  }
  // `pass` needs no state change beyond banking the turn's regen (the shared tail
  // below skips the energy spend, since passing costs nothing).

  // One message for both the round log and the reveal frame (appendCrewStep
  // derives the frame text from the same helper), so they stay in lockstep.
  nextSpaceship = appendLog(nextSpaceship, crewStepMessage(crewAction), now, state.roundIndex);
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
      spawnRoundThreats(
        state,
        {
          ...spaceship,
          threatLevel: threatLevelForRound(state.roundIndex + 1),
          revealSteps: undefined,
          crewSteps: [],
          playersActedThisRound: [],
          activePlayerId: firstPlayerId(room)
        },
        now,
        state.roundIndex + 1,
        room.players.length
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
      maxRounds: MAX_ROUNDS,
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

function parseSpaceshipAction(input: string): SpaceshipActionType | null {
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
