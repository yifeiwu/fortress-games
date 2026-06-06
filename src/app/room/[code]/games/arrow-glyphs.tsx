import type { Direction } from "@/lib/types";

/** A chunky directional arrow drawn in `currentColor`. A single up-pointing
 * path is rotated per direction so every arrow stays pixel-identical. */
const ARROW_ROTATION: Record<Direction, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270
};

export function DirectionArrow({ direction, className = "" }: { direction: Direction; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
      <path
        d="M50 10 L84 48 L65 48 L65 90 L35 90 L35 48 L16 48 Z"
        transform={`rotate(${ARROW_ROTATION[direction]} 50 50)`}
      />
    </svg>
  );
}
