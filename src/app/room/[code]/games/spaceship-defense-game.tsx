"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { playerName as resolvePlayerName } from "@/lib/game/players";
import { useCountdown, useNumberChange, useStepPlayback } from "@/app/room/[code]/games/shared";
import { GameShell, HostRestartFooter } from "@/app/room/[code]/games/shared-ui";
import {
  ACTION_ENERGY_COST,
  ENERGY_PER_TURN,
  ROUNDS_PER_THREAT_TIER,
  TURN_DURATION_MS,
  emergencyJumpChanceFromCharge,
  threatLevelForRound
} from "@/lib/game/plugins/spaceship-defense-game";
import type { Room, SpaceshipActionType, SpaceshipCrewAction, SpaceshipHitDetail, SpaceshipShipState, SpaceshipThreat, SpaceshipThreatKind } from "@/lib/types";
import { Button } from "@/components/Button";

interface SpaceshipDefenseGameProps {
  room: Room;
  viewerPlayerId: string;
  isHost: boolean;
  onSubmitAction: (action: SpaceshipActionType, targetThreatId?: string) => Promise<void>;
  onRestart: () => void;
}

// Visual scale for the turn timer bar.
const TURN_SECONDS = TURN_DURATION_MS / 1000;

// Named bands for the threat meter (index = tier - 1; the last entry covers all
// higher tiers). Each carries the label and a colour that climbs green→red so
// the rising danger reads at a glance.
const THREAT_TIERS = [
  { label: "Skirmish", bar: "bg-emerald-400", text: "text-emerald-300" },
  { label: "Elevated", bar: "bg-lime-400", text: "text-lime-300" },
  { label: "Severe", bar: "bg-amber-400", text: "text-amber-300" },
  { label: "Critical", bar: "bg-orange-500", text: "text-orange-300" },
  { label: "Overrun", bar: "bg-red-500", text: "text-red-300" }
] as const;

function threatTier(level: number) {
  return THREAT_TIERS[Math.min(THREAT_TIERS.length, Math.max(1, level)) - 1];
}

// Shared base style for the crew action buttons (gradient set per-button inline).
const ACTION_BUTTON =
  "rounded-lg px-3 py-3 text-center text-sm font-semibold text-slate-950 shadow-md shadow-black/30 transition duration-150 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100";

// One shared gradient so the standard crew actions read as a consistent set.
// The escape buttons (Jump Away / Emergency Jump) keep their own risk-coded
// colours since those convey safety-critical meaning.
const ACTION_BUTTON_BG = "linear-gradient(160deg,#38bdf8,#0ea5e9)";

const THREAT_TONES: Record<string, string> = {
  raider: "border-orange-500/40 bg-orange-500/10",
  destroyer: "border-red-500/40 bg-red-500/10",
  missile: "border-amber-500/50 bg-amber-500/10",
  stealth_ship: "border-violet-500/40 bg-violet-500/10"
};

// A short, non-color label per kind so the threat type is legible without
// relying on border colour alone (color-blind friendliness).
const THREAT_TAGS: Record<string, string> = {
  raider: "RDR",
  destroyer: "DST",
  missile: "MSL",
  stealth_ship: "STL"
};

// ---------------------------------------------------------------------------
// Inline icon set (lucide-style, currentColor) used across the spaceship HUD.
// ---------------------------------------------------------------------------
type IconName =
  | "hull"
  | "shields"
  | "jump"
  | "energy"
  | "target"
  | "charge"
  | "warning"
  | "pass"
  | "raider"
  | "destroyer"
  | "missile"
  | "stealth_ship";

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };
  switch (name) {
    case "hull":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
          <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </svg>
      );
    case "shields":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "jump":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M13 17l5-5-5-5" />
          <path d="M6 17l5-5-5-5" />
        </svg>
      );
    case "energy":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none">
          <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
      );
    case "target":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "charge":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 4v5h-5" />
        </svg>
      );
    case "warning":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "pass":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M5 4l10 8-10 8z" fill="currentColor" stroke="none" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
      );
    case "raider":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none">
          <path d="M3 11 21 3l-8 18-2-7-8-3z" />
        </svg>
      );
    case "destroyer":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M21 16.5V7.5L12 2 3 7.5v9L12 22z" />
          <path d="M12 22V12" />
          <path d="m3.5 7 8.5 5 8.5-5" />
        </svg>
      );
    case "missile":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M12 2c1.7 1.7 2.5 4.2 2.5 7.2V16l-2.5 5-2.5-5V9.2C9.5 6.2 10.3 3.7 12 2z" />
          <path d="M9.5 14 6 17.5M14.5 14 18 17.5" />
        </svg>
      );
    case "stealth_ship":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke}>
          <path d="M2 12s4-7 10-7 10 7 10 7" strokeDasharray="3 3" />
          <path d="M12 9a3 3 0 0 1 0 6" />
          <path d="M9.5 10.5 14.5 13.5" />
        </svg>
      );
    default:
      return null;
  }
}

// Inline energy "spark" used within running text/labels (e.g. "1⚡" costs). Kept
// as a tiny baseline-aligned glyph so it reads like part of the number.
function EnergyMark({ className = "h-3 w-3" }: { className?: string }) {
  return <Icon name="energy" className={`inline-block align-[-0.125em] ${className}`} />;
}

// Honours the OS "reduce motion" setting. The heavier ambient effects (parallax
// scroll, screen shake, the red-alert pulse) check this so motion-sensitive
// players get a calm, static HUD instead.
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

// Tracks a narrow (phone-sized) viewport so the tactical view can shrink its
// sprites and keep the swarm from crowding the player's ship.
function useIsCompact(): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return compact;
}

interface Star {
  id: number;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

// Deterministic star generation (seeded so server and client render identically
// and avoid hydration mismatches).
function makeStars(count: number, seedInit: number): Star[] {
  let seed = seedInit;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: rand() * 100,
    top: rand() * 100,
    size: 1 + rand() * 2.2,
    delay: rand() * 4,
    duration: 2.4 + rand() * 3.6,
    opacity: 0.25 + rand() * 0.6
  }));
}

// Two depth layers: a dim, slow far field and a brighter, faster near field.
const FAR_STARS = makeStars(56, 0x9e3779b9);
const NEAR_STARS = makeStars(30, 0x85ebca6b);

// One parallax layer. The layer is 200% wide and holds the same stars twice
// (left half + right half) so the scroll loops seamlessly. `scroll` is the
// per-layer speed animation (omitted when reduced motion is on).
function StarLayer({ stars, scroll, sizeScale }: { stars: Star[]; scroll: string; sizeScale: number }) {
  const tile = (offset: number) =>
    stars.map((star) => (
      <span
        key={`${offset}-${star.id}`}
        className="animate-twinkle absolute rounded-full bg-white"
        style={{
          left: `${offset + star.left / 2}%`,
          top: `${star.top}%`,
          width: `${star.size * sizeScale}px`,
          height: `${star.size * sizeScale}px`,
          opacity: star.opacity,
          animationDelay: `${star.delay}s`,
          animationDuration: `${star.duration}s`
        }}
      />
    ));
  return (
    <div className={`absolute inset-y-0 left-0 w-[200%] ${scroll}`}>
      {tile(0)}
      {tile(50)}
    </div>
  );
}

function Starfield() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Slow-drifting nebula/planet art for parallax depth behind the stars. */}
      <img
        src="/backdrops/spaceship_defense.svg"
        alt=""
        className={`absolute inset-0 h-full w-full scale-110 object-cover opacity-25 ${reduced ? "" : "animate-float-slow"}`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(56,189,248,0.12),transparent_55%),radial-gradient(circle_at_85%_85%,rgba(168,85,247,0.12),transparent_55%)]" />
      <StarLayer stars={FAR_STARS} scroll={reduced ? "" : "animate-star-scroll-slow"} sizeScale={0.8} />
      <StarLayer stars={NEAR_STARS} scroll={reduced ? "" : "animate-star-scroll-fast"} sizeScale={1.3} />
    </div>
  );
}

function playerName(room: Room, playerId: string | undefined): string {
  return resolvePlayerName(room, playerId, "TBD");
}

function orderedPlayers(room: Room) {
  return [...room.players].sort((a, b) => a.joinOrder - b.joinOrder);
}

function hullTone(ratio: number): string {
  if (ratio <= 0.3) return "bg-red-500";
  if (ratio <= 0.6) return "bg-amber-400";
  return "bg-emerald-400";
}

// Returns a className that briefly flashes when `value` changes, so players
// notice hull/shield/jump updates that happen during the enemy phase.
function useFlashOnChange(value: number): string {
  const change = useNumberChange(value, 600);
  if (!change) return "ring-0 ring-transparent";
  return change.delta > 0 ? "ring-2 ring-emerald-300/70" : "ring-2 ring-red-400/70";
}

function ProgressBar({
  value,
  max,
  tone,
  label
}: {
  value: number;
  max: number;
  tone: string;
  label: string;
}) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      className="h-3 overflow-hidden rounded-full bg-slate-800"
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${tone}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function ShipStat({
  label,
  value,
  max,
  tone,
  icon,
  iconClass = "text-slate-400",
  note
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
  icon?: IconName;
  iconClass?: string;
  note?: string;
}) {
  const flash = useFlashOnChange(value);
  return (
    <div
      className={`rounded-lg border border-slate-700/80 bg-slate-900/70 p-4 shadow-inner shadow-black/20 transition-shadow duration-300 ${flash}`}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-slate-200">
          {icon ? <Icon name={icon} className={`h-4 w-4 ${iconClass}`} /> : null}
          {label}
        </span>
        <span className="font-mono tabular-nums text-slate-300">
          {value} <span className="text-slate-500">/ {max}</span>
        </span>
      </div>
      <div className="mt-2">
        <ProgressBar value={value} max={max} tone={tone} label={`${label} ${value} of ${max}`} />
      </div>
      {note ? <p className="mt-1.5 text-xs text-slate-400">{note}</p> : null}
    </div>
  );
}

