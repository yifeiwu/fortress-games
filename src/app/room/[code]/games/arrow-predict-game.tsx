"use client";

import { useState } from "react";
import type { Direction, Room } from "@/lib/types";
import { ARROW_PHASE_DURATIONS_MS, leaderCatchScore } from "@/lib/game/plugins/arrow-game-rules";
import { playerName as resolvePlayerName } from "@/lib/game/players";
import { useAnimationClock } from "@/app/room/[code]/games/shared";
import { Confetti, GameShell } from "@/app/room/[code]/games/shared-ui";
import { DirectionArrow } from "@/app/room/[code]/games/arrow-glyphs";
import { Medal } from "@/app/room/[code]/games/award-icons";
import { Button } from "@/components/Button";

export const ARROW_KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right"
};

const DIRECTION_ICONS: Record<Direction, string> = {
  up: "↑",
  left: "←",
  down: "↓",
  right: "→"
};

const DIRECTION_LABELS: Record<Direction, string> = {
  up: "Up",
  left: "Left",
  down: "Down",
  right: "Right"
};

interface ArrowPredictGameProps {
  room: Room;
  viewerPlayerId: string;
  isHost: boolean;
  onSubmitDirection: (direction: Direction) => Promise<void>;
  onRestart: () => void;
}

function playerName(room: Room, playerId: string | undefined | null): string {
  return resolvePlayerName(room, playerId ?? undefined, "TBD");
}

function CountdownRing({ fraction, seconds, urgent }: { fraction: number; seconds: number | null; urgent: boolean }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, fraction)));
  return (
    <div className={`relative mx-auto h-32 w-32 ${urgent ? "animate-pulse" : ""}`}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={urgent ? "#fb7185" : "#38bdf8"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s linear, stroke 0.3s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`font-mono text-4xl font-bold leading-none ${urgent ? "text-accent-danger" : "text-cyan-200"}`}
          aria-hidden="true"
        >
          {seconds ?? "-"}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400" aria-hidden="true">sec</span>
        <span className="sr-only" aria-live="polite">
          {seconds !== null ? `${seconds} seconds remaining` : ""}
        </span>
      </div>
    </div>
  );
}

