import { Trophy, Target, XCircle, Star, TrendingUp, Clock } from "lucide-react";
import type { LastMatch } from "@/lib/game-storage";

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LastMatchCard({ match, title = "Última Partida" }: { match: LastMatch; title?: string }) {
  const total = match.correct + match.wrong;
  const pct = total === 0 ? 0 : Math.round((match.correct / total) * 100);
  return (
    <div className="rounded-2xl border bg-secondary/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
        <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> {formatDate(match.at)}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Cell icon={<Trophy className="h-4 w-4" />} label="Pontos" value={match.score} tone="accent" />
        <Cell icon={<Target className="h-4 w-4" />} label="Acertos" value={match.correct} tone="success" />
        <Cell icon={<XCircle className="h-4 w-4" />} label="Erros" value={match.wrong} tone="destructive" />
        <Cell icon={<Star className="h-4 w-4" />} label="Nível" value={match.level} tone="primary" />
        <Cell icon={<TrendingUp className="h-4 w-4" />} label="Aprov." value={`${pct}%`} tone="primary" />
      </div>
    </div>
  );
}

function Cell({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: number | string; tone: string }) {
  const map: Record<string, string> = {
    accent: "bg-accent/15 text-accent",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/15 text-destructive",
    primary: "bg-primary/15 text-primary",
  };
  return (
    <div className="flex items-center gap-2 rounded-xl bg-card p-2">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${map[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-bold font-display">{value}</div>
      </div>
    </div>
  );
}
