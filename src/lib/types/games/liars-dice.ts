// ─── Liar's Dice / Bluffer's Hoard ────────────────────────────────────────────

/** Game phases owned by the Liar's Dice game. */
export type LiarsDiceGameStatus = "dice_roll" | "bidding" | "dice_reveal";

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
interface LiarsDiceRevealState {
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
