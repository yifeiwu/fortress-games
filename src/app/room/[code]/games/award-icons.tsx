/** Podium / victory iconography shared across the finish screens. */

const MEDAL_COLORS = [
  { ring: "#fbbf24", face: "#fde68a", ribbon: "#0ea5e9" }, // gold
  { ring: "#cbd5e1", face: "#e2e8f0", ribbon: "#64748b" }, // silver
  { ring: "#d97706", face: "#f59e0b", ribbon: "#b45309" } // bronze
] as const;

/** A medallion on a ribbon for podium ranks 0 (gold), 1 (silver), 2 (bronze). */
export function Medal({ rank, className = "" }: { rank: number; className?: string }) {
  const c = MEDAL_COLORS[rank] ?? MEDAL_COLORS[2];
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M32 4 L46 4 L58 44 L40 44 Z" fill={c.ribbon} opacity="0.9" />
      <path d="M68 4 L54 4 L42 44 L60 44 Z" fill={c.ribbon} />
      <circle cx="50" cy="64" r="28" fill={c.ring} />
      <circle cx="50" cy="64" r="20" fill={c.face} />
      <text
        x="50"
        y="64"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="22"
        fontWeight="700"
        fill={c.ribbon}
      >
        {rank + 1}
      </text>
    </svg>
  );
}

/** A simple trophy cup in `currentColor`, for winner banners. */
export function Trophy({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
      <path d="M30 14 L70 14 L70 34 C70 48 60 56 50 56 C40 56 30 48 30 34 Z" />
      <path d="M30 18 C16 18 16 36 30 38 L30 30 C24 29 24 24 30 24 Z" />
      <path d="M70 18 C84 18 84 36 70 38 L70 30 C76 29 76 24 70 24 Z" />
      <rect x="46" y="56" width="8" height="16" />
      <rect x="34" y="72" width="32" height="8" rx="2" />
      <rect x="28" y="80" width="44" height="8" rx="2" />
    </svg>
  );
}
