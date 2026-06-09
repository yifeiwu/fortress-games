"use client";

import { memo, type ReactNode } from "react";
import { Button } from "@/components/Button";

const CONFETTI_COLORS = ["#38bdf8", "#34d399", "#fb7185", "#fbbf24", "#a78bfa"];
const CONFETTI_PIECES = Array.from({ length: 18 });

/** A burst of falling confetti, absolutely positioned over its parent. */
export const Confetti = memo(function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {CONFETTI_PIECES.map((_, i) => (
        <span
          key={i}
          className="animate-confetti absolute top-0 block h-2 w-2 rounded-sm"
          style={{
            left: `${(i / CONFETTI_PIECES.length) * 100}%`,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 6) * 0.25}s`,
            animationDuration: `${2.2 + (i % 4) * 0.4}s`
          }}
        />
      ))}
    </div>
  );
});

/**
 * Footer shown on a finished game: a Play Again button for the host, or a
 * consistent waiting message for everyone else.
 */
export function HostRestartFooter({
  isHost,
  onRestart,
  label = "Play Again",
  className = ""
}: {
  isHost: boolean;
  onRestart: () => void;
  label?: string;
  className?: string;
}) {
  if (isHost) {
    return (
      <Button
        variant="success"
        onClick={onRestart}
        className={`rounded-xl px-8 py-3 ${className}`}
      >
        {label}
      </Button>
    );
  }
  return <p className="text-sm text-slate-400">Waiting for the host to restart the game.</p>;
}

/** The shared bordered panel every game renders inside. */
export function GameShell({
  children,
  className = "",
  active = false
}: {
  children: ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-slate-950/75 p-4 shadow-[0_0_50px_rgba(34,211,238,0.12)] lg:col-span-2 ${
        active ? "border-cyan-300/80 shadow-[0_0_60px_rgba(34,211,238,0.3)]" : "border-cyan-700/40"
      } ${className}`}
    >
      {children}
    </div>
  );
}
