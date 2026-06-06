// ─── Spaceship Defense / Starshield Crisis ───────────────────────────────────

/** Game phases owned by the spaceship-defense game. */
export type SpaceshipGameStatus = "player_turn" | "enemy_phase";

export type SpaceshipActionType = "shoot" | "shield" | "charge_jump" | "jump_away" | "emergency_jump" | "pass";
export type SpaceshipThreatKind = "raider" | "destroyer" | "missile" | "stealth_ship";

export interface SpaceshipShipState {
  hull: number;
  maxHull: number;
  shields: number;
  shieldCap: number;
  jumpCharge: number;
  jumpTarget: number;
  /**
   * Shared crew power reserve. Regenerates by 1 at the start of every player's
   * turn; most actions spend it (passing simply banks the regen).
   */
  energy: number;
  energyCap: number;
}

export interface SpaceshipThreat {
  id: string;
  kind: SpaceshipThreatKind;
  name: string;
  health: number;
  maxHealth: number;
  attack: number;
  attackRevealed: boolean;
  attacksInTurns: number;
  attackInterval: number;
  oneShot: boolean;
}

interface SpaceshipLogEntry {
  id: string;
  message: string;
  createdAt: number;
  roundIndex: number;
}

/**
 * What a single crew member did on their turn, captured so the enemy-phase
 * reveal can recap the crew's choices (and their effect) before showing the
 * incoming fire. Reset at the start of every round.
 */
export interface SpaceshipCrewAction {
  id: string;
  playerId: string;
  playerName: string;
  action: SpaceshipActionType;
  /** True when the turn was auto-passed because the timer ran out. */
  timedOut: boolean;
  energySpent: number;
  /** Populated for `shoot`. */
  targetThreatId?: string;
  targetThreatName?: string;
  targetThreatKind?: SpaceshipThreatKind;
  damageDealt?: number;
  killedTarget?: boolean;
  /** Populated for `shield`. */
  shieldsGained?: number;
  /** Populated for `charge_jump`. */
  jumpGained?: number;
}

/**
 * Structured breakdown of a single enemy attack, so the reveal can show exactly
 * how the hit landed (shields soaking vs hull damage) rather than just a string.
 */
export interface SpaceshipHitDetail {
  threatId: string;
  threatName: string;
  threatKind: SpaceshipThreatKind;
  /** Raw incoming damage. `revealed` is false for stealth attacks (shown as "?"). */
  attack: number;
  revealed: boolean;
  absorbed: number;
  toHull: number;
  shieldsBefore: number;
  shieldsAfter: number;
  hullBefore: number;
  hullAfter: number;
}

/**
 * A single frame in the round play-by-play, snapshotting the ship and threat row
 * immediately AFTER an event resolved. The client replays these so the round
 * unfolds one beat at a time: first each crew member's action (`crew` frames),
 * then the enemy fire (`hit` frames), instead of jumping straight to the
 * post-phase state.
 */
export interface SpaceshipRevealStep {
  id: string;
  message: string;
  ship: SpaceshipShipState;
  threats: SpaceshipThreat[];
  /** Present on crew-action frames. */
  crew?: SpaceshipCrewAction;
  /** Present on enemy-attack frames. */
  hit?: SpaceshipHitDetail;
}

export interface SpaceshipGameState {
  ship: SpaceshipShipState;
  threats: SpaceshipThreat[];
  /**
   * Escalation tier driving how hard each round spawns. A pure function of the
   * round (see threatLevelForRound), stored for the HUD meter. Rises every few
   * rounds — the legible "the longer you stay, the worse it gets" signal.
   */
  threatLevel: number;
  activePlayerId?: string;
  playersActedThisRound: string[];
  outcome?: "won" | "lost";
  rngCursor: number;
  /** Ordered play-by-play of the most recent round (crew actions then enemy fire), for the reveal animation. */
  revealSteps?: SpaceshipRevealStep[];
  /** Crew-action frames captured so far this round; merged ahead of the enemy frames at the reveal. */
  crewSteps: SpaceshipRevealStep[];
  log: SpaceshipLogEntry[];
}