// The escalation meter, drawn as a compact HUD overlay inside the tactical view
// (top-right). A small bar fills across the current tier band so it visibly
// creeps up each round and "ticks over" into a scarier, redder tier as the
// threat level climbs. At the top tier it pulses to signal the field is about
// to be overrun — a legible nudge to charge and run.
function ThreatLevelMeter({ level, roundIndex, reducedMotion }: { level: number; roundIndex: number; reducedMotion: boolean }) {
  const tier = threatTier(level);
  const isTopTier = level >= THREAT_TIERS.length;
  // Fill within the current tier band; pin to full once at the top tier.
  const progress = isTopTier ? 1 : (roundIndex % ROUNDS_PER_THREAT_TIER) / ROUNDS_PER_THREAT_TIER;
  const percent = Math.round(progress * 100);
  const rising = threatLevelForRound(roundIndex + 1) > level;
  const hint = isTopTier ? "Field overrun — escape now" : rising ? "Threat rises next round" : "Reinforcements keep building";
  return (
    <div
      className={`absolute right-2 top-2 z-20 w-36 rounded-lg border px-2 py-1.5 backdrop-blur-sm ${
        isTopTier ? "border-red-500/60 bg-red-950/50" : "border-slate-600/60 bg-slate-950/70"
      }`}
      title={hint}
    >
      <div className="flex items-center gap-1">
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-300">
          <Icon name="warning" className={`h-3 w-3 ${tier.text}`} />
          Threat
        </span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-label={`Threat level ${tier.label}, tier ${level}`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${tier.bar} ${isTopTier && !reducedMotion ? "animate-pulse" : ""}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// Compact readout for the threat the player has targeted on the battlefield.
// Brings back the attack value / firing cadence that the old card grid showed,
// without re-introducing a whole grid: pick a ship in the viewport, read its
// stats here. Renders a hint when nothing is selected.
function SelectedThreatDetail({ threat }: { threat: SpaceshipThreat | undefined }) {
  if (!threat) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
        Select a ship in the tactical view to inspect its weapons.
      </div>
    );
  }
  const tone = THREAT_TONES[threat.kind] ?? "border-slate-600 bg-slate-800";
  const imminent = threat.attacksInTurns <= 1;
  const killFirst = threat.oneShot && threat.kind !== "missile";
  return (
    <div className={`rounded-xl border p-3 ${tone} ${imminent ? "border-red-400/70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded bg-slate-950/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-200">
          <Icon name={threat.kind} className="h-3 w-3" />
          {THREAT_TAGS[threat.kind] ?? "???"}
        </span>
        <span className="font-semibold text-slate-100">{threat.name}</span>
        <span
          className={`ml-auto rounded-full border px-2 py-0.5 ${
            imminent ? "border-red-400/60 bg-red-500/20 text-red-100" : "border-slate-500/50 bg-slate-950/60 text-slate-200"
          }`}
        >
          T-{threat.attacksInTurns}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <span className="rounded bg-slate-950/50 px-2 py-1">
          Hull <span className="font-semibold text-slate-100">{Math.max(0, threat.health)} / {threat.maxHealth}</span>
        </span>
        <span className="rounded bg-slate-950/50 px-2 py-1">
          Attack <span className="font-semibold text-slate-100">{threat.attackRevealed ? threat.attack : "?"}</span>
        </span>
        <span className="rounded bg-slate-950/50 px-2 py-1">
          {threat.oneShot ? "One-shot" : `Repeats T-${threat.attackInterval}`}
        </span>
      </div>
      {killFirst ? (
        <p className="mt-2 flex items-center gap-1 rounded bg-amber-500/20 px-2 py-1 text-[11px] font-semibold text-amber-100">
          <Icon name="warning" className="h-3 w-3 shrink-0" />
          Kill first — fires once for big damage
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tactical viewport: the ship and the live threats sharing one asteroid/wreckage
// field, with three approach zones plotting how close each threat is to firing.
// ---------------------------------------------------------------------------

// Stable 0..1 hash from a string, so each threat keeps the same
// spot in the field (and on the radar) frame to frame.
function hash01(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

interface Asteroid {
  id: number;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  spin: number;
  shade: number;
}

function makeAsteroids(count: number, seedInit: number): Asteroid[] {
  let seed = seedInit;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: rand() * 100,
    top: rand() * 100,
    size: 26 + rand() * 58,
    delay: rand() * 6,
    duration: 5 + rand() * 6,
    spin: 34 + rand() * 50,
    shade: rand()
  }));
}

const ASTEROIDS = makeAsteroids(7, 0x1b873593);

function AsteroidShape({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <path d="M50 6 72 14 90 34 86 58 70 86 44 92 18 78 8 52 16 26 34 12Z" fill="currentColor" />
      <circle cx="40" cy="40" r="7" fill="rgba(0,0,0,0.28)" />
      <circle cx="62" cy="58" r="10" fill="rgba(0,0,0,0.22)" />
      <circle cx="58" cy="28" r="5" fill="rgba(0,0,0,0.2)" />
    </svg>
  );
}

// Player ship sprite: a flying-saucer silhouette with a shield bubble (opacity
// scales with shields) and a hull tint that shifts amber/red as integrity drops.
function ShipSprite({ shieldRatio, hullRatio, reducedMotion, scale = 1 }: { shieldRatio: number; hullRatio: number; reducedMotion: boolean; scale?: number }) {
  const hullColor = hullRatio <= 0.3 ? "#f87171" : hullRatio <= 0.6 ? "#fbbf24" : "#67e8f9";
  return (
    <div className="relative">
      {shieldRatio > 0 ? (
        <span
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-300/70 ${reducedMotion ? "" : "animate-pulse"}`}
          style={{ width: 96 * scale, height: 96 * scale, opacity: 0.2 + shieldRatio * 0.55, boxShadow: "inset 0 0 18px rgba(34,211,238,0.55)" }}
          aria-hidden="true"
        />
      ) : null}
      <svg viewBox="0 0 84 52" width={82 * scale} height={50 * scale} className="relative drop-shadow-[0_0_10px_rgba(34,211,238,0.45)]" aria-hidden="true">
        {/* Rear ion wake */}
        <path d="M6 27 0 23 0 27 0 31Z" fill="#67e8f9" opacity="0.9" className={reducedMotion ? "" : "animate-pulse"} />
        {/* Saucer base hull */}
        <ellipse cx="42" cy="29" rx="34" ry="11.5" fill={hullColor} stroke="#0e7490" strokeWidth="1.5" />
        {/* Dark underside band */}
        <path d="M13 29c6.5 5 17 8 29 8s22.5-3 29-8" fill="none" stroke="#155e75" strokeWidth="1.5" opacity="0.7" />
        {/* Upper dome */}
        <ellipse cx="42" cy="23" rx="17" ry="8.5" fill="#22d3ee" stroke="#0e7490" strokeWidth="1.2" opacity="0.92" />
        {/* Cockpit lights */}
        <circle cx="35" cy="23" r="1.9" fill="#e0f2fe" opacity="0.9" />
        <circle cx="42" cy="21.8" r="2.1" fill="#e0f2fe" opacity="0.95" />
        <circle cx="49" cy="23" r="1.9" fill="#e0f2fe" opacity="0.9" />
        {/* Rim lights */}
        <g fill="#a5f3fc" opacity="0.85">
          <circle cx="20" cy="31.5" r="1.4" />
          <circle cx="30" cy="34" r="1.2" />
          <circle cx="42" cy="35" r="1.3" />
          <circle cx="54" cy="34" r="1.2" />
          <circle cx="64" cy="31.5" r="1.4" />
        </g>
      </svg>
    </div>
  );
}

// On-screen footprint (px width) per enemy class. The Destroyer is a capital
// ship — drawn at ~2× the others ("two squares").
const ENEMY_SIZE: Record<SpaceshipThreatKind, number> = {
  raider: 48,
  destroyer: 92,
  missile: 42,
  stealth_ship: 54
};

