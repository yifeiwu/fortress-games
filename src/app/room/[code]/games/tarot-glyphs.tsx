import type { ReactNode } from "react";

// Minimalist line-art emblems for each Major Arcana card. Each glyph is a set of
// stroked paths on a 0..32 canvas drawn in `currentColor`, so they inherit the
// card's text color and stay in keeping with the deck's no-emoji aesthetic.
const GLYPHS: Record<string, ReactNode> = {
  the_fool: (
    <>
      <path d="M8 25 L22 9" />
      <circle cx="24" cy="7.5" r="3" />
      <path d="M6 27 h4 M13 28 h3" />
    </>
  ),
  the_magician: (
    <>
      <path d="M16 4 V12" />
      <circle cx="12" cy="20" r="3.4" />
      <circle cx="20" cy="20" r="3.4" />
    </>
  ),
  the_high_priestess: <path d="M21 6 a11 11 0 1 0 0 20 a8.5 8.5 0 1 1 0-20 z" />,
  the_empress: (
    <>
      <circle cx="16" cy="12" r="6" />
      <path d="M16 18 V28 M11 23 H21" />
    </>
  ),
  the_emperor: <path d="M8 7 H24 V15 a8 11 0 0 1 -8 11 a8 11 0 0 1 -8 -11 Z" />,
  the_hierophant: (
    <>
      <circle cx="12.5" cy="12.5" r="5" />
      <path d="M15.5 15.5 L26 26 M22 22 h3 M24 24 h2.5" />
    </>
  ),
  the_lovers: (
    <>
      <circle cx="13" cy="16" r="6" />
      <circle cx="20" cy="16" r="6" />
    </>
  ),
  the_chariot: <path d="M7 16 H22 M16 9 L23 16 L16 23" />,
  strength: <path d="M8 20 L16 11 L24 20 M8 27 L16 18 L24 27" />,
  the_hermit: (
    <>
      <path d="M16 6 L24 16 L16 26 L8 16 Z" />
      <circle cx="16" cy="16" r="2.6" />
    </>
  ),
  wheel_of_fortune: (
    <>
      <circle cx="16" cy="16" r="9" />
      <path d="M16 7 V25 M7 16 H25 M9.6 9.6 L22.4 22.4 M22.4 9.6 L9.6 22.4" />
    </>
  ),
  justice: (
    <>
      <path d="M16 6 V23 M10 25 H22" />
      <path d="M6 11 H26" />
      <path d="M3 11 a3 3 0 0 0 6 0 M23 11 a3 3 0 0 0 6 0" />
    </>
  ),
  the_hanged_man: (
    <>
      <path d="M16 4 V13" />
      <path d="M8 13 H24 L16 27 Z" />
    </>
  ),
  death: (
    <>
      <path d="M10 27 L21 7" />
      <path d="M21 7 a11 11 0 0 1 -11 5" />
    </>
  ),
  temperance: (
    <>
      <path d="M9 8 h7 l-3.5 7 z" />
      <path d="M16 17 h7 l-3.5 7 z" />
      <path d="M13 14 q3 3 6 5" />
    </>
  ),
  the_devil: (
    <>
      <path d="M8 19 C8 8 12.5 8 13.5 15 M24 19 C24 8 19.5 8 18.5 15" />
      <path d="M13 15 q3 6 6 0" />
    </>
  ),
  the_tower: (
    <>
      <path d="M11 28 V11 H21 V28" />
      <path d="M17 5 L13 14 H16 L13 21" />
    </>
  ),
  the_star: <path d="M16 4 V28 M4 16 H28 M8 8 L24 24 M24 8 L8 24" />,
  the_moon: (
    <>
      <circle cx="16" cy="16" r="9" />
      <path d="M19 8 a9 9 0 0 1 0 16 a7 7 0 0 0 0 -16 z" />
    </>
  ),
  the_sun: (
    <>
      <circle cx="16" cy="16" r="6" />
      <path d="M16 3 V7 M16 25 V29 M3 16 H7 M25 16 H29 M7 7 L9.6 9.6 M22.4 22.4 L25 25 M25 7 L22.4 9.6 M9.6 22.4 L7 25" />
    </>
  ),
  judgement: (
    <>
      <path d="M4 25 H28" />
      <path d="M8 25 a8 8 0 0 1 16 0" />
      <path d="M16 20 V9 M13 12 L16 9 L19 12" />
    </>
  ),
  the_world: (
    <>
      <ellipse cx="16" cy="16" rx="8" ry="11" />
      <path d="M11 8 l-2 -2 M21 8 l2 -2 M11 24 l-2 2 M21 24 l2 2" />
    </>
  )
};

// Generic fallback (an eight-point spark) for any unknown card id.
const FALLBACK: ReactNode = <path d="M16 5 V27 M5 16 H27 M9 9 L23 23 M23 9 L9 23" />;

/** Ornate celestial sigil for the card *backs* — a moon within twin rings and
 * scattered sparks, in the same line-art idiom as the arcana glyphs. */
export function TarotCardBackEmblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="16" cy="16" r="13.5" />
      <circle cx="16" cy="16" r="10.5" strokeDasharray="0.5 2.2" />
      <path d="M18.5 9.5 a7 7 0 1 0 0 13 a5.4 5.4 0 1 1 0-13 z" />
      <path d="M8 9.4 v2.4 M6.8 10.6 h2.4" />
      <path d="M23.5 21.6 v2.4 M22.3 22.8 h2.4" />
      <path d="M22.4 7.6 v1.8 M21.5 8.5 h1.8" />
    </svg>
  );
}

/** Renders the line-art emblem for a card id, inheriting `currentColor`. */
export function TarotGlyph({ cardId, className }: { cardId: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {GLYPHS[cardId] ?? FALLBACK}
    </svg>
  );
}

