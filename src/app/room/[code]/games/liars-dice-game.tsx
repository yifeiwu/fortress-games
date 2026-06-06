"use client";

import { useEffect, useMemo, useState } from "react";
import type { LiarsDicePlayerState, Room } from "@/lib/types";
import {
  DIE_FACES,
  LIARS_DICE_PHASE_DURATIONS_MS,
  countFace,
  isHigherBid,
  minLegalRaise,
  totalDiceInPlay
} from "@/lib/game/plugins/liars-dice-rules";
import { playerName as resolvePlayerName } from "@/lib/game/players";
import { useAnimationClock, useNumberChange } from "@/app/room/[code]/games/shared";
import { Confetti, GameShell, HostRestartFooter } from "@/app/room/[code]/games/shared-ui";
import { DiePips, HiddenCup } from "@/app/room/[code]/games/dice-faces";

interface LiarsDiceGameProps {
  room: Room;
  viewerPlayerId: string;
  isHost: boolean;
  onSubmitBid: (quantity: number, face: number) => Promise<void>;
  onCallLiar: () => Promise<void>;
  onRestart: () => void;
}

function name(room: Room, playerId: string | undefined | null): string {
  return resolvePlayerName(room, playerId ?? undefined, "Player");
}

/** Group a hand into unique faces with their counts, ordered by descending count. */
function groupDiceByCount(dice: number[]): { face: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const die of dice) counts.set(die, (counts.get(die) ?? 0) + 1);
  return [...counts.entries()]
    .map(([face, count]) => ({ face, count }))
    .sort((a, b) => b.count - a.count || b.face - a.face);
}

const DIE_SIZES = {
  lg: { box: "h-[4.5rem] w-[4.5rem] rounded-lg", badge: "-right-2 -top-2 h-6 min-w-6 text-xs" },
  sm: { box: "h-10 w-10 rounded-md", badge: "-right-1.5 -top-1.5 h-5 min-w-5 text-[10px]" }
} as const;

/** A single die: a pip face when `value` is known, otherwise a hidden cup. An
 * optional `count` collapses duplicates into one die with a ×N badge. */
function Die({
  value,
  highlight,
  hidden,
  count,
  shake,
  size = "lg"
}: {
  value?: number;
  highlight?: boolean;
  hidden?: boolean;
  count?: number;
  shake?: boolean;
  size?: keyof typeof DIE_SIZES;
}) {
  const s = DIE_SIZES[size];
  const badge =
    count !== undefined && count > 1 ? (
      <span
        className={`absolute flex items-center justify-center rounded-full border border-amber-400/70 bg-slate-950 px-1 font-bold text-amber-200 ${s.badge}`}
      >
        ×{count}
      </span>
    ) : null;

  if (hidden || value === undefined) {
    return (
      <span
        className={`relative inline-flex items-center justify-center border border-amber-900/50 bg-slate-900/80 ${s.box} ${
          shake ? "animate-dice-shake" : ""
        }`}
      >
        <HiddenCup className="h-3/5 w-3/5" />
        {badge}
      </span>
    );
  }
  return (
    <span
      className={`relative inline-flex items-center justify-center border leading-none ${s.box} ${
        highlight
          ? "border-amber-400 bg-amber-400/25 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.45)]"
          : "border-amber-900/50 bg-slate-900/80 text-amber-100"
      }`}
      aria-label={count && count > 1 ? `${count} of ${value}` : `${value}`}
    >
      <DiePips value={value} className="h-3/4 w-3/4" />
      {badge}
    </span>
  );
}