// Detailed side-view enemy ships, all facing left toward the player's vessel.
// Filled silhouettes with plating/cockpit/engine detail rather than flat glyphs.
function EnemyShip({ kind, className = "" }: { kind: SpaceshipThreatKind; className?: string }) {
  switch (kind) {
    case "raider":
      return (
        <svg viewBox="0 0 100 64" className={className} aria-hidden="true">
          <path d="M88 26 102 32 88 38Z" fill="#fde68a" opacity="0.9" />
          <path d="M54 26 74 4 80 28Z" fill="#c2410c" />
          <path d="M54 38 74 60 80 36Z" fill="#c2410c" />
          <path d="M6 32 46 20 90 26 Q98 28 98 32 Q98 36 90 38 L46 44Z" fill="#fb923c" stroke="#7c2d12" strokeWidth="2" />
          <path d="M48 30 86 29 86 35 48 34Z" fill="#9a3412" opacity="0.7" />
          <path d="M28 28 46 26 46 38 28 36Z" fill="#0c4a6e" stroke="#bae6fd" strokeWidth="1" />
        </svg>
      );
    case "destroyer":
      return (
        <svg viewBox="0 0 124 84" className={className} aria-hidden="true">
          <path d="M106 30 122 36 106 42Z" fill="#fecaca" opacity="0.9" />
          <path d="M106 44 122 50 106 56Z" fill="#fecaca" opacity="0.9" />
          <path d="M78 26 92 4 100 28Z" fill="#7f1d1d" />
          <path d="M78 58 92 80 100 56Z" fill="#7f1d1d" />
          <path d="M8 42 34 24 100 22 Q114 26 114 42 Q114 58 100 62 L34 60Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2.5" />
          <path d="M40 30 98 28 M40 54 98 56" stroke="#991b1b" strokeWidth="2" fill="none" />
          <path d="M8 42 26 33 26 51Z" fill="#b91c1c" />
          <rect x="60" y="32" width="26" height="20" rx="3" fill="#991b1b" stroke="#fca5a5" strokeWidth="1" />
          <g fill="#fca5a5">
            <circle cx="50" cy="30" r="5" />
            <rect x="32" y="28.5" width="20" height="3" rx="1.5" />
            <circle cx="72" cy="56" r="5" />
            <rect x="54" y="54.5" width="20" height="3" rx="1.5" />
          </g>
        </svg>
      );
    case "missile":
      return (
        <svg viewBox="0 0 100 44" className={className} aria-hidden="true">
          <path d="M84 18 100 22 84 26Z" fill="#fde68a" opacity="0.9" />
          <path d="M70 14 90 4 82 18Z" fill="#b45309" />
          <path d="M70 30 90 40 82 26Z" fill="#b45309" />
          <path d="M8 22 Q26 10 78 14 L84 18 84 26 78 30 Q26 34 8 22Z" fill="#fbbf24" stroke="#92400e" strokeWidth="2" />
          <path d="M8 22 26 15 26 29Z" fill="#b45309" />
          <path d="M40 14 42 30 M50 14 52 30" stroke="#92400e" strokeWidth="2" />
        </svg>
      );
    case "stealth_ship":
      return (
        <svg viewBox="0 0 100 60" className={className} aria-hidden="true">
          <path d="M88 26 102 30 88 34Z" fill="#c4b5fd" opacity="0.7" />
          <path d="M6 30 66 10 94 24 94 36 66 50Z" fill="#8b5cf6" fillOpacity="0.85" stroke="#4c1d95" strokeWidth="2" />
          <path d="M6 30 66 10 60 30Z" fill="#6d28d9" fillOpacity="0.7" />
          <path d="M6 30 60 30 66 50Z" fill="#5b21b6" fillOpacity="0.7" />
          <path d="M6 30 66 10 94 24" fill="none" stroke="#c4b5fd" strokeWidth="1" strokeDasharray="4 3" />
          <path d="M40 27 56 25 56 31 40 32Z" fill="#1e1b4b" />
        </svg>
      );
    default:
      return null;
  }
}

