import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Trophy,
  Star,
  Play,
  Users,
  User,
  Sparkles,
  Gamepad2,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  KeyRound,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { GameRegistration } from "@/lib/game-registry";
import type { GameId } from "@/lib/game-storage";
import type { StageGameRecord, RecordHolder } from "@/lib/game-records";
import { getGameInstructions } from "@/lib/game-instructions";

interface GameDetailDialogProps {
  game: GameRegistration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlay: (gameId: GameId) => void;
  personalStats: { bestScore: number; bestLevel: number };
  stageRecord?: StageGameRecord | null;
  stageName?: string;
  isUnlocked?: boolean;
  onOpenCodeGate?: () => void;
}

export function GameDetailDialog({
  game,
  open,
  onOpenChange,
  onPlay,
  personalStats,
  stageRecord,
  stageName,
  isUnlocked = true,
  onOpenCodeGate,
}: GameDetailDialogProps) {
  if (!game) return null;

  const instructions = getGameInstructions(game.id);

  function handleStartPlay() {
    onOpenChange(false);
    onPlay(game!.id);
  }

  function handleUnlock() {
    onOpenChange(false);
    onOpenCodeGate?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-3xl border-2 border-primary/30 shadow-2xl">
        <DialogHeader className="space-y-3 text-left">
          {/* Topo: Ícone grande + Título + Subtítulo */}
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div
              className={`grid h-16 w-16 sm:h-20 sm:w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${game.gradient} text-white shadow-lg ring-4 ring-primary/10`}
            >
              {React.isValidElement(game.icon)
                ? React.cloneElement(game.icon as React.ReactElement<{ className?: string }>, {
                    className: "h-9 w-9 sm:h-11 sm:w-11",
                  })
                : game.icon}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">
                  <Gamepad2 className="h-3 w-3" /> Desafio Educativo
                </span>
                {!isUnlocked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    <KeyRound className="h-3 w-3" /> Bloqueado por Código
                  </span>
                )}
              </div>
              <DialogTitle className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {game.title}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground font-medium line-clamp-2 mt-0.5">
                {game.subtitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* 1. Estatísticas: Recorde Pessoal x Recorde da Plataforma */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Seu Desempenho */}
            <div className="rounded-2xl border bg-card p-3 shadow-2xs flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <User className="h-3.5 w-3.5 text-primary" /> Seu Desempenho
                </div>
                <div className="font-display text-lg font-black text-foreground flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  {personalStats.bestScore.toLocaleString("pt-BR")} pts
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1 text-xs font-black text-primary border border-primary/20">
                  Nível {personalStats.bestLevel}
                </span>
              </div>
            </div>

            {/* Maior Ranking / Recorde Atual da Plataforma */}
            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-card to-amber-500/5 p-3 shadow-2xs flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" /> Recorde da Plataforma
                </div>
                <div className="font-display text-lg font-black text-amber-600 dark:text-amber-400">
                  {stageRecord && stageRecord.score > 0
                    ? `${stageRecord.score.toLocaleString("pt-BR")} pts`
                    : "Sem recorde"}
                </div>
                <p className="text-[10px] text-muted-foreground truncate font-medium">
                  {stageRecord && stageRecord.holders.length > 0
                    ? `Detentor: ${stageRecord.holders.map((h: RecordHolder) => h.nick).join(", ")}`
                    : "Seja o primeiro a marcar!"}
                </p>
              </div>
              {stageName && (
                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center rounded-lg bg-amber-500/15 px-2 py-0.5 text-[9px] font-extrabold text-amber-700 dark:text-amber-300">
                    {stageName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Objetivo & Como Jogar */}
          <div className="rounded-2xl border bg-secondary/30 p-3.5 sm:p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 font-display text-xs sm:text-sm font-extrabold text-foreground uppercase tracking-wide">
              <Target className="h-4 w-4 text-primary" /> Objetivo do Jogo
            </div>
            <p className="text-xs sm:text-sm text-foreground/90 font-medium leading-relaxed">
              {instructions.objective}
            </p>

            <div className="pt-2 border-t border-border/60">
              <div className="flex items-center gap-1.5 font-display text-xs sm:text-sm font-extrabold text-foreground uppercase tracking-wide mb-2">
                <HelpCircle className="h-4 w-4 text-primary" /> Como Jogar Passo a Passo
              </div>
              <ul className="space-y-1.5">
                {instructions.howToPlay.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="leading-snug">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 3. Comandos & Dicas Estratégicas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="rounded-2xl border bg-card p-3 space-y-1">
              <div className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-primary">
                <Gamepad2 className="h-3.5 w-3.5" /> Comandos & Controles
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                {instructions.controls}
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-3 space-y-1">
              <div className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-amber-500">
                <Lightbulb className="h-3.5 w-3.5" /> Dica & Pontuação
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                {instructions.tips} <span className="block mt-1 font-bold text-foreground">{instructions.scoring}</span>
              </p>
            </div>
          </div>

          {/* 4. Modalidades Disponíveis */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Modalidades do Jogo
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                Escolha jogar <b>Solo (Individual)</b> para bater recordes pessoais ou monte equipes <b>(SPARKS, NEXUS, CODEX, LOGICS)</b> na tela inicial!
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 rounded-lg bg-card border px-2 py-1 text-[10px] font-bold text-foreground">
                <User className="h-3 w-3 text-primary" /> Normal (Solo)
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-card border px-2 py-1 text-[10px] font-bold text-foreground">
                <Users className="h-3 w-3 text-emerald-500" /> Grupos / Equipes
              </span>
            </div>
          </div>

          {/* 5. Ação Principal / Botão Jogar */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto rounded-xl border px-4 py-2.5 font-display text-xs font-bold text-muted-foreground hover:bg-secondary transition-all cursor-pointer"
            >
              Fechar
            </button>

            {isUnlocked ? (
              <button
                type="button"
                onClick={handleStartPlay}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-3 font-display text-sm font-black text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                Jogar Agora
              </button>
            ) : (
              <button
                type="button"
                onClick={handleUnlock}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 font-display text-sm font-black text-white shadow-lg shadow-amber-500/25 hover:bg-amber-600 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                <KeyRound className="h-4 w-4" />
                Inserir Código para Liberar Jogo
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
