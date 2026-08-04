import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import type { TeamConfig } from "@/lib/teams";

interface Props {
  config: TeamConfig;
  /** Current total score of the run; deltas are credited to the active team. */
  score: number;
  /** Optional external control of the active team index. */
  activeIndex?: number;
  onActiveChange?: (i: number) => void;
  /** Notify the parent when team scores change (for results screens). */
  onScoresChange?: (scores: number[]) => void;
}

export function TeamScoreBar({ config, score, activeIndex, onActiveChange, onScoresChange }: Props) {
  const [internalActive, setInternalActive] = useState(0);
  const active = activeIndex ?? internalActive;
  const [scores, setScores] = useState<number[]>(() => config.teams.map(() => 0));
  const prev = useRef(score);
  const activeRef = useRef(active);
  activeRef.current = active;
  const changeRef = useRef(onScoresChange);
  changeRef.current = onScoresChange;

  useEffect(() => {
    const delta = score - prev.current;
    prev.current = score;
    if (!delta) return;
    setScores((s) => {
      const next = [...s];
      next[activeRef.current] = (next[activeRef.current] ?? 0) + delta;
      changeRef.current?.(next);
      return next;
    });
  }, [score]);

  if (config.mode !== "equipes" || config.teams.length === 0) return null;

  function select(i: number) {
    setInternalActive(i);
    onActiveChange?.(i);
  }

  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Users className="h-4 w-4" /> Equipe da vez — toque para trocar
      </div>
      <div className="flex flex-wrap gap-2">
        {config.teams.map((t, i) => (
          <button
            key={t + i}
            type="button"
            onClick={() => select(i)}
            className={`rounded-xl border-2 px-3 py-2 text-left transition-all ${
              i === active
                ? "border-primary bg-primary text-primary-foreground shadow-md scale-[1.03]"
                : "border-border bg-background hover:bg-secondary"
            }`}
          >
            <div className="font-display text-sm font-bold leading-tight">{t}</div>
            <div className={`text-xs ${i === active ? "opacity-90" : "text-muted-foreground"}`}>
              {scores[i] ?? 0} pts
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TeamResults({ config, scores }: { config: TeamConfig; scores: number[] }) {
  if (config.mode !== "equipes" || config.teams.length === 0) return null;
  const ranked = config.teams
    .map((name, i) => ({ name, score: scores[i] ?? 0 }))
    .sort((a, b) => b.score - a.score);
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border bg-card p-5 shadow-md">
      <div className="mb-3 text-center font-display text-xl font-bold">Placar das equipes</div>
      <div className="space-y-2">
        {ranked.map((t, i) => (
          <div
            key={t.name + i}
            className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
              i === 0 ? "border-accent bg-accent/10" : "bg-background/60"
            }`}
          >
            <span className="font-display font-bold">
              {i + 1}º • {t.name}
            </span>
            <span className="font-display text-lg font-extrabold">{t.score} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}
