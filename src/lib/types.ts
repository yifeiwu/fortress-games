export type Direction = "up" | "down" | "left" | "right";

export type RoomStatus = "lobby" | "in_game" | "ended";
export type GameStatus = "waiting" | "intro" | "round_open" | "round_revealed" | "player_turn" | "enemy_phase" | "pick_phase" | "fight_round" | "fight_reveal" | "tarot_setup" | "tarot_reading" | "dice_roll" | "bidding" | "dice_reveal" | "finished";
export type SpaceshipActionType = "shoot" | "shield" | "charge_jump" | "jump_away" | "emergency_jump" | "pass";
export type SpaceshipThreatKind = "raider" | "destroyer" | "missile" | "stealth_ship";

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
  joinOrder: number;
}

/**
 * Per-room presence ledger: maps a player id to the epoch ms of their last
 * heartbeat. Stored in its own row (`room_presence_state`) so that frequent
 * heartbeats don't bump the room's optimistic version and contend with game
 * moves. `connected` on {@link Player} is derived from these timestamps.
 */
export type RoomPresence = Record<string, number>;

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  content: string;
  createdAt: string;
}

export interface RoundChoice {
  playerId: string;
  direction: Direction;
  submittedAt: number;
  autoSubmitted: boolean;
}

export interface RoundRngRecord {
  roundIndex: number;
  seedHash?: string;
  seedPlain?: string;
  rngAlgo: "mulberry32";
  revealedAt?: number;
}

export interface ScoreEntry {
  playerId: string;
  points: number;
}

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

export interface SpaceshipLogEntry {
  id: string;
  message: string;
  createdAt: number;
  roundIndex: number;
}

/**
 * A threat queued to join the battle on a future round. Telegraphed in the UI so
 * the crew can prepare before it arrives.
 */
export interface SpaceshipReinforcement {
  id: string;
  kind: SpaceshipThreatKind;
  name: string;
  /** Rounds until it joins the threat row (1 = arrives at the start of the next round). */
  arrivesInRounds: number;
  /** Pre-rolled attack countdown applied when it spawns (kept deterministic from the seed). */
  attackCountdown: number;
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
  activePlayerId?: string;
  playersActedThisRound: string[];
  outcome?: "won" | "lost";
  rngCursor: number;
  /** Ordered play-by-play of the most recent round (crew actions then enemy fire), for the reveal animation. */
  revealSteps?: SpaceshipRevealStep[];
  /** Crew-action frames captured so far this round; merged ahead of the enemy frames at the reveal. */
  crewSteps: SpaceshipRevealStep[];
  /** Threats inbound on future rounds, shown to the crew as "incoming". */
  reinforcements: SpaceshipReinforcement[];
  log: SpaceshipLogEntry[];
}

export interface GameState {
  gameType: string;
  state: GameStatus;
  roundIndex: number;
  maxRounds: number;
  roundDeadlineAt?: number;
  leaderPlayerId?: string;
  scores: Record<string, number>;
  choicesByRound: Record<number, Record<string, RoundChoice>>;
  rngByRound: Record<number, RoundRngRecord>;
  spaceship?: SpaceshipGameState;
  frankenbeasts?: FrankenBeastsGameState;
  tarot?: TarotGameState;
  liarsDice?: LiarsDiceGameState;
  version: number;
}

export interface Room {
  code: string;
  gameType: string;
  status: RoomStatus;
  createdAt: number;
  lastActivityAt?: number;
  hostPlayerId: string;
  players: Player[];
  chat: ChatMessage[];
  game: GameState;
}

export interface PlayerSession {
  id: string;
  username?: string;
  roomCode?: string;
  playerId?: string;
  createdAt: number;
  updatedAt: number;
}

// ─── FrankenBeasts ───────────────────────────────────────────────────────────

export type FBPartSlot = "head" | "body" | "tail";

export interface FBPendingPick {
  headId?: string;
  bodyId?: string;
  tailId?: string;
  lockedIn: boolean;
}

export interface FBDamageBuff {
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

// ─── Tarot ───────────────────────────────────────────────────────────────────

/** One drawn card in the spread, resolved deterministically from the seeds. */
export interface TarotDrawnCard {
  cardId: string;
  /** Spread position label, e.g. "Past" / "Present" / "Future". */
  positionLabel: string;
  reversed: boolean;
}

export interface TarotGameState {
  /** Seeker name and question entered by the player; double as the RNG seed. */
  seekerName?: string;
  question?: string;
  /** The full spread, drawn up front; revealed one at a time on the client. */
  cards: TarotDrawnCard[];
  /** How many cards have been flipped so far. */
  revealedCount: number;
}

// ─── Liar's Dice ───────────────────────────────────────────────────────────────

/** A public claim: "at least `quantity` dice across the table show `face`". */
export interface LiarsDiceBid {
  playerId: string;
  quantity: number;
  /** Die face, 1–6. No wilds: only exact matches of this face count. */
  face: number;
  /** True when the timer ran out and the bid was placed automatically. */
  autoSubmitted: boolean;
  submittedAt: number;
}

export interface LiarsDicePlayerState {
  playerId: string;
  /** Cups remaining; 0 means knocked out. */
  diceCount: number;
  /**
   * This round's roll, length === diceCount. Hidden from opponents on the client
   * during play (only the viewer's own dice render) and shown to all on reveal.
   */
  dice: number[];
  eliminated: boolean;
}

/** Snapshot of a resolved "Liar!" call, shown during the dice_reveal phase. */
export interface LiarsDiceRevealState {
  bid: LiarsDiceBid;
  callerPlayerId: string;
  /** Actual count of dice showing `bid.face` across the whole table. */
  actualCount: number;
  /** True if the bid held (count ≥ quantity) → the caller loses a die. */
  bidHeld: boolean;
  loserPlayerId: string;
  /** Whether the loser was knocked out by losing this die. */
  loserEliminated: boolean;
  /** Every player's dice at the moment of the call, for the reveal. */
  dice: Record<string, number[]>;
}

export interface LiarsDiceLogEntry {
  id: string;
  message: string;
  roundIndex: number;
}

export interface LiarsDiceGameState {
  players: LiarsDicePlayerState[];
  /** Whose turn it is during the bidding phase. */
  activePlayerId?: string;
  /** Who opens the bidding this round (loser of the previous round). */
  startPlayerId?: string;
  /** The current standing bid, or undefined when the opener must bid. */
  currentBid?: LiarsDiceBid;
  /** Populated during dice_reveal after a call resolves. */
  reveal?: LiarsDiceRevealState;
  winnerPlayerId?: string;
  log: LiarsDiceLogEntry[];
}
