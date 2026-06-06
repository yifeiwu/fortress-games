"use client";

import "./tarot-game.css";
import { CSSProperties, FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import {
  getTarotCard,
  getTarotShortName,
  TAROT_POSITION_MEANINGS
} from "@/lib/game/plugins/tarot-data";
import { buildSynthesis } from "@/lib/game/plugins/tarot-insights";
import { playerName } from "@/lib/game/players";
import type { Room, TarotDrawnCard } from "@/lib/types";
import { TarotArtwork, TarotCardBackEmblem } from "./tarot-glyphs";

interface TarotGameProps {
  room: Room;
  viewerPlayerId: string;
  isHost: boolean;
  onSubmitSeeds: (seekerName: string, question: string) => Promise<void>;
  onFlip: () => Promise<void>;
  onRestart: () => void;
}

const EXAMPLE_QUESTIONS = [
  "Where is my love life heading?",
  "How can I move forward in my work?",
  "What should I do for my health?",
  "What lies ahead for my finances?"
];

const QUESTION_MAX = 200;

/** Shared press + keyboard-focus affordances for the tarot buttons. */
const INTERACTIVE =
  "transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

function positionMeaning(positionLabel: string): string | undefined {
  return TAROT_POSITION_MEANINGS[positionLabel as keyof typeof TAROT_POSITION_MEANINGS];
}

/** A one-line, screen-reader / clipboard friendly summary of a drawn card. */
function cardSummary(card: TarotDrawnCard): string {
  const meta = getTarotCard(card.cardId);
  if (!meta) return "";
  const orientation = card.reversed ? "reversed" : "upright";
  return `${card.positionLabel}: ${meta.name}, ${orientation}.`;
}

function TarotShell({ children }: { children: ReactNode }) {
  return (
    <div className="lg:col-span-3">
      {/* Animated gradient border wrapper. */}
      <div className="rounded-2xl bg-gradient-to-r from-fuchsia-500/50 via-indigo-500/40 to-violet-500/50 bg-[length:200%_200%] p-px animate-border-shift">
        <div className="relative overflow-hidden rounded-2xl border border-fuchsia-900/30 bg-slate-950/80 p-6 backdrop-blur">
          {/* Twinkling starfield. */}
          <div className="tarot-starfield pointer-events-none absolute inset-0" aria-hidden />
          {/* Candle-glow reading table backdrop (flickers like candlelight). */}
          <div
            className="pointer-events-none absolute inset-x-0 -top-24 h-64 animate-candle-flicker bg-[radial-gradient(60%_100%_at_50%_0%,rgba(251,191,36,0.18),transparent_70%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_120%,rgba(168,85,247,0.16),transparent_60%)]"
            aria-hidden
          />
          {/* Drifting arcane mist (two parallax layers) + edge vignette. */}
          <div className="tarot-fog" aria-hidden />
          <div className="tarot-fog tarot-fog--slow" aria-hidden />
          {/* Roving candlelight + a slow sweeping light shaft. */}
          <div className="tarot-roving-light" aria-hidden />
          <div className="tarot-light-shaft" aria-hidden />
          <div className="tarot-vignette" aria-hidden />
          <div className="relative">
            <div className="mb-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-300/70">Fortune&apos;s Veil</p>
              <h2 className="tarot-chromatic mt-1 bg-gradient-to-r from-fuchsia-300 via-fuchsia-200 to-violet-300 bg-clip-text text-2xl font-bold text-transparent">
                Tarot Reading
              </h2>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardBackFace({ label }: { label: string }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-indigo-500/30 bg-[repeating-linear-gradient(45deg,rgba(99,102,241,0.18)_0,rgba(99,102,241,0.18)_8px,rgba(15,23,42,0.6)_8px,rgba(15,23,42,0.6)_16px)] p-4 text-center">
      {/* Sheen sweeping across the card back while it waits to be flipped. */}
      <span
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-card-sheen bg-gradient-to-r from-transparent via-white/15 to-transparent"
        aria-hidden
      />
      {/* Ornate celestial emblem in place of an emoji glyph. */}
      <span className="relative flex h-12 w-12 items-center justify-center text-indigo-200/70" aria-hidden>
        <TarotCardBackEmblem className="h-full w-full" />
      </span>
      <span className="relative text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200/70">{label}</span>
    </div>
  );
}

function CardFrontFace({ card, active }: { card: TarotDrawnCard; active: boolean }) {
  const meta = getTarotCard(card.cardId);
  if (!meta) return null;
  const orientation = card.reversed ? "reversed" : "upright";
  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-fuchsia-500/40 bg-gradient-to-b from-slate-900 to-indigo-950/70 p-2 shadow-[0_0_24px_rgba(217,70,239,0.15)] ${
        active ? "tarot-chromatic-flash" : ""
      }`}
      aria-label={`${card.positionLabel}: ${meta.name}, ${orientation}`}
    >
      {/* Drifting sheen + a one-shot glow/ring burst the moment the card lands. */}
      <span className="tarot-front-sheen" aria-hidden />
      {active ? <span className="tarot-reveal-burst" aria-hidden /> : null}
      {active ? <span className="tarot-reveal-ring" aria-hidden /> : null}
      {/* Name + numeral live inside the SVG, so a reversed card flips the whole
          composition — lettering included — into a true upside-down reading. */}
      <TarotArtwork
        cardId={card.cardId}
        name={getTarotShortName(card.cardId)}
        numeral={meta.numeral}
        className={`relative z-10 h-full w-auto max-w-full text-fuchsia-100 drop-shadow-[0_0_22px_rgba(217,70,239,0.36)] ${
          card.reversed ? "rotate-180" : ""
        }`}
      />
    </div>
  );
}

/** Centered deck of card backs performing a two-handed riffle + cut shuffle. */
function ShuffleDeck() {
  const deckCards = [0, 1, 2, 3, 4, 5, 6, 7];
  const sparks = [-40, -16, 6, 22, 44];
  return (
    <div className="tarot-shuffle-stage">
      <span className="tarot-table-shadow" aria-hidden />
      <div className="tarot-shuffle-pile">
        {deckCards.map((i) => (
          <div
            key={i}
            className="tarot-shuffle-card"
            style={
              {
                // Alternate hands; a negative delay offsets each card so the
                // halves zipper back together in a cascade rather than as one block.
                "--dir": i % 2 === 0 ? 1 : -1,
                animationDelay: `${i * -70}ms`,
                zIndex: deckCards.length - i
              } as CSSProperties
            }
          >
            <CardBackFace label="" />
          </div>
        ))}
      </div>
      {sparks.map((x, i) => (
        <span
          key={x}
          className="tarot-spark"
          style={{ "--x": x, animationDelay: `${i * 320}ms` } as CSSProperties}
          aria-hidden
        />
      ))}
    </div>
  );
}

/**
 * A 3D flip slot: shows the card back until `flipped`, then rotates to the face.
 * The two faces are stacked in a single fixed-height grid cell so every card is
 * exactly the same size; a long interpretation scrolls within the face rather
 * than resizing the card. When `onFlip` is provided and this is the next card,
 * the whole slot becomes a button you can click.
 */
function FlipCard({
  card,
  flipped,
  isNext,
  onFlip,
  busy
}: {
  card: TarotDrawnCard;
  flipped: boolean;
  isNext: boolean;
  onFlip?: () => void;
  busy?: boolean;
}) {
  const highlight = isNext && !flipped;
  const interactive = highlight && !!onFlip;
  // Replay the elaborate flip keyframe only on a *fresh* reveal — a card that is
  // already face-up when you join/refresh should render statically at 180°.
  const [animateFlip, setAnimateFlip] = useState(false);
  const wasFlipped = useRef(flipped);
  useEffect(() => {
    if (flipped && !wasFlipped.current) {
      setAnimateFlip(true);
      const done = window.setTimeout(() => setAnimateFlip(false), 1300);
      wasFlipped.current = flipped;
      return () => window.clearTimeout(done);
    }
    wasFlipped.current = flipped;
    return undefined;
  }, [flipped]);

  const slotClass = `tarot-card-slot w-full rounded-xl ${
    highlight ? "animate-next-card-pulse" : ""
  }`;
  const faces = (
    <div className="tarot-flip-scene h-72 w-full">
      <span className={`tarot-flip-shadow ${animateFlip ? "tarot-flip-shadow--flipping" : ""}`} aria-hidden />
      <div
        className={`tarot-flip-card ${flipped ? "tarot-flip-card--flipped" : ""} ${
          animateFlip ? "tarot-flip-card--flipping" : ""
        }`}
      >
        <div className="tarot-flip-face">
          <CardBackFace label={card.positionLabel} />
        </div>
        <div className="tarot-flip-face tarot-flip-face--front">
          <CardFrontFace card={card} active={flipped} />
        </div>
      </div>
    </div>
  );

  // Ambient ground shadow that sways with the room's moving candlelight.
  const cast = <span className="tarot-card-cast" aria-hidden />;

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onFlip}
        disabled={busy}
        aria-label={`Reveal the ${card.positionLabel} card`}
        className={`${slotClass} block cursor-pointer appearance-none border-0 bg-transparent p-0 text-left disabled:cursor-wait ${INTERACTIVE}`}
      >
        {cast}
        {faces}
      </button>
    );
  }

  return (
    <div className={slotClass}>
      {cast}
      {faces}
    </div>
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  }
}

export function TarotGame({ room, viewerPlayerId, isHost, onSubmitSeeds, onFlip, onRestart }: TarotGameProps) {
  const tarot = room.game.tarot;
  const state = room.game.state;
  const myName = playerName(room, viewerPlayerId);

  const [seekerName, setSeekerName] = useState(myName);
  const [question, setQuestion] = useState("");
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);
  // Shuffle/deal intro that plays once when a fresh reading begins. Initialized
  // eagerly so a freshly-dealt spread doesn't flash before the effect runs.
  const [introPhase, setIntroPhase] = useState<"shuffle" | "deal" | "ready">(() =>
    state === "tarot_reading" && (tarot?.revealedCount ?? 0) === 0 ? "shuffle" : "ready"
  );

  // Keep the name field seeded with the viewer's username until they edit it.
  useEffect(() => {
    setSeekerName((current) => (current ? current : myName));
  }, [myName]);

  const introQuestion = tarot?.question;
  const introRevealed = tarot?.revealedCount ?? 0;
  useEffect(() => {
    if (state !== "tarot_reading") return undefined;
    // Joining/refreshing mid-reading shouldn't replay the deal.
    if (introRevealed > 0) {
      setIntroPhase("ready");
      return undefined;
    }
    setIntroPhase("shuffle");
    // Two full riffle cycles (~0.95s each) before the deck deals out.
    const toDeal = window.setTimeout(() => setIntroPhase("deal"), 1900);
    const toReady = window.setTimeout(() => setIntroPhase("ready"), 3150);
    return () => {
      window.clearTimeout(toDeal);
      window.clearTimeout(toReady);
    };
  }, [state, introQuestion, introRevealed]);

  async function beginReading() {
    const trimmedName = seekerName.trim();
    const trimmedQuestion = question.trim();
    if (!trimmedName || !trimmedQuestion) return;
    await onSubmitSeeds(trimmedName, trimmedQuestion);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await beginReading();
  }

  function handleQuestionKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void beginReading();
    }
  }

  // ── Setup: ask name + question (the RNG seeds) ──────────────────────────────
  if (state === "tarot_setup" || !tarot) {
    return (
      <TarotShell>
        {isHost ? (
          <form className="mx-auto flex max-w-md flex-col gap-4" onSubmit={handleSubmit}>
            <div className="tarot-sigil mx-auto" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <p className="text-center text-sm text-slate-300">
              The Reader shuffles the deck. Your name and your question guide the cards that surface — the same
              question always draws the same fate.
            </p>
            <label className="block text-sm font-medium text-slate-200">
              Your name
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
                value={seekerName}
                onChange={(e) => setSeekerName(e.target.value)}
                maxLength={40}
                placeholder="Your name"
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              <span className="flex items-baseline justify-between">
                Your question
                <span className="text-xs font-normal text-slate-500">
                  {question.length}/{QUESTION_MAX}
                </span>
              </span>
              <textarea
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleQuestionKeyDown}
                maxLength={QUESTION_MAX}
                rows={3}
                placeholder="What do you wish to know?"
              />
              <span className="mt-1 block text-xs text-slate-500">Press {"\u2318/Ctrl"} + Enter to begin.</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setQuestion(example)}
                  className={`rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-300 hover:border-fuchsia-500/60 hover:text-fuchsia-200 ${INTERACTIVE}`}
                >
                  {example}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={!seekerName.trim() || !question.trim()}
              className={`rounded bg-fuchsia-500 px-4 py-2 font-semibold text-slate-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${INTERACTIVE}`}
            >
              Begin the reading
            </button>
          </form>
        ) : (
          <p className="text-center text-sm text-slate-300">The seeker is preparing their question…</p>
        )}
      </TarotShell>
    );
  }

  const cards = tarot.cards;
  const revealedCount = tarot.revealedCount;
  const allRevealed = revealedCount >= cards.length;
  const lastRevealed = revealedCount > 0 ? cards[revealedCount - 1] : undefined;
  const nextCard = !allRevealed ? cards[revealedCount] : undefined;
  const synthesisParagraphs = allRevealed ? buildSynthesis(cards, tarot.seekerName) : [];
  const synthesisText = synthesisParagraphs.join("\n\n");

  async function flipNext() {
    if (revealing || allRevealed) return;
    setRevealing(true);
    try {
      await onFlip();
    } finally {
      setRevealing(false);
    }
  }

  async function handleCopyReading() {
    const lines = [
      `Tarot reading for ${tarot?.seekerName ?? "you"}`,
      tarot?.question ? `"${tarot.question}"` : "",
      "",
      ...cards.map((card) => cardSummary(card)),
      ...(synthesisText ? ["", synthesisText] : [])
    ].filter(Boolean);
    const ok = await copyToClipboard(lines.join("\n"));
    if (ok) {
      setCopied(true);
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    }
  }

  // Screen-reader announcement of the most recently revealed card.
  const liveRegion = (
    <p className="sr-only" aria-live="polite">
      {lastRevealed ? cardSummary(lastRevealed) : ""}
    </p>
  );

  // ── Reading + result share one layout, so the last flip flows straight into
  //    the finished state instead of swapping to a separate stacked view. ──────
  return (
    <TarotShell>
      <div className="mx-auto max-w-3xl">
        {liveRegion}
        {tarot.question ? (
          <div className="mb-5 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {tarot.seekerName} {allRevealed ? "asked" : "asks"}
            </p>
            <p className="mt-1 text-sm italic text-slate-200">&ldquo;{tarot.question}&rdquo;</p>
          </div>
        ) : null}

        {introPhase !== "ready" ? (
          <p className="mb-4 text-center text-sm text-fuchsia-200/80">
            {introPhase === "shuffle" ? "The Reader shuffles the deck…" : "Dealing your spread…"}
          </p>
        ) : null}

        {introPhase === "shuffle" ? (
          <ShuffleDeck />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {cards.map((card, index) => {
              const midIndex = (cards.length - 1) / 2;
              const dealing = introPhase === "deal";
              return (
                <div
                  key={card.positionLabel}
                  className={`flex flex-col gap-2 ${dealing ? "tarot-deal" : ""}`}
                  style={
                    dealing
                      ? ({
                          animationDelay: `${index * 180}ms`,
                          "--deal-x": `${(midIndex - index) * 70}px`,
                          "--deal-rot": `${(index - midIndex) * 10}deg`
                        } as CSSProperties)
                      : undefined
                  }
                >
                  <FlipCard
                    card={card}
                    flipped={index < revealedCount}
                    isNext={index === revealedCount}
                    onFlip={isHost ? flipNext : undefined}
                    busy={revealing}
                  />
                  <p className="text-center text-[11px] text-slate-400">
                    <span className="font-semibold uppercase tracking-wide text-slate-300">{card.positionLabel}</span>
                    {" — "}
                    {positionMeaning(card.positionLabel)}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {introPhase !== "ready" ? null : !allRevealed ? (
          <>
            {isHost ? (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={flipNext}
                  disabled={revealing}
                  className={`rounded bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${INTERACTIVE}`}
                >
                  {nextCard ? `Flip ${nextCard.positionLabel}` : "All revealed"}
                </button>
              </div>
            ) : null}
            {isHost && nextCard ? (
              <p className="mt-2 text-center text-[11px] text-slate-400">or tap the glowing card to turn it</p>
            ) : null}
            <p className="mt-4 text-center text-xs text-slate-400">
              {revealedCount} of {cards.length} cards revealed
            </p>
          </>
        ) : (
          // Footer fades in once the final card has landed, so the transition
          // from the last flip into the result reads as one continuous beat.
          <div className="mt-6 animate-fade-up" style={{ animationDelay: "1250ms" }}>
            <p className="text-center text-sm text-slate-400">
              The cards have spoken. Take what serves you and leave the rest.
            </p>

            {synthesisParagraphs.length > 0 ? (
              <div className="mt-5 rounded-lg border border-fuchsia-900/40 bg-slate-900/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300/80">The weave</p>
                {synthesisParagraphs.map((para, i) => (
                  <p key={i} className={`${i === 0 ? "mt-2" : "mt-3"} text-sm leading-relaxed text-slate-200`}>
                    {para}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Sit with it</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Notice what resonates and what you resist. Let the spread be a mirror — the meaning you bring to it is
                the reading.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={handleCopyReading}
                className={`rounded px-4 py-2 font-semibold ${INTERACTIVE} ${
                  copied ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-100 hover:bg-slate-600"
                }`}
              >
                {copied ? "Copied" : "Copy my reading"}
              </button>
              {isHost ? (
                <button
                  type="button"
                  onClick={onRestart}
                  className={`rounded bg-fuchsia-500 px-4 py-2 font-semibold text-slate-950 hover:opacity-90 ${INTERACTIVE}`}
                >
                  New reading
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </TarotShell>
  );
}
