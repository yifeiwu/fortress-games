/** Inline SVG iconography for FrankenBeasts — status badges, slot-art
 * fallbacks, and outcome marks. All draw in `currentColor` (negative space is
 * cut with even-odd fills) so they sit on any badge/background colour. */

type IconProps = { className?: string };

/** Skull — poison / damage-over-time. */
export function PoisonIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C7.6 2 4 5.4 4 9.6c0 2.4 1.1 4.3 2.6 5.5V18a1 1 0 0 0 1 1H9v-2h2v2h2v-2h2v2h1.4a1 1 0 0 0 1-1v-2.9C18.9 13.9 20 12 20 9.6 20 5.4 16.4 2 12 2Zm-3 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
      />
    </svg>
  );
}

/** Roar — a sound burst for the attack buff. */
export function RoarIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" stroke="none" />
      <path d="M15 8.5a5 5 0 0 1 0 7" strokeLinecap="round" />
      <path d="M18 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" />
    </svg>
  );
}

/** Shield — armor / damage reduction. */
export function ArmorIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2 4 5v6c0 5 3.4 8.2 8 9 4.6-.8 8-4 8-9V5l-8-3Z" />
    </svg>
  );
}

/** Placeholder beast-part art when a PNG is missing, one per slot. */
export function SlotIcon({ slot, className = "" }: { slot: "head" | "body" | "tail"; className?: string }) {
  if (slot === "head") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M4 4l4 4M20 4l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 5c-4 0-7 3-7 7s3 7 7 7 7-3 7-7-3-7-7-7Zm-2.5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
        />
      </svg>
    );
  }
  if (slot === "body") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M12 3c-4 0-6 3-6 7v5c0 3 2.5 6 6 6s6-3 6-6v-5c0-4-2-7-6-7Z" />
        <path d="M9 9h6M9 13h6" stroke="#0b1220" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M4 6c6 0 4 7 8 7s4-5 8-3" strokeLinecap="round" />
      <path d="M19 9l1.5 1-1.8.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Skull-and-crossed-bones styled mark for a loss. */
export function SkullIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C7 2 3 5.6 3 10c0 2.7 1.4 5 3.5 6.4V19a1 1 0 0 0 1 1H10v-2h1.2v2h1.6v-2H14v2h2.5a1 1 0 0 0 1-1v-2.6C19.6 15 21 12.7 21 10c0-4.4-4-8-9-8Zm-3.5 7a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
      />
    </svg>
  );
}

/** A clasped-hands mark for a draw. */
export function HandshakeIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12l4-4 5 1 3-1 4 2" />
      <path d="M22 12l-4 4-3-1" />
      <path d="M11 9l-3 3 2 2 2-1" />
      <path d="M14 10l3 3" />
    </svg>
  );
}
