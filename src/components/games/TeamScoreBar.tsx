import { useEffect, useRef } from "react";
import { Users } from "lucide-react";
import type { TeamSession } from "@/lib/use-team-session";

interface Props {
  session: TeamSession;
  /** Current total score of the run; deltas are credited to the active team. */
  score: number;
}

export function TeamScoreBar({ session, score }: Props) {
  const prev = useRef(score);
  const creditRef = useRef(session.credit);
  creditRef.current = session.credit;

  useEffect(() => {
    const delta = score - prev.current;
    prev.current = score;
    if (delta) creditRef.current(delta);
  }, [score]);

  if (!session.activeSession) return null;

  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Users className="h-4 w-4" /> Equipe da vez — toque para trocar
      </div>
      <div className="flex flex-wrap gap-2">
        {session.order.map((t, i) => (
          <button
            key={t + i}
            type="button"
            onClick={() => session.setCurrent(i)}
            className={`rounded-xl border-2 px-3 py-2 text-left transition-all ${
              i === session.current
                ? "border-primary bg-primary text-primary-foreground shadow-md scale-[1.03]"
                : "border-border bg-background hover:bg-secondary"
            }`}
          >
            <div className="font-display text-sm font-bold leading-tight">
              {i + 1}º • {t}
            </div>
            <div className={`text-xs ${i === session.current ? "opacity-90" : "text-muted-foreground"}`}>
              {session.scores[i] ?? 0} pts
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TeamResults({ session }: { session: TeamSession }) {
  if (!session.activeSession) return null;
  const ranked = session.order
    .map((name, i) => ({ name, score: session.scores[i] ?? 0 }))
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
      <p className="mt-3 text-center text-xs text-muted-foreground">
        O placar acumula entre as rodadas até você tocar em "Finalizar jogo".
      </p>
    </div>
  );
}
