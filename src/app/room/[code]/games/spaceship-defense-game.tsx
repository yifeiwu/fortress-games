"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { playerName as resolvePlayerName } from "@/lib/game/players";
import { useCountdown, useNumberChange, useStepPlayback } from "@/app/room/[code]/games/shared";
import { GameShell, HostRestartFooter } from "@/app/room/[code]/games/shared-ui";
import type { Room, SpaceshipActionType, SpaceshipCrewAction, SpaceshipHitDetail, SpaceshipReinforcement, SpaceshipThreat } from "@/lib/types";

interface SpaceshipDefenseGameProps {
  room: Room;
  viewerPlayerId: string;
  isHost: boolean;
  onSubmitAction: (action: SpaceshipActionType, targetThreatId?: string) => Promise<void>;
  onRestart: () => void;
}

// Visual scale for the turn timer bar. Mirrors TURN_DURATION_MS in the plugin.
const TURN_SECONDS = 40;

// Mirrors ACTION_ENERGY_COST / ENERGY_PER_TURN in the spaceship-defense plugin.
const ENERGY_COST: Record<SpaceshipActionType, number> = {
  shoot: 1,
  shield: 3,
  charge_jump: 2,
  jump_away: 0,
  emergency_jump: 0,
  pass: 0
};
const ENERGY_PER_TURN = 1;

// Shared base style for the crew action buttons (gradient set per-button inline).
const ACTION_BUTTON =
  "rounded-lg px-3 py-3 text-center text-sm font-semibold text-slate-950 shadow-md shadow-black/30 transition duration-150 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100";

// One shared gradient so the standard crew actions read as a consistent set.
// The escape buttons (Jump Away / Emergency Jump) keep their own risk-coded
// colours since those convey safety-critical meaning.
const ACTION_BUTTON_BG = "linear-gradient(160deg,#38bdf8,#0ea5e9)";

// Mirrors emergencyJumpChance in the spaceship-defense plugin.
function emergencyJumpChance(jumpCharge: number, jumpTarget: number): number {
  if (jumpTarget <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((jumpCharge / jumpTarget) * 100)));
}

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

// A deterministic starfield (seeded so server and client render identically and
// avoid hydration mismatches). Drawn behind the HUD for spaceship ambiance.
const STARS = (() => {
  let seed = 0x9e3779b9;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: 72 }, (_, id) => ({
    id,
    left: rand() * 100,
    top: rand() * 100,
    size: 1 + rand() * 2.2,
    delay: rand() * 4,
    duration: 2.4 + rand() * 3.6,
    opacity: 0.25 + rand() * 0.6
  }));
})();

function Starfield() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(56,189,248,0.12),transparent_55%),radial-gradient(circle_at_85%_85%,rgba(168,85,247,0.12),transparent_55%)]" />
      {STARS.map((star) => (
        <span
          key={star.id}
          className="animate-twinkle absolute rounded-full bg-white"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`
          }}
        />
      ))}
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

function ThreatCard({
  threat,
  selected,
  disabled,
  onSelect
}: {
  threat: SpaceshipThreat;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const tone = THREAT_TONES[threat.kind] ?? "border-slate-600 bg-slate-800";
  const imminent = threat.attacksInTurns <= 1;
  const killFirst = threat.oneShot && threat.kind !== "missile";
  return (
    <div
      className={`rounded-lg border p-3 text-left transition ${tone} ${
        selected ? "ring-2 ring-cyan-300" : ""
      } ${imminent ? "animate-pulse border-red-400/70" : ""}`}
    >
      <button
        type="button"
        className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-75"
        onClick={onSelect}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`${threat.name}, hull ${Math.max(0, threat.health)} of ${threat.maxHealth}, attacks in ${threat.attacksInTurns} turns`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="inline-flex items-center gap-1 rounded bg-slate-950/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-300">
              <Icon name={threat.kind} className="h-3 w-3" />
              {THREAT_TAGS[threat.kind] ?? "???"}
            </span>
            <p className="mt-1 text-xs text-slate-400">
              Hull {Math.max(0, threat.health)} / {threat.maxHealth}
            </p>
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs ${
              imminent
                ? "border-red-400/60 bg-red-500/20 text-red-100"
                : "border-slate-500/50 bg-slate-950/60 text-slate-200"
            }`}
          >
            T-{threat.attacksInTurns}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <span className="rounded bg-slate-950/50 px-2 py-1">
            Attack: <span className="font-semibold">{threat.attackRevealed ? threat.attack : "?"}</span>
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
      </button>
      <button
        type="button"
        className={`mt-2 w-full rounded px-2 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          selected
            ? "bg-accent text-slate-950"
            : "border border-slate-500/60 bg-slate-950/50 text-slate-200 hover:border-accent"
        }`}
        onClick={onSelect}
        disabled={disabled}
        aria-pressed={selected}
      >
        {selected ? "Targeted" : "Target"}
      </button>
    </div>
  );
}

