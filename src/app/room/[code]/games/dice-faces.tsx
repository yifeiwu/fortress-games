/** Crisp, scalable dice art for Bluffer's Hoard. Pips inherit `currentColor`
 * so they pick up the surrounding amber / highlight text colour, and the
 * hidden cup is a small wooden tumbler that reads at any size. */

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 28], [70, 28], [30, 50], [70, 50], [30, 72], [70, 72]]
};

/** The pips for a die value, drawn in `currentColor`. Size it with `className`. */
export function DiePips({ value, className = "" }: { value: number; className?: string }) {
  const pips = PIP_LAYOUT[value] ?? [];
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" />
      ))}
    </svg>
  );
}

/** A small overturned wooden cup, used for dice that are still concealed. */
export function HiddenCup({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="dice-cup-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b45309" />
          <stop offset="1" stopColor="#7c2d12" />
        </linearGradient>
      </defs>
      <path d="M28 26 L72 26 L65 80 L35 80 Z" fill="url(#dice-cup-body)" stroke="#451a03" strokeWidth="3" />
      <ellipse cx="50" cy="26" rx="22" ry="7" fill="#92400e" stroke="#451a03" strokeWidth="3" />
      <ellipse cx="50" cy="26" rx="15" ry="4" fill="#451a03" />
      <path d="M37 40 L63 40" stroke="#fcd34d" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
