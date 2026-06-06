import { TAROT_POSITION_MEANINGS, getTarotCard } from "@/lib/game/plugins/tarot-data";
import type { TarotDrawnCard } from "@/lib/types";

interface CardView {
  id: string;
  label: string;
  /** What the spread position represents (e.g. "what shaped this"). */
  meaning: string;
  name: string;
  reversed: boolean;
  /** Full active interpretation for the card's current orientation. */
  interpretation: string;
  /** Short lead clause of the active interpretation, for mid-sentence use. */
  theme: string;
}

/** The first sentence of an interpretation, lowercased for embedding in prose. */
function leadClause(text: string): string {
  const end = text.search(/[.!?]/);
  const clause = (end === -1 ? text : text.slice(0, end)).trim();
  return clause.charAt(0).toLowerCase() + clause.slice(1);
}

function toViews(cards: TarotDrawnCard[]): CardView[] {
  return cards.flatMap((card) => {
    const meta = getTarotCard(card.cardId);
    if (!meta) return [];
    const meaning = TAROT_POSITION_MEANINGS[card.positionLabel as keyof typeof TAROT_POSITION_MEANINGS] ?? "";
    return [
      {
        id: card.cardId,
        label: card.positionLabel,
        meaning,
        name: meta.name,
        reversed: card.reversed,
        interpretation: card.reversed ? meta.reversed : meta.upright,
        theme: leadClause(card.reversed ? meta.reversed : meta.upright)
      }
    ];
  });
}

function named(view: CardView): string {
  return view.reversed ? `${view.name} reversed` : view.name;
}

interface TriadMember {
  id: string;
  reversed: boolean;
}

interface TriadReading {
  /** Three card+orientation members, matched order-independently. */
  cards: [TriadMember, TriadMember, TriadMember];
  /** Authored prose for this exact set of cards in this exact orientation. */
  read: string;
}

/** Concise constructors for triad members: upright / reversed. */
const up = (id: string): TriadMember => ({ id, reversed: false });
const rev = (id: string): TriadMember => ({ id, reversed: true });

/**
 * Hand-written readings for particularly strong three-card combinations.
 *
 * Matching is order-independent (position doesn't matter) but orientation-aware:
 * each upright/reversed permutation of a triad is its own unique entry with its
 * own custom read. A triad's eight orientation variants must be authored
 * individually; any variant left unauthored simply falls back to the procedural
 * weave. Because a given set of three cards lands in only ~1 of 1,540 readings,
 * these act as rare "signature" spreads.
 */
