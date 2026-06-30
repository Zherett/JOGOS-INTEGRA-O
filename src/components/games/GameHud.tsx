import { Trophy, Star, Clock, Flame } from "lucide-react";
import { formatTime } from "@/lib/use-countdown";

interface Props {
  time: number;
  score: number;
  level: number;
  streak?: number;
}

export function GameHud({ time, score, level, streak }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Stat icon={<Clock className="h-5 w-5" />} label="Tempo" value={formatTime(time)} tone="primary" />
      <Stat icon={<Trophy className="h-5 w-5" />} label="Pontos" value={score.toString()} tone="accent" />
      <Stat icon={<Star className="h-5 w-5" />} label="Nível" value={level.toString()} tone="primary" />
      <Stat icon={<Flame className="h-5 w-5" />} label="Sequência" value={(streak ?? 0).toString()} tone="accent" />
    </div>
  );
}

function Stat({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: string; tone: "primary" | "accent" }) {
  const bg = tone === "primary"
    ? "bg-primary/10 text-primary"
    : "bg-accent/15 text-accent";
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${bg}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-lg font-bold font-display">{value}</div>
      </div>
    </div>
  );
}
