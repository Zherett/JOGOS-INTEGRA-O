import { useCallback, useRef, useState } from "react";
import { shuffleTeams, type TeamConfig } from "./teams";

export interface TeamSession {
  /** Play order for the current session (empty when there is no session). */
  order: string[];
  scores: number[];
  current: number;
  activeSession: boolean;
  setCurrent: (i: number) => void;
  credit: (delta: number) => void;
  /** Starts (or keeps) a session based on the chosen configuration. */
  begin: (config: TeamConfig) => void;
  /** Ends the session: order and scores are cleared. */
  finish: () => void;
}

/**
 * Keeps team order and scores alive across rounds until "Finalizar jogo".
 */
export function useTeamSession(): TeamSession {
  const [order, setOrder] = useState<string[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [current, setCurrentState] = useState(0);
  const currentRef = useRef(0);

  const setCurrent = useCallback((i: number) => {
    currentRef.current = i;
    setCurrentState(i);
  }, []);

  const credit = useCallback((delta: number) => {
    if (!delta) return;
    setScores((s) => {
      if (!s.length) return s;
      const next = [...s];
      const i = Math.min(currentRef.current, next.length - 1);
      next[i] = (next[i] ?? 0) + delta;
      return next;
    });
  }, []);

  const finish = useCallback(() => {
    setOrder([]);
    setScores([]);
    setCurrent(0);
  }, [setCurrent]);

  const begin = useCallback(
    (config: TeamConfig) => {
      if (config.mode !== "equipes" || config.teams.length === 0) {
        finish();
        return;
      }
      setOrder((prev) => {
        if (prev.length === config.teams.length && prev.every((t) => config.teams.includes(t))) {
          return prev; // keep the running session order
        }
        setScores(config.teams.map(() => 0));
        setCurrent(0);
        return config.order === "aleatoria" ? shuffleTeams(config.teams) : [...config.teams];
      });
      setScores((prev) => (prev.length === config.teams.length ? prev : config.teams.map(() => 0)));
    },
    [finish, setCurrent],
  );

  return {
    order,
    scores,
    current,
    activeSession: order.length > 0,
    setCurrent,
    credit,
    begin,
    finish,
  };
}
