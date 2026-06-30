import { useEffect, useRef, useState } from "react";

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

export function formatTime(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