// A clickable enemy marker in the field: a detailed ship sprite, attack
// countdown, and a tiny health bar. Imminent threats flash; "kill first" threats
// get a warning pip.
function ThreatBlip({
  threat,
  x,
  y,
  selected,
  disabled,
  onSelect,
  reducedMotion,
  scale = 1
}: {
  threat: SpaceshipThreat;
  x: number;
  y: number;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  reducedMotion: boolean;
  scale?: number;
}) {
  const imminent = threat.attacksInTurns <= 1;
  const killFirst = threat.oneShot && threat.kind !== "missile";
  const hp = threat.maxHealth > 0 ? Math.max(0, (threat.health / threat.maxHealth) * 100) : 0;
  const size = (ENEMY_SIZE[threat.kind] ?? 48) * scale;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${threat.name}, hull ${Math.max(0, threat.health)} of ${threat.maxHealth}, attacks in ${threat.attacksInTurns}`}
      title={`${threat.name} · T-${threat.attacksInTurns}`}
      className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none disabled:cursor-default ${
        reducedMotion ? "" : "transition-[left,top] duration-700 ease-out"
      }`}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span
        className={`relative ${reducedMotion ? "" : "animate-float-slow"}`}
        style={{ width: size, animationDelay: `${hash01(`${threat.id}:bob`) * 4}s` }}
      >
        <span
          className={`block rounded-lg transition hover:brightness-125 ${selected ? "ring-2 ring-cyan-300" : ""} ${
            imminent && !reducedMotion ? "animate-pulse" : ""
          }`}
          style={{ filter: imminent ? "drop-shadow(0 0 7px rgba(248,113,113,0.75))" : "drop-shadow(0 0 4px rgba(0,0,0,0.55))" }}
        >
          <EnemyShip kind={threat.kind} className="block w-full" />
        </span>
        <span
          className={`absolute -right-1.5 -top-1.5 rounded-full px-1 text-[9px] font-bold leading-tight ${
            imminent ? "bg-red-500 text-white" : "border border-slate-600 bg-slate-900 text-slate-200"
          }`}
        >
          {threat.attackRevealed ? threat.attack : "?"}
        </span>
        {killFirst ? (
          <span className="absolute -left-1.5 -top-1.5 text-amber-300">
            <Icon name="warning" className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </span>
      <span className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800/90" style={{ width: size }}>
        <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${hp}%` }} />
      </span>
    </button>
  );
}

// Ship anchor in the viewport's 0..100 coordinate space — matches the absolute
// left-[13%] / vertical-centre placement of the ship sprite below, so beams and
// reticle lines terminate on the hull.
const SHIP_ANCHOR = { x: 13, y: 50 };

interface PlacedThreat {
  threat: SpaceshipThreat;
  x: number;
  y: number;
}

// Three approach zones, left (closest to the ship) to right (farthest). Enemies
// enter at T-3 (far) and march inward to T-1 (impact) as their countdown ticks.
// `center` is the X% a threat in that zone sits at; the band spans [start,end].
const APPROACH_ZONES = [
  { distance: 1, label: "T-1 Impact", start: 18, end: 45.3, center: 31.6, tint: "rgba(248,113,113,0.07)" },
  { distance: 2, label: "T-2", start: 45.3, end: 72.6, center: 59.0, tint: "rgba(251,191,36,0.05)" },
  { distance: 3, label: "T-3 Far", start: 72.6, end: 100, center: 86.3, tint: "rgba(56,189,248,0.05)" }
] as const;

// Deterministic battlefield layout shared by the live turn and the reveal so a
// threat occupies the same spot in both. Horizontal position snaps to one of the
// three approach zones by countdown (T-1 near the ship, T-3 far out), with a
// small per-id jitter; vertically they're spread by slot with a stable wobble so
// the swarm doesn't look like a rigid grid.
function placeThreats(threats: SpaceshipThreat[]): PlacedThreat[] {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const count = threats.length;
  // Reserve the top-right HUD zone for the threat indicator so incoming ships
  // never hide behind it.
  const inThreatMeterZone = (x: number, y: number) => x >= 74 && y <= 28;
  return threats.map((threat, index) => {
    const zone = clamp(threat.attacksInTurns, 1, 3);
    const center = 31.6 + (zone - 1) * 27.3;
    const x = clamp(center + (hash01(threat.id) - 0.5) * 16, 20, 98);
    const slot = count > 1 ? index / (count - 1) : 0.5;
    let y = clamp(9 + slot * 80 + (hash01(`${threat.id}:y`) - 0.5) * 16, 6, 94);
    if (inThreatMeterZone(x, y)) {
      // Reposition into the next clear band while keeping deterministic spacing.
      y = clamp(30 + slot * 62 + (hash01(`${threat.id}:meter-avoid`) - 0.5) * 10, 30, 94);
    }
    return { threat, x, y };
  });
}

// A one-shot weapon beam to play across the field. `incoming` flips the palette
// to enemy-red and aims the impact burst at the ship; `key` re-triggers the
// animation each time it changes.
interface ViewportFire {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  incoming?: boolean;
  killed?: boolean;
  key: number;
}

// Debris fragments hurled out by the explosion. Pre-computed directions (and a
// per-piece spin) so the blast looks scattered but renders deterministically.
const EXPLOSION_DEBRIS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + (i % 2 ? 0.3 : 0);
  const dist = 70 + (i % 4) * 28;
  return {
    id: i,
    dx: Math.cos(angle) * dist,
    dy: Math.sin(angle) * dist,
    dr: (i % 2 ? 1 : -1) * (180 + i * 30),
    size: 5 + (i % 3) * 3,
    delay: 0.7 + (i % 3) * 0.04
  };
});

// The end-of-game cinematic, drawn as an overlay that takes over the tactical
// view: the camera pushes in (jump-zoom) and the ship either streaks into a
// blooming wormhole (a win — escape is always a jump) or is torn apart in an
// explosion (a loss). Honours reduced motion with a calm static frame.
function JumpCinematic({ outcome, reducedMotion }: { outcome: "won" | "lost"; reducedMotion: boolean }) {
  const won = outcome === "won";

  if (reducedMotion) {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden rounded-xl bg-slate-950/95" aria-hidden="true">
        {won ? (
          <div className="relative h-32 w-32">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(165,243,252,0.9),rgba(99,102,241,0.45)_55%,transparent_72%)]" />
            <div className="absolute inset-3 rounded-full border-2 border-cyan-300/60" />
          </div>
        ) : (
          <div className="relative h-32 w-32">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(254,215,170,0.95),rgba(248,113,113,0.5)_50%,transparent_72%)]" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-30 overflow-hidden rounded-xl" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.82),rgba(2,6,23,0.97))]" />
      <div className="absolute inset-0 flex items-center justify-center animate-jump-zoom">
        {won ? (
          <div className="relative flex h-56 w-56 items-center justify-center">
            {/* Warp streaks radiating from the portal core. */}
            {Array.from({ length: 16 }, (_, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 h-px w-28 origin-left"
                style={{ transform: `rotate(${i * (360 / 16)}deg)` }}
              >
                <span
                  className="block h-full w-full origin-left bg-gradient-to-r from-cyan-100/90 via-cyan-300/40 to-transparent animate-warp-streak"
                  style={{ animationDelay: `${(i % 5) * 0.12}s` }}
                />
              </span>
            ))}
            {/* The wormhole portal: nested swirling rings + a bright core. */}
            <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 animate-wormhole-form">
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.18),rgba(99,102,241,0.55)_55%,transparent_74%)] animate-wormhole-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-cyan-300/60 animate-wormhole-spin" style={{ animationDirection: "reverse" } as CSSProperties} />
              <div className="absolute inset-6 rounded-full border border-violet-300/50 animate-wormhole-spin" />
              <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_30px_12px_rgba(165,243,252,0.85)]" />
            </div>
            {/* The ship streaking into the portal. */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-ship-warp" style={{ animationDelay: "0.5s" }}>
              <ShipSprite shieldRatio={0.6} hullRatio={1} reducedMotion={false} scale={1.1} />
            </div>
          </div>
        ) : (
          <div className="relative flex h-56 w-56 items-center justify-center">
            {/* Shockwave rings expanding from the blast. */}
            <div className="absolute left-1/2 top-1/2 h-24 w-24 rounded-full border-2 border-orange-300/80 animate-shockwave" style={{ animationDelay: "0.68s" }} />
            <div className="absolute left-1/2 top-1/2 h-24 w-24 rounded-full border border-amber-200/70 animate-shockwave" style={{ animationDelay: "0.86s" }} />
            {/* Core blast flash. */}
            <div
              className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,237,213,0.95),rgba(249,115,22,0.6)_45%,transparent_72%)] animate-burst"
              style={{ animationDelay: "0.68s" }}
            />
            {/* Debris fragments. */}
            {EXPLOSION_DEBRIS.map((piece) => (
              <span
                key={piece.id}
                className="absolute left-1/2 top-1/2 rounded-sm bg-orange-300 animate-debris-fly"
                style={
                  {
                    width: piece.size,
                    height: piece.size,
                    animationDelay: `${piece.delay}s`,
                    "--dx": `${piece.dx}px`,
                    "--dy": `${piece.dy}px`,
                    "--dr": `${piece.dr}deg`
                  } as CSSProperties
                }
              />
            ))}
            {/* The doomed ship, shuddering then bursting apart. */}
            <div className="animate-ship-explode">
              <ShipSprite shieldRatio={0} hullRatio={0.25} reducedMotion={false} scale={1.1} />
            </div>
          </div>
        )}
      </div>
      {/* Climax flash, timed to when the ship vanishes / the blast peaks. */}
      <div
        className={`absolute inset-0 ${won ? "bg-cyan-100" : "bg-orange-200"} animate-cine-flash`}
        style={{ animationDelay: won ? "2.0s" : "0.78s" }}
      />
    </div>
  );
}

function TacticalViewport({
  ship,
  threats,
  threatLevel,
  roundIndex,
  selectedThreatId,
  onSelect,
  disabled,
  reducedMotion,
  compact = false,
  helmLabel,
  fire,
  cinematic
}: {
  ship: SpaceshipShipState;
  threats: SpaceshipThreat[];
  threatLevel: number;
  roundIndex: number;
  selectedThreatId: string | undefined;
  onSelect: (threatId: string) => void;
  disabled: boolean;
  reducedMotion: boolean;
  compact?: boolean;
  helmLabel?: string;
  fire?: ViewportFire | null;
  /** When set, plays the end-of-game jump cinematic over the battlefield. */
  cinematic?: "won" | "lost";
}) {
  const scale = compact ? 0.7 : 1;
  const placed = placeThreats(threats);
  const selected = placed.find((entry) => entry.threat.id === selectedThreatId);

  const beamColor = fire ? (fire.incoming ? "rgba(248,113,113,0.95)" : fire.killed ? "rgba(251,146,60,0.95)" : "rgba(34,211,238,0.95)") : "";
  const burstBg = fire
    ? fire.incoming
      ? "radial-gradient(circle, rgba(254,202,202,0.95), rgba(248,113,113,0.5) 45%, transparent 70%)"
      : fire.killed
        ? "radial-gradient(circle, rgba(254,215,170,0.95), rgba(251,146,60,0.6) 45%, transparent 70%)"
        : "radial-gradient(circle, rgba(165,243,252,0.9), rgba(34,211,238,0.5) 45%, transparent 70%)"
    : "";
  const burstSize = (fire?.killed ? 46 : 28) * scale;

  return (
    <div className="relative h-72 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950/60 sm:h-80 lg:h-96">
      <Starfield />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {ASTEROIDS.map((rock) => (
          <span
            key={rock.id}
            className={`absolute ${reducedMotion ? "" : "animate-float-slow"}`}
            style={{ left: `${rock.left}%`, top: `${rock.top}%`, animationDelay: `${rock.delay}s`, animationDuration: `${rock.duration}s` }}
          >
            <AsteroidShape
              className={reducedMotion ? "" : "animate-asteroid-spin"}
              style={{
                width: rock.size,
                height: rock.size,
                color: rock.shade > 0.5 ? "rgba(100,116,139,0.35)" : "rgba(71,85,105,0.42)",
                animationDuration: `${rock.spin}s`
              }}
            />
          </span>
        ))}
      </div>

      {/* Three approach zones: enemies enter far and march toward impact. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {APPROACH_ZONES.map((zone) => (
          <div
            key={zone.label}
            className="absolute inset-y-0 border-l border-slate-500/20"
            style={{ left: `${zone.start}%`, width: `${zone.end - zone.start}%`, background: zone.tint }}
          />
        ))}
      </div>

      {selected ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1={SHIP_ANCHOR.x} y1={SHIP_ANCHOR.y} x2={selected.x} y2={selected.y} stroke="rgba(34,211,238,0.5)" strokeWidth="0.4" strokeDasharray="2 2" />
        </svg>
      ) : null}

      {fire ? (
        <svg
          key={`beam-${fire.key}`}
          className="animate-beam-flash pointer-events-none absolute inset-0 z-10 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line x1={fire.fromX} y1={fire.fromY} x2={fire.toX} y2={fire.toY} stroke={beamColor} strokeWidth="0.9" strokeLinecap="round" />
        </svg>
      ) : null}
      {fire ? (
        <span
          key={`burst-${fire.key}`}
          className="animate-burst pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${fire.toX}%`, top: `${fire.toY}%`, width: burstSize, height: burstSize, background: burstBg }}
          aria-hidden="true"
        />
      ) : null}

      <div className="absolute left-[13%] top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <ShipSprite
          shieldRatio={ship.shieldCap > 0 ? ship.shields / ship.shieldCap : 0}
          hullRatio={ship.maxHull > 0 ? ship.hull / ship.maxHull : 0}
          reducedMotion={reducedMotion}
          scale={scale}
        />
        {helmLabel ? (
          <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950/75 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-cyan-200">
            {helmLabel}
          </span>
        ) : null}
      </div>

      {placed.length ? (
        placed.map((entry) => (
          <ThreatBlip
            key={entry.threat.id}
            threat={entry.threat}
            x={entry.x}
            y={entry.y}
            selected={selectedThreatId === entry.threat.id}
            disabled={disabled}
            onSelect={() => onSelect(entry.threat.id)}
            reducedMotion={reducedMotion}
            scale={scale}
          />
        ))
      ) : (
        <span className="absolute right-[24%] top-1/2 z-10 -translate-y-1/2 rounded bg-slate-950/70 px-2 py-1 text-xs text-slate-300">
          Sector clear
        </span>
      )}

      <span className="absolute left-2 top-2 z-20 rounded bg-slate-950/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-cyan-300">
        Tactical view
      </span>

      <ThreatLevelMeter level={threatLevel} roundIndex={roundIndex} reducedMotion={reducedMotion} />

      {cinematic ? <JumpCinematic outcome={cinematic} reducedMotion={reducedMotion} /> : null}
    </div>
  );
}