const TRIADS: TriadReading[] = [
  // ── Death · The Tower · The World — the deck's three great endings ──
  {
    cards: [up("death"), up("the_tower"), up("the_world")],
    read: "Three of the deck's great turning points fall together, all upright and all moving the same way. The Tower tears down what no longer holds, Death clears the rubble, and The World seals the cycle complete. This is ending as accomplishment — nothing is being taken from you that wasn't already finished."
  },
  {
    cards: [up("death"), up("the_tower"), rev("the_world")],
    read: "The Tower's upheaval and Death's clean break both land true, but The World arrives reversed — completion held just out of reach. The endings are real and necessary; the sense of closure simply hasn't caught up yet. One loose thread stands between you and the finish."
  },
  {
    cards: [up("death"), rev("the_tower"), up("the_world")],
    read: "Death and The World stand upright around a reversed Tower: the great collapse is softened, delayed, or already survived. The transformation still completes its arc — you reach wholeness without the wall coming down all at once. An ending earned gently rather than seized by force."
  },
  {
    cards: [up("death"), rev("the_tower"), rev("the_world")],
    read: "Death stands clear while both The Tower and The World fall reversed. The upheaval is muffled and the closure incomplete — you're ready to release the old, yet the structure won't quite break and the cycle won't quite close. Real transformation waiting on a shake-up that keeps not coming."
  },
  {
    cards: [rev("death"), up("the_tower"), up("the_world")],
    read: "The Tower falls and The World completes, both upright, but Death lands reversed — you cling to what is already over. The upheaval clears the ground and the cycle stands ready to close, yet something in you keeps holding the door. The ending is built; only the letting-go remains."
  },
  {
    cards: [rev("death"), up("the_tower"), rev("the_world")],
    read: "The Tower's upheaval is the only thing standing upright here, with Death and The World both reversed. Change crashes in while you resist its meaning and closure slips away. The harder you grip what's ending, the longer the wall keeps falling."
  },
  {
    cards: [rev("death"), rev("the_tower"), up("the_world")],
    read: "The World completes upright while both Death and The Tower fall reversed — a strange, quiet finish. The dramatic collapse never came and the ending was resisted, yet somehow the cycle closes anyway. Wholeness arrives almost by accident, through the back door rather than the broken wall."
  },
  {
    cards: [rev("death"), rev("the_tower"), rev("the_world")],
    read: "The deck's three great endings all fall reversed at once — a rare and stubborn spread. The Tower's blow is held back, Death's release is refused, and The World's circle won't close. Everything here is poised to end and nothing is allowed to; the only way through is to stop bracing against the change you already know is due."
  },

  // ── The Sun · The Star · The World — the deck's three brightest cards ──
  {
    cards: [up("the_sun"), up("the_star"), up("the_world")],
    read: "The Sun, The Star, and The World together upright — about as bright a spread as the deck holds. Hope, joy, and completion arrive at once: faith rewarded, warmth returned, and a cycle closing in fullness. If you were waiting for permission to believe things are genuinely good, here it is."
  },
  {
    cards: [up("the_sun"), up("the_star"), rev("the_world")],
    read: "The Sun and The Star blaze upright while The World arrives reversed. The warmth and the hope are entirely real — only the sense of completion lags behind, a single loose end keeping the celebration from being official. Joy is already here; the finish line is a step away."
  },
  {
    cards: [up("the_sun"), rev("the_star"), up("the_world")],
    read: "The Sun and The World stand upright around a reversed Star. The outcome is bright and the cycle completes, yet your own faith flickers — you may reach the good ending without quite trusting it. Let the warmth convince you of what doubt won't."
  },
  {
    cards: [up("the_sun"), rev("the_star"), rev("the_world")],
    read: "The Sun shines alone upright while The Star and The World both fall reversed. The warmth is real but unaccompanied by faith or closure — a good day inside an unfinished, uncertain stretch. Take the light where it lands and let it carry you past the doubt."
  },
  {
    cards: [rev("the_sun"), up("the_star"), up("the_world")],
    read: "The Star and The World stand upright while The Sun falls reversed — hope and completion intact, but the open joy is dimmed. The good outcome arrives; you may simply be too clouded to feel its full warmth. Clarity is coming, even if today it's muted."
  },
  {
    cards: [rev("the_sun"), up("the_star"), rev("the_world")],
    read: "Only The Star holds upright here, with The Sun and The World both reversed. Faith persists while joy is clouded and the cycle stays unfinished — hope doing the heavy lifting through a flat, incomplete stretch. Keep believing; it's the one light still burning."
  },
  {
    cards: [rev("the_sun"), rev("the_star"), up("the_world")],
    read: "The World completes upright while both The Sun and The Star fall reversed. You reach the finish, but without the warmth or the faith that should accompany it — an ending that feels more like relief than triumph. The wholeness is real; let it slowly thaw the rest."
  },
  {
    cards: [rev("the_sun"), rev("the_star"), rev("the_world")],
    read: "The deck's three brightest cards all fall reversed together — a rare dimming of the lights. Joy is clouded, faith is distant, and the circle won't quite close. None of it is lost, only obscured; this is a spread that asks you to tend the small embers until the sky clears."
  },

  // ── The Fool · The Magician · The World — the Fool's Journey, end to end ──
  {
    cards: [up("the_fool"), up("the_magician"), up("the_world")],
    read: "The Fool's Journey laid out end to end, all upright. A leap into the unknown, every tool already in hand, and a cycle that closes complete — beginning, means, and arrival in perfect sequence. Whatever you're starting, the deck says you have what it takes to finish it."
  },
  {
    cards: [up("the_fool"), up("the_magician"), rev("the_world")],
    read: "The Fool leaps and The Magician holds every tool, both upright, but The World arrives reversed. The start is brave and the capability real — only the finish stays just out of reach, one loose end shy of complete. Keep going; you're closer than the closure feels."
  },
  {
    cards: [up("the_fool"), rev("the_magician"), up("the_world")],
    read: "The Fool and The World stand upright around a reversed Magician. The leap is taken and the cycle does complete, yet your power feels scattered in the middle — you arrive almost in spite of how unfocused the work felt. Trust that the tools were there even when they didn't feel sharp."
  },
  {
    cards: [up("the_fool"), rev("the_magician"), rev("the_world")],
    read: "The Fool leaps upright while both The Magician and The World fall reversed. The willingness to begin is real, but the means feel scattered and the finish won't close — a bold start waiting on focus it hasn't found yet. Gather your tools before reaching for the end."
  },
  {
    cards: [rev("the_fool"), up("the_magician"), up("the_world")],
    read: "The Magician and The World stand upright while The Fool falls reversed. You hold every tool and the cycle stands ready to complete — only the first step stalls, held back by hesitation or fear of the leap. Everything is in place but the nerve to begin."
  },
  {
    cards: [rev("the_fool"), up("the_magician"), rev("the_world")],
    read: "The Magician shines upright between a reversed Fool and a reversed World. The capability is unmistakable, yet you hesitate at the start and the finish won't close — power with no leap to launch it and no arrival to land it. The tools are waiting; the willingness is the missing piece."
  },
  {
    cards: [rev("the_fool"), rev("the_magician"), up("the_world")],
    read: "The World completes upright while both The Fool and The Magician fall reversed. Somehow the cycle closes despite a stalled start and scattered means — you arrive, but it felt like fumbling the whole way. Take the completion as proof you were more capable than you believed."
  },
  {
    cards: [rev("the_fool"), rev("the_magician"), rev("the_world")],
    read: "The Fool's Journey laid out end to end and every card reversed — a rare, knotted spread. The leap is feared, the tools sit unused, and the cycle won't close. Nothing is broken here, only stalled; the whole arc is waiting on a single brave first step to set it moving."
  },

  // ── The Moon · The Sun · The Star — the three celestial cards ──
  {
    cards: [up("the_moon"), up("the_sun"), up("the_star")],
    read: "The three celestial cards together, all upright — the deck's whole sky at once. The Moon's fog, The Sun's warmth, and The Star's quiet hope held in one spread: intuition, clarity, and faith all lit. Feel your way through what's unclear; the light is on its way and worth the wait."
  },
  {
    cards: [up("the_moon"), up("the_sun"), rev("the_star")],
    read: "The Moon and The Sun stand upright while The Star falls reversed. There's fog to feel through and real warmth waiting beyond it, but faith flickers in between — you may doubt the light even as it rises. Let the warmth, not the worry, tell you what's true."
  },
  {
    cards: [up("the_moon"), rev("the_sun"), up("the_star")],
    read: "The Moon and The Star hold upright around a reversed Sun. Intuition and hope are intact, but the open joy is clouded — you sense your way forward and keep the faith, yet the warmth hasn't broken through. Trust the inner light while the outer one clears."
  },
  {
    cards: [up("the_moon"), rev("the_sun"), rev("the_star")],
    read: "The Moon stands upright while both The Sun and The Star fall reversed. You're still feeling through the fog, but warmth is dimmed and faith feels distant — the hardest stretch of the night, before clarity arrives. Let intuition carry you; the sky does clear."
  },
  {
    cards: [rev("the_moon"), up("the_sun"), up("the_star")],
    read: "The Sun and The Star blaze upright while The Moon falls reversed — and reversed, The Moon means the fog is lifting. Confusion clears just as warmth and hope arrive: hidden truths surface, anxiety eases, and the path brightens all at once. This is the dawn after a long, uncertain night."
  },
  {
    cards: [rev("the_moon"), up("the_sun"), rev("the_star")],
    read: "The Sun shines upright between a reversed Moon and a reversed Star. The fog is lifting and the warmth is real, but faith lags behind — clarity arriving faster than you can trust it. The good news is true; let yourself believe it."
  },
  {
    cards: [rev("the_moon"), rev("the_sun"), up("the_star")],
    read: "The Star holds upright while both The Moon and The Sun fall reversed. The confusion is clearing and faith endures, even though the warmth stays dimmed — hope steady in a half-lit sky. Keep believing; the brightness is the last thing to return, not the first."
  },
  {
    cards: [rev("the_moon"), rev("the_sun"), rev("the_star")],
    read: "All three celestial cards reversed at once — the whole sky overcast. Yet reversed, The Moon means the fog is already lifting, even as warmth and faith stay low. The hardest part is passing; tend the small lights and let the clearing finish on its own time."
  },

  // ── The Lovers · The Devil · The Tower — attachment and rupture ──
  {
    cards: [up("the_lovers"), up("the_devil"), up("the_tower")],
    read: "The Lovers, The Devil, and The Tower together upright — connection, attachment, and collapse in one spread. A bond you value sits beside the thing that binds you, and the structure around them is shaking loose. What's real in the connection will survive the shake-up; what was only attachment won't."
  },
  {
    cards: [up("the_lovers"), up("the_devil"), rev("the_tower")],
    read: "The Lovers and The Devil stand upright while The Tower falls reversed. A genuine bond and a binding attachment both run strong, but the collapse that would force the issue is softened or delayed. The reckoning between love and attachment is coming — just not yet, and not all at once."
  },
  {
    cards: [up("the_lovers"), rev("the_devil"), up("the_tower")],
    read: "The Lovers stand upright, The Devil reversed, The Tower upright — and reversed, The Devil means a chain is breaking. A real connection holds while an old attachment loses its grip, even as the surrounding structure comes down. Freedom and rupture clearing the way for what actually matters."
  },
  {
    cards: [up("the_lovers"), rev("the_devil"), rev("the_tower")],
    read: "The Lovers stand upright while both The Devil and The Tower fall reversed. A genuine bond holds steady as an old attachment loosens and the threatened collapse is averted — the gentlest version of this spread. You free yourself without the wall having to fall."
  },
  {
    cards: [rev("the_lovers"), up("the_devil"), up("the_tower")],
    read: "The Devil and The Tower stand upright while The Lovers fall reversed. Values clash or a choice is avoided just as attachment tightens and the structure shakes — disharmony meeting temptation meeting collapse. The shake-up here is exposing a bond that was never quite aligned."
  },
  {
    cards: [rev("the_lovers"), up("the_devil"), rev("the_tower")],
    read: "The Devil stands upright between a reversed Lovers and a reversed Tower. Attachment grips hardest where connection has gone out of tune, while the collapse that might break the spell is held back. Notice what truly binds you — the chains are looser than the avoided choice makes them feel."
  },
  {
    cards: [rev("the_lovers"), rev("the_devil"), up("the_tower")],
    read: "The Tower stands upright while both The Lovers and The Devil fall reversed. A binding attachment is finally losing its grip and a misaligned bond is being faced, just as the structure around them breaks. The collapse here is a release, not a loss."
  },
  {
    cards: [rev("the_lovers"), rev("the_devil"), rev("the_tower")],
    read: "The Lovers, The Devil, and The Tower all reversed together. A choice has been dodged, an attachment is loosening, and the looming collapse is held at bay — everything poised and nothing yet resolved. The bond, the chain, and the wall are all waiting on one honest decision you keep postponing."
  },

  // ── Death · The Tower · The Star — destruction and renewal ──
  {
    cards: [up("death"), up("the_tower"), up("the_star")],
    read: "Death, The Tower, and The Star together upright — rock bottom and the climb back in one breath. An ending clears the way, a shaky foundation falls, and hope grows back in the cleared ground. This is renewal through wreckage: what breaks here breaks so something truer can rise."
  },
  {
    cards: [up("death"), up("the_tower"), rev("the_star")],
    read: "Death and The Tower stand upright while The Star falls reversed. The ending lands and the old structure falls as they should, but the hope that should follow flickers — faith hasn't caught up to the clearing yet. The ground is ready for new growth; trust will be the last thing to return."
  },
  {
    cards: [up("death"), rev("the_tower"), up("the_star")],
    read: "Death and The Star hold upright around a reversed Tower. The transformation completes and hope is already lit, while the collapse itself is softened — release and renewal without the full crash. An ending that makes room gently, with the light coming back early."
  },
  {
    cards: [up("death"), rev("the_tower"), rev("the_star")],
    read: "Death stands upright while both The Tower and The Star fall reversed. You're ready to release the old, but the shake-up is muffled and faith feels distant — transformation underway in a flat, uncertain stretch. The clearing is real even if neither the crash nor the hope has fully arrived."
  },
  {
    cards: [rev("death"), up("the_tower"), up("the_star")],
    read: "The Tower and The Star stand upright while Death falls reversed. The collapse clears the ground and hope is already rising, yet you cling to what's done — the renewal is waiting on a release you keep refusing. The new growth needs you to let the old thing finally end."
  },
  {
    cards: [rev("death"), up("the_tower"), rev("the_star")],
    read: "The Tower stands upright between a reversed Death and a reversed Star. Upheaval arrives while you resist the ending it's forcing and faith runs low — the wall falls, but you won't let go and can't yet hope. The way through is to stop clinging; the clearing is on your side."
  },
  {
    cards: [rev("death"), rev("the_tower"), up("the_star")],
    read: "The Star holds upright while both Death and The Tower fall reversed. Hope endures even though the ending is resisted and the collapse never quite comes — faith carrying a stretch where nothing breaks and nothing closes. Keep the light; it's what finally moves the stuck pieces."
  },
  {
    cards: [rev("death"), rev("the_tower"), rev("the_star")],
    read: "Death, The Tower, and The Star all reversed at once. The ending is refused, the shake-up is held back, and faith feels far off — everything braced against a change that's overdue. Nothing is lost here, only stalled; the smallest act of letting go is enough to let the renewal begin."
  },

  // ── Wheel of Fortune · Justice · Judgement — fate and reckoning ──
  {
    cards: [up("wheel_of_fortune"), up("justice"), up("judgement")],
    read: "The Wheel of Fortune, Justice, and Judgement together upright — fate, fairness, and reckoning aligned. The cycle turns in your favor, cause and effect balance, and a clear-eyed look back points the way forward. The cosmic books are settling in your favor; act on what the reckoning reveals."
  },
  {
    cards: [up("wheel_of_fortune"), up("justice"), rev("judgement")],
    read: "The Wheel turns in your favor and Justice balances the scales, both upright, but Judgement falls reversed. Luck and fairness are on your side, yet you're avoiding the honest look back that would let you act on them. The verdict is good — face it and the next step opens."
  },
  {
    cards: [up("wheel_of_fortune"), rev("justice"), up("judgement")],
    read: "The Wheel and Judgement stand upright around a reversed Justice. Timing turns your way and the wake-up call lands, but a reckoning is being dodged and the scales sit uneven. The change is real; the loose account is what keeps it from feeling earned."
  },
  {
    cards: [up("wheel_of_fortune"), rev("justice"), rev("judgement")],
    read: "The Wheel turns upright while both Justice and Judgement fall reversed. Luck shifts in your favor, but a reckoning is evaded and the honest reflection avoided — good timing wasted on unfinished accounts. Fortune's gift only lands once you settle what you keep sidestepping."
  },
  {
    cards: [rev("wheel_of_fortune"), up("justice"), up("judgement")],
    read: "Justice and Judgement stand upright while The Wheel falls reversed. The scales balance and the wake-up call lands clearly, even as the timing works against you — fairness and reckoning intact through a run of bad luck. The verdict holds; the cycle's resistance is temporary."
  },
  {
    cards: [rev("wheel_of_fortune"), up("justice"), rev("judgement")],
    read: "Justice stands upright between a reversed Wheel and a reversed Judgement. The scales are fair and the truth is plain, but the timing is against you and you're avoiding the look back. The accounting is honest; bad luck and self-doubt are the only things stalling the verdict."
  },
  {
    cards: [rev("wheel_of_fortune"), rev("justice"), up("judgement")],
    read: "Judgement stands upright while both The Wheel and Justice fall reversed. The wake-up call lands clearly even as luck sours and a reckoning goes unsettled — the call to honesty arriving in unfair, ill-timed conditions. Answer it anyway; clarity is the one thing working in your favor."
  },
  {
    cards: [rev("wheel_of_fortune"), rev("justice"), rev("judgement")],
    read: "The Wheel of Fortune, Justice, and Judgement all reversed together — fate, fairness, and reckoning all jammed. Bad timing, a dodged account, and an ignored call to look back, all at once. The wheel always turns again; settle one honest debt and the whole mechanism starts moving."
  },

  // ── The Magician · The High Priestess · The Hierophant — ways of knowing ──
  {
    cards: [up("the_magician"), up("the_high_priestess"), up("the_hierophant")],
    read: "The Magician, The High Priestess, and The Hierophant together upright — outer power, inner knowing, and shared wisdom in one spread. You hold the tools, the quiet inner voice is clear, and tradition offers solid ground. Rare alignment: act on what you know, trust what you sense, and lean on what's been proven."
  },
  {
    cards: [up("the_magician"), up("the_high_priestess"), rev("the_hierophant")],
    read: "The Magician and The High Priestess stand upright while The Hierophant falls reversed. Your own power and intuition are sharp, but the old rules and shared wisdom no longer fit — you forge your own way. This is knowledge that comes from within and from will, not from the institution."
  },
  {
    cards: [up("the_magician"), rev("the_high_priestess"), up("the_hierophant")],
    read: "The Magician and The Hierophant hold upright around a reversed High Priestess. You have the tools and the tradition to guide you, but your inner voice is being ignored or drowned out. Don't let outer competence talk over the quiet thing you already sense."
  },
  {
    cards: [up("the_magician"), rev("the_high_priestess"), rev("the_hierophant")],
    read: "The Magician stands upright while both The High Priestess and The Hierophant fall reversed. Your power and will are clear, but you're cut off from both inner intuition and outer guidance — acting alone, by force, with neither compass. Capable, but flying blind; slow down and listen before you build."
  },
  {
    cards: [rev("the_magician"), up("the_high_priestess"), up("the_hierophant")],
    read: "The High Priestess and The Hierophant stand upright while The Magician falls reversed. Inner knowing and shared wisdom are both available, but your power feels scattered or unused — you sense the way and have the teaching, yet can't quite act. The tools are there; focus is what's missing."
  },
  {
    cards: [rev("the_magician"), up("the_high_priestess"), rev("the_hierophant")],
    read: "The High Priestess shines upright between a reversed Magician and a reversed Hierophant. Intuition is the one clear channel — your will is scattered and the old rules don't fit. Trust the quiet inner voice; it's more reliable right now than either effort or tradition."
  },
  {
    cards: [rev("the_magician"), rev("the_high_priestess"), up("the_hierophant")],
    read: "The Hierophant stands upright while both The Magician and The High Priestess fall reversed. Tradition and shared guidance offer the firm ground that your scattered power and ignored intuition can't — lean on what's proven while you regather yourself. Sometimes the old rules are exactly the scaffold you need."
  },
  {
    cards: [rev("the_magician"), rev("the_high_priestess"), rev("the_hierophant")],
    read: "The Magician, The High Priestess, and The Hierophant all reversed together — every channel of knowing clouded at once. Will is scattered, intuition is drowned, and the old wisdom no longer fits. Don't force a decision now; clear the noise first, and let one source of guidance come back online before you act."
  },

  // ── The Emperor · The Hierophant · Justice — authority and order ──
  {
    cards: [up("the_emperor"), up("the_hierophant"), up("justice")],
    read: "The Emperor, The Hierophant, and Justice together upright — authority, tradition, and fairness in full alignment. Clear structure, trusted guidance, and a balanced reckoning all hold at once. This is the spread of solid ground: the rules are sound, the system is fair, and discipline pays off."
  },
  {
    cards: [up("the_emperor"), up("the_hierophant"), rev("justice")],
    read: "The Emperor and The Hierophant stand upright while Justice falls reversed. Structure and tradition are firm, but a reckoning is being dodged and the scales sit uneven — order without accountability. The framework is solid; it's the unsettled account that throws it off balance."
  },
  {
    cards: [up("the_emperor"), rev("the_hierophant"), up("justice")],
    read: "The Emperor and Justice hold upright around a reversed Hierophant. Authority is clear and the scales are fair, but the old rules no longer fit — you uphold order while breaking with convention. Structure and fairness without leaning on tradition to get there."
  },
  {
    cards: [up("the_emperor"), rev("the_hierophant"), rev("justice")],
    read: "The Emperor stands upright while both The Hierophant and Justice fall reversed. You impose structure, but the old rules don't fit and a reckoning goes unsettled — control without guidance or balance. Authority alone isn't enough here; the system needs fairness and a workable code, not just a firm hand."
  },
  {
    cards: [rev("the_emperor"), up("the_hierophant"), up("justice")],
    read: "The Hierophant and Justice stand upright while The Emperor falls reversed. Tradition and fairness hold firm even as authority slips — control wavers or grips too hard, but the shared code and the scales keep things steady. Lean on the system; your own grip is the unreliable part right now."
  },
  {
    cards: [rev("the_emperor"), up("the_hierophant"), rev("justice")],
    read: "The Hierophant stands upright between a reversed Emperor and a reversed Justice. Shared tradition is the one steady thing — authority is slipping and a reckoning is dodged. Lean on proven guidance while you rebuild structure and settle what's gone unbalanced."
  },
  {
    cards: [rev("the_emperor"), rev("the_hierophant"), up("justice")],
    read: "Justice stands upright while both The Emperor and The Hierophant fall reversed. Fairness holds even as authority wavers and the old rules stop fitting — the scales are the last reliable measure when structure and tradition both give way. Let what's fair, not what's customary or commanded, decide."
  },
  {
    cards: [rev("the_emperor"), rev("the_hierophant"), rev("justice")],
    read: "The Emperor, The Hierophant, and Justice all reversed together — structure, tradition, and fairness all destabilized. Authority slips, the old rules don't fit, and the scales sit uneven. The whole order is up for renegotiation; rebuild from what's genuinely fair, not from what used to hold."
  },

  // ── Strength · The Chariot · The Emperor — three kinds of power ──
  {
    cards: [up("strength"), up("the_chariot"), up("the_emperor")],
    read: "Strength, The Chariot, and The Emperor together upright — three kinds of power in full force. Quiet inner courage, driving momentum, and firm structure all hold at once: you can master yourself, push forward, and build to last. A commanding spread — the will, the drive, and the discipline are all yours."
  },
  {
    cards: [up("strength"), up("the_chariot"), rev("the_emperor")],
    read: "Strength and The Chariot stand upright while The Emperor falls reversed. Inner courage and forward drive are strong, but structure is slipping — power and momentum without a firm framework to hold them. You have the engine; rebuild the chassis before you redline it."
  },
  {
    cards: [up("strength"), rev("the_chariot"), up("the_emperor")],
    read: "Strength and The Emperor hold upright around a reversed Chariot. Quiet courage and solid structure are in place, but the momentum stalls or pulls two ways — you're grounded and brave, yet not moving. Steady yourself, then point the drive in one direction."
  },
  {
    cards: [up("strength"), rev("the_chariot"), rev("the_emperor")],
    read: "Strength stands upright while both The Chariot and The Emperor fall reversed. Inner courage holds, but drive has stalled and structure is slipping — patience and self-kindness carrying a stretch with no momentum or framework. Tend the inner fire first; the drive and the order rebuild from there."
  },
  {
    cards: [rev("strength"), up("the_chariot"), up("the_emperor")],
    read: "The Chariot and The Emperor stand upright while Strength falls reversed. Drive and structure are strong, but the inner fire flickers — you're pushing forward on a firm frame while running low underneath. Be kind to yourself; momentum can't outrun burnout for long."
  },
  {
    cards: [rev("strength"), up("the_chariot"), rev("the_emperor")],
    read: "The Chariot stands upright between a reversed Strength and a reversed Emperor. Raw momentum is the only thing holding — inner reserves are low and structure is slipping. You're moving fast on an empty tank and a shaky frame; steady both before the drive carries you somewhere you can't hold."
  },
  {
    cards: [rev("strength"), rev("the_chariot"), up("the_emperor")],
    read: "The Emperor stands upright while both Strength and The Chariot fall reversed. Structure holds even as inner courage flickers and drive stalls — the framework carrying you when the fire and the momentum won't. Lean on discipline and routine; they'll hold the line while you recover the rest."
  },
  {
    cards: [rev("strength"), rev("the_chariot"), rev("the_emperor")],
    read: "Strength, The Chariot, and The Emperor all reversed together — every form of power running low at once. Inner fire flickers, drive stalls, and structure slips. This isn't a spread for pushing; it's a spread for rest and repair. Refill the well before you ask anything of the will again."
  },

  // ── The Empress · The Emperor · The Lovers — care, structure, connection ──
  {
    cards: [up("the_empress"), up("the_emperor"), up("the_lovers")],
    read: "The Empress, The Emperor, and The Lovers together upright — nurture, structure, and connection in harmony. Care and stability hold the ground while a genuine, values-aligned bond grows on it. A deeply relational spread: the foundation is warm, steady, and chosen with the heart."
  },
  {
    cards: [up("the_empress"), up("the_emperor"), rev("the_lovers")],
    read: "The Empress and The Emperor stand upright while The Lovers fall reversed. Care and structure are both present, but the connection is out of tune — values clash, or a choice of the heart is being avoided. The foundation is sound; it's the bond on top of it that needs honesty."
  },
  {
    cards: [up("the_empress"), rev("the_emperor"), up("the_lovers")],
    read: "The Empress and The Lovers hold upright around a reversed Emperor. Nurture and genuine connection are strong, but structure is slipping — warmth and love without firm boundaries to hold them. Tend the bond, but give it some framework before the lack of it strains the care."
  },
  {
    cards: [up("the_empress"), rev("the_emperor"), rev("the_lovers")],
    read: "The Empress stands upright while both The Emperor and The Lovers fall reversed. Care is being given, but structure is slipping and the connection is out of tune — nurture pouring into a bond without boundaries or alignment. Make sure the care isn't one-sided; it needs both structure and a true match to hold."
  },
  {
    cards: [rev("the_empress"), up("the_emperor"), up("the_lovers")],
    read: "The Emperor and The Lovers stand upright while The Empress falls reversed. Structure and genuine connection hold, but care has been withheld or neglected — a bond with firm ground and real feeling, missing warmth. Bring the nurture back; the framework and the love are already there."
  },
  {
    cards: [rev("the_empress"), up("the_emperor"), rev("the_lovers")],
    read: "The Emperor stands upright between a reversed Empress and a reversed Lovers. Structure is the one steady thing — care is withheld and the connection is out of tune. The framework is holding a relationship that's gone cold and unaligned; warmth and honesty are what it's waiting for."
  },
  {
    cards: [rev("the_empress"), rev("the_emperor"), up("the_lovers")],
    read: "The Lovers stand upright while both The Empress and The Emperor fall reversed. The connection itself is genuine and aligned, even though nurture has lapsed and structure is slipping — a real bond on shaky, under-tended ground. The love is sound; rebuild the care and the boundaries around it."
  },
  {
    cards: [rev("the_empress"), rev("the_emperor"), rev("the_lovers")],
    read: "The Empress, The Emperor, and The Lovers all reversed together — care, structure, and connection all strained at once. Warmth withheld, boundaries slipping, and a bond out of tune. The relationship isn't lost, but it's running on empty; it needs tending, structure, and an honest choice, in that order."
  },

  // ── Temperance · The Star · The World — harmony and fulfillment ──
  {
    cards: [up("temperance"), up("the_star"), up("the_world")],
    read: "Temperance, The Star, and The World together upright — balance, hope, and completion in one serene spread. Extremes blend into a steady middle path, faith lights the way, and a cycle closes whole. About as peaceful an arrival as the deck offers: patience has brought you home."
  },
  {
    cards: [up("temperance"), up("the_star"), rev("the_world")],
    read: "Temperance and The Star stand upright while The World falls reversed. Balance holds and hope is lit, but completion stays just out of reach — a loose end between you and the whole. The steady middle path is working; one last patient step finishes it."
  },
  {
    cards: [up("temperance"), rev("the_star"), up("the_world")],
    read: "Temperance and The World hold upright around a reversed Star. Balance is steady and the cycle completes, but faith flickers along the way — you arrive whole without quite trusting you would. Let the result restore the hope the journey shook."
  },
  {
    cards: [up("temperance"), rev("the_star"), rev("the_world")],
    read: "Temperance stands upright while both The Star and The World fall reversed. You're holding a steady, balanced course, but faith feels distant and completion won't close — patience carrying a stretch with little hope and no finish in sight. Keep the middle path; it's what eventually clears both."
  },
  {
    cards: [rev("temperance"), up("the_star"), up("the_world")],
    read: "The Star and The World stand upright while Temperance falls reversed. Hope is lit and the cycle completes, but balance is off — excess or impatience rushing toward a finish that was already coming. Slow down; you'll arrive either way, and gentler if you stop forcing it."
  },
  {
    cards: [rev("temperance"), up("the_star"), rev("the_world")],
    read: "The Star shines upright between a reversed Temperance and a reversed World. Hope holds, but impatience throws things out of proportion and the finish won't close — faith intact while haste keeps the completion at bay. Steady your pace; the rushing is exactly what's delaying the arrival."
  },
  {
    cards: [rev("temperance"), rev("the_star"), up("the_world")],
    read: "The World stands upright while both Temperance and The Star fall reversed. The cycle completes despite impatience and faltering faith — you reach the finish in a rush, without much hope along the way. The wholeness is real; let it teach you that the steady path would've gotten you there easier."
  },
  {
    cards: [rev("temperance"), rev("the_star"), rev("the_world")],
    read: "Temperance, The Star, and The World all reversed together — balance, hope, and completion all out of reach. Impatience throws things out of proportion, faith feels far, and the cycle won't close. The remedy is the slow one: restore the steady middle path, and harmony, hope, and the finish return in that order."
  },

  // ── The Fool · Death · Judgement — the full arc of transformation ──
  {
    cards: [up("the_fool"), up("death"), up("judgement")],
    read: "The Fool, Death, and Judgement together upright — the whole arc of transformation in a single breath. An ending clears the ground, a clear-eyed reckoning names what it meant, and a fresh leap begins from that honesty. Few spreads say rebirth this plainly: what closes here is meant to, and what starts is built on the truth of it."
  },
  {
    cards: [up("the_fool"), up("death"), rev("judgement")],
    read: "The Fool leaps and Death clears the way, both upright, while Judgement falls reversed. The ending is real and the new beginning is ready, but you skip the honest look back that would give the leap its meaning. Begin if you must — yet the reckoning you're dodging is exactly what would make it land."
  },
  {
    cards: [up("the_fool"), rev("death"), up("judgement")],
    read: "The Fool and Judgement stand upright around a reversed Death. The call to start is clear and the reckoning is honest, but you cling to what is already over. The new chapter waits on one release: let the old thing end and the leap will have somewhere to go."
  },
  {
    cards: [up("the_fool"), rev("death"), rev("judgement")],
    read: "The Fool leaps upright while both Death and Judgement fall reversed. The willingness to begin is real, but you're holding on to what's done and avoiding the honest look back — eager to start the new before finishing the old. Close the chapter and face it before you take the leap."
  },
  {
    cards: [rev("the_fool"), up("death"), up("judgement")],
    read: "Death and Judgement stand upright while The Fool falls reversed. The ending lands cleanly and the reckoning is honest, but the first step stalls — fear at the edge holds back the leap the moment has already earned. Everything is cleared and named; only the nerve to begin is missing."
  },
  {
    cards: [rev("the_fool"), up("death"), rev("judgement")],
    read: "Death stands upright between a reversed Fool and a reversed Judgement. The ending is genuine, yet you hesitate at the new beginning and avoid the honest look back. The close is doing its work — meet it with reflection and a braver first step rather than flinching from both."
  },
  {
    cards: [rev("the_fool"), rev("death"), up("judgement")],
    read: "Judgement stands upright while both The Fool and Death fall reversed. The wake-up call is clear, but you cling to what's over and stall at the leap it's urging. The reckoning has already named the way forward; let the old end and take the step it asks for."
  },
  {
    cards: [rev("the_fool"), rev("death"), rev("judgement")],
    read: "The Fool, Death, and Judgement all reversed together — the whole arc of transformation jammed at once. The leap is feared, the ending refused, and the honest reckoning avoided. Nothing here is broken, only stalled; one honest look back is enough to start the old closing and the new beginning together."
  }
];

