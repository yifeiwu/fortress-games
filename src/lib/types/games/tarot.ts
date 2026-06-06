// ─── Tarot / Fortune's Veil ───────────────────────────────────────────────────

/** Game phases owned by the tarot game. */
export type TarotGameStatus = "tarot_setup" | "tarot_reading";

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