function CountdownBar({ fraction, urgent }: { fraction: number; urgent: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full ${urgent ? "bg-rose-400" : "bg-amber-400"}`}
        style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, transition: "width 0.25s linear" }}
      />
    </div>
  );
}

function PlayerSeat({
  room,
  player,
  viewerPlayerId,
  isActive,
  revealDice,
  highlightFace,
  rolling
}: {
  room: Room;
  player: LiarsDicePlayerState;
  viewerPlayerId: string;
  isActive: boolean;
  revealDice: number[] | null;
  highlightFace?: number | null;
  rolling?: boolean;
}) {
  const isYou = player.playerId === viewerPlayerId;
  const diceChange = useNumberChange(player.diceCount);
  const showFaces = revealDice ?? (isYou ? player.dice : null);

  return (
    <div
      className={`relative flex flex-col gap-2 rounded-xl border px-3 py-2 transition ${
        player.eliminated
          ? "border-slate-800 bg-slate-950/60 opacity-50"
          : isActive
            ? "border-amber-400/80 bg-amber-500/10 shadow-[0_0_24px_rgba(251,191,36,0.25)]"
            : "border-amber-900/40 bg-slate-950/70"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-sm">
          <span className="truncate font-semibold text-amber-100">
            {name(room, player.playerId)}
            {isYou ? " (You)" : ""}
          </span>
          {isActive ? (
            <span className="shrink-0 rounded-full border border-amber-400/60 bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">
              Turn
            </span>
          ) : null}
        </span>
        <span className="relative flex shrink-0 items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-xs font-semibold text-amber-200">
          🎲 ×{player.diceCount}
          {diceChange && diceChange.delta < 0 ? (
            <span key={diceChange.key} className="animate-pop-in absolute -right-1 -top-3 text-[10px] font-bold text-rose-400">
              −1
            </span>
          ) : null}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {player.eliminated ? (
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Knocked out</span>
        ) : showFaces ? (
          groupDiceByCount(showFaces).map(({ face, count }) => (
            <Die key={face} value={face} count={count} highlight={highlightFace != null && face === highlightFace} />
          ))
        ) : (
          <Die hidden count={player.diceCount} shake={rolling} />
        )}
      </div>
    </div>
  );
}

export function LiarsDiceGame({ room, viewerPlayerId, isHost, onSubmitBid, onCallLiar, onRestart }: LiarsDiceGameProps) {
  const game = room.game;
  const liars = game.liarsDice;
  const phase = game.state;
  const isRolling = phase === "dice_roll";
  const isBidding = phase === "bidding";
  const isReveal = phase === "dice_reveal";
  const isFinished = phase === "finished";

  const showClock = isRolling || isBidding;
  const now = useAnimationClock(showClock);
  const remainingMs = showClock && game.roundDeadlineAt ? Math.max(0, game.roundDeadlineAt - now) : 0;
  const seconds = showClock && game.roundDeadlineAt ? Math.ceil(remainingMs / 1000) : null;
  const phaseDuration = LIARS_DICE_PHASE_DURATIONS_MS[phase as keyof typeof LIARS_DICE_PHASE_DURATIONS_MS] ?? 0;
  const fraction = phaseDuration ? remainingMs / phaseDuration : 0;
  const urgent = isBidding && seconds !== null && seconds <= 5;

  const players = useMemo(() => liars?.players ?? [], [liars?.players]);
  const totalDice = totalDiceInPlay(players);
  const currentBid = liars?.currentBid;
  const activePlayerId = liars?.activePlayerId;
  const isMyTurn = isBidding && activePlayerId === viewerPlayerId;
  const reveal = liars?.reveal;

  const myDice = useMemo(
    () => players.find((p) => p.playerId === viewerPlayerId)?.dice ?? [],
    [players, viewerPlayerId]
  );

  const [quantity, setQuantity] = useState(1);
  const [face, setFace] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  // Default the controls to the smallest legal raise whenever the standing bid
  // changes (or it becomes your turn), so a single tap is always valid.
  useEffect(() => {
    if (!isMyTurn) return;
    if (currentBid) {
      const raise = minLegalRaise(currentBid, totalDice);
      if (raise) {
        setQuantity(raise.quantity);
        setFace(raise.face);
      }
    } else {
      setQuantity(1);
      setFace(2);
    }
  }, [isMyTurn, currentBid?.quantity, currentBid?.face, totalDice, currentBid]);

  const myHoldOfFace = myDice.filter((d) => d === face).length;
  const proposedBid = { quantity, face };
  const bidIsLegal =
    quantity >= 1 &&
    quantity <= totalDice &&
    face >= 1 &&
    face <= DIE_FACES &&
    (!currentBid || isHigherBid(proposedBid, currentBid));

  const sortedSeats = useMemo(() => {
    const order = new Map(room.players.map((player, index) => [player.id, index]));
    return [...players].sort((a, b) => (order.get(a.playerId) ?? 0) - (order.get(b.playerId) ?? 0));
  }, [players, room.players]);

  async function submitBid() {
    if (submitting || !bidIsLegal) return;
    setSubmitting(true);
    try {
      await onSubmitBid(quantity, face);
    } finally {
      setSubmitting(false);
    }
  }

  async function callLiar() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onCallLiar();
    } finally {
      setSubmitting(false);
    }
  }

  const winner = liars?.winnerPlayerId;

  return (
    <GameShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-amber-200">Bluffer&apos;s Hoard</h2>
        <span className="rounded-full border border-amber-700/50 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
          {isFinished ? "Match over" : `Round ${game.roundIndex + 1} · ${totalDice} dice in play`}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-300">
        Bid how many of a face are on the whole table — no wilds. Raise the claim or call{" "}
        <span className="font-semibold text-amber-200">Liar!</span> The loser of each showdown drops a die.
      </p>

      {/* Seeded-fairness badge: the hash is published while cups are hidden. */}
      {game.rngByRound[game.roundIndex]?.seedHash ? (
        <p className="mt-2 break-all font-mono text-[10px] text-slate-500">
          seed&nbsp;{game.rngByRound[game.roundIndex]?.revealedAt ? "revealed" : "hash"}:{" "}
          {game.rngByRound[game.roundIndex]?.seedPlain ?? game.rngByRound[game.roundIndex]?.seedHash}
        </p>
      ) : null}

      {showClock ? (
        <div className="mt-3 flex items-center gap-3">
          <CountdownBar fraction={fraction} urgent={urgent} />
          <span className={`w-10 shrink-0 text-right font-mono text-sm ${urgent ? "text-rose-300" : "text-amber-200"}`}>
            {seconds ?? "-"}s
          </span>
        </div>
      ) : null}

      {!isFinished ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.1fr]">
          {/* Left: the table of seats with live dice counts. */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">The table</h3>
            {sortedSeats.map((player) => (
              <PlayerSeat
                key={player.playerId}
                room={room}
                player={player}
                viewerPlayerId={viewerPlayerId}
                isActive={!isReveal && player.playerId === activePlayerId}
                revealDice={isReveal ? reveal?.dice[player.playerId] ?? null : null}
                highlightFace={isReveal ? reveal?.bid.face ?? null : currentBid?.face ?? null}
                rolling={isRolling}
              />
            ))}
          </div>

          {/* Right: the current bid + your controls, or the showdown result. */}
          <div className="rounded-xl border border-amber-800/40 bg-slate-900/70 p-4">
            {isReveal && reveal ? (
              <div className="space-y-3 text-center" key={`reveal-${game.roundIndex}`}>
                <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300">Showdown</p>
                <p className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-sm text-slate-200">
                  <span className="font-semibold text-amber-100">{name(room, reveal.callerPlayerId)}</span> called{" "}
                  <span className="font-semibold">{name(room, reveal.bid.playerId)}</span>&apos;s bid of
                  <span className="inline-flex items-center gap-1 font-semibold">
                    {reveal.bid.quantity} × <Die value={reveal.bid.face} size="sm" />
                  </span>
                </p>
                <div className="rounded-lg border border-amber-900/40 bg-slate-950/70 px-3 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-bold text-amber-200">{reveal.actualCount}</span>
                    <span className="text-xl text-slate-500">×</span>
                    <Die value={reveal.bid.face} size="sm" highlight />
                    <span className="text-sm text-slate-400">on the table</span>
                  </div>
                  <p className={`mt-2 text-sm font-semibold ${reveal.bidHeld ? "text-emerald-300" : "text-rose-300"}`}>
                    {reveal.bidHeld ? "The bid held — the caller was wrong." : "Bluff caught — the bid fell short."}
                  </p>
                </div>
                <p className="text-sm text-slate-300">
                  <span className="font-semibold text-rose-300">{name(room, reveal.loserPlayerId)}</span> loses a die
                  {reveal.loserEliminated ? " and is knocked out!" : "."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Current bid</h3>
                  {currentBid ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-3xl font-bold text-amber-100">{currentBid.quantity}</span>
                      <span className="text-xl text-slate-500">×</span>
                      <Die value={currentBid.face} size="sm" />
                      <span className="text-xs font-normal text-slate-400">by {name(room, currentBid.playerId)}</span>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-slate-400">No bid yet — the opener must place the first claim.</p>
                  )}
                </div>

                {isRolling ? (
                  <p className="rounded-lg border border-amber-900/40 bg-slate-950/60 px-3 py-4 text-center text-sm text-amber-200">
                    Shaking the cups…
                  </p>
                ) : isMyTurn ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Your move</p>
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">Quantity</span>
                        <div className="mt-1 flex items-center gap-1">
                          <button
                            type="button"
                            className="h-10 w-10 rounded-md border border-amber-800/60 bg-slate-900 text-2xl text-amber-200 hover:border-amber-400 disabled:opacity-40"
                            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                            disabled={quantity <= 1}
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="w-10 text-center font-mono text-2xl text-amber-100">{quantity}</span>
                          <button
                            type="button"
                            className="h-10 w-10 rounded-md border border-amber-800/60 bg-slate-900 text-2xl text-amber-200 hover:border-amber-400 disabled:opacity-40"
                            onClick={() => setQuantity((q) => Math.min(totalDice, q + 1))}
                            disabled={quantity >= totalDice}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">Face</span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {Array.from({ length: DIE_FACES }, (_, i) => i + 1).map((f) => (
                            <button
                              key={f}
                              type="button"
                              aria-pressed={face === f}
                              className={`flex h-12 w-12 items-center justify-center rounded-md border leading-none ${
                                face === f
                                  ? "border-amber-400 bg-amber-400/20 text-amber-100"
                                  : "border-amber-900/50 bg-slate-900 text-amber-200 hover:border-amber-400"
                              }`}
                              onClick={() => setFace(f)}
                            >
                              <DiePips value={f} className="h-8 w-8" />
                            </button>
                          ))}
                        </div>
                        <span className="mt-1.5 text-[11px] text-slate-400">
                          You hold <span className="font-semibold text-amber-200">{myHoldOfFace}</span> of these
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={submitBid}
                        disabled={!bidIsLegal || submitting}
                      >
                        Place bid
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-lg border border-rose-500/60 bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={callLiar}
                        disabled={!currentBid || submitting}
                      >
                        Call Liar!
                      </button>
                    </div>
                    {!bidIsLegal ? (
                      <p className="text-center text-[11px] text-slate-500">
                        A raise must increase the quantity, or keep it and raise the face.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="rounded-lg border border-amber-900/40 bg-slate-950/60 px-3 py-4 text-center text-sm text-slate-300">
                    Waiting for <span className="font-semibold text-amber-200">{name(room, activePlayerId)}</span> to act…
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {isFinished ? (
        <div className="mt-4 space-y-4">
          <div className="relative overflow-hidden rounded-xl border border-amber-700/40 bg-slate-950/80 p-5 text-center">
            <Confetti />
            <p className="relative text-xs uppercase tracking-[0.3em] text-amber-300">Match over</p>
            <h3 className="relative mt-1 text-2xl font-bold text-amber-100">
              {winner ? `${name(room, winner)} wins the hoard!` : "Game over"}
            </h3>
            <p className="relative mt-1 text-sm text-slate-300">Last bluffer with dice standing takes it all.</p>
          </div>
          <div className="rounded-xl border border-amber-800/40 bg-slate-900/70 p-4">
            <div className="space-y-2 text-sm">
              {sortedSeats.map((player) => (
                <div
                  key={player.playerId}
                  className={`flex items-center justify-between rounded px-3 py-2 ${
                    player.playerId === winner ? "border border-amber-400/50 bg-amber-400/10" : "bg-slate-950/70"
                  }`}
                >
                  <span className="min-w-0 truncate pr-3 text-slate-200">
                    {name(room, player.playerId)}
                    {player.playerId === viewerPlayerId ? " (You)" : ""}
                  </span>
                  <span className="text-xs text-slate-300">
                    {player.eliminated ? "knocked out" : `${player.diceCount} dice left`}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center">
            <HostRestartFooter isHost={isHost} onRestart={onRestart} label="Play Again" />
          </div>
        </div>
      ) : null}
    </GameShell>
  );
}
