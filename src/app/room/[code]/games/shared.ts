import { useEffect, useRef, useState } from "react";

/** Whole seconds remaining until `deadlineAt`, clamped at 0. */
function timeLeft(deadlineAt: number | undefined, now: number): number {
  if (!deadlineAt) return 0;
  return Math.max(0, Math.ceil((deadlineAt - now) / 1000));
}

/**
 * Whole seconds remaining until `deadlineAt`, self-ticking. Unlike a page-wide
 * `now` clock, this only re-renders the component that uses it, and only when
 * the displayed second actually changes (the interval polls faster than 1s so
 * the boundary lands promptly, but identical values bail out of `setState`).
 */
export function useCountdown(deadlineAt: number | undefined): number {
  const [secs, setSecs] = useState(() => timeLeft(deadlineAt, Date.now()));

  useEffect(() => {
    setSecs(timeLeft(deadlineAt, Date.now()));
    if (!deadlineAt) return undefined;
    const id = setInterval(() => {
      setSecs((prev) => {
        const next = timeLeft(deadlineAt, Date.now());
        return next === prev ? prev : next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [deadlineAt]);

  return secs;
}

/**
 * A self-ticking wall clock for sub-second UI (e.g. a smooth countdown ring).
 * Only runs while `active`, and is scoped to the component that calls it so the
 * rest of the page tree doesn't re-render on every tick.
 */
export function useAnimationClock(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);

  return now;
}

/**
 * Drives event-by-event playback of a reveal phase. Advances an internal cursor
 * on its own timer (independent of the 500ms `now` tick) and paces it to land on
 * the final frame shortly before `deadlineAt`. Resets whenever `resetKey`
 * changes (e.g. a new round). Returns the clamped current step index.
 */
export function useStepPlayback(resetKey: number | string, totalSteps: number, deadlineAt: number | undefined): number {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setStepIndex(0);
    if (totalSteps <= 1) return undefined;
    const budget = Math.max(1200, (deadlineAt ?? Date.now()) - Date.now() - 600);
    const perStep = Math.min(1100, Math.max(380, budget / (totalSteps - 1)));
    let cursor = 0;
    const timer = setInterval(() => {
      cursor += 1;
      setStepIndex(cursor);
      if (cursor >= totalSteps - 1) clearInterval(timer);
    }, perStep);
    return () => clearInterval(timer);
  }, [resetKey, totalSteps, deadlineAt]);

  return totalSteps > 0 ? Math.min(stepIndex, totalSteps - 1) : 0;
}

export interface NumberChange {
  /** Signed change since the last value (negative = decrease). */
  delta: number;
  /** Increments on every change, for use as an animation key. */
  key: number;
}

/**
 * Tracks the most recent change to a numeric `value`, auto-clearing to null
 * after `holdMs`. Used to flash cards and pop floating damage/heal numbers when
 * HP, shields, etc. move between renders (each reveal frame is a render).
 */
export function useNumberChange(value: number, holdMs = 1000): NumberChange | null {
  const prevRef = useRef(value);
  const keyRef = useRef(0);
  const [change, setChange] = useState<NumberChange | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (value === prev) return undefined;
    keyRef.current += 1;
    const key = keyRef.current;
    setChange({ delta: value - prev, key });
    const timer = setTimeout(() => {
      setChange((current) => (current && current.key === key ? null : current));
    }, holdMs);
    return () => clearTimeout(timer);
  }, [value, holdMs]);

  return change;
}