// Telegraphs queued reinforcements so the crew can prep for the next wave before
// it lands. Sorted soonest-first; the imminent wave is highlighted.
function IncomingReinforcements({ reinforcements }: { reinforcements: SpaceshipReinforcement[] }) {
  if (!reinforcements.length) return null;
  const sorted = [...reinforcements].sort((a, b) => a.arrivesInRounds - b.arrivesInRounds);
  return (
    <div className="rounded-lg border border-fuchsia-700/40 bg-fuchsia-950/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200">Incoming reinforcements</h4>
        <span className="text-xs text-fuchsia-300/80">{reinforcements.length} inbound</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {sorted.map((entry) => {
          const tone = THREAT_TONES[entry.kind] ?? "border-slate-600 bg-slate-800";
          const imminent = entry.arrivesInRounds <= 1;
          return (
            <span
              key={entry.id}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${tone} ${imminent ? "ring-1 ring-fuchsia-300/70" : ""}`}
              title={`${entry.name} arrives in ${entry.arrivesInRounds} round${entry.arrivesInRounds === 1 ? "" : "s"}`}
            >
              <span className="rounded bg-slate-950/70 px-1 py-0.5 text-[9px] font-bold tracking-wider text-slate-300">
                {THREAT_TAGS[entry.kind] ?? "???"}
              </span>
              <span className="text-slate-100">{entry.name}</span>
              <span className="font-mono text-fuchsia-200/90">{imminent ? "next" : `${entry.arrivesInRounds} rds`}</span>
            </span>
          );
        })}
      </div>
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
  const rawSeconds = useCountdown(game.roundDeadlineAt);
  const dialogRef = useRef<HTMLDivElement>(null);

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
  const canJump = ship.jumpCharge >= ship.jumpTarget;
  // The risky alternative when the drive isn't fully charged: gamble on how far
  // the jump drive has already charged. The jump itself is free.
  const emergencyChance = emergencyJumpChance(ship.jumpCharge, ship.jumpTarget);
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

  // Show the most imminent threats first, breaking ties by raw attack power.
  const sortedThreats = [...spaceship.threats].sort((a, b) => {
    if (a.attacksInTurns !== b.attacksInTurns) return a.attacksInTurns - b.attacksInTurns;
    return b.attack - a.attack;
  });

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
    const cost = ENERGY_COST[action] ?? 0;
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

      {isFinished ? (
        <div
          className={`mt-4 rounded-xl border bg-slate-900/80 p-5 text-center ${
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
              <span className="mt-0.5 block text-[11px] font-normal opacity-80">0–4 dmg · {ENERGY_COST.shoot}<EnergyMark /></span>
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
              <span className="mt-0.5 block text-[11px] font-normal opacity-80">to {ship.shieldCap} · {ENERGY_COST.shield}<EnergyMark /></span>
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
              <span className="mt-0.5 block text-[11px] font-normal opacity-80">{ENERGY_COST.charge_jump}<EnergyMark /></span>
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

      <div className="mt-4 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-cyan-100">Threat Row</h3>
            <span className="text-xs text-slate-400">Select a target, then shoot</span>
          </div>
          {spaceship.reinforcements?.length ? (
            <div className="mt-3">
              <IncomingReinforcements reinforcements={spaceship.reinforcements} />
            </div>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {sortedThreats.length ? (
              sortedThreats.map((threat) => (
                <ThreatCard
                  key={threat.id}
                  threat={threat}
                  selected={selectedThreatId === threat.id}
                  disabled={isFinished}
                  onSelect={() => setSelectedThreatId(threat.id)}
                />
              ))
            ) : (
              <p className="rounded border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-300">
                No active threats. Use the opening to charge the jump drive.
              </p>
            )}
          </div>
        </section>

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
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
                onClick={() => setConfirmingEmergencyJump(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-orange-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                onClick={() => {
                  setConfirmingEmergencyJump(false);
                  void submit("emergency_jump");
                }}
              >
                Attempt jump ({emergencyChance}%)
              </button>
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
        <div className="rounded-lg bg-slate-950/50 px-2 py-2">
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

// The focal frame while a crew action plays in the reveal — mirrors HitBreakdown
// for enemy fire.
function CrewActionBreakdown({ crew }: { crew: SpaceshipCrewAction }) {
  const { label, effect, tone } = crewActionSummary(crew);
  const tag = crew.targetThreatKind ? THREAT_TAGS[crew.targetThreatKind] : undefined;
  return (
    <div className="animate-pop-in rounded-xl border border-cyan-700/40 bg-slate-900/70 px-4 py-3" aria-live="polite">
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
  const steps = spaceship.revealSteps ?? [];
  const totalSteps = steps.length;

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

  const sortedThreats = useMemo(
    () =>
      [...threats].sort((a, b) => {
        if (a.attacksInTurns !== b.attacksInTurns) return a.attacksInTurns - b.attacksInTurns;
        return b.attack - a.attack;
      }),
    [threats]
  );

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
      <div className="relative z-10">
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

      <section className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
        <h3 className="font-semibold text-cyan-100">Threat Row</h3>
        {spaceship.reinforcements?.length ? (
          <div className="mt-3">
            <IncomingReinforcements reinforcements={spaceship.reinforcements} />
          </div>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sortedThreats.length ? (
            sortedThreats.map((threat) => (
              <ThreatCard
                key={threat.id}
                threat={threat}
                selected={false}
                disabled
                onSelect={() => {}}
              />
            ))
          ) : (
            <p className="rounded border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-300">
              The threat row is clear — for now.
            </p>
          )}
        </div>
      </section>
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