// Detailed line-art illustrations for each of the 22 Major Arcana.
// All paths are drawn on a 96 × 128 coordinate space (matching the card viewBox).
const ARTWORKS: Record<string, ReactNode> = {
  the_fool: (
    <>
      {/* Sky and distant mountains */}
      <path d="M10 82 L22 60 L34 74 L50 48 L66 68 L80 54 L86 62" strokeWidth="0.7" opacity="0.45" />
      <path d="M10 96 Q34 90 48 94 Q62 90 86 96" strokeWidth="0.75" opacity="0.5" />
      {/* Cliff edge */}
      <path d="M10 96 L52 96" strokeWidth="1.05" />
      <path d="M52 96 L52 110 Q52 116 60 116 L86 116" strokeWidth="0.85" opacity="0.5" />
      {/* Sun top-right */}
      <circle cx="72" cy="26" r="9" strokeWidth="1" />
      <path d="M72 13 v5 M72 38 v5 M59 26 h5 M80 26 h5 M63 17 l3.5 3.5 M78 31 l3 3 M81 17 l-3.5 3.5 M63 35 l-3 3" strokeWidth="0.75" />
      {/* Figure — head + jester cap */}
      <circle cx="40" cy="64" r="5.5" strokeWidth="1" />
      <path d="M36 61 C34 54 40 50 42 55 M40 60 C37 52 46 48 46 56" strokeWidth="0.8" />
      {/* Torso */}
      <path d="M40 70 L40 82" strokeWidth="1.1" />
      {/* Arms — left trailing, right holding staff */}
      <path d="M34 72 L46 74 L54 68" strokeWidth="1" />
      {/* Staff with bundle */}
      <path d="M52 70 L64 48" strokeWidth="1.15" />
      <ellipse cx="66" cy="45" rx="5" ry="4" strokeWidth="0.9" />
      {/* Legs — walking step off cliff */}
      <path d="M40 82 L35 92 M40 82 L47 90" strokeWidth="1.1" />
      {/* Dog at heels */}
      <circle cx="27" cy="88" r="4" strokeWidth="0.9" />
      <path d="M27 84 L27 78 L31 76 L33 79 M23 84 L23 92 M31 84 L31 92 M19 92 L33 92" strokeWidth="0.8" />
      <path d="M31 76 L35 72" strokeWidth="0.75" />
    </>
  ),

  the_magician: (
    <>
      {/* Lemniscate ∞ above head */}
      <path d="M34 24 C34 18 40 16 44 20 C48 24 48 28 52 28 C56 28 62 26 62 20 C62 14 56 12 52 16 C48 20 48 24 44 24 C40 24 34 22 34 24 Z" strokeWidth="1" />
      {/* Head */}
      <circle cx="48" cy="38" r="6" strokeWidth="1" />
      {/* Long robe / tunic */}
      <path d="M40 44 L38 80 H58 L56 44 Z" strokeWidth="0.95" />
      <path d="M40 56 H56 M40 62 H56" strokeWidth="0.45" opacity="0.6" />
      {/* Snake belt */}
      <path d="M38 60 Q48 64 58 60 Q54 57 50 60 Q46 57 42 60" strokeWidth="0.7" />
      {/* Right arm raised — wand pointing up */}
      <path d="M54 46 L66 30 L68 24" strokeWidth="1.1" />
      <circle cx="68" cy="22" r="2.5" fill="currentColor" stroke="none" />
      {/* Left arm pointing down */}
      <path d="M42 46 L34 58 L32 63" strokeWidth="1.1" />
      <circle cx="32" cy="65" r="2" fill="currentColor" stroke="none" />
      {/* Legs */}
      <path d="M42 80 L40 96 M54 80 L56 96" strokeWidth="0.95" />
      {/* Table */}
      <path d="M14 104 H82 M18 104 V112 M78 104 V112" strokeWidth="0.95" />
      {/* Four implements on table */}
      {/* Cup */}
      <path d="M22 98 L20 104 H28 L26 98 M20 102 Q24 105 28 102" strokeWidth="0.85" />
      {/* Wand */}
      <path d="M36 94 L36 104 M33 94 H39 M33 92 H39 L36 88 L33 92" strokeWidth="0.8" />
      {/* Pentacle disc */}
      <circle cx="48" cy="99" r="5" strokeWidth="0.8" />
      <path d="M48 94 L49.7 99 L55 97 L51 101 L53 107 L48 103 L43 107 L45 101 L41 97 L46.3 99 Z" strokeWidth="0.55" />
      {/* Sword */}
      <path d="M62 92 L62 104 M59 99 H65 M61 92 L63 92 L62 88 Z" strokeWidth="0.8" />
    </>
  ),

  the_high_priestess: (
    <>
      {/* Two tall stone pillars */}
      <rect x="10" y="16" width="11" height="100" rx="1" strokeWidth="0.95" />
      <rect x="75" y="16" width="11" height="100" rx="1" strokeWidth="0.95" />
      <path d="M8 18 H23 M73 18 H88" strokeWidth="0.8" />
      <path d="M8 22 H23 M73 22 H88" strokeWidth="0.45" />
      {/* Veil / tapestry hanging between pillars */}
      <path d="M21 22 Q48 28 75 22 L75 100 Q48 108 21 100 Z" strokeWidth="0.7" strokeDasharray="1.5 3" opacity="0.5" />
      {/* Crescent moon at feet */}
      <path d="M34 108 Q48 102 62 108 Q56 116 40 116 Z" strokeWidth="0.95" />
      {/* Seated figure */}
      <circle cx="48" cy="42" r="6.5" strokeWidth="1.05" />
      {/* Triple tiara crown */}
      <path d="M41 37 H55 M43 37 L43 31 M48 37 L48 28 M53 37 L53 31" strokeWidth="0.9" />
      <path d="M41 31 H43 M53 31 H55" strokeWidth="0.7" />
      {/* Long robe */}
      <path d="M41 49 L37 84 H59 L55 49 Z" strokeWidth="0.95" />
      {/* Scroll / book in lap */}
      <path d="M38 72 Q48 67 58 72 Q58 82 48 84 Q38 82 38 72 Z" strokeWidth="0.85" />
      <path d="M42 74 H54 M42 77 H54 M42 80 H52" strokeWidth="0.45" />
      {/* Cross on breast */}
      <path d="M48 54 V62 M44 58 H52" strokeWidth="0.8" />
    </>
  ),

  the_empress: (
    <>
      {/* Lush landscape and trees */}
      <path d="M10 100 C22 94 36 96 48 100 C60 94 74 96 86 100" strokeWidth="0.75" opacity="0.55" />
      <path d="M14 100 L14 72 M10 76 C10 68 18 66 18 74 C18 66 14 62 14 68 M14 68 C14 62 20 60 20 66" strokeWidth="0.75" opacity="0.6" />
      <path d="M80 100 L80 76 M76 80 C76 72 84 70 84 78 C84 70 80 66 80 72 M80 72 C80 66 86 64 86 70" strokeWidth="0.75" opacity="0.6" />
      {/* Grain stalks */}
      <path d="M22 100 L26 72 M26 100 L30 74 M66 100 L70 74 M70 100 L74 72" strokeWidth="0.7" opacity="0.5" />
      <path d="M22 72 C24 68 26 68 26 72 M26 74 C28 70 30 70 30 74 M66 74 C68 70 70 70 70 74 M70 72 C72 68 74 68 74 72" strokeWidth="0.65" opacity="0.55" />
      {/* Throne back */}
      <path d="M24 36 H72 M24 96 H72 M24 36 V96 M72 36 V96" strokeWidth="0.7" opacity="0.45" />
      {/* Star crown — 12-pointed */}
      <path d="M34 36 L36 28 L38 36 M42 36 L44 26 L46 36 M50 36 L52 26 L54 36 M58 36 L60 28 L62 36" strokeWidth="0.85" />
      <path d="M34 28 H62" strokeWidth="0.6" />
      {/* Head */}
      <circle cx="48" cy="46" r="7" strokeWidth="1.05" />
      {/* Flowing robe */}
      <path d="M40 54 C36 64 32 78 30 96 H66 C64 78 60 64 56 54 Z" strokeWidth="0.95" />
      {/* Sceptre */}
      <path d="M64 50 L74 30" strokeWidth="1.1" />
      <circle cx="75" cy="28" r="3.5" strokeWidth="0.9" />
      <path d="M71.5 28 H78.5 M75 24.5 V31.5" strokeWidth="0.55" />
      {/* Venus shield left hand */}
      <path d="M28 66 C22 62 22 56 28 52 C34 48 40 52 38 58 C36 64 28 66 28 66 Z" strokeWidth="0.85" />
      <path d="M33 66 L33 74 M30 70 H36" strokeWidth="0.8" />
    </>
  ),

  the_emperor: (
    <>
      {/* Craggy mountain range */}
      <path d="M10 90 L22 64 L36 80 L50 52 L64 72 L78 58 L86 66 L86 100 L10 100" strokeWidth="0.7" opacity="0.4" />
      {/* Stone throne */}
      <path d="M22 32 H74 V94 H22 Z" strokeWidth="0.75" opacity="0.4" />
      <path d="M18 30 H78 V36 H18 Z" strokeWidth="0.85" />
      {/* Ram heads on armrests */}
      <path d="M22 62 C18 60 14 62 14 66 C14 70 18 68 22 70 M22 60 C18 56 14 52 18 48 C22 46 22 54 22 60" strokeWidth="0.8" />
      <path d="M74 62 C78 60 82 62 82 66 C82 70 78 68 74 70 M74 60 C78 56 82 52 78 48 C74 46 74 54 74 60" strokeWidth="0.8" />
      {/* Armored figure */}
      <circle cx="48" cy="44" r="6.5" strokeWidth="1.05" />
      {/* Beard detail */}
      <path d="M44 50 C44 54 48 56 52 54 C52 56 48 58 44 54" strokeWidth="0.65" />
      {/* Armored breastplate */}
      <path d="M40 50 L38 76 H58 L56 50 Z" strokeWidth="0.95" />
      <path d="M40 58 H56 M40 64 H56 M42 70 H54" strokeWidth="0.45" opacity="0.7" />
      {/* Imperial crown */}
      <path d="M40 38 H56 M40 38 L40 30 M44 38 L42 28 M48 38 L48 26 M52 38 L54 28 M56 38 L56 30" strokeWidth="0.9" />
      <path d="M40 30 H56" strokeWidth="0.7" />
      {/* Orb in left hand */}
      <circle cx="34" cy="65" r="6" strokeWidth="0.9" />
      <path d="M34 59 V71 M28 65 H40 M34 59 Q38 62 38 65" strokeWidth="0.5" />
      <circle cx="34" cy="59" r="1.5" fill="currentColor" stroke="none" />
      {/* Sceptre / ankh right hand */}
      <path d="M62 48 L70 28" strokeWidth="1.1" />
      <path d="M66 30 H74 M70 26 V32" strokeWidth="0.9" />
      {/* Legs on throne */}
      <path d="M42 76 L40 92 M54 76 L56 92 M38 92 H60" strokeWidth="0.9" />
    </>
  ),

  the_hierophant: (
    <>
      {/* Two ornate columns */}
      <rect x="10" y="18" width="10" height="100" rx="1" strokeWidth="0.9" />
      <rect x="76" y="18" width="10" height="100" rx="1" strokeWidth="0.9" />
      <path d="M8 20 H22 M74 20 H88 M8 24 H22 M74 24 H88" strokeWidth="0.65" />
      {/* Archway top */}
      <path d="M20 26 Q48 16 76 26" strokeWidth="0.8" />
      {/* Triple papal crown (tiara) */}
      <path d="M36 26 H60 M36 26 L36 20 H60 L60 26 M38 20 L38 14 H58 L58 20 M40 14 L40 8 H56 L56 14" strokeWidth="0.85" />
      {/* Head */}
      <circle cx="48" cy="38" r="6" strokeWidth="1.05" />
      {/* Long papal robe */}
      <path d="M40 44 L36 104 H60 L56 44 Z" strokeWidth="0.95" />
      <path d="M40 54 H56 M40 62 H56" strokeWidth="0.45" opacity="0.55" />
      {/* Triple-barred cross staff */}
      <path d="M64 36 L64 96" strokeWidth="1.1" />
      <path d="M60 46 H68 M60 54 H68 M61 62 H67" strokeWidth="0.9" />
      {/* Blessing hand gesture — two fingers raised */}
      <path d="M54 54 L62 52 M54 58 L62 56 M54 62 L60 62" strokeWidth="0.75" />
      {/* Keys of heaven crossed at base */}
      <path d="M30 94 L46 110 M26 96 H34 M26 96 V104" strokeWidth="0.8" />
      <circle cx="46" cy="110" r="4" strokeWidth="0.75" />
      <path d="M50 94 L34 110 M46 96 H54 M54 96 V104" strokeWidth="0.8" />
      <circle cx="34" cy="110" r="4" strokeWidth="0.75" />
      {/* Two kneeling petitioners */}
      <circle cx="24" cy="84" r="3.5" strokeWidth="0.8" />
      <path d="M24 88 L20 96 H30 L26 88 M20 92 L18 88 M28 88 L30 86" strokeWidth="0.7" />
      <circle cx="72" cy="84" r="3.5" strokeWidth="0.8" />
      <path d="M72 88 L68 96 H78 L74 88 M68 92 L66 88 M74 88 L76 86" strokeWidth="0.7" />
    </>
  ),

  the_lovers: (
    <>
      {/* Radiant sun behind angel */}
      <circle cx="48" cy="18" r="12" strokeWidth="0.8" opacity="0.55" />
      <path d="M48 4 v5 M48 27 v5 M34 8 l3.5 3.5 M59 8 l-3.5 3.5 M28 18 h5 M63 18 h5 M34 28 l3.5 -3.5 M59 28 l-3.5 -3.5" strokeWidth="0.7" opacity="0.55" />
      {/* Angel head + halo */}
      <circle cx="48" cy="18" r="5.5" strokeWidth="1" />
      <circle cx="48" cy="18" r="9" strokeWidth="0.5" strokeDasharray="1.5 2.5" opacity="0.7" />
      {/* Angel wings sweeping outward */}
      <path d="M42 17 C32 10 16 12 12 22 C18 18 32 20 36 28 C38 20 40 16 42 20" strokeWidth="0.95" />
      <path d="M54 17 C64 10 80 12 84 22 C78 18 64 20 60 28 C58 20 56 16 54 20" strokeWidth="0.95" />
      {/* Blessing arms reaching downward */}
      <path d="M44 23 L38 34 M52 23 L58 34" strokeWidth="0.85" />
      {/* Ground line */}
      <path d="M10 94 H86" strokeWidth="0.9" />
      {/* Mountain between figures */}
      <path d="M42 94 L48 78 L54 94" strokeWidth="0.7" opacity="0.5" />
      {/* Man (left) */}
      <circle cx="30" cy="58" r="5.5" strokeWidth="0.95" />
      <path d="M30 64 L30 80 M24 66 L36 68 M30 80 L26 94 M30 80 L34 94" strokeWidth="0.95" />
      {/* Flame tree behind man */}
      <path d="M14 94 L14 66 M10 94 L18 94" strokeWidth="0.7" opacity="0.6" />
      <path d="M14 66 C12 58 18 56 18 62 C20 56 16 52 14 58 M14 58 C14 52 20 50 18 56" strokeWidth="0.7" opacity="0.6" />
      {/* Woman (right) */}
      <circle cx="66" cy="58" r="5.5" strokeWidth="0.95" />
      <path d="M62 60 C60 66 60 74 62 80 M70 60 C72 66 72 74 70 80" strokeWidth="0.65" />
      <path d="M66 64 L66 80 M60 66 L72 68 M66 80 L62 94 M66 80 L70 94" strokeWidth="0.95" />
      {/* Apple tree behind woman */}
      <path d="M82 94 L82 68 M78 94 L86 94" strokeWidth="0.7" opacity="0.6" />
      <circle cx="80" cy="66" r="5" strokeWidth="0.7" opacity="0.6" />
      <circle cx="84" cy="60" r="3.5" strokeWidth="0.65" opacity="0.6" />
    </>
  ),

  the_chariot: (
    <>
      {/* Star canopy */}
      <path d="M14 32 H82 V18 H14 Z" strokeWidth="0.9" />
      <g fill="currentColor" stroke="none">
        <circle cx="26" cy="25" r="1.5" />
        <circle cx="38" cy="23" r="1.5" />
        <circle cx="48" cy="25" r="1.5" />
        <circle cx="58" cy="23" r="1.5" />
        <circle cx="70" cy="25" r="1.5" />
        <circle cx="30" cy="28" r="1" opacity={0.6} />
        <circle cx="54" cy="28" r="1" opacity={0.6} />
        <circle cx="66" cy="28" r="1" opacity={0.6} />
      </g>
      {/* Chariot body */}
      <path d="M18 32 L18 72 H78 L78 32" strokeWidth="1" />
      {/* Winged solar disc on front */}
      <circle cx="48" cy="50" r="7" strokeWidth="0.85" />
      <path d="M41 50 H20 M55 50 H76 M20 48 C20 42 36 40 41 46 M20 52 C20 58 36 60 41 54 M76 48 C76 42 60 40 55 46 M76 52 C76 58 60 60 55 54" strokeWidth="0.75" />
      {/* Warrior — head with crown/helmet */}
      <circle cx="48" cy="38" r="5.5" strokeWidth="1" />
      <path d="M42 34 H54 M43 34 L44 28 M48 34 L48 26 M53 34 L52 28" strokeWidth="0.85" />
      {/* Breastplate */}
      <path d="M44 44 H52 L54 58 H42 L44 44 Z" strokeWidth="0.9" />
      {/* Crescent shoulder emblems */}
      <path d="M44 46 C42 44 40 44 40 46 M52 46 C54 44 56 44 56 46" strokeWidth="0.7" />
      {/* Sceptre held right */}
      <path d="M52 44 L62 30 L64 24" strokeWidth="1.1" />
      <circle cx="64" cy="22" r="2.5" fill="currentColor" stroke="none" />
      {/* Large wheels */}
      <circle cx="22" cy="78" r="10" strokeWidth="0.95" />
      <path d="M22 68 V88 M12 78 H32 M15 71 L29 85 M29 71 L15 85" strokeWidth="0.6" />
      <circle cx="74" cy="78" r="10" strokeWidth="0.95" />
      <path d="M74 68 V88 M64 78 H84 M67 71 L81 85 M81 71 L67 85" strokeWidth="0.6" />
      {/* Two sphinxes pulling */}
      <ellipse cx="30" cy="100" rx="12" ry="8" strokeWidth="0.9" />
      <circle cx="20" cy="96" r="4.5" strokeWidth="0.85" />
      <ellipse cx="66" cy="100" rx="12" ry="8" strokeWidth="0.9" />
      <circle cx="76" cy="96" r="4.5" strokeWidth="0.85" />
      {/* Reins */}
      <path d="M34 72 Q32 84 30 92 M62 72 Q64 84 66 92" strokeWidth="0.65" strokeDasharray="2 2" />
    </>
  ),

  strength: (
    <>
      {/* Lemniscate above */}
      <path d="M33 20 C33 15 39 13 43 17 C47 21 47 25 52 25 C57 25 63 23 63 17 C63 11 57 9 52 13 C47 17 47 21 43 21 C39 21 33 19 33 20 Z" strokeWidth="1" />
      {/* Gentle rolling landscape */}
      <path d="M10 98 Q30 90 48 94 Q66 90 86 98" strokeWidth="0.7" opacity="0.5" />
      {/* Flower garland on woman's head */}
      <path d="M34 42 C32 38 36 34 40 36 C38 32 44 30 44 36 C46 30 50 32 48 36 C52 32 56 34 54 38" strokeWidth="0.7" />
      {/* Woman's head */}
      <circle cx="44" cy="46" r="6" strokeWidth="1.05" />
      {/* Woman's dress */}
      <path d="M38 52 C36 62 34 76 32 88 H56 C54 76 52 62 50 52 Z" strokeWidth="0.9" />
      {/* Arms reaching gently to lion */}
      <path d="M50 56 Q56 62 54 72" strokeWidth="1.05" />
      <path d="M38 56 Q34 62 36 72" strokeWidth="0.9" />
      {/* Large lion body */}
      <ellipse cx="60" cy="82" rx="22" ry="15" strokeWidth="1.05" />
      {/* Lion head */}
      <circle cx="38" cy="72" r="14" strokeWidth="1" />
      {/* Mane rings */}
      <circle cx="38" cy="72" r="10" strokeWidth="0.5" strokeDasharray="1 2.5" />
      {/* Lion face */}
      <circle cx="33" cy="70" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="43" cy="70" r="1.8" fill="currentColor" stroke="none" />
      <path d="M34 76 Q38 80 42 76" strokeWidth="0.85" />
      <path d="M38 76 V80" strokeWidth="0.7" />
      {/* Lion front paws */}
      <path d="M24 90 L18 100 M30 94 L26 104 M36 96 L34 106 M42 96 L40 106" strokeWidth="0.85" />
      <path d="M16 102 H42" strokeWidth="0.8" />
      {/* Lion tail */}
      <path d="M82 78 C90 70 90 84 84 88 C82 92 80 94 82 98" strokeWidth="0.9" />
      <circle cx="82" cy="100" r="3.5" strokeWidth="0.8" />
    </>
  ),

  the_hermit: (
    <>
      {/* Mountain — stark peak */}
      <path d="M10 110 L48 22 L86 110" strokeWidth="1.05" />
      {/* Secondary peaks behind */}
      <path d="M10 90 L24 62 L38 80" strokeWidth="0.7" opacity="0.35" />
      <path d="M58 80 L72 56 L86 78" strokeWidth="0.7" opacity="0.35" />
      {/* Snow cap */}
      <path d="M38 42 L48 22 L58 42 Q52 38 48 36 Q44 38 38 42" strokeWidth="0.65" opacity="0.65" />
      {/* Night stars */}
      <g fill="currentColor" stroke="none" opacity="0.65">
        <circle cx="18" cy="22" r="1.2" />
        <circle cx="28" cy="14" r="1" />
        <circle cx="74" cy="18" r="1.2" />
        <circle cx="82" cy="30" r="1" />
        <circle cx="12" cy="38" r="0.9" />
      </g>
      {/* Hermit figure at peak */}
      <circle cx="48" cy="54" r="5.5" strokeWidth="1.05" />
      {/* Deep hood over head */}
      <path d="M42 52 C40 44 44 38 48 40 C52 38 56 44 54 52" strokeWidth="0.9" />
      {/* Long sweeping cloak */}
      <path d="M42 60 C40 70 36 84 34 96 H62 C60 84 56 70 54 60 Z" strokeWidth="0.95" />
      {/* Walking staff — left hand */}
      <path d="M36 62 L26 100" strokeWidth="1.15" />
      <path d="M24 98 H28" strokeWidth="0.85" />
      {/* Lantern raised — right hand */}
      <path d="M60 60 L66 44" strokeWidth="1.05" />
      {/* Lantern body */}
      <rect x="62" y="34" width="9" height="12" rx="1.5" strokeWidth="0.95" />
      <path d="M63 34 L65 28 M70 34 L68 28 M65 28 H68" strokeWidth="0.75" />
      {/* Light star in lantern */}
      <path d="M66.5 38 V44 M63.5 41 H69.5 M64.3 38.8 L68.7 43.2 M68.7 38.8 L64.3 43.2" strokeWidth="0.6" />
    </>
  ),

  wheel_of_fortune: (
    <>
      {/* Heavenly clouds framing the wheel */}
      <path d="M10 24 C16 16 26 14 32 20 C36 12 46 10 52 16 C56 10 66 12 70 18 C76 12 84 14 86 22" strokeWidth="0.8" opacity="0.5" />
      {/* The great Wheel */}
      <circle cx="48" cy="66" r="40" strokeWidth="1.1" />
      <circle cx="48" cy="66" r="32" strokeWidth="0.7" />
      <circle cx="48" cy="66" r="10" strokeWidth="0.85" />
      {/* 8 spokes */}
      <path d="M48 26 V106 M8 66 H88 M20 38 L76 94 M76 38 L20 94" strokeWidth="0.7" />
      {/* Alchemical symbols on the outer ring (suggestion lines) */}
      <path d="M46 27 H50 M48 27 V23" strokeWidth="0.85" />
      <path d="M46 107 C46 111 48 111 48 107 C48 111 50 111 50 107" strokeWidth="0.8" />
      <path d="M9 64 V68 M9 64 H11 M9 66 H11" strokeWidth="0.85" />
      <path d="M85 64 L89 62 L89 70 L85 68 L85 64" strokeWidth="0.8" />
      {/* Sphinx atop the wheel */}
      <circle cx="48" cy="22" r="5" strokeWidth="0.95" />
      <path d="M44 26 L40 34 H56 L52 26" strokeWidth="0.85" />
      <path d="M40 30 C36 30 34 32 34 34 H40 M56 30 C60 30 62 32 62 34 H56" strokeWidth="0.75" />
      {/* Anubis (jackal-headed) descending left */}
      <circle cx="14" cy="70" r="4" strokeWidth="0.85" />
      <path d="M12 68 L10 62" strokeWidth="0.7" />
      <path d="M14 74 L12 82 H18 L16 74 M12 78 L10 74 M16 74 L18 72" strokeWidth="0.7" />
      {/* Serpent descending right */}
      <path d="M80 46 C86 54 86 62 82 68 C78 74 80 80 78 86 C76 92 72 94 70 90" strokeWidth="0.95" />
      <circle cx="70" cy="88" r="2.5" strokeWidth="0.75" />
      <path d="M68 88 L66 84 M72 88 L74 84" strokeWidth="0.6" />
    </>
  ),

  justice: (
    <>
      {/* Two stone pillars */}
      <rect x="8" y="14" width="9" height="106" rx="1" strokeWidth="0.85" opacity="0.75" />
      <rect x="79" y="14" width="9" height="106" rx="1" strokeWidth="0.85" opacity="0.75" />
      <path d="M6 16 H19 M77 16 H90 M6 20 H19 M77 20 H90" strokeWidth="0.55" />
      {/* Purple curtain / veil hint */}
      <path d="M17 18 Q48 26 79 18 L79 34 Q48 40 17 34 Z" strokeWidth="0.7" opacity="0.55" strokeDasharray="2 3" />
      {/* Throne / seat suggestion */}
      <path d="M17 86 H79 M17 34 V86 M79 34 V86" strokeWidth="0.55" opacity="0.4" />
      {/* Crown */}
      <path d="M34 32 H62 M36 32 L38 22 M44 32 L46 20 L48 18 L50 20 L52 32 M58 32 L60 22" strokeWidth="0.9" />
      <path d="M34 24 H38 M58 24 H62" strokeWidth="0.65" />
      {/* Head */}
      <circle cx="48" cy="44" r="6.5" strokeWidth="1.05" />
      {/* Long judicial robe */}
      <path d="M40 50 L38 88 H58 L56 50 Z" strokeWidth="0.95" />
      <path d="M40 60 H56 M40 68 H56" strokeWidth="0.45" opacity="0.55" />
      {/* Balance scales (left hand) */}
      <path d="M32 52 L32 46" strokeWidth="1.05" />
      <path d="M24 46 H40" strokeWidth="1.05" />
      {/* Left pan */}
      <path d="M24 46 L22 56 Q28 60 30 56 L28 46" strokeWidth="0.85" />
      {/* Right pan */}
      <path d="M38 46 L40 56 Q46 60 44 56 L42 46" strokeWidth="0.85" />
      {/* Upright sword (right hand) — double-edged */}
      <path d="M64 50 L64 22" strokeWidth="1.2" />
      <path d="M60 52 H68" strokeWidth="1.05" />
      <path d="M62 22 L64 18 L66 22 Z" fill="currentColor" stroke="none" />
      {/* Sword grip detail */}
      <path d="M63 56 H65 L65 62 H63 Z" strokeWidth="0.7" />
    </>
  ),

  the_hanged_man: (
    <>
      {/* Living tree — T-cross crossbar */}
      <path d="M16 22 L16 108" strokeWidth="1.1" />
      <path d="M80 22 L80 108" strokeWidth="1.1" />
      {/* Crossbeam */}
      <path d="M12 26 H84" strokeWidth="1.2" />
      {/* Tree roots */}
      <path d="M12 108 C8 104 8 112 16 112 M84 108 C88 104 88 112 80 112" strokeWidth="0.8" />
      {/* Tree branch suggestion — leaves on posts */}
      <path d="M12 40 C8 36 6 42 10 44 M84 40 C88 36 90 42 86 44" strokeWidth="0.7" opacity="0.6" />
      <path d="M12 56 C6 52 4 60 10 60 M84 56 C90 52 92 60 86 60" strokeWidth="0.65" opacity="0.55" />
      {/* Rope from crossbeam */}
      <path d="M48 26 L48 38" strokeWidth="0.95" />
      {/* Head (lowest point, upside down) */}
      <circle cx="48" cy="96" r="7.5" strokeWidth="1.05" />
      {/* Halo of light */}
      <circle cx="48" cy="96" r="12" strokeWidth="0.5" strokeDasharray="1.5 2.5" opacity="0.7" />
      {/* Body going upward from head */}
      <path d="M48 88 L48 64" strokeWidth="1.1" />
      {/* Right leg straight — foot tied to rope */}
      <path d="M48 64 L44 50 L44 38" strokeWidth="1.05" />
      <path d="M44 38 L48 38" strokeWidth="0.8" />
      {/* Left leg crossed behind — bent at knee */}
      <path d="M48 64 L54 54 L50 44" strokeWidth="1.05" />
      {/* Arms behind back forming a triangle */}
      <path d="M48 78 L38 72 C34 70 32 74 34 78 C36 82 40 82 42 80" strokeWidth="0.95" />
      <path d="M48 78 L58 72 C62 70 64 74 62 78 C60 82 56 82 54 80" strokeWidth="0.95" />
      {/* Hair / cloth flowing downward */}
      <path d="M42 102 C40 108 42 116 44 114 M52 103 C54 110 52 118 50 116" strokeWidth="0.75" />
    </>
  ),

  death: (
    <>
      {/* Rising sun on horizon — transformation */}
      <path d="M10 88 H86" strokeWidth="0.9" />
      <circle cx="48" cy="88" r="14" strokeWidth="0.85" opacity="0.65" />
      <path d="M48 70 V64 M60 74 L64 70 M36 74 L32 70 M66 88 H72 M30 88 H24" strokeWidth="0.7" opacity="0.6" />
      {/* River */}
      <path d="M10 100 C22 96 34 102 48 98 C62 94 74 100 86 96" strokeWidth="0.8" opacity="0.5" />
      {/* Fallen king, woman, child below */}
      <circle cx="16" cy="84" r="4" strokeWidth="0.8" />
      <path d="M12 88 L10 96 H22 L20 88" strokeWidth="0.7" />
      <circle cx="76" cy="80" r="3.5" strokeWidth="0.8" />
      <path d="M76 84 L72 92 M76 84 L80 92" strokeWidth="0.7" />
      <circle cx="62" cy="82" r="2.5" strokeWidth="0.75" />
      {/* Horse — large, centre */}
      <ellipse cx="44" cy="62" rx="24" ry="14" strokeWidth="1.05" />
      {/* Horse head */}
      <path d="M64 52 C72 48 78 54 76 62 C72 56 66 56 64 60" strokeWidth="0.95" />
      <path d="M76 58 L80 60 L78 64" strokeWidth="0.8" />
      {/* Flowing mane */}
      <path d="M64 52 C66 46 68 44 66 50" strokeWidth="0.7" />
      {/* Horse legs */}
      <path d="M28 72 L24 88 M36 74 L34 88 M52 74 L54 88 M60 72 L64 88" strokeWidth="0.95" />
      {/* Skeleton rider */}
      <circle cx="44" cy="42" r="6.5" strokeWidth="1" />
      {/* Skull — eyeholes and teeth */}
      <circle cx="41" cy="40" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="47" cy="40" r="1.5" fill="currentColor" stroke="none" />
      <path d="M40 46 H48 M41 46 V48 M44 46 V48 M47 46 V48" strokeWidth="0.6" />
      {/* Spine and ribs */}
      <path d="M44 48 L44 60 M40 50 H48 M38 54 H50 M38 58 H50" strokeWidth="0.8" />
      {/* Black banner with white rose */}
      <path d="M52 40 L60 20" strokeWidth="1.1" />
      <path d="M60 20 H80 L80 32 H60 L60 20" strokeWidth="0.85" />
      <circle cx="70" cy="26" r="4" strokeWidth="0.75" />
      <path d="M70 22 V30 M66 26 H74" strokeWidth="0.5" />
    </>
  ),

  temperance: (
    <>
      {/* Gentle landscape — pool and irises */}
      <path d="M10 90 Q30 84 48 88 Q66 84 86 90" strokeWidth="0.75" opacity="0.5" />
      <path d="M24 106 Q48 100 72 106 Q72 118 48 120 Q24 118 24 106 Z" strokeWidth="0.85" opacity="0.6" />
      {/* Irises left */}
      <path d="M14 92 L14 76 M12 80 C12 74 18 72 16 78 M14 76 C14 70 20 68 18 74" strokeWidth="0.7" opacity="0.7" />
      <path d="M10 78 C10 72 14 72 14 78 C14 72 18 72 18 78 C14 76 10 76 10 80 Z" strokeWidth="0.7" opacity="0.7" />
      {/* Irises right */}
      <path d="M82 92 L82 76 M80 80 C80 74 86 72 84 78 M82 76 C82 70 88 68 86 74" strokeWidth="0.7" opacity="0.7" />
      <path d="M78 78 C78 72 82 72 82 78 C82 72 86 72 86 78 C82 76 78 76 78 80 Z" strokeWidth="0.7" opacity="0.7" />
      {/* Angel figure */}
      <circle cx="48" cy="34" r="7" strokeWidth="1.05" />
      {/* Solar crown / halo */}
      <circle cx="48" cy="34" r="12" strokeWidth="0.5" opacity="0.6" strokeDasharray="1.2 3" />
      <path d="M48 19 v-6 M61 23 l4 -4 M35 23 l-4 -4 M64 34 h6 M32 34 h-6" strokeWidth="0.7" opacity="0.55" />
      {/* Large wings spanning wide */}
      <path d="M40 33 C28 26 12 28 8 40 C14 34 28 36 34 44 C36 36 38 32 40 36" strokeWidth="0.95" />
      <path d="M56 33 C68 26 84 28 88 40 C82 34 68 36 62 44 C60 36 58 32 56 36" strokeWidth="0.95" />
      {/* Triangle on breast */}
      <path d="M44 44 L48 38 L52 44 Z M44 44 H52" strokeWidth="0.85" />
      {/* Robe */}
      <path d="M40 42 C38 56 36 72 34 90 M56 42 C58 56 60 72 62 90" strokeWidth="0.9" />
      <path d="M34 90 Q48 84 62 90" strokeWidth="0.8" />
      {/* Two cups — pouring arc */}
      <path d="M26 56 L24 68 H36 L34 56 M24 66 Q30 70 36 66" strokeWidth="0.9" />
      <path d="M60 66 L58 78 H70 L68 66 M58 76 Q64 80 70 76" strokeWidth="0.9" />
      <path d="M34 58 C40 52 52 58 58 68" strokeWidth="0.7" strokeDasharray="1.5 2" />
      {/* Foot in water / foot on land */}
      <path d="M60 92 Q66 88 64 96 M36 94 Q30 90 32 98" strokeWidth="0.8" />
    </>
  ),

  the_devil: (
    <>
      {/* Inverted pentagram above */}
      <path d="M48 16 L42 34 L58 24 L38 24 L54 34 Z" strokeWidth="0.9" />
      {/* Dark radiating lines from the pentagram */}
      <path d="M48 10 L24 36 M48 10 L36 40 M48 10 L60 40 M48 10 L72 36" strokeWidth="0.5" opacity="0.35" />
      {/* Half-cube throne */}
      <path d="M24 100 H72 V112 H24 Z M24 100 L18 90 H66 L72 100 M18 90 H24 V100 M66 90 L72 100" strokeWidth="0.9" />
      {/* Main Baphomet figure */}
      <circle cx="48" cy="48" r="9.5" strokeWidth="1.05" />
      {/* Goat horns */}
      <path d="M38 42 C36 30 28 26 30 20 C34 28 36 34 40 40 M58 42 C60 30 68 26 66 20 C62 28 60 34 56 40" strokeWidth="1" />
      {/* Goat ears */}
      <path d="M38 44 L32 40 L34 46 M58 44 L64 40 L62 46" strokeWidth="0.75" />
      {/* Face details — eyes and pentagram brow */}
      <circle cx="43" cy="47" r="2" fill="currentColor" stroke="none" />
      <circle cx="53" cy="47" r="2" fill="currentColor" stroke="none" />
      <path d="M43 52 H53 M44 56 Q48 58 52 56" strokeWidth="0.75" />
      {/* Large bat wings */}
      <path d="M38 54 C24 46 8 52 6 66 C12 58 28 58 34 66 C36 56 38 52 38 58" strokeWidth="1" />
      <path d="M58 54 C72 46 88 52 90 66 C84 58 68 58 62 66 C60 56 58 52 58 58" strokeWidth="1" />
      {/* Wing membrane veins */}
      <path d="M8 64 L34 62 M10 60 L32 60" strokeWidth="0.45" opacity="0.55" />
      <path d="M88 64 L62 62 M86 60 L64 60" strokeWidth="0.45" opacity="0.55" />
      {/* Body */}
      <path d="M40 58 L38 82 H58 L56 58 Z" strokeWidth="0.95" />
      {/* Inverted torch — flame pointing down */}
      <path d="M40 58 L34 42" strokeWidth="1.05" />
      <path d="M32 38 C30 34 34 32 36 36 C34 32 38 30 40 34 C40 30 36 30 36 36 Z" strokeWidth="0.8" />
      {/* Two bound figures below */}
      <circle cx="28" cy="90" r="4" strokeWidth="0.85" />
      <path d="M28 94 L24 104 H34 L30 94 M22 98 L24 92 M30 92 L32 96" strokeWidth="0.75" />
      <path d="M26 88 L24 84 M30 88 L32 84" strokeWidth="0.7" />
      <circle cx="68" cy="90" r="4" strokeWidth="0.85" />
      <path d="M68 94 L64 104 H74 L70 94 M62 98 L64 92 M70 92 L72 96" strokeWidth="0.75" />
      <path d="M66 88 L64 84 M70 88 L72 84" strokeWidth="0.7" />
      {/* Chains */}
      <path d="M48 80 C44 82 36 86 30 90" strokeWidth="0.7" strokeDasharray="1.5 1.2" />
      <path d="M48 80 C52 82 60 86 66 90" strokeWidth="0.7" strokeDasharray="1.5 1.2" />
    </>
  ),

  the_tower: (
    <>
      {/* Stormy sky */}
      <path d="M10 16 C18 10 28 12 36 8 C44 6 52 10 60 8 C68 6 76 10 84 8 L86 16" strokeWidth="0.7" opacity="0.45" />
      {/* The Tower — tall rectangular keep */}
      <path d="M24 114 L24 36 H72 L72 114" strokeWidth="1.05" />
      <path d="M20 114 H76" strokeWidth="0.85" />
      {/* Crenellated battlements */}
      <path d="M24 36 H28 V28 H32 V36 H36 V28 H40 V36 H44 V28 H48 V36 H52 V28 H56 V36 H60 V28 H64 V36 H68 V28 H72 V36" strokeWidth="0.9" />
      {/* Tower wall texture — horizontal lines */}
      <path d="M28 48 H68 M28 60 H68 M28 72 H68 M28 84 H68 M28 96 H68" strokeWidth="0.35" opacity="0.5" />
      {/* Arrow-slit windows */}
      <rect x="34" y="52" width="8" height="12" rx="0.5" strokeWidth="0.75" />
      <rect x="54" y="52" width="8" height="12" rx="0.5" strokeWidth="0.75" />
      <rect x="44" y="68" width="8" height="14" rx="0.5" strokeWidth="0.75" />
      {/* Crown blasted off top */}
      <path d="M40 28 H56 L60 20 H56 M40 24 L38 18 M48 28 L48 18 M54 22 L58 16" strokeWidth="0.9" />
      {/* Lightning bolt — jagged and thick */}
      <path d="M80 8 L62 46 L70 46 L52 84" strokeWidth="1.3" strokeLinejoin="round" />
      {/* Second lightning channel */}
      <path d="M78 12 L62 44 L68 44 L54 80" strokeWidth="0.4" opacity="0.6" />
      {/* Falling figure left */}
      <circle cx="16" cy="66" r="4.5" strokeWidth="0.95" />
      <path d="M16 70 L12 82 M16 70 L22 80 M12 74 L22 76" strokeWidth="0.9" />
      {/* Falling figure right */}
      <circle cx="78" cy="82" r="4.5" strokeWidth="0.95" />
      <path d="M78 86 L74 98 M78 86 L84 96 M74 90 L84 92" strokeWidth="0.9" />
      {/* Flames at base */}
      <path d="M28 114 C26 106 32 104 30 114 M40 114 C38 106 44 104 42 114 M52 114 C50 106 56 104 54 114 M64 114 C62 106 68 104 66 114" strokeWidth="0.8" opacity="0.75" />
    </>
  ),

  the_star: (
    <>
      {/* Large 8-pointed star — centrepiece */}
      <path d="M48 12 L52 28 L66 22 L56 34 L70 38 L54 40 L58 56 L48 44 L38 56 L42 40 L26 38 L40 34 L30 22 L44 28 Z" strokeWidth="1.05" />
      {/* Seven smaller stars */}
      <path d="M18 20 L19.8 25.2 L25.2 23.4 L21.6 27.6 L26.4 30 L20.8 30 L22.8 35.2 L18 30.4 L13.2 35.2 L15.2 30 L9.6 30 L14.4 27.6 L10.8 23.4 L16.2 25.2 Z" strokeWidth="0.65" />
      <path d="M74 16 L75.4 20.2 L79.8 18.8 L77 22 L81 24 L76.6 24 L78.2 28.2 L74 24.4 L69.8 28.2 L71.4 24 L67 24 L71 22 L68.2 18.8 L72.6 20.2 Z" strokeWidth="0.65" />
      <g fill="currentColor" stroke="none" opacity="0.7">
        <circle cx="84" cy="38" r="1.6" />
        <circle cx="12" cy="42" r="1.4" />
        <circle cx="80" cy="54" r="1.3" />
        <circle cx="14" cy="58" r="1.3" />
        <circle cx="82" cy="66" r="1.1" />
      </g>
      {/* Pool of water */}
      <path d="M16 108 Q48 100 80 108 Q80 122 48 124 Q16 122 16 108 Z" strokeWidth="0.9" opacity="0.65" />
      <path d="M22 110 Q48 104 74 110" strokeWidth="0.5" opacity="0.5" />
      {/* Kneeling nude figure */}
      <circle cx="48" cy="62" r="5.5" strokeWidth="1.05" />
      {/* Body */}
      <path d="M48 68 L48 84" strokeWidth="1.1" />
      {/* Left arm pouring into pool */}
      <path d="M44 70 L34 84 L30 96" strokeWidth="1.05" />
      {/* Right arm pouring onto earth */}
      <path d="M52 70 L62 82 L66 90" strokeWidth="1.05" />
      {/* Water streams */}
      <path d="M30 98 L28 106 M32 98 L30 106 M34 98 L32 106" strokeWidth="0.6" opacity="0.75" />
      <path d="M64 92 L66 100 M66 92 L68 100 M62 94 L64 102" strokeWidth="0.6" opacity="0.75" />
      {/* Left knee/foot on earth, right in water */}
      <path d="M44 84 L40 96 Q44 100 42 106" strokeWidth="0.9" />
      <path d="M52 84 L58 94 L60 100" strokeWidth="0.9" />
    </>
  ),

  the_moon: (
    <>
      {/* Large moon — full disc with crescent shadow profile */}
      <circle cx="48" cy="32" r="20" strokeWidth="1.05" />
      <path d="M55 14 C70 18 76 32 68 44 C78 36 80 18 55 14 Z" strokeWidth="0.95" opacity="0.65" />
      {/* Moon face */}
      <circle cx="42" cy="29" r="2.2" fill="currentColor" stroke="none" />
      <path d="M38 36 Q42 40 46 36" strokeWidth="0.85" />
      {/* Dew-drops falling from the moon */}
      <path d="M34 52 L30 62 L32 66 L28 72 M48 54 L50 64 L46 70 L50 78 M62 52 L68 62 L64 66 L68 74" strokeWidth="0.5" opacity="0.45" strokeDasharray="1 2" />
      {/* Moon rays */}
      <path d="M48 10 V4 M28 16 L24 12 M68 16 L72 12 M20 30 H14 M76 30 H82 M28 48 L24 52 M68 48 L72 52" strokeWidth="0.7" opacity="0.6" />
      {/* Winding path */}
      <path d="M20 108 Q26 96 32 86 Q40 74 48 72 Q56 74 64 86 Q70 96 76 108" strokeWidth="0.7" strokeDasharray="2 2.5" opacity="0.55" />
      {/* Pool at bottom */}
      <path d="M10 108 Q48 100 86 108 Q86 122 48 124 Q10 122 10 108 Z" strokeWidth="0.9" opacity="0.6" />
      {/* Crayfish emerging from pool */}
      <path d="M48 108 L48 96 M44 96 H52 M42 98 H54" strokeWidth="0.95" />
      <path d="M44 94 L40 88 L44 90 M52 94 L56 88 L52 90" strokeWidth="0.85" />
      <path d="M44 100 L42 106 M48 100 L48 106 M52 100 L54 106" strokeWidth="0.65" />
      {/* Two towers */}
      <path d="M8 108 L8 66 H20 L20 108" strokeWidth="1" />
      <path d="M6 68 H8 V64 H10 V68 H12 V64 H14 V68 H16 V64 H18 V68 H20" strokeWidth="0.7" />
      <path d="M76 108 L76 66 H88 L88 108" strokeWidth="1" />
      <path d="M74 68 H76 V64 H78 V68 H80 V64 H82 V68 H84 V64 H86 V68 H88" strokeWidth="0.7" />
      {/* Dog (left) and wolf (right) howling */}
      <circle cx="26" cy="100" r="4.5" strokeWidth="0.9" />
      <path d="M24 100 L22 96 L26 94 L28 96 L26 100 M26 94 L26 84" strokeWidth="0.75" />
      <path d="M22 104 L26 106 M26 106 L30 104 M22 104 L16 106 M30 104 L36 102" strokeWidth="0.7" />
      <circle cx="70" cy="100" r="4.5" strokeWidth="0.9" />
      <path d="M68 100 L66 96 L70 94 L74 96 L70 100 M70 94 L70 84" strokeWidth="0.75" />
      <path d="M66 104 L70 106 M70 106 L74 104 M66 104 L60 106 M74 104 L80 102" strokeWidth="0.7" />
    </>
  ),

  the_sun: (
    <>
      {/* Great radiant sun */}
      <circle cx="48" cy="34" r="20" strokeWidth="1.1" />
      <circle cx="48" cy="34" r="13" strokeWidth="0.6" opacity="0.5" />
      {/* Sun face */}
      <circle cx="41" cy="31" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="55" cy="31" r="2.2" fill="currentColor" stroke="none" />
      <path d="M41 38 Q48 43 55 38" strokeWidth="0.95" />
      <path d="M46 27 Q48 25 50 27" strokeWidth="0.7" />
      {/* Long rays — alternating long and short */}
      <path d="M48 12 V6 M48 56 V62 M28 18 L23 14 M68 18 L73 14 M28 50 L23 54 M68 50 L73 54 M14 34 H8 M82 34 H88" strokeWidth="1.05" />
      <path d="M34 16 L30 11 M62 16 L66 11 M20 24 L15 22 M76 24 L81 22 M20 44 L15 46 M76 44 L81 46 M34 52 L30 57 M62 52 L66 57" strokeWidth="0.75" />
      {/* Stone wall */}
      <path d="M10 102 H86 V96 H10 Z M10 99 H86" strokeWidth="0.8" />
      <path d="M20 96 V102 M32 96 V102 M44 96 V102 M56 96 V102 M68 96 V102 M80 96 V102" strokeWidth="0.45" opacity="0.6" />
      {/* Sunflowers on wall */}
      <path d="M10 96 L10 80 M8 84 C8 78 14 78 14 84 C14 78 10 74 10 80" strokeWidth="0.8" opacity="0.7" />
      <circle cx="10" cy="78" r="4" strokeWidth="0.7" opacity="0.7" />
      <path d="M86 96 L86 80 M84 84 C84 78 90 78 90 84 C90 78 86 74 86 80" strokeWidth="0.8" opacity="0.7" />
      <circle cx="86" cy="78" r="4" strokeWidth="0.7" opacity="0.7" />
      {/* White horse */}
      <ellipse cx="48" cy="86" rx="20" ry="11" strokeWidth="1.05" />
      {/* Horse head */}
      <path d="M64 80 C70 76 76 80 74 88 C70 82 66 82 64 86" strokeWidth="0.95" />
      <path d="M74 84 L78 86 L76 90" strokeWidth="0.8" />
      {/* Mane */}
      <path d="M64 80 C66 72 70 70 68 78" strokeWidth="0.7" />
      {/* Horse tail */}
      <path d="M28 84 C22 78 20 88 26 92" strokeWidth="0.9" />
      {/* Legs */}
      <path d="M36 94 L34 106 M44 96 L42 106 M52 96 L54 106 M60 94 L62 106" strokeWidth="0.95" />
      {/* Child on horse */}
      <circle cx="54" cy="68" r="5.5" strokeWidth="1" />
      {/* Sunray crown */}
      <path d="M50 64 L48 58 M54 63 L53 57 M58 65 L62 60 M56 68 L60 64" strokeWidth="0.7" />
      {/* Arms — left holding horse, right with banner */}
      <path d="M50 72 L42 78 M58 72 L66 68" strokeWidth="0.9" />
      <path d="M66 68 L66 58 L78 61 L66 64" strokeWidth="0.85" />
    </>
  ),

  judgement: (
    <>
      {/* Clouds at top */}
      <path d="M8 30 C14 20 26 18 32 26 C36 16 46 14 52 22 C58 14 70 18 74 26 C80 18 88 22 88 32" strokeWidth="0.9" opacity="0.55" />
      <path d="M14 30 C16 22 28 22 28 30 M54 22 C56 16 66 18 66 26 M72 26 C74 20 84 22 84 30" strokeWidth="0.65" opacity="0.45" />
      {/* Angel — head with halo */}
      <circle cx="48" cy="22" r="7" strokeWidth="1.05" />
      <circle cx="48" cy="22" r="12" strokeWidth="0.5" opacity="0.6" strokeDasharray="1.5 3" />
      {/* Large wings */}
      <path d="M40 20 C28 12 10 14 6 28 C12 22 28 24 34 32 C36 22 38 18 40 22" strokeWidth="1" />
      <path d="M56 20 C68 12 86 14 90 28 C84 22 68 24 62 32 C60 22 58 18 56 22" strokeWidth="1" />
      {/* Trumpet */}
      <path d="M44 30 L54 38 L54 48 L44 48 Z" strokeWidth="0.95" />
      <path d="M54 40 L68 46 L68 54 L54 48" strokeWidth="0.95" />
      <path d="M68 50 C72 50 76 54 74 58 C72 62 68 58 68 54" strokeWidth="0.9" />
      {/* Cross banner */}
      <path d="M54 38 L66 38 M60 38 V46" strokeWidth="0.75" />
      {/* Rays from angel */}
      <path d="M36 12 L30 6 M60 12 L66 6 M48 10 V4" strokeWidth="0.7" opacity="0.6" />
      {/* Ocean / sea of eternity */}
      <path d="M10 94 Q30 88 48 92 Q66 88 86 94" strokeWidth="0.8" opacity="0.55" />
      {/* Three figures rising from rectangular coffins */}
      {/* Left */}
      <rect x="12" y="96" width="20" height="24" rx="1" strokeWidth="0.75" opacity="0.55" />
      <circle cx="22" cy="80" r="4.5" strokeWidth="0.9" />
      <path d="M22 84 L22 96 M16 86 L10 80 M28 86 L34 80" strokeWidth="0.9" />
      {/* Centre */}
      <rect x="38" y="92" width="20" height="26" rx="1" strokeWidth="0.75" opacity="0.55" />
      <circle cx="48" cy="76" r="5" strokeWidth="0.95" />
      <path d="M48 82 L48 92 M40 80 L34 74 M56 80 L62 74" strokeWidth="0.95" />
      {/* Right */}
      <rect x="64" y="96" width="20" height="24" rx="1" strokeWidth="0.75" opacity="0.55" />
      <circle cx="74" cy="80" r="4.5" strokeWidth="0.9" />
      <path d="M74 84 L74 96 M68 86 L62 80 M80 86 L86 80" strokeWidth="0.9" />
    </>
  ),

  the_world: (
    <>
      {/* Oval laurel wreath — main frame */}
      <ellipse cx="48" cy="64" rx="34" ry="48" strokeWidth="1.1" />
      <ellipse cx="48" cy="64" rx="30" ry="44" strokeWidth="0.55" opacity="0.4" />
      {/* Wreath leaf pairs — left side */}
      <path d="M14 44 C8 40 8 32 14 30 C12 36 14 42 18 42" strokeWidth="0.75" opacity="0.85" />
      <path d="M12 56 C6 52 6 44 12 42 C10 48 12 54 16 54" strokeWidth="0.75" opacity="0.85" />
      <path d="M12 68 C6 64 6 58 12 56 C10 62 12 66 16 66" strokeWidth="0.75" opacity="0.85" />
      <path d="M12 80 C6 76 6 70 12 68 C10 74 12 78 16 78" strokeWidth="0.75" opacity="0.85" />
      <path d="M14 92 C8 88 8 82 14 80 C12 86 14 90 18 90" strokeWidth="0.75" opacity="0.85" />
      {/* Wreath leaf pairs — right side */}
      <path d="M82 44 C88 40 88 32 82 30 C84 36 82 42 78 42" strokeWidth="0.75" opacity="0.85" />
      <path d="M84 56 C90 52 90 44 84 42 C86 48 84 54 80 54" strokeWidth="0.75" opacity="0.85" />
      <path d="M84 68 C90 64 90 58 84 56 C86 62 84 66 80 66" strokeWidth="0.75" opacity="0.85" />
      <path d="M84 80 C90 76 90 70 84 68 C86 74 84 78 80 78" strokeWidth="0.75" opacity="0.85" />
      <path d="M82 92 C88 88 88 82 82 80 C84 86 82 90 78 90" strokeWidth="0.75" opacity="0.85" />
      {/* Wreath ties */}
      <path d="M38 16 Q48 14 58 16 M38 18 Q48 20 58 18" strokeWidth="0.85" />
      <path d="M38 112 Q48 114 58 112 M38 110 Q48 108 58 110" strokeWidth="0.85" />
      {/* Dancing figure inside wreath */}
      <circle cx="48" cy="48" r="6" strokeWidth="1.05" />
      {/* Flowing hair */}
      <path d="M44 46 C42 40 44 36 48 36 C52 36 54 40 52 46" strokeWidth="0.8" />
      {/* Body — dynamic sash wrap */}
      <path d="M46 54 C44 60 46 68 48 70 C50 68 52 60 50 54 Z" strokeWidth="0.9" />
      {/* Left arm raised — wand up */}
      <path d="M46 56 L36 50 L32 46" strokeWidth="1.05" />
      <path d="M32 46 L30 42" strokeWidth="1.15" />
      <circle cx="30" cy="40" r="2" fill="currentColor" stroke="none" />
      {/* Right arm — wand out */}
      <path d="M50 58 L60 64 L66 70" strokeWidth="1.05" />
      <path d="M66 70 L68 74" strokeWidth="1.15" />
      <circle cx="69" cy="76" r="2" fill="currentColor" stroke="none" />
      {/* Legs — dynamic dance pose */}
      <path d="M46 70 L40 82 L36 90" strokeWidth="1.05" />
      <path d="M50 70 L58 80 L62 86" strokeWidth="1.05" />
      {/* Four evangelists in corners */}
      {/* Bull — top left */}
      <path d="M10 16 C10 10 18 8 20 14 C16 10 14 14 18 18 M10 16 C8 18 8 24 12 24 L20 22 L20 14 M8 10 L10 13 M20 10 L18 13" strokeWidth="0.75" opacity="0.8" />
      {/* Eagle — top right */}
      <path d="M76 12 C80 6 88 8 86 16 M82 12 L76 20 C78 18 84 18 86 20 M82 8 L82 4 M80 8 L76 5 M84 8 L88 5" strokeWidth="0.75" opacity="0.8" />
      {/* Lion — bottom left */}
      <circle cx="14" cy="112" r="5.5" strokeWidth="0.8" opacity="0.8" />
      <circle cx="14" cy="112" r="3.5" strokeWidth="0.4" strokeDasharray="0.8 1.5" opacity="0.7" />
      <path d="M10 116 L10 122 L20 122 L20 116 M10 119 H20" strokeWidth="0.65" opacity="0.8" />
      {/* Angel / Aquarius — bottom right */}
      <circle cx="82" cy="110" r="4.5" strokeWidth="0.8" opacity="0.8" />
      <path d="M78 108 C76 104 86 102 88 106" strokeWidth="0.7" opacity="0.8" />
      <path d="M78 114 C76 118 86 120 88 116" strokeWidth="0.7" opacity="0.8" />
    </>
  ),
};

