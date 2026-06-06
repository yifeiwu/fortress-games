// The 22 Major Arcana, with a generic upright/reversed interpretation per card.
// Interpretations are intentionally broad ("cold reading" style) so any card
// reads plausibly for any question.

export interface TarotCard {
  id: string;
  name: string;
  /** Traditional Major Arcana numeral (e.g. "0", "XIII"), used as the card face. */
  numeral: string;
  upright: string;
  reversed: string;
}

/** Spread positions, in flip order. Length determines how many cards are drawn. */
export const TAROT_POSITIONS = ["Past", "Present", "Future"] as const;

/** A short gloss of what each spread position represents. */
export const TAROT_POSITION_MEANINGS: Record<(typeof TAROT_POSITIONS)[number], string> = {
  Past: "what shaped this",
  Present: "where things stand",
  Future: "where this path leads"
};

export const TAROT_CARDS: TarotCard[] = [
  {
    id: "the_fool",
    name: "The Fool",
    numeral: "0",
    upright: "A leap into the unknown. New beginnings, spontaneity, and trusting where the road leads.",
    reversed: "Hesitation at the edge. Reckless choices or fear of the first step hold you back."
  },
  {
    id: "the_magician",
    name: "The Magician",
    numeral: "I",
    upright: "You already hold every tool you need. Focus your will and the path opens.",
    reversed: "Scattered energy or untapped talent. Power exists but goes unused or misdirected."
  },
  {
    id: "the_high_priestess",
    name: "The High Priestess",
    numeral: "II",
    upright: "Trust the quiet voice within. Hidden knowledge surfaces when you stop forcing answers.",
    reversed: "Ignored intuition. Secrets stay buried and the inner voice is drowned out by noise."
  },
  {
    id: "the_empress",
    name: "The Empress",
    numeral: "III",
    upright: "Abundance and nurture. Something you've tended is ready to bloom.",
    reversed: "Creative block or neglect. Care has been withheld — from a project or from yourself."
  },
  {
    id: "the_emperor",
    name: "The Emperor",
    numeral: "IV",
    upright: "Structure and authority. Stability comes from discipline and clear boundaries.",
    reversed: "Rigidity or control slipping. Order imposed too hard, or not at all."
  },
  {
    id: "the_hierophant",
    name: "The Hierophant",
    numeral: "V",
    upright: "Tradition and guidance. A mentor, institution, or shared belief offers grounding.",
    reversed: "Breaking with convention. The old rules no longer fit — you forge your own."
  },
  {
    id: "the_lovers",
    name: "The Lovers",
    numeral: "VI",
    upright: "A meaningful choice of the heart. Alignment of values and genuine connection.",
    reversed: "Disharmony or a choice avoided. Values clash, or you're pulled two ways at once."
  },
  {
    id: "the_chariot",
    name: "The Chariot",
    numeral: "VII",
    upright: "Momentum through willpower. Hold the reins and victory follows determination.",
    reversed: "Stalled drive or pulling in opposite directions. Control wavers before the finish."
  },
  {
    id: "strength",
    name: "Strength",
    numeral: "VIII",
    upright: "Quiet courage. Gentleness and patience tame what force never could.",
    reversed: "Self-doubt or burnout. The inner fire flickers — be kind to yourself first."
  },
  {
    id: "the_hermit",
    name: "The Hermit",
    numeral: "IX",
    upright: "A season of reflection. Step back and the answer reveals itself in the silence.",
    reversed: "Isolation or avoidance. Solitude has tipped into hiding from what you must face."
  },
  {
    id: "wheel_of_fortune",
    name: "Wheel of Fortune",
    numeral: "X",
    upright: "The cycle turns in your favor. A shift of luck and timely change arrive.",
    reversed: "Resisting the turn. A run of bad timing, or clinging to what is already passing."
  },
  {
    id: "justice",
    name: "Justice",
    numeral: "XI",
    upright: "Truth and fair outcomes. Cause and effect balance — accountability brings clarity.",
    reversed: "Imbalance or evasion. A reckoning is dodged and consequences linger unresolved."
  },
  {
    id: "the_hanged_man",
    name: "The Hanged Man",
    numeral: "XII",
    upright: "Surrender and a new angle. Letting go reveals what struggle hid.",
    reversed: "Stalling and needless sacrifice. You're stuck waiting for a sign that won't come."
  },
  {
    id: "death",
    name: "Death",
    numeral: "XIII",
    upright: "An ending that clears the way. Transformation — release the old to make room.",
    reversed: "Clinging to what's done. Change is overdue but resisted, dragging out the close."
  },
  {
    id: "temperance",
    name: "Temperance",
    numeral: "XIV",
    upright: "Balance and patience. Blend the extremes and a steady middle path emerges.",
    reversed: "Excess or impatience. Things feel out of proportion and harmony is hard to find."
  },
  {
    id: "the_devil",
    name: "The Devil",
    numeral: "XV",
    upright: "Attachment and temptation. Notice what binds you — the chains are looser than they look.",
    reversed: "Breaking free. A habit or fear loses its grip and you reclaim your power."
  },
  {
    id: "the_tower",
    name: "The Tower",
    numeral: "XVI",
    upright: "Sudden upheaval. A shaky foundation falls so something truer can be built.",
    reversed: "Disaster averted, or change delayed. The shake-up is softened but not escaped."
  },
  {
    id: "the_star",
    name: "The Star",
    numeral: "XVII",
    upright: "Hope and renewal. After the storm, calm and quiet faith light the way.",
    reversed: "Doubt dims the light. Faith feels distant — reconnect with what inspires you."
  },
  {
    id: "the_moon",
    name: "The Moon",
    numeral: "XVIII",
    upright: "Illusion and intuition. Not all is as it seems; let feeling guide you through the fog.",
    reversed: "Confusion lifting. Hidden truths come to light and anxiety begins to ease."
  },
  {
    id: "the_sun",
    name: "The Sun",
    numeral: "XIX",
    upright: "Joy and clarity. Warmth, success, and the simple confidence of being seen.",
    reversed: "Clouded brightness. Optimism is there but dimmed — look for the small wins."
  },
  {
    id: "judgement",
    name: "Judgement",
    numeral: "XX",
    upright: "A wake-up call. Reflection brings reckoning, forgiveness, and a clear next step.",
    reversed: "Self-doubt or a call ignored. You're avoiding an honest look back."
  },
  {
    id: "the_world",
    name: "The World",
    numeral: "XXI",
    upright: "Completion and wholeness. A cycle closes with accomplishment and belonging.",
    reversed: "Almost there. A loose end keeps the finish line just out of reach."
  }
];