export function ArrowPredictGame({ room, viewerPlayerId, isHost, onSubmitDirection, onRestart }: ArrowPredictGameProps) {
  const game = room.game;
  const isIntro = game.state === "intro";
  const isRoundOpen = game.state === "round_open";
  const isReveal = game.state === "round_revealed";
  const isFinished = game.state === "finished";

  const showCountdown = isIntro || isRoundOpen;
  // Smooth, self-scoped clock so only this game re-renders as the ring drains.
  const now = useAnimationClock(showCountdown);
  const [submitting, setSubmitting] = useState(false);
  const remainingMs = showCountdown && game.roundDeadlineAt ? Math.max(0, game.roundDeadlineAt - now) : 0;
  const countdown = showCountdown && game.roundDeadlineAt ? Math.max(0, Math.ceil(remainingMs / 1000)) : null;
  const phaseDuration = ARROW_PHASE_DURATIONS_MS[game.state as keyof typeof ARROW_PHASE_DURATIONS_MS] ?? 0;
  const fraction = phaseDuration ? remainingMs / phaseDuration : 0;
  const urgent = isRoundOpen && countdown !== null && countdown <= 3;

  const currentChoices = game.choicesByRound[game.roundIndex] ?? {};
  const myCurrentChoice = currentChoices[viewerPlayerId]?.direction ?? null;
  const myHasPicked = Boolean(currentChoices[viewerPlayerId]);
  const isFinalRound = isRoundOpen && game.roundIndex === game.maxRounds - 1;

  const currentLeaderId = game.leaderPlayerId ?? null;
  const viewerIsCurrentLeader = currentLeaderId === viewerPlayerId;
  const lockedInCount = room.players.filter((p) => Boolean(currentChoices[p.id])).length;

  // During reveal and finished the just-scored round is the current roundIndex.
  const resolvedRoundIndex = isReveal || isFinished ? game.roundIndex : null;
  const resolvedChoices = resolvedRoundIndex !== null ? game.choicesByRound[resolvedRoundIndex] ?? {} : {};
  const resolvedLeaderId = resolvedRoundIndex !== null ? game.leaderPlayerId ?? null : null;
  const resolvedLeaderDirection = resolvedLeaderId ? resolvedChoices[resolvedLeaderId]?.direction ?? null : null;

  const nextLeaderId = isReveal && room.players.length ? room.players[(game.roundIndex + 1) % room.players.length]?.id ?? null : null;

  function caughtCountForLeader(): number {
    if (!resolvedLeaderDirection || !resolvedLeaderId) return 0;
    return room.players.filter((p) => p.id !== resolvedLeaderId && resolvedChoices[p.id]?.direction === resolvedLeaderDirection).length;
  }

  function gainedFor(playerId: string): number {
    if (!resolvedLeaderDirection || !resolvedLeaderId) return 0;
    if (playerId === resolvedLeaderId) {
      // Leader earns an escalating jackpot for catching several dodgers at once.
      return leaderCatchScore(caughtCountForLeader());
    }
    // Dodgers (anyone who looked a different way) score +1.
    const dir = resolvedChoices[playerId]?.direction;
    return dir && dir !== resolvedLeaderDirection ? 1 : 0;
  }

  function wasCaught(playerId: string): boolean {
    if (!resolvedLeaderDirection || playerId === resolvedLeaderId) return false;
    return resolvedChoices[playerId]?.direction === resolvedLeaderDirection;
  }

  const sortedPlayers = [...room.players].sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0));
  const topScore = sortedPlayers.length ? game.scores[sortedPlayers[0].id] ?? 0 : 0;

  const viewerGained = resolvedRoundIndex !== null ? gainedFor(viewerPlayerId) : 0;
  const viewerIsLeader = viewerPlayerId === resolvedLeaderId;

  async function submitDirection(direction: Direction) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmitDirection(direction);
    } finally {
      setSubmitting(false);
    }
  }

  function accuracyFor(playerId: string): { correct: number; attempts: number } {
    let correct = 0;
    let attempts = 0;
    if (!room.players.length) return { correct, attempts };
    for (let r = 0; r < game.maxRounds; r += 1) {
      const choices = game.choicesByRound[r];
      if (!choices) continue;
      const leaderId = room.players[r % room.players.length]?.id;
      if (!leaderId || leaderId === playerId) continue;
      const leaderDir = choices[leaderId]?.direction;
      const myDir = choices[playerId]?.direction;
      if (!leaderDir || !myDir) continue;
      attempts += 1;
      if (myDir !== leaderDir) correct += 1;
    }
    return { correct, attempts };
  }

  return (
    <GameShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-cyan-200">Acchi Muite Hoi Live Match</h2>
        <span className="rounded-full border border-cyan-700/50 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
          {isFinalRound ? "Final round" : `Round ${Math.min(game.roundIndex + 1, game.maxRounds)} / ${game.maxRounds}`}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-300">The leader points a direction to catch you. Look any other way to dodge and score.</p>

      {isIntro ? (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-xl border border-cyan-700/40 bg-slate-950/80 p-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Game starting</p>
          <h3 className="text-2xl font-bold text-cyan-100">{playerName(room, game.leaderPlayerId)} points first</h3>
          <ul className="w-full max-w-md space-y-2 text-left text-sm text-slate-300">
            <li className="flex items-start gap-3 rounded-lg border border-cyan-900/40 bg-slate-900/60 px-3 py-2">
              <span className="text-lg leading-none text-accent-success">↗</span>
              <span><span className="font-semibold text-accent-success">Dodge:</span> look any direction except the leader&apos;s to score <span className="font-semibold">+1</span>.</span>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-cyan-900/40 bg-slate-900/60 px-3 py-2">
              <span className="text-lg leading-none text-accent-danger">✕</span>
              <span><span className="font-semibold text-accent-danger">Caught:</span> match the leader&apos;s arrow and you score nothing that round.</span>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-cyan-900/40 bg-slate-900/60 px-3 py-2">
              <span className="text-lg leading-none text-cyan-200">★</span>
              <span><span className="font-semibold text-cyan-200">Lead:</span> point where the crowd looks. Catching several at once pays an escalating jackpot (2→<span className="font-semibold">+3</span>, 3→<span className="font-semibold">+6</span>).</span>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-cyan-900/40 bg-slate-900/60 px-3 py-2">
              <span className="text-lg leading-none text-slate-400">⏱</span>
              <span><span className="font-semibold text-slate-200">Don&apos;t freeze:</span> run out the timer and you&apos;re auto-caught. Everyone takes a turn leading.</span>
            </li>
          </ul>
          <CountdownRing fraction={fraction} seconds={countdown} urgent={false} />
        </div>
      ) : null}

      {isRoundOpen || isReveal ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl border border-cyan-800/40 bg-slate-900/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-2 text-sm text-slate-300">
              {isRoundOpen ? (
                <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100">
                  {lockedInCount} / {room.players.length} locked in
                </span>
              ) : (
                <span />
              )}
              <span className="rounded bg-slate-800 px-2 py-1">{isReveal ? "Reveal" : "Decision phase"}</span>
            </div>

            {isRoundOpen ? (
              <>
                <div
                  className={`mb-4 rounded-lg border px-3 py-2 text-center text-sm ${
                    viewerIsCurrentLeader
                      ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100"
                      : "border-cyan-800/50 bg-slate-950/70 text-slate-200"
                  }`}
                >
                  {viewerIsCurrentLeader ? (
                    <>
                      <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">You are the leader</span>
                      <p className="mt-1 font-semibold">Point where you think they&apos;ll look — catch several at once for a jackpot!</p>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">Leader this round</span>
                      <p className="mt-1 font-semibold text-cyan-100">{playerName(room, currentLeaderId)} is pointing — dodge them!</p>
                    </>
                  )}
                </div>
                <CountdownRing fraction={fraction} seconds={countdown} urgent={urgent} />
                <p className="mb-1 mt-3 text-center text-sm text-slate-300">
                  {viewerIsCurrentLeader ? "Pick the direction to point before the timer expires." : "Look away from the leader before the timer expires."}
                </p>
                <p className="mb-3 text-center text-xs text-slate-400">
                  {myHasPicked && myCurrentChoice ? (
                    <>
                      Locked in:{" "}
                      <span className="inline-flex items-center gap-1 font-semibold text-cyan-200">
                        {DIRECTION_LABELS[myCurrentChoice]}
                        <DirectionArrow direction={myCurrentChoice} className="h-3.5 w-3.5" />
                      </span>
                    </>
                  ) : (
                    <span className="text-accent-danger">Not locked in yet — choose a direction!</span>
                  )}
                </p>
                <div
                  className="mx-auto grid h-72 w-full max-w-sm grid-cols-3 grid-rows-3 gap-2 rounded-xl border border-cyan-900/40 bg-[radial-gradient(circle_at_center,_rgba(34,211,238,0.15),_rgba(15,23,42,0.9)_70%)] p-3"
                  role="group"
                  aria-label="Direction selector"
                >
                  {(["up", "left", "right", "down"] as Direction[]).map((direction) => {
                    const isSelected = myCurrentChoice === direction;
                    const positionClass =
                      direction === "up"
                        ? "col-start-2 row-start-1"
                        : direction === "left"
                          ? "col-start-1 row-start-2"
                          : direction === "right"
                            ? "col-start-3 row-start-2"
                            : "col-start-2 row-start-3";
                    return (
                      <button
                        key={direction}
                        type="button"
                        aria-label={DIRECTION_LABELS[direction]}
                        aria-pressed={isSelected}
                        className={`${positionClass} flex flex-col items-center justify-center gap-1 rounded-lg border text-center font-semibold transition ${
                          isSelected ? "border-accent bg-accent text-slate-950" : "border-cyan-800/60 bg-slate-900/90 text-cyan-100 hover:border-accent"
                        }`}
                        onClick={() => submitDirection(direction)}
                      >
                        <DirectionArrow direction={direction} className="h-9 w-9" />
                        <span className="text-[10px] uppercase tracking-wide">{DIRECTION_LABELS[direction]}</span>
                      </button>
                    );
                  })}
                  <div className="col-start-2 row-start-2 flex items-center justify-center rounded-lg border border-cyan-900/40 bg-slate-950/80 text-center text-[10px] uppercase tracking-wide text-slate-400">
                    Tap or use arrow keys
                  </div>
                </div>

              </>
            ) : (
              <div className="flex flex-col items-center text-center" key={`reveal-${game.roundIndex}`}>
                <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-400">
                  {playerName(room, resolvedLeaderId)} pointed
                </p>
                <span className="animate-arrow-reveal mt-1 flex h-20 w-20 items-center justify-center text-cyan-200">
                  {resolvedLeaderDirection ? (
                    <DirectionArrow direction={resolvedLeaderDirection} className="h-full w-full" />
                  ) : (
                    <span className="font-mono text-6xl font-bold leading-none">-</span>
                  )}
                </span>

                <p className="mt-4 text-[10px] uppercase tracking-[0.25em] text-slate-500">Everyone looks</p>
                <div className="mt-2 flex w-full flex-wrap items-start justify-center gap-2">
                  {room.players.map((player) => {
                    const dir = resolvedChoices[player.id]?.direction;
                    const isLeader = player.id === resolvedLeaderId;
                    const caught = wasCaught(player.id);
                    const isYou = player.id === viewerPlayerId;
                    const tone = isLeader
                      ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-200"
                      : caught
                        ? "border-accent-danger/60 bg-accent-danger/15 text-accent-danger"
                        : "border-accent-success/50 bg-accent-success/15 text-accent-success";
                    return (
                      <div
                        key={player.id}
                        className={`animate-arrow-reveal flex w-16 flex-col items-center gap-1 rounded-lg border px-1 py-2 ${tone}`}
                      >
                        <span className="flex h-8 w-8 items-center justify-center">
                          {dir ? (
                            <DirectionArrow direction={dir} className="h-full w-full" />
                          ) : (
                            <span className="font-mono text-3xl font-bold leading-none">-</span>
                          )}
                        </span>
                        <span className="max-w-full truncate text-[10px] text-slate-300">
                          {isYou ? "You" : player.name}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-wide">
                          {isLeader ? "Leader" : caught ? "Caught" : "Dodged"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div
                  className={`mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold ${
                    viewerIsLeader
                      ? "animate-flash-success bg-cyan-500/15 text-cyan-200"
                      : viewerGained > 0
                        ? "animate-flash-success bg-accent-success/20 text-accent-success"
                        : "animate-flash-danger bg-accent-danger/15 text-accent-danger"
                  }`}
                >
                  {viewerIsLeader
                    ? `You pointed ${resolvedLeaderDirection ? DIRECTION_ICONS[resolvedLeaderDirection] : ""} — caught ${caughtCountForLeader()} (+${viewerGained}${caughtCountForLeader() >= 2 ? " jackpot!" : ""})`
                    : viewerGained > 0
                      ? "Dodged! You read the leader. +1"
                      : "Caught! You looked the leader's way."}
                </div>
                {nextLeaderId ? (
                  <div className="mt-4 rounded-lg border border-cyan-700/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
                    Next leader: <span className="font-semibold">{playerName(room, nextLeaderId)}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-cyan-800/40 bg-slate-900/70 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-200">Scoreboard</h3>
            <div className="mt-3 space-y-2 text-sm">
              {sortedPlayers.map((player) => {
                const gained = isReveal ? gainedFor(player.id) : 0;
                const isYou = player.id === viewerPlayerId;
                const isLeaderRow = player.id === game.leaderPlayerId;
                return (
                  <div key={player.id} className="flex items-center justify-between rounded bg-slate-950/70 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 pr-3">
                      <span className="truncate">
                        {player.name}
                        {isYou ? " (You)" : ""}
                        {player.isHost ? " (Host)" : ""}
                        {player.isBot ? " [Bot]" : ""}
                      </span>
                      {isLeaderRow ? (
                        <span className="shrink-0 rounded-full border border-cyan-500/50 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                          Leader
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-2 text-right text-xs text-slate-300">
                      {isReveal && gained > 0 ? (
                        <span key={`gain-${game.roundIndex}`} className="animate-pop-in rounded bg-accent/20 px-1.5 py-0.5 font-semibold text-accent">
                          +{gained}
                        </span>
                      ) : null}
                      {game.scores[player.id] ?? 0} pts
                    </span>
                  </div>
                );
              })}
            </div>
            {isReveal ? (
              <div className="mt-4">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Round picks</h4>
                <div className="mt-2 space-y-1 text-xs">
                  {room.players.map((player) => {
                    const dir = resolvedChoices[player.id]?.direction;
                    const isLeader = player.id === resolvedLeaderId;
                    const gained = gainedFor(player.id);
                    return (
                      <div key={player.id} className="flex items-center justify-between rounded border border-cyan-900/40 bg-slate-950/70 px-2 py-1">
                        <span className="truncate pr-2">
                          {player.name}
                          {isLeader ? " (Leader)" : ""}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="flex h-3.5 w-3.5 items-center justify-center text-slate-200" aria-hidden="true">
                            {dir ? <DirectionArrow direction={dir} className="h-full w-full" /> : "-"}
                          </span>
                          <span className={isLeader ? "text-cyan-200" : gained > 0 ? "text-accent-success" : "text-accent-danger"}>
                            {isLeader ? "led" : gained > 0 ? "dodged" : "caught"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isFinished ? (
        <div className="mt-4 space-y-4">
          <div className="relative overflow-hidden rounded-xl border border-cyan-700/40 bg-slate-950/80 p-5 text-center">
            <Confetti />
            <p className="relative text-xs uppercase tracking-[0.3em] text-cyan-300">Game over</p>
            <h3 className="relative mt-1 text-2xl font-bold text-cyan-100">Final Leaderboard</h3>
            {sortedPlayers.length ? (
              <p className="relative mt-1 text-sm text-slate-300">
                Winner: <span className="font-semibold text-accent">{sortedPlayers[0].name}</span> with {topScore} pts
              </p>
            ) : null}
          </div>

          {sortedPlayers.length >= 3 ? (
            <div className="grid grid-cols-3 items-end gap-3">
              {[1, 0, 2].map((rank) => {
                const player = sortedPlayers[rank];
                if (!player) return <div key={rank} />;
                const heights = ["h-28", "h-20", "h-16"];
                return (
                  <div key={player.id} className="flex flex-col items-center">
                    <Medal rank={rank} className="h-8 w-8" />
                    <span className="max-w-full truncate text-xs text-slate-200">{player.name}</span>
                    <span className="text-[11px] text-slate-400">{game.scores[player.id] ?? 0} pts</span>
                    <div
                      className={`mt-1 w-full rounded-t-md ${heights[rank]} ${
                        rank === 0 ? "bg-accent/40" : rank === 1 ? "bg-cyan-600/40" : "bg-slate-600/40"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="rounded-xl border border-cyan-800/40 bg-slate-900/70 p-4">
            <div className="space-y-2 text-sm">
              {sortedPlayers.map((player, index) => {
                const { correct, attempts } = accuracyFor(player.id);
                const accuracy = attempts ? Math.round((correct / attempts) * 100) : null;
                const isYou = player.id === viewerPlayerId;
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between rounded px-3 py-2 ${
                      index === 0 ? "border border-accent/50 bg-accent/10" : "bg-slate-950/70"
                    }`}
                  >
                    <span className="min-w-0 truncate pr-3">
                      <span className="mr-2 text-slate-400">#{index + 1}</span>
                      {player.name}
                      {isYou ? " (You)" : ""}
                      {player.isHost ? " (Host)" : ""}
                      {player.isBot ? " [Bot]" : ""}
                    </span>
                    <span className="flex items-center gap-3 text-right text-xs">
                      <span className="text-slate-500">{accuracy !== null ? `${accuracy}% dodged` : "-"}</span>
                      <span className="text-slate-300">{game.scores[player.id] ?? 0} pts</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {isHost ? (
            <Button variant="success" className="w-full" onClick={onRestart}>
              Restart game
            </Button>
          ) : (
            <p className="text-center text-sm text-slate-400">Waiting for the host to restart the game.</p>
          )}
        </div>
      ) : null}
    </GameShell>
  );
}
