import { Award, CheckCircle, Clock, Lock, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MedalIcon } from "./MedalIcon";
import {
  RARITY_INFO,
  MEDAL_XP_REWARDS,
  type MedalDefinition,
  type PlayerUnlockedMedal,
} from "@/lib/medals-catalog";

interface Props {
  medal: MedalDefinition | null;
  unlockedInfo?: PlayerUnlockedMedal | null;
  progressText?: string;
  percentComplete?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MedalDetailModal({
  medal,
  unlockedInfo,
  progressText,
  percentComplete = 0,
  open,
  onOpenChange,
}: Props) {
  if (!medal) return null;

  const isUnlocked = Boolean(unlockedInfo);
  const rarity = RARITY_INFO[medal.rarity];

  let formattedDate: string | null = null;
  if (unlockedInfo?.unlockedAt) {
    try {
      const d = new Date(unlockedInfo.unlockedAt);
      formattedDate = d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      formattedDate = unlockedInfo.unlockedAt;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-md rounded-3xl border bg-card p-6 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{medal.title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center text-center">
          {/* Medal Icon with Neon Glow */}
          <div
            className={`relative mb-4 grid h-24 w-24 place-items-center rounded-3xl border-2 transition-transform duration-300 ${
              isUnlocked
                ? rarity.neonBorderClass + " scale-105"
                : "border-muted-foreground/30 bg-muted/40 opacity-75"
            }`}
            style={{
              boxShadow: isUnlocked ? `0 0 25px ${rarity.glowHex}` : undefined,
            }}
          >
            <MedalIcon
              name={medal.iconName}
              className={`h-12 w-12 ${isUnlocked ? rarity.textColor : "text-muted-foreground"}`}
            />
            {isUnlocked && (
              <span className="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                <CheckCircle className="h-4 w-4" />
              </span>
            )}
          </div>

          {/* Rarity, Reward & Category Tag */}
          <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5">
            <span
              className={`rounded-full border px-3 py-0.5 text-xs font-black uppercase tracking-wider ${rarity.badgeBgClass}`}
            >
              {rarity.label}
            </span>
            <span className="rounded-full bg-amber-500/15 border border-amber-500/40 px-2.5 py-0.5 text-[11px] font-black text-amber-600 dark:text-amber-400">
              +{MEDAL_XP_REWARDS[medal.rarity]} XP
            </span>
            <span className="rounded-full bg-secondary/70 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {medal.category.replace("_", " ").toUpperCase()}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-display text-xl font-black text-foreground">
            {medal.title}
          </h3>

          {/* Description */}
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {medal.description}
          </p>

          {/* Unlock Status / Progress */}
          <div className="mt-5 w-full rounded-2xl border bg-secondary/30 p-3.5 text-left">
            {isUnlocked ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-500 dark:text-emerald-400">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>Medalha Desbloqueada e Conquistada!</span>
                </div>
                {formattedDate && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Obtida em: <b>{formattedDate}</b>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" /> Ainda não desbloqueada
                  </span>
                  <span>{Math.round(percentComplete)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, percentComplete))}%` }}
                  />
                </div>
                {progressText && (
                  <p className="text-right text-[11px] font-semibold text-primary">
                    {progressText}
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-5 w-full rounded-xl bg-secondary py-2.5 font-display text-xs font-bold text-secondary-foreground transition-all hover:bg-secondary/80 active:scale-95"
          >
            Fechar Detalhes
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