/**
 * Finds an authored reading for the exact triad drawn, matching card identity
 * and orientation but ignoring the order the cards landed in. Returns undefined
 * unless all three cards (and their orientations) match an authored entry.
 */
function findTriadReading(cards: TarotDrawnCard[]): string | undefined {
  if (cards.length !== 3) return undefined;
  for (const triad of TRIADS) {
    const matches = triad.cards.every((member) =>
      cards.some((card) => card.cardId === member.id && card.reversed === member.reversed)
    );
    if (matches) return triad.read;
  }
  return undefined;
}

/**
 * Notable two-card pairings, woven directly into the narrative when both cards
 * are present. Order-independent and deterministic.
 */
const COMBOS: { ids: [string, string]; note: string }[] = [
  { ids: ["the_tower", "the_star"], note: "Where The Tower and The Star meet, the upheaval clears the ground and hope grows back in its place." },
  { ids: ["the_moon", "the_sun"], note: "The Moon beside The Sun says confusion gives way to clarity once the fog burns off." },
  { ids: ["the_lovers", "the_devil"], note: "With The Lovers and The Devil side by side, connection and attachment are easy to mistake for one another here." },
  { ids: ["the_magician", "the_fool"], note: "The Fool meeting The Magician means raw potential arrives with the very tools it needs." },
  { ids: ["the_hermit", "the_star"], note: "The Hermit and The Star together turn solitude into something lit by quiet hope, not loneliness." },
  { ids: ["death", "the_world"], note: "Death and The World together frame the ending not as a loss but as the close of a whole cycle." },
  { ids: ["the_emperor", "the_tower"], note: "The Emperor and The Tower together show rigid structure being shaken loose." },
  { ids: ["the_hermit", "the_moon"], note: "The Hermit walking beneath The Moon turns confusion into a path you feel your way along rather than see." },
  { ids: ["the_hanged_man", "death"], note: "The Hanged Man before Death is a surrender the ending then makes final — what you let go of does not come back." },
  { ids: ["the_sun", "the_world"], note: "The Sun meeting The World crowns the completion with plain, uncomplicated joy." },
  { ids: ["strength", "the_devil"], note: "Strength against The Devil is the quiet refusal that loosens a chain by patience rather than force." },
  { ids: ["the_high_priestess", "the_moon"], note: "The High Priestess under The Moon deepens the intuition — trust the knowing that arrives without proof." },
  { ids: ["justice", "judgement"], note: "Justice beside Judgement turns a fair outcome into an honest reckoning with yourself." },
  { ids: ["temperance", "the_chariot"], note: "Temperance steadying The Chariot keeps drive from tipping over into haste." },
  { ids: ["the_empress", "the_sun"], note: "The Empress in The Sun's light is growth that finally gets to flourish out in the open." }
];