const ARTWORKS_FALLBACK: ReactNode = (
  <>
    <circle cx="48" cy="64" r="34" strokeWidth="0.95" />
    <path d="M48 30 V98 M14 64 H82 M24 40 L72 88 M72 40 L24 88" strokeWidth="0.65" opacity="0.55" />
    <circle cx="48" cy="64" r="18" strokeWidth="0.7" strokeDasharray="1.5 3" />
    <circle cx="48" cy="64" r="7" strokeWidth="0.85" />
    <path d="M48 18 V12 M48 110 V116 M10 64 H4 M86 64 H92" strokeWidth="0.85" opacity="0.65" />
    <g fill="currentColor" stroke="none" opacity="0.7">
      <circle cx="48" cy="16" r="1.5" />
      <circle cx="48" cy="112" r="1.5" />
      <circle cx="14" cy="64" r="1.3" />
      <circle cx="82" cy="64" r="1.3" />
    </g>
  </>
);

/** Letter-spacing tightens as the name grows, so long titles like "Hierophant"
 * stay inside the name band without overflowing. */
function nameLetterSpacing(name: string): number {
  if (name.length >= 10) return 0.6;
  if (name.length >= 8) return 1.2;
  return 2;
}

const NAME_FONT =
  "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";

/**
 * Full card face for an arcana: a top band with the Roman numeral, the line-art
 * scene scaled into the middle, and a bottom band with the card name. Because the
 * name and numeral are drawn *into* the SVG, rotating the whole element renders a
 * genuinely upside-down "reversed" card — art and lettering flip together.
 */