function CrewRoster({
  room,
  activePlayerId,
  actedPlayerIds,
  viewerPlayerId
}: {
  room: Room;
  activePlayerId: string | undefined;
  actedPlayerIds: string[];
  viewerPlayerId: string;
}) {
  const acted = new Set(actedPlayerIds);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-[0.2em] text-cyan-300">Crew</span>
      {orderedPlayers(room).map((player) => {
        const isActive = player.id === activePlayerId;
        const hasActed = acted.has(player.id);
        const isViewer = player.id === viewerPlayerId;
        const stateClass = isActive
          ? "border-cyan-300 bg-cyan-500/20 text-cyan-50"
          : hasActed
            ? "border-slate-700 bg-slate-900/60 text-slate-500 line-through"
            : "border-slate-600 bg-slate-900/60 text-slate-200";
        return (
          <span
            key={player.id}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${stateClass}`}
            title={isActive ? "Acting now" : hasActed ? "Already acted this round" : "Waiting to act"}
          >
            {isActive ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> : null}
            {player.name}
            {isViewer ? <span className="text-[10px] text-cyan-300">(you)</span> : null}
            {player.isBot ? <span className="text-[10px] text-slate-400">bot</span> : null}
          </span>
        );
      })}
    </div>
  );
}

// Classify a log message so enemy fire, the viewer's own actions, and wins are
// visually distinct from neutral chatter.
function logToneFor(message: string, viewerName: string): string {
  if (message.includes("attacks for") || message.includes("hull failed") || message.includes("hull. The ship is lost")) {
    return "border-l-2 border-red-500/70 bg-red-950/30 text-red-100";
  }
  if (message.includes("escapes") || message.includes("escaped")) {
    return "border-l-2 border-emerald-500/70 bg-emerald-950/30 text-emerald-100";
  }
  if (message.includes("timed out")) {
    return "bg-slate-950/70 text-slate-500 italic";
  }
  if (viewerName !== "TBD" && message.startsWith(viewerName)) {
    return "border-l-2 border-cyan-400/70 bg-cyan-950/30 text-cyan-100";
  }
  return "bg-slate-950/70 text-slate-300";
}

export function SpaceshipDefenseGame({ room, viewerPlayerId, isHost, onSubmitAction, onRestart }: SpaceshipDefenseGameProps) {
  const game = room.game;
  const spaceship = game.spaceship;
  const isFinished = game.state === "finished";
  const [selectedThreatId, setSelectedThreatId] = useSelectedThreat(spaceship?.threats);
  const [confirmingEmergencyJump, setConfirmingEmergencyJump] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Transient ship→target beam shown the instant the player fires, before the
  // server resolves the shot. Cleared after the beam animation finishes.
  const [firing, setFiring] = useState<{ id: string; key: number } | null>(null);
  // Gates the Mission Complete panel behind the jump cinematic: once the game
  // finishes we let the wormhole/explosion play out on the tactical view first,
  // then reveal the result.
  const [cinematicDone, setCinematicDone] = useState(false);
  const rawSeconds = useCountdown(game.roundDeadlineAt);
  const reducedMotion = usePrefersReducedMotion();
  const isCompact = useIsCompact();
  const dialogRef = useRef<HTMLDivElement>(null);

  const outcome = spaceship?.outcome;
  useEffect(() => {
    if (!isFinished) {
      setCinematicDone(false);
      return undefined;
    }
    // Reduced motion skips straight to the result; otherwise hold for the
    // cinematic (the win warp runs a touch longer than the loss blast).
    if (reducedMotion) {
      setCinematicDone(true);
      return undefined;
    }
    const holdMs = outcome === "won" ? 2800 : 2400;
    const timer = window.setTimeout(() => setCinematicDone(true), holdMs);
    return () => window.clearTimeout(timer);
  }, [isFinished, outcome, reducedMotion]);

  // Dismiss the emergency-jump confirmation whenever it stops being the viewer's
  // turn (e.g. the timer runs out or another player acts).
  useEffect(() => {
    const active = game.state === "player_turn" && spaceship?.activePlayerId === viewerPlayerId;
    if (!active) setConfirmingEmergencyJump(false);
  }, [game.state, spaceship?.activePlayerId, viewerPlayerId]);

  // Close the emergency-jump dialog on Escape and trap initial focus inside it.
  useEffect(() => {
    if (!confirmingEmergencyJump) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmingEmergencyJump(false);
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmingEmergencyJump]);

  if (!spaceship) {
    return (
      <div className="rounded-xl border border-slate-700 bg-bg-panel p-4 lg:col-span-2">
        <h2 className="text-lg font-semibold">Starshield Crisis</h2>
        <p className="mt-1 text-sm text-slate-300">Preparing ship state...</p>
      </div>
    );
  }

  if (game.state === "enemy_phase") {
    return <EnemyRevealPhase room={room} />;
  }

  const ship = spaceship.ship;
  const activePlayerName = playerName(room, spaceship.activePlayerId);
  const viewerName = playerName(room, viewerPlayerId);
  const viewerIsActive = spaceship.activePlayerId === viewerPlayerId && game.state === "player_turn";
  const seconds = game.roundDeadlineAt && !isFinished ? rawSeconds : null;
  const selectedThreat = spaceship.threats.find((threat) => threat.id === selectedThreatId);
  // Optimistic muzzle flash: aim a beam from the ship at the threat we just fired
  // on, as long as it's still on the board this render.
  const firingTarget = firing ? placeThreats(spaceship.threats).find((entry) => entry.threat.id === firing.id) : undefined;
  const liveFire: ViewportFire | null =
    firing && firingTarget
      ? { fromX: SHIP_ANCHOR.x, fromY: SHIP_ANCHOR.y, toX: firingTarget.x, toY: firingTarget.y, key: firing.key }
      : null;
  const helmLabel = viewerIsActive ? "You at the helm" : `${activePlayerName} at the helm`;
  const canJump = ship.jumpCharge >= ship.jumpTarget;
  // The risky alternative when the drive isn't fully charged: gamble on how far
  // the jump drive has already charged. The jump itself is free.
  const emergencyChance = emergencyJumpChanceFromCharge(ship.jumpCharge, ship.jumpTarget);
  const canEmergencyJump = viewerIsActive && !isFinished && !canJump;
  const chanceTone = emergencyChance >= 70 ? "text-emerald-300" : emergencyChance >= 40 ? "text-amber-300" : "text-red-300";

  // Forecast the next enemy phase: threats at T-1 fire when countdowns tick.
  const incomingThreats = spaceship.threats.filter((threat) => threat.attacksInTurns <= 1);
  let knownIncoming = 0;
  let hiddenIncoming = 0;
  incomingThreats.forEach((threat) => {
    if (threat.attackRevealed) knownIncoming += threat.attack;
    else hiddenIncoming += 1;
  });
  const incomingAbsorbed = Math.min(ship.shields, knownIncoming);
  const incomingToHull = Math.max(0, knownIncoming - incomingAbsorbed);

  // Red-alert condition: the hull is about to take damage, integrity is critical,
  // or a "kill first" one-shot threat (a destroyer-class burst, not a missile) is
  // on the board. Drives the pulsing banner + danger vignette.
  const hullRatio = ship.maxHull > 0 ? ship.hull / ship.maxHull : 1;
  const hasKillFirst = spaceship.threats.some((threat) => threat.oneShot && threat.kind !== "missile");
  const redAlert = !isFinished && (incomingToHull > 0 || hullRatio <= 0.3 || hasKillFirst);
  const alertReason =
    incomingToHull > 0
      ? `${incomingToHull} damage inbound to the hull`
      : hullRatio <= 0.3
        ? "Hull integrity critical"
        : "High-priority threat on the field";

  // Group the log into rounds (newest first) and only surface the last two.
  const recentRounds = [...new Set(spaceship.log.map((entry) => entry.roundIndex))]
    .sort((a, b) => b - a)
    .slice(0, 2);
  const logByRound = recentRounds.map((roundIndex) => ({
    roundIndex,
    entries: spaceship.log.filter((entry) => entry.roundIndex === roundIndex)
  }));

  async function submit(action: SpaceshipActionType, targetThreatId?: string) {
    if (!viewerIsActive || submitting) return;
    if (action === "shoot" && targetThreatId) {
      setFiring({ id: targetThreatId, key: Date.now() });
      window.setTimeout(() => setFiring(null), 650);
    }
    setSubmitting(true);
    try {
      await onSubmitAction(action, targetThreatId);
    } finally {
      setSubmitting(false);
    }
  }

  // Per-action disabled state with a human-readable reason for tooltips.
  function actionState(action: SpaceshipActionType): { disabled: boolean; reason?: string } {
    if (!viewerIsActive) return { disabled: true, reason: "Wait for your turn" };
    if (submitting) return { disabled: true, reason: "Submitting your action…" };
    const cost = ACTION_ENERGY_COST[action] ?? 0;
    if (cost > ship.energy) {
      return { disabled: true, reason: `Not enough energy (needs ${cost}, have ${ship.energy})` };
    }
    switch (action) {
      case "shoot":
        return selectedThreat ? { disabled: false } : { disabled: true, reason: "Select a threat to target" };
      case "shield":
        return ship.shields >= ship.shieldCap ? { disabled: true, reason: "Shields already at max" } : { disabled: false };
      case "charge_jump":
        return canJump ? { disabled: true, reason: "Jump drive already fully charged" } : { disabled: false };
      case "jump_away":
        return canJump ? { disabled: false } : { disabled: true, reason: `Charge the jump drive to ${ship.jumpTarget} first` };
      default:
        return { disabled: false };
    }
  }

  const shootState = actionState("shoot");
  const shieldState = actionState("shield");
  const chargeState = actionState("charge_jump");
  const jumpState = actionState("jump_away");
  const passState = actionState("pass");

  const timerSeconds = seconds ?? 0;
  const timerPercent = Math.max(0, Math.min(100, (timerSeconds / TURN_SECONDS) * 100));
  const timerTone = timerSeconds <= 5 ? "bg-red-500" : timerSeconds <= 15 ? "bg-amber-400" : "bg-cyan-400";

  return (
    <GameShell active={viewerIsActive} className="relative overflow-hidden">
      <Starfield />
      {redAlert ? (
        <div
          className={`pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_50%,transparent_42%,rgba(239,68,68,0.4))] ${
            reducedMotion ? "opacity-40" : "animate-red-alert"
          }`}
          aria-hidden="true"
        />
      ) : null}
      <div className="relative z-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.25)]">
            <Icon name="hull" className="animate-float-slow h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-wide text-cyan-100">Starshield Crisis</h2>
            <p className="mt-0.5 text-sm text-slate-300">Charge the jump drive before enemy fire breaks the hull.</p>
          </div>
        </div>
        <span className="rounded-full border border-cyan-700/50 bg-cyan-500/10 px-3 py-1 font-mono text-xs tracking-wider text-cyan-100">
          ROUND {game.roundIndex + 1}
        </span>
      </div>

      {redAlert ? (
        <div
          className={`mt-4 flex items-center gap-2 rounded-lg border border-red-500/60 bg-red-950/40 px-4 py-2 text-sm text-red-100 ${
            reducedMotion ? "" : "animate-pulse"
          }`}
          role="alert"
        >
          <Icon name="warning" className="h-4 w-4 shrink-0" />
          <span className="font-bold tracking-[0.25em]">RED ALERT</span>
          <span className="text-red-200/90">— {alertReason}</span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ShipStat
          label="Hull"
          value={ship.hull}
          max={ship.maxHull}
          tone={hullTone(ship.maxHull > 0 ? ship.hull / ship.maxHull : 0)}
          icon="hull"
          iconClass="text-emerald-300"
          note={ship.shields > 0 ? `+${ship.shields} shield buffer (${ship.hull + ship.shields} effective)` : undefined}
        />
        <ShipStat label="Shields" value={ship.shields} max={ship.shieldCap} tone="bg-cyan-400" icon="shields" iconClass="text-cyan-300" />
        <ShipStat label="Jump" value={ship.jumpCharge} max={ship.jumpTarget} tone="bg-accent-success" icon="jump" iconClass="text-emerald-300" />
        <ShipStat
          label="Energy"
          value={ship.energy}
          max={ship.energyCap}
          tone="bg-amber-300"
          icon="energy"
          iconClass="text-amber-300"
          note={`+${ENERGY_PER_TURN} each turn`}
        />
      </div>

      {!isFinished ? (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            incomingToHull > 0
              ? "border-red-500/50 bg-red-950/30 text-red-100"
              : knownIncoming > 0 || hiddenIncoming > 0
                ? "border-amber-500/40 bg-amber-950/20 text-amber-100"
                : "border-emerald-600/40 bg-emerald-950/20 text-emerald-100"
          }`}
        >
          {incomingThreats.length === 0 ? (
            <span>No incoming fire next phase — a good window to charge the jump drive.</span>
          ) : (
            <span>
              <span className="font-semibold">Next enemy phase:</span> {knownIncoming} incoming
              {hiddenIncoming > 0 ? <span className="text-amber-200"> (+{hiddenIncoming} hidden)</span> : null} —{" "}
              {incomingAbsorbed} absorbed by shields, <span className="font-semibold">{incomingToHull} to hull</span>.
            </span>
          )}
        </div>
      ) : null}

      {isFinished && cinematicDone ? null : (
        <div className="mt-4">
          <TacticalViewport
            ship={ship}
            threats={spaceship.threats}
            threatLevel={spaceship.threatLevel}
            roundIndex={game.roundIndex}
            selectedThreatId={selectedThreatId}
            onSelect={setSelectedThreatId}
            disabled={isFinished}
            reducedMotion={reducedMotion}
            compact={isCompact}
            helmLabel={helmLabel}
            fire={liveFire}
            cinematic={isFinished && !cinematicDone ? spaceship.outcome : undefined}
          />
        </div>
      )}

      {isFinished ? (
        cinematicDone ? (
        <div
          className={`animate-fade-up mt-4 rounded-xl border bg-slate-900/80 p-5 text-center ${
            spaceship.outcome === "won" ? "border-emerald-500/40 shadow-[0_0_50px_rgba(52,211,153,0.18)]" : "border-red-500/40 shadow-[0_0_50px_rgba(244,63,94,0.18)]"
          }`}
        >
          <span
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border ${
              spaceship.outcome === "won"
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                : "border-red-400/40 bg-red-500/10 text-red-200"
            }`}
          >
            <Icon name={spaceship.outcome === "won" ? "jump" : "warning"} className="h-7 w-7" />
          </span>
          <p className={`mt-3 text-xs uppercase tracking-[0.3em] ${spaceship.outcome === "won" ? "text-emerald-300" : "text-red-300"}`}>
            Mission complete
          </p>
          <h3 className={`mt-1 text-2xl font-bold ${spaceship.outcome === "won" ? "text-emerald-100" : "text-red-100"}`}>
            {spaceship.outcome === "won" ? "The crew escaped." : "The ship was destroyed."}
          </h3>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
              <p className="text-xs uppercase tracking-wider text-slate-400">Rounds survived</p>
              <p className="mt-1 text-xl font-bold text-cyan-100">{game.roundIndex + 1}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
              <p className="text-xs uppercase tracking-wider text-slate-400">Hull remaining</p>
              <p className="mt-1 text-xl font-bold text-cyan-100">
                {ship.hull} / {ship.maxHull}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
              <p className="text-xs uppercase tracking-wider text-slate-400">Threats left</p>
              <p className="mt-1 text-xl font-bold text-cyan-100">{spaceship.threats.length}</p>
            </div>
          </div>
          <div className="mt-4">
            <HostRestartFooter isHost={isHost} onRestart={onRestart} label="Restart game" />
          </div>
        </div>
        ) : (
          <div
            className={`mt-4 rounded-xl border p-4 text-center ${
              spaceship.outcome === "won" ? "border-cyan-500/40 bg-cyan-950/30" : "border-orange-500/40 bg-orange-950/20"
            }`}
            role="status"
          >
            <p className={`text-xs uppercase tracking-[0.3em] ${spaceship.outcome === "won" ? "text-cyan-300" : "text-orange-300"}`}>
              {spaceship.outcome === "won" ? "Engaging jump drive" : "Drive overload"}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-100">
              {spaceship.outcome === "won" ? "Punching through to safety…" : "The ship is coming apart…"}
            </h3>
          </div>
        )
      ) : (
        <div
          className={`mt-4 rounded-xl border p-4 ${
            viewerIsActive ? "border-cyan-300/70 bg-cyan-950/30" : "border-cyan-800/40 bg-slate-900/70"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                {viewerIsActive ? "Your move" : "Active player"}
              </p>
              <h3 className="text-xl font-semibold text-cyan-100">
                {viewerIsActive ? "Your turn — pick an action" : `${activePlayerName}'s turn`}
              </h3>
            </div>
            <div className="min-w-[120px]">
              <div className="flex items-center justify-end gap-2 text-sm text-slate-200" aria-live="polite">
                <span className={`font-mono font-semibold ${timerSeconds <= 5 ? "text-red-300" : "text-slate-200"}`}>
                  {seconds ?? "-"}s
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ease-linear ${timerTone}`}
                  style={{ width: `${timerPercent}%` }}
                />
              </div>
            </div>
          </div>

          <CrewRoster
            room={room}
            activePlayerId={spaceship.activePlayerId}
            actedPlayerIds={spaceship.playersActedThisRound}
            viewerPlayerId={viewerPlayerId}
          />

          <div className="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <button
              type="button"
              title={shootState.reason}
              className={ACTION_BUTTON} style={{ background: ACTION_BUTTON_BG }}
              disabled={shootState.disabled}
              onClick={() => submit("shoot", selectedThreatId)}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Icon name="target" className="h-4 w-4" />
                Shoot {selectedThreat ? selectedThreat.name : "Threat"}
              </span>
              <span className="mt-0.5 block text-[11px] font-normal opacity-80">3 dmg · {ACTION_ENERGY_COST.shoot}<EnergyMark /></span>
            </button>
            <button
              type="button"
              title={shieldState.reason}
              className={ACTION_BUTTON} style={{ background: ACTION_BUTTON_BG }}
              disabled={shieldState.disabled}
              onClick={() => submit("shield")}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Icon name="shields" className="h-4 w-4" />
                Full Shields
              </span>
              <span className="mt-0.5 block text-[11px] font-normal opacity-80">to {ship.shieldCap} · {ACTION_ENERGY_COST.shield}<EnergyMark /></span>
            </button>
            <button
              type="button"
              title={chargeState.reason}
              className={ACTION_BUTTON} style={{ background: ACTION_BUTTON_BG }}
              disabled={chargeState.disabled}
              onClick={() => submit("charge_jump")}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Icon name="charge" className="h-4 w-4" />
                Charge Jump
              </span>
              <span className="mt-0.5 block text-[11px] font-normal opacity-80">{ACTION_ENERGY_COST.charge_jump}<EnergyMark /></span>
            </button>
            {canJump ? (
              <button
                type="button"
                title={jumpState.reason}
                className={`${ACTION_BUTTON} animate-pulse`} style={{ background: "linear-gradient(160deg,#34d399,#10b981)" }}
                disabled={jumpState.disabled}
                onClick={() => submit("jump_away")}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Icon name="jump" className="h-4 w-4" />
                  Jump Away
                </span>
                <span className="mt-0.5 block text-[11px] font-normal opacity-80">guaranteed</span>
              </button>
            ) : (
              <button
                type="button"
                title={
                  !viewerIsActive
                    ? "Wait for your turn"
                    : `Risky escape: ${emergencyChance}% chance — failure destroys the ship`
                }
                className={ACTION_BUTTON} style={{ background: "linear-gradient(160deg,#fb923c,#f97316)" }}
                disabled={!canEmergencyJump}
                onClick={() => setConfirmingEmergencyJump(true)}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Icon name="warning" className="h-4 w-4" />
                  Emergency Jump
                </span>
                <span className="mt-0.5 block text-[11px] font-normal opacity-80">{emergencyChance}% odds</span>
              </button>
            )}
            <button
              type="button"
              title={passState.reason ?? "Skip your action and bank the energy you generated"}
              className={ACTION_BUTTON} style={{ background: ACTION_BUTTON_BG }}
              disabled={passState.disabled}
              onClick={() => submit("pass")}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Icon name="pass" className="h-4 w-4" />
                Charge Energy
              </span>
              <span className="mt-0.5 block text-[11px] font-normal opacity-80">bank +{ENERGY_PER_TURN}<EnergyMark /></span>
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-4">
        <SelectedThreatDetail threat={selectedThreat} />

        <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <h3 className="font-semibold text-cyan-100">Event Log</h3>
          <div className="mt-3 space-y-4 text-sm">
            {logByRound.length ? (
              logByRound.map(({ roundIndex, entries }) => (
                <div key={roundIndex} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Round {roundIndex + 1}</span>
                    <span className="h-px flex-1 bg-slate-700" />
                  </div>
                  {entries.map((entry) => (
                    <p key={entry.id} className={`rounded px-3 py-2 ${logToneFor(entry.message, viewerName)}`}>
                      {entry.message}
                    </p>
                  ))}
                </div>
              ))
            ) : (
              <p className="text-slate-400">No events yet.</p>
            )}
          </div>
        </section>
      </div>

      {confirmingEmergencyJump && canEmergencyJump ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm emergency jump"
          onClick={() => setConfirmingEmergencyJump(false)}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-sm rounded-2xl border border-orange-500/60 bg-slate-900 p-5 shadow-[0_0_60px_rgba(251,146,60,0.25)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs uppercase tracking-[0.25em] text-orange-300">Risky maneuver</p>
            <h3 className="mt-1 text-xl font-bold text-orange-100">Force an emergency jump?</h3>
            <p className="mt-3 text-sm text-slate-300">
              The drive isn&apos;t fully charged. Overload it with raw power for a{" "}
              <span className={`font-bold ${chanceTone}`}>{emergencyChance}% chance</span> to escape right now.
            </p>
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-500/50 bg-red-950/30 px-3 py-2 text-xs text-red-100">
              <Icon name="warning" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>On failure the drive overloads and the ship is destroyed — game over for the whole crew.</span>
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmingEmergencyJump(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => {
                  setConfirmingEmergencyJump(false);
                  void submit("emergency_jump");
                }}
              >
                Attempt jump ({emergencyChance}%)
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </GameShell>
  );
}

// A detailed breakdown of the current enemy hit: how much the shields soaked and
// how much reached the hull, with before -> after values for each.
function HitBreakdown({ hit }: { hit: SpaceshipHitDetail }) {
  const tag = THREAT_TAGS[hit.threatKind] ?? "???";
  return (
    <div className="animate-pop-in rounded-xl border border-red-700/40 bg-slate-900/70 px-4 py-3" aria-live="polite">
      <div className="flex items-center justify-center gap-2">
        <span className="flex items-center gap-1 rounded bg-slate-950/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-300">
          <Icon name={hit.threatKind} className="h-3 w-3" />
          {tag}
        </span>
        <span className="text-sm font-semibold text-red-100">
          {hit.threatName} {hit.revealed ? `fires for ${hit.attack}` : "strikes from the shadows"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-950/50 px-2 py-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Incoming</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-red-200">{hit.revealed ? hit.attack : "?"}</p>
        </div>
        <div className="rounded-lg bg-slate-950/50 px-2 py-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Shields</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-cyan-200">
            {hit.shieldsBefore} <span className="text-slate-500">→</span> {hit.shieldsAfter}
          </p>
          <p className="text-[10px] text-cyan-300/80">{hit.absorbed > 0 ? `−${hit.absorbed} absorbed` : "no buffer"}</p>
        </div>
        <div className="relative rounded-lg bg-slate-950/50 px-2 py-2">
          {hit.toHull > 0 ? (
            <span className="animate-damage-float pointer-events-none absolute left-1/2 top-0 text-lg font-extrabold text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.65)]">
              −{hit.toHull}
            </span>
          ) : null}
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Hull</p>
          <p className={`mt-0.5 text-sm font-semibold tabular-nums ${hit.toHull > 0 ? "text-red-300" : "text-emerald-300"}`}>
            {hit.hullBefore} <span className="text-slate-500">→</span> {hit.hullAfter}
          </p>
          <p className={`text-[10px] ${hit.toHull > 0 ? "text-red-300/80" : "text-emerald-300/80"}`}>
            {hit.toHull > 0 ? `−${hit.toHull} hull` : "fully blocked"}
          </p>
        </div>
      </div>
    </div>
  );
}

// One line in the accumulating enemy-phase play-by-play.
function HitLogLine({ hit, highlight }: { hit: SpaceshipHitDetail; highlight: boolean }) {
  const tag = THREAT_TAGS[hit.threatKind] ?? "???";
  return (
    <div className={`flex items-center justify-between gap-2 rounded px-3 py-1.5 text-xs ${highlight ? "animate-pop-in bg-red-950/40 text-red-100" : "bg-slate-950/60 text-slate-300"}`}>
      <span className="flex items-center gap-2">
        <span className="flex items-center gap-1 rounded bg-slate-950/70 px-1 py-0.5 text-[9px] font-bold tracking-wider text-slate-400">
          <Icon name={hit.threatKind} className="h-2.5 w-2.5" />
          {tag}
        </span>
        {hit.threatName}
        <span className="text-slate-500">·</span>
        <span className="text-slate-400">{hit.revealed ? `${hit.attack} dmg` : "ambush"}</span>
      </span>
      <span className="flex items-center gap-3 font-mono tabular-nums">
        {hit.absorbed > 0 ? <span className="text-cyan-300">shield −{hit.absorbed}</span> : null}
        <span className={hit.toHull > 0 ? "text-red-300" : "text-emerald-300"}>
          {hit.toHull > 0 ? `hull −${hit.toHull}` : "blocked"}
        </span>
      </span>
    </div>
  );
}

// Short, human-readable summary of what a crew member's choice did this round,
// used to recap the crew phase before the enemy fire plays out.
function crewActionSummary(crew: SpaceshipCrewAction): { label: string; effect: string; tone: string } {
  switch (crew.action) {
    case "shoot": {
      const target = crew.targetThreatName ?? "a threat";
      if (crew.killedTarget) return { label: `destroyed ${target}`, effect: `${crew.damageDealt} dmg`, tone: "text-emerald-300" };
      if ((crew.damageDealt ?? 0) > 0) return { label: `shot ${target}`, effect: `${crew.damageDealt} dmg`, tone: "text-amber-200" };
      return { label: `fired at ${target}`, effect: "missed", tone: "text-slate-400" };
    }
    case "shield":
      return {
        label: "charged shields to full",
        effect: (crew.shieldsGained ?? 0) > 0 ? `+${crew.shieldsGained} shields` : "already max",
        tone: "text-cyan-300"
      };
    case "charge_jump":
      return {
        label: "charged jump drive",
        effect: (crew.jumpGained ?? 0) > 0 ? `+${crew.jumpGained} jump` : "already full",
        tone: "text-violet-200"
      };
    case "emergency_jump":
      return { label: "emergency jump failed", effect: "reserve spent", tone: "text-red-300" };
    case "pass":
      return {
        label: crew.timedOut ? "timed out" : "charged energy",
        effect: `+${ENERGY_PER_TURN} energy banked`,
        tone: "text-slate-400"
      };
    default:
      return { label: crew.action, effect: "", tone: "text-slate-300" };
  }
}

// Weapon-fire overlay for a "shoot" crew frame: a tracer beam streaks across the
// card toward an impact burst on the right. A kill lands a bigger orange blast;
// a hit a smaller amber one; a miss fizzles with no impact. The parent remounts
// this frame per reveal step, so the one-shot animations replay automatically.
function ShotFx({ crew }: { crew: SpaceshipCrewAction }) {
  const killed = Boolean(crew.killedTarget);
  const hit = killed || (crew.damageDealt ?? 0) > 0;
  const beamColor = killed ? "rgba(251,146,60,0.9)" : hit ? "rgba(250,204,21,0.85)" : "rgba(148,163,184,0.6)";
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Centering lives on the wrappers; the animated transforms (scaleX / scale)
          live on the inner elements so they don't clobber the vertical centering. */}
      <div className="absolute left-0 top-1/2 h-[3px] w-full -translate-y-1/2">
        <div
          className="animate-tracer h-full w-full origin-left"
          style={{ background: `linear-gradient(90deg, transparent, ${beamColor})` }}
        />
      </div>
      {hit ? (
        <div className="absolute top-1/2 -translate-y-1/2" style={{ right: "0.5rem" }}>
          <div
            className="animate-burst rounded-full"
            style={{
              width: killed ? "44px" : "26px",
              height: killed ? "44px" : "26px",
              background: killed
                ? "radial-gradient(circle, rgba(254,215,170,0.95), rgba(251,146,60,0.6) 45%, transparent 70%)"
                : "radial-gradient(circle, rgba(254,240,138,0.9), rgba(250,204,21,0.5) 45%, transparent 70%)",
              animationDelay: "0.25s"
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

// The focal frame while a crew action plays in the reveal — mirrors HitBreakdown
// for enemy fire.
function CrewActionBreakdown({ crew }: { crew: SpaceshipCrewAction }) {
  const { label, effect, tone } = crewActionSummary(crew);
  const tag = crew.targetThreatKind ? THREAT_TAGS[crew.targetThreatKind] : undefined;
  return (
    <div className="animate-pop-in relative overflow-hidden rounded-xl border border-cyan-700/40 bg-slate-900/70 px-4 py-3" aria-live="polite">
      {crew.action === "shoot" ? <ShotFx crew={crew} /> : null}
      <div className="relative z-10">
        <div className="flex items-center justify-center gap-2 text-sm">
          {tag ? <span className="rounded bg-slate-950/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-300">{tag}</span> : null}
          <span className="font-semibold text-cyan-100">{crew.playerName}</span>
          <span className={`font-semibold ${tone}`}>{label}</span>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-mono tabular-nums">
          {effect ? <span className={`rounded bg-slate-950/50 px-2.5 py-1 ${tone}`}>{effect}</span> : null}
          {crew.energySpent > 0 ? <span className="rounded bg-slate-950/50 px-2.5 py-1 text-amber-300/90">−{crew.energySpent}<EnergyMark /></span> : null}
        </div>
      </div>
    </div>
  );
}

function CrewActionLine({ crew, highlight }: { crew: SpaceshipCrewAction; highlight: boolean }) {
  const { label, effect, tone } = crewActionSummary(crew);
  return (
    <div className={`flex items-center justify-between gap-2 rounded px-3 py-1.5 text-xs ${highlight ? "animate-pop-in bg-cyan-950/40" : "bg-slate-950/60"}`}>
      <span className="flex items-center gap-2 text-slate-200">
        <span className="font-semibold text-cyan-100">{crew.playerName}</span>
        <span className="text-slate-500">·</span>
        <span className={tone}>{label}</span>
      </span>
      <span className="flex items-center gap-3 font-mono tabular-nums">
        {effect ? <span className={tone}>{effect}</span> : null}
        {crew.energySpent > 0 ? <span className="text-amber-300/90">−{crew.energySpent}<EnergyMark /></span> : null}
      </span>
    </div>
  );
}

// Plays the whole round out one beat at a time: each crew action first, then the
// enemy fire (hull/shield drain hit-by-hit), all driven by the shared server
// reveal steps, before the next crew round opens.
function EnemyRevealPhase({ room }: { room: Room }) {
  const game = room.game;
  const spaceship = game.spaceship!;
  const steps = useMemo(() => spaceship.revealSteps ?? [], [spaceship.revealSteps]);
  const totalSteps = steps.length;

  const reducedMotion = usePrefersReducedMotion();
  const clampedIndex = useStepPlayback(game.roundIndex, totalSteps, game.roundDeadlineAt);
  const currentStep = totalSteps > 0 ? steps[clampedIndex] : undefined;

  // Drive the panel off the current frame's snapshot, falling back to the final
  // post-phase state for a phase that recorded nothing.
  const ship = currentStep?.ship ?? spaceship.ship;
  const threats = currentStep?.threats ?? spaceship.threats;
  const secs = useCountdown(game.roundDeadlineAt);

  const currentCrew = currentStep?.crew;
  const currentHit = currentStep?.hit;
  const inCrewPhase = Boolean(currentCrew);

  // Totals depend only on the full step list; recompute only when it changes.
  const { crewTotal, hitTotal } = useMemo(
    () => ({
      crewTotal: steps.filter((step) => step.crew).length,
      hitTotal: steps.filter((step) => step.hit).length
    }),
    [steps]
  );
  // Revealed slices advance with the playback index.
  const { revealedCrew, revealedHits } = useMemo(() => {
    const shown = steps.slice(0, clampedIndex + 1);
    return {
      revealedCrew: shown.filter((step) => step.crew).map((step) => step.crew!),
      revealedHits: shown.filter((step) => step.hit).map((step) => step.hit!)
    };
  }, [steps, clampedIndex]);
  const isFinalFrame = totalSteps === 0 || clampedIndex >= totalSteps - 1;
  const message = currentStep?.message ?? "";

  const isCompact = useIsCompact();

  // Replay the shot/incoming fire on the battlefield: locate the relevant ship by
  // id in this frame (or the frame before it, for a target that was just
  // destroyed/spent and is gone from the current snapshot) and aim a beam.
  const revealFire: ViewportFire | null = useMemo(() => {
    const locate = (id: string) => {
      const inFrame = placeThreats(threats).find((entry) => entry.threat.id === id);
      if (inFrame) return inFrame;
      const prev = clampedIndex > 0 ? steps[clampedIndex - 1]?.threats : undefined;
      return prev ? placeThreats(prev).find((entry) => entry.threat.id === id) : undefined;
    };
    if (currentCrew?.action === "shoot" && currentCrew.targetThreatId) {
      const pos = locate(currentCrew.targetThreatId);
      if (!pos) return null;
      return { fromX: SHIP_ANCHOR.x, fromY: SHIP_ANCHOR.y, toX: pos.x, toY: pos.y, killed: Boolean(currentCrew.killedTarget), key: clampedIndex };
    }
    if (currentHit) {
      const pos = locate(currentHit.threatId);
      if (!pos) return null;
      return { fromX: pos.x, fromY: pos.y, toX: SHIP_ANCHOR.x, toY: SHIP_ANCHOR.y, incoming: true, key: clampedIndex };
    }
    return null;
  }, [threats, steps, clampedIndex, currentCrew, currentHit]);

  // A hull-damaging enemy frame kicks off a screen shake + red flash, scaled by
  // how hard the hit landed. Re-keyed by frame so each blow re-triggers.
  const hullHit = currentHit && currentHit.toHull > 0 ? currentHit.toHull : 0;
  const shaking = !reducedMotion && hullHit > 0;
  const shakeStyle: CSSProperties | undefined = shaking
    ? ({ "--shake": `${Math.min(11, 3 + hullHit * 2)}px` } as CSSProperties)
    : undefined;

  const eyebrow = inCrewPhase ? "Crew phase" : "Enemy phase";
  const title = inCrewPhase ? "Crew takes action" : "Incoming fire — brace the hull";
  const phaseTheme = inCrewPhase
    ? "border-cyan-700/50 shadow-[0_0_50px_rgba(34,211,238,0.15)]"
    : "border-red-700/50 shadow-[0_0_50px_rgba(244,63,94,0.15)]";
  const progressLabel = isFinalFrame
    ? "Round complete"
    : inCrewPhase
      ? `Crew action ${revealedCrew.length} / ${crewTotal}`
      : hitTotal > 0
        ? `Hit ${Math.max(1, revealedHits.length)} / ${hitTotal}`
        : "No enemy fire this phase";

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-slate-950/75 p-4 transition-shadow duration-500 lg:col-span-2 ${phaseTheme}`}>
      <Starfield />
      {shaking ? (
        <div key={`flash-${clampedIndex}`} className="animate-flash-danger pointer-events-none absolute inset-0 z-0 bg-red-600/30" aria-hidden="true" />
      ) : null}
      <div
        key={shaking ? `shake-${clampedIndex}` : "steady"}
        className={`relative z-10 ${shaking ? "animate-stage-shake" : ""}`}
        style={shakeStyle}
      >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-xs uppercase tracking-[0.25em] ${inCrewPhase ? "text-cyan-300" : "text-red-300"}`}>{eyebrow}</p>
          <h2 className={`text-lg font-semibold ${inCrewPhase ? "text-cyan-100" : "text-red-100"}`}>{title}</h2>
        </div>
        <span className="rounded-full border border-slate-600/50 bg-slate-500/10 px-3 py-1 font-mono text-xs tracking-wider text-slate-100">
          ROUND {game.roundIndex + 1}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ShipStat
          label="Hull"
          value={ship.hull}
          max={ship.maxHull}
          tone={hullTone(ship.maxHull > 0 ? ship.hull / ship.maxHull : 0)}
          icon="hull"
          iconClass="text-emerald-300"
        />
        <ShipStat label="Shields" value={ship.shields} max={ship.shieldCap} tone="bg-cyan-400" icon="shields" iconClass="text-cyan-300" />
        <ShipStat label="Jump" value={ship.jumpCharge} max={ship.jumpTarget} tone="bg-accent-success" icon="jump" iconClass="text-emerald-300" />
        <ShipStat label="Energy" value={ship.energy} max={ship.energyCap} tone="bg-amber-300" icon="energy" iconClass="text-amber-300" />
      </div>

      {/* Battlefield stays pinned directly under the stats so the per-beat log
          below it can change height without shoving the tactical view around. */}
      <section className="mt-4 space-y-3">
        <TacticalViewport
          ship={ship}
          threats={threats}
          threatLevel={spaceship.threatLevel}
          roundIndex={game.roundIndex}
          selectedThreatId={undefined}
          onSelect={() => {}}
          disabled
          reducedMotion={reducedMotion}
          compact={isCompact}
          helmLabel={inCrewPhase && currentCrew ? `${currentCrew.playerName} at the helm` : undefined}
          fire={revealFire}
        />
      </section>

      <div key={`srev-${game.roundIndex}-${clampedIndex}`} className="mt-4">
        {currentCrew ? (
          <CrewActionBreakdown crew={currentCrew} />
        ) : currentHit ? (
          <HitBreakdown hit={currentHit} />
        ) : message ? (
          <div className="animate-pop-in rounded-xl border border-red-700/40 bg-slate-900/70 px-4 py-3 text-center" aria-live="polite">
            <p className="text-sm font-semibold text-red-100">{message}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm">
        <span className="text-slate-300">{progressLabel}</span>
        <span className="text-slate-400">
          Next round in <span className="font-bold text-cyan-300 tabular-nums">{secs}s</span>
        </span>
      </div>

      {revealedCrew.length > 0 ? (
        <div className="mt-4 rounded-xl border border-cyan-800/40 bg-slate-900/70 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Crew actions</h3>
            <span className="text-xs text-slate-400">{revealedCrew.length} / {crewTotal}</span>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {revealedCrew.map((crew, index) => (
              <CrewActionLine key={crew.id} crew={crew} highlight={inCrewPhase && index === revealedCrew.length - 1} />
            ))}
          </div>
        </div>
      ) : null}

      {revealedHits.length > 0 ? (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">Damage report</h3>
            <span className="text-xs text-slate-400">
              hull −{revealedHits.reduce((sum, hit) => sum + hit.toHull, 0)} · shields −{revealedHits.reduce((sum, hit) => sum + hit.absorbed, 0)}
            </span>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {revealedHits.map((hit, index) => (
              <HitLogLine key={`${hit.threatId}-${index}`} hit={hit} highlight={index === revealedHits.length - 1} />
            ))}
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}

function useSelectedThreat(threats: SpaceshipThreat[] | undefined) {
  const [selectedThreatId, setSelectedThreatId] = useState<string | undefined>(threats?.[0]?.id);

  useEffect(() => {
    if (!threats?.length) {
      setSelectedThreatId(undefined);
      return;
    }
    if (!selectedThreatId || !threats.some((threat) => threat.id === selectedThreatId)) {
      setSelectedThreatId(threats[0].id);
    }
  }, [selectedThreatId, threats]);

  return [selectedThreatId, setSelectedThreatId] as const;
}
