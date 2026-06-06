// ─── FrankenBeasts ────────────────────────────────────────────────────────────

/** Game phases owned by the FrankenBeasts game. */
export type FrankenBeastsGameStatus = "pick_phase" | "fight_round" | "fight_reveal";

type FBPartSlot = "head" | "body" | "tail";

interface FBPendingPick {
  headId?: string;
  bodyId?: string;
  tailId?: string;
  lockedIn: boolean;
}

interface FBDamageBuff {
  bonus: number;
  turnsRemaining: number;
}

export interface FBCombatStatus {
  headId: string;
  bodyId: string;
  tailId: string;
  hp: number;
  maxHp: number;
  poisonDamage: number;
  poisonTurns: number;
  damageBuff: FBDamageBuff;
}

export interface FBRoundAction {
  playerId: string;
  abilityId: string;
  autoSubmitted: boolean;
}

export interface FBLogEntry {
  id: string;
  message: string;
  roundIndex: number;
}

/**
 * A single frame in the play-by-play of a fight round. Captured server-side as
 * `resolveFightRound` mutates combat state, so the client can replay the round
 * event-by-event (HP draining at each step) instead of jumping to the result.
 * `states` is the snapshot of every fighter's combat status immediately AFTER
 * this event resolved.
 */
export interface FBRevealStep {
  id: string;
  message: string;
  states: Record<string, FBCombatStatus>;
  /**
   * Set to the acting fighter's id when this step is a direct attack that dealt
   * damage. Drives the "charge" animation client-side so only real attacks make
   * a beast lunge (poison/passive/retaliation ticks leave it standing).
   */
  attackerId?: string;
}

export interface FrankenBeastsGameState {
  /** The two players fighting in this match. Extra room members are spectators. */
  fighterIds?: [string, string];
  pendingPicks: Record<string, FBPendingPick>;
  combatStates: Record<string, FBCombatStatus>;
  /** Selected ability per player during fight_round; committed to roundActions on timeout. */
  roundSelections: Record<string, string>;
  roundActions: Record<string, FBRoundAction>;
  lastRoundActions: Record<string, FBRoundAction>;
  /** Ordered play-by-play of the most recent round, for the reveal animation. */
  revealSteps?: FBRevealStep[];
  log: FBLogEntry[];
  winnerId?: string;
  isDraw?: boolean;
}