export function TarotArtwork({
  cardId,
  name,
  numeral,
  className
}: {
  cardId: string;
  name: string;
  numeral: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 96 128"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <defs>
        <radialGradient id={`tarot-glow-${cardId}`} cx="50%" cy="44%" r="54%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Card frame */}
      <rect x="3" y="3" width="90" height="122" rx="6" strokeWidth="1.1" opacity="0.8" />
      <rect x="7" y="7" width="82" height="114" rx="3" strokeWidth="0.5" strokeDasharray="1.5 3.5" opacity="0.45" />
      {/* Subtle vignette glow */}
      <rect x="7" y="7" width="82" height="114" rx="3" fill={`url(#tarot-glow-${cardId})`} stroke="none" />

      {/* ── Top band: Roman numeral ── */}
      <text
        x="48"
        y="16.5"
        textAnchor="middle"
        fontFamily={NAME_FONT}
        fontSize="8"
        letterSpacing="2"
        fill="currentColor"
        stroke="none"
        opacity="0.9"
      >
        {numeral}
      </text>
      <path d="M14 21 H38 M58 21 H82" strokeWidth="0.6" opacity="0.55" />
      <path d="M48 19 l2 2 l-2 2 l-2 -2 Z" strokeWidth="0.6" opacity="0.7" />

      {/* ── Middle: the scene, scaled back into its own zone ── */}
      <g transform="translate(16.3 23) scale(0.66)">{ARTWORKS[cardId] ?? ARTWORKS_FALLBACK}</g>

      {/* ── Bottom band: the card name ── */}
      <path d="M14 107 H38 M58 107 H82" strokeWidth="0.6" opacity="0.55" />
      <path d="M48 105 l2 2 l-2 2 l-2 -2 Z" strokeWidth="0.6" opacity="0.7" />
      <text
        x="48"
        y="118.5"
        textAnchor="middle"
        fontFamily={NAME_FONT}
        fontSize="9"
        fontWeight="600"
        letterSpacing={nameLetterSpacing(name)}
        fill="currentColor"
        stroke="none"
      >
        {name.toUpperCase()}
      </text>
    </svg>
  );
}
