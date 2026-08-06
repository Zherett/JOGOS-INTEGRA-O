import { useCallback, useEffect, useRef, useState } from "react";

/** Extra seconds granted per correct answer. */
export const BONUS_PER_CORRECT = 3;
/** Hard cap of extra seconds per round (2:00 -> 2:30). */
export const MAX_BONUS = 30;

export function useCountdown(seconds: number, running: boolean, onEnd: () => void) {
  const [remaining, setRemaining] = useState(seconds);
  const endedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    if (!running) return;
    // Reset on each start
    setRemaining(seconds);
    endedRef.current = false;
    const start = Date.now();
    const id = window.setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, seconds - elapsed);
      setRemaining(left);
      if (left <= 0 && !endedRef.current) {
        endedRef.current = true;
        window.clearInterval(id);
        onEndRef.current();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running, seconds]);

  return remaining;
}

export interface RoundClock {
  time: number;
  bonus: number;
  /** Adds BONUS_PER_CORRECT seconds (capped) — call only when the bonus is on. */
  addBonus: () => void;
}

/** Countdown that can be extended with bonus seconds on correct answers. */
export function useRoundClock(seconds: number, running: boolean, onEnd: () => void): RoundClock {
  const [remaining, setRemaining] = useState(seconds);
  const [bonus, setBonus] = useState(0);
  const bonusRef = useRef(0);
  const endedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    if (!running) return;
    bonusRef.current = 0;
    setBonus(0);
    setRemaining(seconds);
    endedRef.current = false;
    const start = Date.now();
    const id = window.setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, seconds + bonusRef.current - elapsed);
      setRemaining(left);
      if (left <= 0 && !endedRef.current) {
        endedRef.current = true;
        window.clearInterval(id);
        onEndRef.current();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running, seconds]);

  const addBonus = useCallback(() => {
    if (endedRef.current) return;
    const next = Math.min(MAX_BONUS, bonusRef.current + BONUS_PER_CORRECT);
    if (next === bonusRef.current) return;
    const gained = next - bonusRef.current;
    bonusRef.current = next;
    setBonus(next);
    setRemaining((r) => r + gained);
  }, []);

  return { time: remaining, bonus, addBonus };
}

export function formatTime(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