export const TAROT_CARDS_BY_ID: Record<string, TarotCard> = Object.fromEntries(
  TAROT_CARDS.map((card) => [card.id, card])
);

/**
 * Short display names for the card face. Drops the leading article and condenses
 * longer titles so every label sits at a similar length within the card's name
 * band (e.g. "The High Priestess" → "Priestess").
 */
const TAROT_SHORT_NAMES: Record<string, string> = {
  the_fool: "The Fool",
  the_magician: "Magician",
  the_high_priestess: "Priestess",
  the_empress: "Empress",
  the_emperor: "Emperor",
  the_hierophant: "Hierophant",
  the_lovers: "Lovers",
  the_chariot: "Chariot",
  strength: "Strength",
  the_hermit: "Hermit",
  wheel_of_fortune: "Fortune",
  justice: "Justice",
  the_hanged_man: "Hanged Man",
  death: "Death",
  temperance: "Temperance",
  the_devil: "The Devil",
  the_tower: "The Tower",
  the_star: "The Star",
  the_moon: "The Moon",
  the_sun: "The Sun",
  judgement: "Judgement",
  the_world: "The World"
};

export function getTarotShortName(cardId: string): string {
  return TAROT_SHORT_NAMES[cardId] ?? TAROT_CARDS_BY_ID[cardId]?.name ?? "";
}

export function getTarotCard(cardId: string): TarotCard | undefined {
  return TAROT_CARDS_BY_ID[cardId];
}
