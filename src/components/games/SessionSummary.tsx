import { Trophy, Medal, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeamSession } from "@/lib/use-team-session";
import { teamColor, TEAM_COLOR_CLASSES } from "@/lib/teams";

interface Props {
  title: string;
  session: TeamSession;
  onClose: () => void;
}

/** Final ranking shown when "Finalizar jogo" is pressed. */
export function SessionSummary({ title, session, onClose }: Props) {
  const ranked = session.order
    .map((name, i) => ({ name, score: session.scores[i] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const place = ["1º", "2º", "3º", "4º", "5º"];

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border bg-card p-6 sm:p-8 shadow-xl animate-pop-in">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent/15 text-accent">
          <Trophy className="h-8 w-8" />
        </div>
        <h2 className="mt-4 font-display text-3xl font-extrabold">Resultado final</h2>
        <p className="text-muted-foreground">{title}</p>
      </div>

      <div className="mt-6 space-y-2">
        {ranked.map((t, i) => {
          const c = TEAM_COLOR_CLASSES[teamColor(t.name)];
          return (
            <div
              key={t.name + i}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                i === 0 ? "border-accent bg-accent/10 shadow-md" : "bg-background/60"
              }`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold ${c.chip}`}>
                {i === 0 ? <Medal className="h-5 w-5" /> : place[i] ?? `${i + 1}º`}
              </span>
              <span className="flex-1 font-display text-lg font-bold">
                {place[i] ?? `${i + 1}º`} • {t.name}
              </span>
              <span className="font-display text-xl font-extrabold">{t.score} pts</span>
            </div>
          );
        })}
      </div>

      <Button size="lg" className="mt-6 h-14 w-full text-base font-bold" onClick={onClose}>
        <Home className="mr-2 h-5 w-5" /> Encerrar e voltar
      </Button>
    </div>
  );
}
