"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { FB_HEADS, FB_BODIES, FB_TAILS, FB_PARTS_BY_ID, beastLabel, computeDamageReduction, getBeastAbilities, resolveFighterIds, PASS_ABILITY } from "@/lib/game/plugins/frankenbeasts-data";
import type { FBAbility, FBPart } from "@/lib/game/plugins/frankenbeasts-data";
import { playerName } from "@/lib/game/players";
import { useCountdown, useNumberChange, useStepPlayback, type NumberChange } from "@/app/room/[code]/games/shared";
import { Confetti, GameShell, HostRestartFooter } from "@/app/room/[code]/games/shared-ui";
import { Trophy } from "@/app/room/[code]/games/award-icons";
import { Button } from "@/components/Button";
import {
  ArmorIcon,
  HandshakeIcon,
  PoisonIcon,
  RoarIcon,
  SkullIcon,
  SlotIcon
} from "@/app/room/[code]/games/frankenbeasts-icons";
import type { FBCombatStatus, FBRoundAction, Room } from "@/lib/types";

interface FrankenBeastsGameProps {
  room: Room;
  viewerPlayerId: string;
  isHost: boolean;
  onSubmitPick: (headId: string, bodyId: string, tailId: string, lockIn: boolean) => Promise<void>;
  onSelectAction: (abilityId: string) => Promise<void>;
  onRestart: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pName(room: Room, id: string | undefined): string {
  return playerName(room, id);
}

function fighterIds(room: Room): [string, string] | null {
  return resolveFighterIds(room, room.game.frankenbeasts);
}

function opponentId(room: Room, viewerPlayerId: string): string | undefined {
  // Resolve against the actual fighter assignment (join order / server-assigned
  // fighterIds) rather than raw player array order, so spectators or rejoins
  // can't shift who counts as "the opponent".
  const fighters = fighterIds(room);
  if (!fighters) return undefined;
  return fighters.find((id) => id !== viewerPlayerId);
}

function hpColor(hp: number, maxHp: number): string {
  const pct = maxHp > 0 ? hp / maxHp : 0;
  if (pct > 0.6) return "bg-emerald-500";
  if (pct > 0.3) return "bg-amber-400";
  return "bg-red-500";
}

// The three battle stages live in /public/stages. We pick one deterministically
// from the (stable) room code so every client in the room shows the same arena
// without needing any server-side game state for it.
const STAGES = ["forest", "city", "volcano"] as const;

function pickStage(code: string): (typeof STAGES)[number] {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return STAGES[Math.abs(h) % STAGES.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HpBar({ hp, maxHp, label, compact = false }: { hp: number; maxHp: number; label: string; compact?: boolean }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;

  // Trailing "ghost" bar: when HP drops, the colored bar snaps to the new value
  // while a pale segment lingers over the lost HP and then drains a beat later,
  // so each hit reads as a hit instead of a silent width change.
  const prevHpRef = useRef(hp);
  const [ghostPct, setGhostPct] = useState(pct);

  useEffect(() => {
    const prevHp = prevHpRef.current;
    prevHpRef.current = hp;
    if (hp < prevHp) {
      const drain = setTimeout(() => setGhostPct(pct), 120);
      return () => clearTimeout(drain);
    }
    setGhostPct(pct);
    return undefined;
  }, [hp, pct]);

  return (
    <div>
      <div className={`flex justify-between text-slate-400 ${compact ? "mb-0.5 text-[10px]" : "mb-1 text-xs"}`}>
        <span className={compact ? "truncate" : undefined}>{label}</span>
        <span className="shrink-0 font-semibold text-slate-200">{hp} / {maxHp}</span>
      </div>
      <div className={`relative overflow-hidden rounded-full bg-slate-700 ${compact ? "h-2" : "h-3"}`}>
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-rose-200/70 transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(ghostPct, pct)}%` }}
        />
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-out ${hpColor(hp, maxHp)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const BADGE_TONES = {
  poison: "bg-purple-900/60 text-purple-300 ring-purple-500/40",
  roar: "bg-orange-900/60 text-orange-300 ring-orange-500/40",
  armor: "bg-sky-900/60 text-sky-300 ring-sky-500/40"
} as const;

function StatusBadge({ tone, children }: { tone: keyof typeof BADGE_TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

function PoisonBadge({ turns, damage }: { turns: number; damage: number }) {
  if (turns <= 0 || damage <= 0) return null;
  return (
    <StatusBadge tone="poison">
      <PoisonIcon className="h-3.5 w-3.5" /> {damage}/turn · {turns}t
    </StatusBadge>
  );
}

function RoarBadge({ bonus, turns }: { bonus: number; turns: number }) {
  if (turns <= 0 || bonus <= 0) return null;
  return (
    <StatusBadge tone="roar">
      <RoarIcon className="h-3.5 w-3.5" /> Roar +{bonus} · {turns}t
    </StatusBadge>
  );
}

function ArmorBadge({ armor }: { armor: number }) {
  if (armor <= 0) return null;
  return (
    <StatusBadge tone="armor">
      <ArmorIcon className="h-3.5 w-3.5" /> {armor} armor
    </StatusBadge>
  );
}

// A part's artwork, falling back to a slot emoji if the image is missing.
// Memoized because its props are stable strings: it shouldn't re-render when an
// ancestor updates for an unrelated reason (HP ticks, countdowns, etc.).
const PartImage = memo(function PartImage({
  partId,
  slot,
  imgClassName,
  fallbackClassName
}: {
  partId: string;
  slot: FBPart["slot"];
  imgClassName: string;
  fallbackClassName: string;
}) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className={fallbackClassName}>
        <SlotIcon slot={slot} className="h-3/5 w-3/5 text-slate-500" />
      </div>
    );
  }
  // Square part art (100x100 SVG); fixed dims avoid layout shift while loading.
  return (
    <img
      src={`/parts/${partId}.svg`}
      alt={FB_PARTS_BY_ID[partId]?.name ?? partId}
      className={imgClassName}
      width={96}
      height={96}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
});

function BeastPortrait({ headId, bodyId, tailId, size = "md" }: { headId: string; bodyId: string; tailId: string; size?: "sm" | "md" | "lg" }) {
  const imgSize = size === "sm" ? "h-14 w-14" : size === "lg" ? "h-24 w-24" : "h-20 w-20";
  const fallbackSize = size === "sm" ? "h-14 w-14 text-2xl" : size === "lg" ? "h-24 w-24 text-4xl" : "h-20 w-20 text-3xl";
  // The SVG parts are drawn to butt together edge-to-edge: each head's neck, the
  // body's two sockets, and the tail's base all sit in the same vertical band and
  // reach the canvas edge, so they connect seamlessly with no overlap margin.
  const fallbackBox = `flex items-center justify-center ${fallbackSize}`;

  return (
    <div className="flex flex-row items-center">
      <PartImage partId={headId} slot="head" imgClassName={`${imgSize} object-contain`} fallbackClassName={fallbackBox} />
      <PartImage partId={bodyId} slot="body" imgClassName={`${imgSize} object-contain`} fallbackClassName={fallbackBox} />
      <PartImage partId={tailId} slot="tail" imgClassName={`${imgSize} object-contain`} fallbackClassName={fallbackBox} />
    </div>
  );
}

function PartCard({
  part,
  selected,
  onClick
}: {
  part: FBPart;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition-all duration-150 ${
        selected
          ? "border-cyan-400 bg-cyan-950/60 ring-2 ring-cyan-400/50"
          : "border-slate-600/50 bg-slate-800/60 hover:border-slate-400/60 hover:bg-slate-700/60"
      }`}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <PartImage
            partId={part.id}
            slot={part.slot}
            imgClassName="h-16 w-16 rounded-lg object-contain bg-slate-700/50"
            fallbackClassName="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-700 text-3xl"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-100">{part.name}</span>
            <span className="rounded-full bg-rose-900/50 px-2 py-0.5 text-xs font-semibold text-rose-300">
              {part.hp} HP
            </span>
          </div>
          {part.passives.map((p, i) => (
            <p key={i} className="mt-0.5 text-xs text-indigo-300">
              <span className="font-semibold">Passive:</span>{" "}
              {p.kind === "damage_reduction" && `−${p.amount} incoming dmg`}
              {p.kind === "damage_amplify" && `+${p.amount} incoming dmg (ouch)`}
              {p.kind === "heal_per_round" && `+${p.amount} HP/round`}
              {p.kind === "retaliation" && `${p.amount} dmg when hit`}
              {p.kind === "death_march" && `${p.amount} dmg/round to opponent`}
              {p.kind === "poison_retaliation" && `Poison Skin: poisons attacker (2/turn for ${p.turns} turns) when hit`}
              {p.kind === "self_poison" && `Self-poison for ${p.turns} turns on assembly`}
            </p>
          ))}
          {part.abilities.map((a) => (
            <p key={a.id} className="mt-0.5 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">{a.name}:</span> {a.description}
            </p>
          ))}
          {part.abilities.length === 0 && part.passives.length === 0 && (
            <p className="mt-0.5 text-xs text-slate-500 italic">No abilities.</p>
          )}
        </div>
      </div>
    </button>
  );
}

function AbilityButton({
  ability,
  selected,
  disabled,
  onClick
}: {
  ability: FBAbility;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const isPass = ability.id === "pass";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl border px-4 py-3 text-left transition-all duration-150 ${
        selected
          ? "border-cyan-400 bg-cyan-950/70 ring-2 ring-cyan-400/40"
          : isPass
          ? "border-slate-600/40 bg-slate-800/30 hover:border-slate-500/60"
          : "border-slate-600/50 bg-slate-800/60 hover:border-cyan-500/60 hover:bg-slate-700/60"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <div className="font-semibold text-slate-200">{ability.name}</div>
      <div className="mt-0.5 text-xs text-slate-400">{ability.description}</div>
    </button>
  );
}

function LogEntry({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-slate-800/60 px-3 py-1.5 text-sm text-slate-300 leading-snug">
      {message}
    </div>
  );
}

// ─── Pick Phase ───────────────────────────────────────────────────────────────

function PickPhase({
  room,
  viewerPlayerId,
  onSubmitPick
}: {
  room: Room;
  viewerPlayerId: string;
  onSubmitPick: FrankenBeastsGameProps["onSubmitPick"];
}) {
  const [selectedHead, setSelectedHead] = useState<string | null>(null);
  const [selectedBody, setSelectedBody] = useState<string | null>(null);
  const [selectedTail, setSelectedTail] = useState<string | null>(null);
  const [lockedIn, setLockedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fb = room.game.frankenbeasts;
  const deadline = room.game.roundDeadlineAt;
  const secs = useCountdown(deadline);

  const oppId = opponentId(room, viewerPlayerId);
  const opponentLocked = oppId ? fb?.pendingPicks?.[oppId]?.lockedIn ?? false : false;
  const myPick = fb?.pendingPicks?.[viewerPlayerId];

  // Prefer local selections, falling back to server-confirmed picks (so a page
  // refresh mid-pick still reflects what's already been chosen).
  const headId = selectedHead ?? myPick?.headId ?? null;
  const bodyId = selectedBody ?? myPick?.bodyId ?? null;
  const tailId = selectedTail ?? myPick?.tailId ?? null;
  const isLockedIn = myPick?.lockedIn ?? lockedIn;
  const allChosen = Boolean(headId && bodyId && tailId);
  const selectedAbilities = headId && bodyId && tailId ? getBeastAbilities(headId, bodyId, tailId) : [];
  const totalHp =
    headId && bodyId && tailId
      ? (FB_PARTS_BY_ID[headId]?.hp ?? 0) + (FB_PARTS_BY_ID[bodyId]?.hp ?? 0) + (FB_PARTS_BY_ID[tailId]?.hp ?? 0)
      : 0;
  const totalArmor = headId && bodyId && tailId ? computeDamageReduction(headId, bodyId, tailId) : 0;

  async function handleSelect(slot: "head" | "body" | "tail", partId: string) {
    if (isLockedIn) return;
    // Update the local selection immediately so the UI stays responsive even
    // while a previous pick is still syncing to the server.
    const nextHead = slot === "head" ? partId : headId ?? "";
    const nextBody = slot === "body" ? partId : bodyId ?? "";
    const nextTail = slot === "tail" ? partId : tailId ?? "";
    if (slot === "head") setSelectedHead(partId);
    if (slot === "body") setSelectedBody(partId);
    if (slot === "tail") setSelectedTail(partId);
    try {
      await onSubmitPick(nextHead, nextBody, nextTail, false);
    } catch {
      // Best-effort sync; the next selection or lock-in will retry.
    }
  }

  async function handleLockIn() {
    if (!allChosen || isLockedIn || submitting) return;
    setLockedIn(true);
    setSubmitting(true);
    try {
      await onSubmitPick(headId!, bodyId!, tailId!, true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl bg-slate-800/80 px-4 py-3">
        <div>
          <h2 className="font-bold text-slate-100 text-lg">Build Your Beast!</h2>
          <p className="text-sm text-slate-400">Pick one part from each column.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`text-2xl font-bold tabular-nums ${secs <= 10 ? "text-red-400" : "text-cyan-300"}`}>
            {secs}s
          </div>
          <div className="flex gap-2 text-xs">
            <span className={isLockedIn ? "text-emerald-400" : "text-slate-400"}>
              {isLockedIn ? "✓ You're ready" : "Choosing…"}
            </span>
            <span className="text-slate-600">·</span>
            <span className={opponentLocked ? "text-emerald-400" : "text-slate-400"}>
              {opponentLocked ? `✓ ${pName(room, oppId)} ready` : `${pName(room, oppId)} choosing…`}
            </span>
          </div>
        </div>
      </div>

      {/* Part columns */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(["head", "body", "tail"] as const).map((slot) => {
          const parts = slot === "head" ? FB_HEADS : slot === "body" ? FB_BODIES : FB_TAILS;
          const selected = slot === "head" ? headId : slot === "body" ? bodyId : tailId;
          return (
            <div key={slot} className="flex flex-col gap-2">
              <h3 className="text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                {slot}
              </h3>
              <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
                {parts.map((part) => (
                  <PartCard
                    key={part.id}
                    part={part}
                    selected={selected === part.id}
                    onClick={() => handleSelect(slot, part.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Beast preview + lock in */}
      <div className="flex flex-col gap-3 rounded-xl bg-slate-800/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {headId && bodyId && tailId ? (
            <>
              <BeastPortrait headId={headId} bodyId={bodyId} tailId={tailId} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-200">
                  {beastLabel(headId, bodyId, tailId)}
                </p>
                <p className="text-xs text-slate-400">
                  Total HP:{" "}
                  <span className="font-bold text-rose-300">
                    {totalHp}
                  </span>
                  {totalArmor > 0 && (
                    <>
                      {" · "}Armor:{" "}
                      <span className="font-bold text-sky-300">{totalArmor}</span>
                    </>
                  )}
                </p>
                <div className="mt-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Final Abilities</p>
                  <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
                    {selectedAbilities.map((ability) => (
                      <div key={ability.id} className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-2 py-1.5">
                        <p className="text-xs font-semibold text-cyan-200">{ability.name}</p>
                        <p className="text-[11px] leading-snug text-slate-400">{ability.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500 italic">Select all three parts to preview your beast.</p>
          )}
        </div>
        <Button
          variant="success"
          onClick={handleLockIn}
          disabled={!allChosen || isLockedIn || submitting}
          className="shrink-0 rounded-xl px-6 py-2 font-bold"
        >
          {isLockedIn ? "✓ Locked In!" : "Lock In"}
        </Button>
      </div>
    </div>
  );
}

// ─── Fight Phase ──────────────────────────────────────────────────────────────

interface StageSide {
  status: FBCombatStatus;
  name: string;
  playerId: string;
  isYou?: boolean;
  label?: string;
}

// A single beast standing on the battle stage: a floating name/HP/status panel
// above the beast art, which charges toward center when it lands a hit and
// recoils/flashes when it takes one. The various transforms (charge, hit-shake,
// idle bob, responsive scale + facing mirror) are split across nested wrappers
// so they never overwrite each other.
// Name / HP / status badges for one beast. Rendered in a row beneath the stage
// (above the action area) rather than floating over the beast art.
function BeastStatusPanel({
  status,
  name,
  label,
  isYou = false,
  align
}: {
  status: FBCombatStatus;
  name: string;
  label?: string;
  isYou?: boolean;
  align: "left" | "right";
}) {
  const armor = computeDamageReduction(status.headId, status.bodyId, status.tailId);
  const justify = align === "left" ? "justify-start" : "justify-end";
  return (
    <div
      className={`rounded-lg bg-slate-950/70 px-2 py-1.5 ring-1 backdrop-blur-sm ${
        isYou ? "ring-cyan-400/50" : "ring-white/10"
      }`}
    >
      <div className={`mb-0.5 flex items-center gap-1.5 ${justify}`}>
        <span className={`truncate text-xs font-bold ${isYou ? "text-cyan-200" : "text-slate-100"}`}>{name}</span>
        {label ? <span className="shrink-0 text-[10px] text-slate-400">{label}</span> : null}
      </div>
      <HpBar
        compact
        hp={status.hp}
        maxHp={status.maxHp}
        label={beastLabel(status.headId, status.bodyId, status.tailId)}
      />
      {(armor > 0 || status.poisonTurns > 0 || status.damageBuff.turnsRemaining > 0) && (
        <div className={`mt-1 flex flex-wrap items-center gap-1 ${justify}`}>
          <ArmorBadge armor={armor} />
          <PoisonBadge turns={status.poisonTurns} damage={status.poisonDamage} />
          <RoarBadge bonus={status.damageBuff.bonus} turns={status.damageBuff.turnsRemaining} />
        </div>
      )}
    </div>
  );
}

function StageBeast({
  status,
  side,
  charging,
  hit,
  defeated = false,
  centered = false,
  knockoutOff = false,
  lungeDir,
  artRef,
  chargeDistance,
  incomingContactMs = 0
}: {
  status: FBCombatStatus;
  side: "left" | "right";
  charging: NumberChange | null;
  hit: NumberChange | null;
  defeated?: boolean;
  /** Place this beast at center stage (used to spotlight the winner). */
  centered?: boolean;
  /** Win screen: this defeated beast is knocked clean off the stage instead of toppling in place. */
  knockoutOff?: boolean;
  /** Win screen: the centered winner jabs this direction to deliver the knockout. */
  lungeDir?: "left" | "right";
  /** Ref to the scaled art node, so the stage can measure the gap between beasts. */
  artRef?: RefObject<HTMLDivElement>;
  /** Lunge travel distance (px), measured by the stage so the attacker reaches its target. */
  chargeDistance?: number;
  /** Delay (ms) before this beast reacts, so recoil/flash/number land when a charging opponent makes contact. */
  incomingContactMs?: number;
}) {
  const damaged = hit ? hit.delta < 0 : false;
  const chargeKey = charging?.key ?? 0;
  const hitKey = hit?.key ?? 0;

  // Recoil distance and damage-number size scale with the hit's magnitude.
  const hitMag = hit ? Math.abs(hit.delta) : 0;
  const knockbackPx = Math.min(28, 8 + hitMag * 0.9);
  const knockbackAnim = side === "left" ? "animate-knockback-left" : "animate-knockback-right";
  const numberSize =
    hitMag >= 10 ? "text-4xl" : hitMag >= 6 ? "text-3xl" : hitMag >= 3 ? "text-2xl" : "text-xl";
  const contactDelay = incomingContactMs > 0 ? { animationDelay: `${incomingContactMs}ms` } : undefined;

  // On the result screen the winner is spotlighted center-stage; the loser keeps
  // its own side and is knocked clean off the stage (see knockoutOff below).
  const vertical = "bottom-[7%]";
  const anchorPos = centered
    ? "left-1/2 -translate-x-1/2 z-10"
    : side === "left"
    ? "left-[12%] sm:left-[21%]"
    : "right-[12%] sm:right-[21%]";
  // Beast art faces left by default, so the left-side beast is mirrored to face
  // its opponent. Responsive scale keeps both beasts on-stage on small screens.
  const scaleMirror =
    side === "left"
      ? "scale-y-[0.66] scale-x-[-0.66] sm:scale-y-[0.89] sm:scale-x-[-0.89] lg:scale-y-[1.06] lg:scale-x-[-1.06]"
      : "scale-[0.66] sm:scale-[0.89] lg:scale-[1.06]";
  const chargeAnim = side === "left" ? "animate-charge-right" : "animate-charge-left";
  // The winner's celebratory knockout jab (finished screen only).
  const lungeAnim = lungeDir === "left" ? "animate-winner-lunge-left" : lungeDir === "right" ? "animate-winner-lunge-right" : undefined;
  // KO'd beasts either topple in place (mid-fight / draw) or, on the win screen,
  // get launched off the stage in their own direction shortly after the jab lands.
  const koAnim = defeated
    ? knockoutOff
      ? side === "left"
        ? "animate-ko-flyoff-left"
        : "animate-ko-flyoff-right"
      : "animate-ko-topple"
    : undefined;

  return (
    <div className={`absolute ${vertical} ${anchorPos} flex w-40 max-w-[46%] flex-col items-center sm:w-44`}>
      {/* beast art zone (name/HP/status panel now lives below the stage) */}
      <div className="relative">
        <div
          key={`charge-${chargeKey}`}
          className={charging ? chargeAnim : lungeAnim}
          style={chargeDistance != null ? ({ "--charge-distance": `${chargeDistance}px` } as CSSProperties) : undefined}
        >
          {/* Recoil away from the attacker; delayed so it lands on contact. */}
          <div
            key={`knockback-${hitKey}`}
            className={damaged ? knockbackAnim : undefined}
            style={damaged ? ({ "--kb": `${knockbackPx}px`, ...contactDelay } as CSSProperties) : undefined}
          >
            <div className="animate-float-slow">
              {/* KO: topple in place, or get launched off the stage on the win screen. */}
              <div
                className={koAnim}
                style={knockoutOff ? ({ animationDelay: "320ms" } as CSSProperties) : undefined}
              >
                <div ref={artRef} className={`origin-bottom ${scaleMirror}`}>
                  <BeastPortrait headId={status.headId} bodyId={status.bodyId} tailId={status.tailId} size="lg" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {hit ? (
          <div
            key={`flash-${hitKey}`}
            className={`pointer-events-none absolute -inset-6 blur-2xl ${
              damaged ? "animate-flash-danger" : "animate-flash-success"
            }`}
            style={{
              ...contactDelay,
              background: damaged
                ? "radial-gradient(circle at center, rgba(251,113,133,0.6) 0%, rgba(251,113,133,0.25) 45%, transparent 70%)"
                : "radial-gradient(circle at center, rgba(52,211,153,0.6) 0%, rgba(52,211,153,0.25) 45%, transparent 70%)"
            }}
            aria-hidden="true"
          />
        ) : null}

        {hit ? (
          <span
            key={`num-${hitKey}`}
            className={`animate-damage-float pointer-events-none absolute left-1/2 top-0 ${numberSize} font-extrabold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${
              damaged ? "text-rose-300" : "text-emerald-300"
            }`}
            style={contactDelay}
            aria-hidden="true"
          >
            {damaged ? hit.delta : `+${hit.delta}`}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// Fraction-of-charge where the lunge reaches its apex (the 50% keyframe of the
// 0.6s charge), i.e. the moment of contact. The victim's recoil/flash/number and
// the camera shake are delayed by this so they land exactly when the beasts meet.
const CHARGE_CONTACT_MS = 300;
// How far the attacker overshoots the measured gap so the beasts visibly clash.
const CHARGE_OVERLAP_PX = 24;

// The shared arena: a terrain backdrop with both beasts facing each other. The
// attacker lunges across the measured gap to actually reach its opponent; on
// contact the victim recoils away, flashes, pops a damage number, and the whole
// stage shakes (camera shake), with everything scaled to the hit's magnitude.
function BattleStage({
  room,
  left,
  right,
  attackerId,
  leftDefeated,
  rightDefeated,
  centerSide
}: {
  room: Room;
  left: StageSide;
  right: StageSide;
  /** The acting fighter for the current reveal frame, if it's a direct attack. */
  attackerId?: string;
  leftDefeated?: boolean;
  rightDefeated?: boolean;
  /** Spotlight one beast at center stage (the winner on the result screen). */
  centerSide?: "left" | "right";
}) {
  const stage = useMemo(() => pickStage(room.code), [room.code]);
  // Hold longer than the default so contact-delayed FX (recoil/flash/number,
  // which wait CHARGE_CONTACT_MS for impact) get to finish their ~1s animation.
  const leftChange = useNumberChange(left.status.hp, 1500);
  const rightChange = useNumberChange(right.status.hp, 1500);
  const leftDamaged = leftChange ? leftChange.delta < 0 : false;
  const rightDamaged = rightChange ? rightChange.delta < 0 : false;
  // A beast charges only when it's the attacker of this frame's direct hit (so
  // poison/passive/retaliation damage doesn't make anyone lunge).
  const leftCharging = attackerId === left.playerId && rightDamaged ? rightChange : null;
  const rightCharging = attackerId === right.playerId && leftDamaged ? leftChange : null;

  // Measure the on-screen gap between the two scaled beasts so the charge keyframe
  // travels just far enough to make contact, regardless of breakpoint/scale.
  const rootRef = useRef<HTMLDivElement>(null);
  const leftArtRef = useRef<HTMLDivElement>(null);
  const rightArtRef = useRef<HTMLDivElement>(null);
  const [chargeDistance, setChargeDistance] = useState(46);

  const measureGap = useCallback(() => {
    const a = leftArtRef.current;
    const b = rightArtRef.current;
    if (!a || !b) return;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const gap = rb.left - ra.right;
    const next = Math.max(0, Math.round(gap + CHARGE_OVERLAP_PX));
    setChargeDistance((prev) => (Math.abs(prev - next) > 1 ? next : prev));
  }, []);

  useLayoutEffect(() => {
    measureGap();
  }, [measureGap, attackerId, left.status.hp, right.status.hp, centerSide]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => measureGap());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureGap]);

  // Camera shake fires once per direct-hit contact, scaled to the damage dealt.
  const impactChange = leftCharging ?? rightCharging;
  const impactActive = impactChange != null;
  const shakePx = Math.min(11, 3 + Math.abs(impactChange?.delta ?? 0) * 0.7);

  return (
    <div className="flex flex-col gap-2">
      <div ref={rootRef} className="relative aspect-[16/10] w-full overflow-hidden rounded-xl ring-1 ring-white/10 sm:aspect-[2/1]">
        <div
          key={`stage-shake-${impactChange?.key ?? 0}`}
          className={`absolute inset-0 ${impactActive ? "animate-stage-shake" : ""}`}
          style={impactActive ? ({ animationDelay: `${CHARGE_CONTACT_MS}ms`, "--shake": `${shakePx}px` } as CSSProperties) : undefined}
        >
          <img
            src={`/stages/${stage}.svg`}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-slate-950/25" />

          <StageBeast
            side="left"
            status={left.status}
            charging={leftCharging}
            hit={leftChange}
            defeated={leftDefeated}
            centered={centerSide === "left"}
            knockoutOff={centerSide != null && centerSide !== "left"}
            lungeDir={centerSide === "left" ? "right" : undefined}
            artRef={leftArtRef}
            chargeDistance={chargeDistance}
            incomingContactMs={rightCharging ? CHARGE_CONTACT_MS : 0}
          />
          <StageBeast
            side="right"
            status={right.status}
            charging={rightCharging}
            hit={rightChange}
            defeated={rightDefeated}
            centered={centerSide === "right"}
            knockoutOff={centerSide != null && centerSide !== "right"}
            lungeDir={centerSide === "right" ? "left" : undefined}
            artRef={rightArtRef}
            chargeDistance={chargeDistance}
            incomingContactMs={leftCharging ? CHARGE_CONTACT_MS : 0}
          />
        </div>
      </div>

      {/* name / HP / status panels, moved below the stage */}
      <div className="grid grid-cols-2 gap-2">
        <BeastStatusPanel status={left.status} name={left.name} label={left.label} isYou={left.isYou} align="left" />
        <BeastStatusPanel status={right.status} name={right.name} label={right.label} isYou={right.isYou} align="right" />
      </div>
    </div>
  );
}

function FightPhase({
  room,
  viewerPlayerId,
  onSelectAction
}: {
  room: Room;
  viewerPlayerId: string;
  onSelectAction: (abilityId: string) => Promise<void>;
}) {
  const fb = room.game.frankenbeasts;
  const [syncing, setSyncing] = useState(false);

  const deadline = room.game.roundDeadlineAt;
  const secs = useCountdown(deadline);
  const timerExpired = secs <= 0;

  const myStatus = fb?.combatStates[viewerPlayerId];
  const oppId = opponentId(room, viewerPlayerId);
  const opponentStatus = oppId ? fb?.combatStates[oppId] : undefined;

  const selectedAbilityId = fb?.roundSelections?.[viewerPlayerId] ?? null;
  const selectedAbility = selectedAbilityId
    ? getBeastAbilities(myStatus?.headId ?? "", myStatus?.bodyId ?? "", myStatus?.tailId ?? "").find(
        (a) => a.id === selectedAbilityId
      )
    : undefined;

  const abilities = myStatus ? getBeastAbilities(myStatus.headId, myStatus.bodyId, myStatus.tailId) : [PASS_ABILITY];

  async function handleSelect(abilityId: string) {
    if (timerExpired || syncing) return;
    setSyncing(true);
    try {
      await onSelectAction(abilityId);
    } finally {
      setSyncing(false);
    }
  }

  if (!myStatus || !opponentStatus) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Timer + round info */}
      <div className="flex items-center justify-between rounded-xl bg-slate-800/80 px-4 py-2">
        <span className="text-sm font-semibold text-slate-300">Round {room.game.roundIndex + 1}</span>
        <div className={`text-xl font-bold tabular-nums ${secs <= 5 ? "text-red-400" : "text-cyan-300"}`}>
          {secs}s
        </div>
        <div className="text-xs text-slate-400">
          {selectedAbility ? (
            <span className="text-cyan-300">
              {selectedAbility.name} · locks in at 0s
            </span>
          ) : (
            <span>Choose an action — locks in when the timer ends</span>
          )}
        </div>
      </div>

      {/* Beasts on the shared stage */}
      <BattleStage
        room={room}
        left={{ status: myStatus, name: pName(room, viewerPlayerId), playerId: viewerPlayerId, isYou: true, label: "You" }}
        right={{ status: opponentStatus, name: pName(room, oppId), playerId: oppId ?? "", label: "Opponent" }}
      />

      {/* Actions */}
      <div className="rounded-xl bg-slate-800/50 p-3">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Choose Your Action</h3>
        <div className="grid grid-cols-2 gap-2">
          {abilities.map((ability) => (
            <AbilityButton
              key={ability.id}
              ability={ability}
              selected={selectedAbilityId === ability.id}
              disabled={timerExpired || syncing}
              onClick={() => handleSelect(ability.id)}
            />
          ))}
        </div>
      </div>

      {/* Log */}
      {fb && fb.log.length > 0 && (
        <div className="rounded-xl bg-slate-800/40 p-3">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Combat Log</h3>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {fb.log.slice(0, 8).map((entry) => (
              <LogEntry key={entry.id} message={entry.message} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reveal Phase ─────────────────────────────────────────────────────────────

function resolveActionName(action: FBRoundAction | undefined, status: FBCombatStatus | undefined): string {
  if (!action || !status) return "—";
  if (action.abilityId === "pass") return "Pass";
  const allAbilities = [
    ...(FB_PARTS_BY_ID[status.headId]?.abilities ?? []),
    ...(FB_PARTS_BY_ID[status.bodyId]?.abilities ?? []),
    ...(FB_PARTS_BY_ID[status.tailId]?.abilities ?? []),
    PASS_ABILITY
  ];
  return allAbilities.find((a) => a.id === action.abilityId)?.name ?? action.abilityId;
}

function RevealPhase({ room, viewerPlayerId }: { room: Room; viewerPlayerId: string }) {
  const fb = room.game.frankenbeasts;
  const secs = useCountdown(room.game.roundDeadlineAt);
  const roundIndex = room.game.roundIndex;
  const deadlineAt = room.game.roundDeadlineAt;

  const oppId = opponentId(room, viewerPlayerId);
  const steps = fb?.revealSteps ?? [];
  const totalSteps = steps.length;

  // Play the round's events one at a time, paced to land on the final frame a
  // little before the next round begins.
  const clampedIndex = useStepPlayback(roundIndex, totalSteps, deadlineAt);
  const currentStep = totalSteps > 0 ? steps[clampedIndex] : undefined;

  // steps[0] is the pre-action baseline (empty message); real events start at 1.
  // Hoisted above the early return so the hooks always run in the same order.
  const eventsTotal = useMemo(() => steps.slice(1).filter((step) => step.message).length, [steps]);
  const revealedEvents = useMemo(
    () => steps.slice(1, clampedIndex + 1).filter((step) => step.message),
    [steps, clampedIndex]
  );

  // Drive the cards off the current frame's snapshot; fall back to the final
  // combat states for rounds that recorded no steps (e.g. a double-pass).
  const myStatus = currentStep?.states[viewerPlayerId] ?? fb?.combatStates[viewerPlayerId];
  const opponentStatus = (oppId ? currentStep?.states[oppId] : undefined) ?? (oppId ? fb?.combatStates[oppId] : undefined);
  const myLastAction = fb?.lastRoundActions[viewerPlayerId];
  const opponentLastAction = oppId ? fb?.lastRoundActions[oppId] : undefined;

  if (!myStatus || !opponentStatus) return null;

  const currentMessage = currentStep?.message || (clampedIndex === 0 ? "The beasts clash!" : "");
  const eventsShown = revealedEvents.length;
  const isFinalFrame = totalSteps === 0 || clampedIndex >= totalSteps - 1;

  return (
    <div className="flex flex-col gap-3">
      {/* Countdown + playback progress */}
      <div className="flex items-center justify-between rounded-xl bg-slate-800/80 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Round {roundIndex + 1} results
        </span>
        {eventsTotal > 0 ? (
          <span className="text-xs text-slate-400">
            {isFinalFrame ? "Round complete" : `Event ${Math.max(1, eventsShown)} / ${eventsTotal}`}
          </span>
        ) : null}
        <span className="text-sm text-slate-400">
          Next in <span className="font-bold text-cyan-300 tabular-nums">{secs}s</span>
        </span>
      </div>

      {/* Action reveal */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">You</p>
          <p className="font-bold text-xl text-slate-100">{resolveActionName(myLastAction, myStatus)}</p>
          {myLastAction?.autoSubmitted && <p className="text-xs text-slate-500 italic mt-1">auto-submitted</p>}
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">{pName(room, oppId)}</p>
          <p className="font-bold text-xl text-slate-100">{resolveActionName(opponentLastAction, opponentStatus)}</p>
          {opponentLastAction?.autoSubmitted && <p className="text-xs text-slate-500 italic mt-1">auto-submitted</p>}
        </div>
      </div>

      {/* Current event spotlight */}
      {currentMessage ? (
        <div
          key={`event-${roundIndex}-${clampedIndex}`}
          className="animate-pop-in rounded-xl border border-cyan-700/40 bg-slate-900/70 px-4 py-3 text-center"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-cyan-100">{currentMessage}</p>
        </div>
      ) : null}

      {/* Beasts on the shared stage — HP/charge animate per reveal frame */}
      <BattleStage
        room={room}
        left={{ status: myStatus, name: pName(room, viewerPlayerId), playerId: viewerPlayerId, isYou: true, label: "You" }}
        right={{ status: opponentStatus, name: pName(room, oppId), playerId: oppId ?? "", label: "Opponent" }}
        attackerId={currentStep?.attackerId}
      />

      {/* Play-by-play, accumulating as the reveal advances */}
      {revealedEvents.length > 0 ? (
        <div className="rounded-xl bg-slate-800/40 p-3">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Play-by-play</h3>
          <div className="flex flex-col gap-1">
            {revealedEvents.map((step, i) => (
              <div key={step.id} className={i === revealedEvents.length - 1 ? "animate-pop-in" : ""}>
                <LogEntry message={step.message} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Finished Screen ──────────────────────────────────────────────────────────

function FinishedScreen({ room, viewerPlayerId, onRestart, isHost }: { room: Room; viewerPlayerId: string; onRestart: () => void; isHost: boolean }) {
  const fb = room.game.frankenbeasts;
  const isDraw = fb?.isDraw;
  const winnerId = fb?.winnerId;
  const isWinner = winnerId === viewerPlayerId;
  const oppId = opponentId(room, viewerPlayerId);
  const myStatus = fb?.combatStates[viewerPlayerId];
  const opponentStatus = oppId ? fb?.combatStates[oppId] : undefined;

  return (
    <div className="relative flex flex-col items-center gap-6 overflow-hidden py-8">
      {isWinner ? <Confetti /> : null}

      {/* Result banner */}
      {isDraw ? (
        <div className="relative flex flex-col items-center gap-2">
          <HandshakeIcon className="h-16 w-16 text-slate-300" />
          <h2 className="text-2xl font-bold text-slate-200">It&apos;s a Draw!</h2>
          <p className="text-slate-400">Neither beast survived.</p>
        </div>
      ) : isWinner ? (
        <div className="relative flex flex-col items-center gap-2">
          <Trophy className="relative h-16 w-16 text-amber-300 drop-shadow-[0_0_16px_rgba(251,191,36,0.4)]" />
          <h2 className="relative text-2xl font-bold text-emerald-300">You Win!</h2>
          {myStatus && (
            <p className="text-sm text-slate-400">
              {myStatus.hp > 0 ? `${myStatus.hp} HP remaining` : "Victory by knockout!"}
            </p>
          )}
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-2">
          <SkullIcon className="h-16 w-16 text-rose-400" />
          <h2 className="text-2xl font-bold text-rose-400">You Lose!</h2>
          {opponentStatus && (
            <p className="text-sm text-slate-400">{pName(room, winnerId)} wins with {opponentStatus.hp} HP left</p>
          )}
        </div>
      )}

      {/* Final standoff on the stage — the defeated beast is greyed out */}
      {myStatus && opponentStatus ? (
        <div className="w-full">
          <BattleStage
            room={room}
            left={{ status: myStatus, name: pName(room, viewerPlayerId), playerId: viewerPlayerId, isYou: true, label: "You" }}
            right={{ status: opponentStatus, name: pName(room, oppId), playerId: oppId ?? "", label: "Opponent" }}
            leftDefeated={isDraw || !isWinner}
            rightDefeated={isDraw || isWinner}
            centerSide={isDraw ? undefined : isWinner ? "left" : "right"}
          />
        </div>
      ) : null}

      {/* Full log */}
      {fb && fb.log.length > 0 && (
        <div className="w-full max-w-md rounded-xl bg-slate-800/50 p-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Battle Log</h3>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {fb.log.map((entry) => (
              <LogEntry key={entry.id} message={entry.message} />
            ))}
          </div>
        </div>
      )}

      <HostRestartFooter isHost={isHost} onRestart={onRestart} />
    </div>
  );
}

function SpectatorView({ room }: { room: Room }) {
  const fb = room.game.frankenbeasts;
  const fighters = fighterIds(room);
  const secs = useCountdown(room.game.roundDeadlineAt);
  const [p1, p2] = fighters ?? [];
  const p1Status = p1 ? fb?.combatStates[p1] : undefined;
  const p2Status = p2 ? fb?.combatStates[p2] : undefined;
  const p1Pick = p1 ? fb?.pendingPicks[p1] : undefined;
  const p2Pick = p2 ? fb?.pendingPicks[p2] : undefined;

  // Play the reveal event-by-event so spectators see the same charge/HP beats as
  // the fighters do, then fall back to the final combat states otherwise.
  const steps = fb?.revealSteps ?? [];
  const totalSteps = steps.length;
  const clampedIndex = useStepPlayback(room.game.roundIndex, totalSteps, room.game.roundDeadlineAt);
  const isReveal = room.game.state === "fight_reveal";
  const currentStep = isReveal && totalSteps > 0 ? steps[clampedIndex] : undefined;
  const p1Display = (p1 ? currentStep?.states[p1] : undefined) ?? p1Status;
  const p2Display = (p2 ? currentStep?.states[p2] : undefined) ?? p2Status;
  const isFinished = room.game.state === "finished";

  function phaseLabel() {
    if (room.game.state === "pick_phase") return "Beasts are being assembled";
    if (room.game.state === "fight_round") return `Round ${room.game.roundIndex + 1}: fighters choosing`;
    if (room.game.state === "fight_reveal") return `Round ${room.game.roundIndex + 1}: results revealed`;
    if (room.game.state === "finished") {
      if (fb?.isDraw) return "The duel ended in a draw";
      return fb?.winnerId ? `${pName(room, fb.winnerId)} wins` : "The duel is over";
    }
    return "Waiting for the duel";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-slate-800/80 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Spectating</p>
            <h2 className="text-lg font-bold text-slate-100">{phaseLabel()}</h2>
            <p className="text-sm text-slate-400">
              {fighters ? `${pName(room, p1)} vs ${pName(room, p2)}` : "Waiting for two fighters."}
            </p>
          </div>
          {room.game.roundDeadlineAt ? (
            <div className={`text-2xl font-bold tabular-nums ${secs <= 5 ? "text-red-400" : "text-cyan-300"}`}>
              {secs}s
            </div>
          ) : null}
        </div>
      </div>

      {room.game.state === "pick_phase" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[p1, p2].map((playerId) => {
            if (!playerId) return null;
            const pick = playerId === p1 ? p1Pick : p2Pick;
            return (
              <div key={playerId} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                <p className="font-semibold text-slate-100">{pName(room, playerId)}</p>
                <p className={`mt-1 text-sm ${pick?.lockedIn ? "text-emerald-300" : "text-slate-400"}`}>
                  {pick?.lockedIn ? "Locked in" : "Choosing parts..."}
                </p>
              </div>
            );
          })}
        </div>
      ) : p1Display && p2Display ? (
        <BattleStage
          room={room}
          left={{ status: p1Display, name: pName(room, p1), playerId: p1 ?? "", label: "Fighter" }}
          right={{ status: p2Display, name: pName(room, p2), playerId: p2 ?? "", label: "Fighter" }}
          attackerId={currentStep?.attackerId}
          leftDefeated={isFinished && (fb?.isDraw || (!!fb?.winnerId && fb.winnerId !== p1))}
          rightDefeated={isFinished && (fb?.isDraw || (!!fb?.winnerId && fb.winnerId !== p2))}
          centerSide={isFinished && fb?.winnerId ? (fb.winnerId === p1 ? "left" : "right") : undefined}
        />
      ) : null}

      {fb && fb.log.length > 0 ? (
        <div className="rounded-xl bg-slate-800/40 p-3">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Battle Log</h3>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {fb.log.slice(0, 10).map((entry) => (
              <LogEntry key={entry.id} message={entry.message} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

export function FrankenBeastsGame({
  room,
  viewerPlayerId,
  isHost,
  onSubmitPick,
  onSelectAction,
  onRestart
}: FrankenBeastsGameProps) {
  const state = room.game.state;
  const fighters = fighterIds(room);
  const isSpectator = Boolean(fighters && !fighters.includes(viewerPlayerId));

  const content =
    isSpectator ? (
      <SpectatorView room={room} />
    ) : state === "pick_phase" ? (
      <PickPhase
        room={room}
        viewerPlayerId={viewerPlayerId}
        onSubmitPick={onSubmitPick}
      />
    ) : state === "fight_round" ? (
      <FightPhase
        room={room}
        viewerPlayerId={viewerPlayerId}
        onSelectAction={onSelectAction}
      />
    ) : state === "fight_reveal" ? (
      <RevealPhase room={room} viewerPlayerId={viewerPlayerId} />
    ) : state === "finished" ? (
      <FinishedScreen
        room={room}
        viewerPlayerId={viewerPlayerId}
        onRestart={onRestart}
        isHost={isHost}
      />
    ) : (
      <div className="flex items-center justify-center py-12 text-slate-400">
        Waiting to start…
      </div>
    );

  return <GameShell>{content}</GameShell>;
}
