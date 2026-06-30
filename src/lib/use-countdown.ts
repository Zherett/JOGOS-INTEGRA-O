import { useEffect, useRef, useState } from "react";

export function useCountdown(seconds: number, running: boolean, onEnd: () => void) {
  const [remaining, setRemaining] = useState(seconds);
  const endedRef = useRef(false);

  useEffect(() => {
    setRemaining(seconds);
    endedRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const initial = remaining;
    const id = window.setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, initial - elapsed);
      setRemaining(left);
      if (left <= 0 && !endedRef.current) {
        endedRef.current = true;
        window.clearInterval(id);
        onEnd();
      }
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return remaining;
}

export function formatTime(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
