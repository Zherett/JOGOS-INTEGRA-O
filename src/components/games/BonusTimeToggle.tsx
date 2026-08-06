import { Timer } from "lucide-react";
import { BONUS_PER_CORRECT, MAX_BONUS } from "@/lib/use-countdown";

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  /** Bonus seconds already earned in the current round. */
  earned?: number;
  className?: string;
}

/** Slide switch that enables +3s per correct answer (up to +30s). */
export function BonusTimeToggle({ value, onChange, earned, className }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`flex items-center gap-3 rounded-2xl border-2 bg-card px-3 py-2 text-left transition-all hover:scale-[1.01] active:scale-95 ${
        value ? "border-accent" : "border-border"
      } ${className ?? ""}`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${value ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
        <Timer className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-bold leading-tight">
          Tempo extra +{BONUS_PER_CORRECT}s por acerto
        </span>
        <span className="block text-xs text-muted-foreground">
          {value ? `Ativado • máx +${MAX_BONUS}s` : "Desativado"}
          {typeof earned === "number" && earned > 0 && value ? ` • ganhou +${earned}s` : ""}
        </span>
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${value ? "bg-accent" : "bg-muted-foreground/30"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-background shadow transition-all ${value ? "left-6" : "left-1"}`}
        />
      </span>
    </button>
  );
}