const COUNT_WORDS: Record<number, string> = { 2: "two", 3: "three" };

/**
 * A stable numeric seed derived from the exact draw (card identity and
 * orientation). Lets the weave vary its phrasing between different spreads while
 * staying fully deterministic — the same cards always seed the same wording.
 */
function seedFromCards(cards: TarotDrawnCard[]): number {
  const key = cards.map((c) => `${c.cardId}:${c.reversed ? "r" : "u"}`).join("|");
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministically picks one entry from a pool. The channel lets independent
 * lines (transition vs. closing) vary separately for the same seed.
 */
function pick<T>(pool: T[], seed: number, channel: number): T {
  const idx = ((seed ^ Math.imul(channel + 1, 0x9e3779b1)) >>> 0) % pool.length;
  return pool[idx];
}

/** Opening transition for the procedural weave, chosen by the draw's seed. */
const TRANSITION_LINES = [
  "Read as one thread, the cards move from pattern to pressure to possibility.",
  "Taken together, they trace a single line from what was set down to what is still being decided.",
  "Laid side by side, the spread reads as one motion: a root, a tension, and the shape it wants to take.",
  "Seen whole, a single current runs through them — from cause, through friction, toward what comes next."
];

/** Closing nudge that ends the reading, chosen by the draw's seed. */
const CLOSING_NUDGES = [
  "Ask where you are already acting as if the answer were known.",
  "Notice which part of this you have been waiting for permission to begin.",
  "Sit with what you felt about it before you reasoned the feeling away.",
  "Watch for the next small, honest step — it is usually already in view."
];

/** "the present, where things stand" — position label plus its gloss. */
function inPosition(view: CardView): string {
  return view.meaning ? `the ${view.label.toLowerCase()}, ${view.meaning},` : `the ${view.label.toLowerCase()}`;
}

function openingLine(seekerName: string | undefined): string {
  const name = seekerName?.trim();
  if (name) {
    return `${name}, the spread answers not with a verdict but with a pattern, tracing what you are reaching toward and what you are quietly bracing against.`;
  }
  return `The spread answers not with a verdict but with a pattern, tracing what you are reaching toward and what you are quietly bracing against.`;
}

function positionThread(views: CardView[]): string[] {
  const [first, second, third] = views;
  if (!first) return [];

  if (views.length === 1) {
    return [`It rests on ${named(first)} in ${inPosition(first)} ${first.interpretation}`];
  }

  const sentences = [`It opens in ${inPosition(first)} with ${named(first)}: ${first.interpretation}`];

  if (second) {
    const turn = second.reversed === first.reversed ? "the same current continues" : "the current changes direction";
    sentences.push(`In ${inPosition(second)} ${turn} through ${named(second)}: ${second.interpretation}`);
  }

  if (third) {
    sentences.push(`Looking toward ${inPosition(third)} ${named(third)} gives the likely shape of the path: ${third.interpretation}`);
  }

  return sentences;
}

/**
 * Reads the upright/reversed balance of the spread and turns it inward in the
 * Reader's voice — naming both what the orientation shows and the stance it
 * points to in the seeker, as one passage. Shared by the procedural weave and
 * the hand-authored triad readings so orientation is always spoken to, never
 * just tallied, and never by naming the technique.
 */
function orientationReading(views: CardView[]): string {
  const reversedCount = views.filter((v) => v.reversed).length;
  if (reversedCount === 0) {
    return `Nothing falls reversed, so the way ahead is unusually open — and beneath the question the cards sense you are less blocked than you have been telling yourself. What waits is the nerve to trust the movement once it begins.`;
  }
  if (reversedCount === views.length) {
    return `Every card falls reversed, so the work here is inward before it is outward. Nothing is truly withholding itself from you; some part of you is bracing, testing, delaying, because the next step would make all of this real.`;
  }
  if (reversedCount === 1) {
    return `Only one card is reversed, so the friction stays contained — that single point of resistance is louder than the rest of the situation deserves. More of you is ready than that one held breath admits.`;
  }
  const word = COUNT_WORDS[reversedCount] ?? String(reversedCount);
  const total = COUNT_WORDS[views.length] ?? String(views.length);
  return `With ${word} of the ${total} cards reversed, the spread falls divided, mirroring the split you carry: one part of you already leaning forward, the other still bracing for what moving would cost.`;
}

function closingPrompt(focal: CardView, nudge: string): string {
  return `Return to ${named(focal)} in the ${focal.label.toLowerCase()}${focal.meaning ? ` — ${focal.meaning}` : ""}. ${nudge}`;
}

/**
 * Weaves the drawn spread into a short reading, returned as ordered paragraphs:
 * the framing, the position-by-position thread (with any notable pairings or a
 * signature triad), and the orientation balance ending on the card to return
 * to. Fully deterministic — the same spread always reads the same way, though
 * phrasing varies between different draws.
 */
export function buildSynthesis(cards: TarotDrawnCard[], seekerName?: string): string[] {
  const views = toViews(cards);
  if (views.length === 0) return [];

  const seed = seedFromCards(cards);
  const opening = openingLine(seekerName);
  const positionSentences = positionThread(views);

  const reversedViews = views.filter((v) => v.reversed);
  const focal = reversedViews.length === 1 ? reversedViews[0] : views[views.length - 1];
  const close = `${orientationReading(views)} ${closingPrompt(focal, pick(CLOSING_NUDGES, seed, 1))}`;

  // A hand-authored signature reading, when this exact triad + orientation has
  // one, takes precedence over the procedural weave.
  const triadReading = findTriadReading(cards);
  if (triadReading) {
    return [opening, [...positionSentences, triadReading].join(" "), close];
  }

  // Position thread, with any notable pairings folded straight in.
  const cardsThread = [...positionSentences];
  const ids = new Set(views.map((v) => v.id));
  for (const combo of COMBOS) {
    if (combo.ids.every((id) => ids.has(id))) cardsThread.push(combo.note);
  }

  const framing = [opening, pick(TRANSITION_LINES, seed, 0)].join(" ");
  return [framing, cardsThread.join(" "), close];
}
