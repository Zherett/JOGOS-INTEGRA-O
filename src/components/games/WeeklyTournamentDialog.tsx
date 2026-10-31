import { useEffect, useState } from "react";
import {
  Trophy,
  Flame,
  Clock,
  Lock,
  Play,
  Medal,
  Zap,
  Sparkles,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { GameId } from "@/lib/game-storage";
import { usePlayerAuth } from "@/lib/player-auth";
import {
  AGE_STAGES,
  getWeeklyTournamentSnapshot,
  syncWeeklyTournamentWithPlayFab,
  TOURNAMENT_DAILY_ENTRIES_LIMIT,
  TOURNAMENT_DAILY_EXTRA_XP_CAP,
  TOURNAMENT_MIN_LEVEL,
  TOURNAMENT_XP_PER_ENTRY,
} from "@/lib/weekly-tournament";
import { stageFromBirthdate, type AgeStageId } from "@/lib/player-profile";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStartRankedEntry: (gameId: GameId) => void;
  onRequireLogin: () => void;
}

export function WeeklyTournamentDialog({
  open,
  onOpenChange,
  onStartRankedEntry,
  onRequireLogin,
}: Props) {
  const auth = usePlayerAuth();
  const profile = auth.profile;
  const [, setTick] = useState(0);
  const myStageId = profile ? stageFromBirthdate(profile.birthdate).id : "etapa_1";
  const [selectedStage, setSelectedStage] = useState<AgeStageId | "TODAS">(myStageId);

  useEffect(() => {
    if (open && profile) {
      setSelectedStage(stageFromBirthdate(profile.birthdate).id);
    }
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    void syncWeeklyTournamentWithPlayFab().then(() => setTick((t) => t + 1));
    const id = window.setInterval(() => {
      void syncWeeklyTournamentWithPlayFab().then(() => setTick((t) => t + 1));
    }, 5000);
    return () => window.clearInterval(id);
  }, [open]);

  if (!profile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <Trophy className="h-6 w-6 text-accent" /> Torneio Semanal Ranqueado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-center">
            <p className="text-sm text-muted-foreground">
              Entre no seu perfil de jogador para disputar o Top 5 do Torneio Semanal, ganhar até
              +100 XP extras por dia e conquistar medalhas!
            </p>
            <Button
              size="lg"
              className="h-12 w-full rounded-2xl font-bold"
              onClick={() => {
                onOpenChange(false);
                onRequireLogin();
              }}
            >
              Entrar no meu perfil agora
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const snap = getWeeklyTournamentSnapshot(profile, selectedStage);

  if (!snap.canEnterLevel) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <Lock className="h-6 w-6 text-accent" /> Torneio Semanal (Nível {TOURNAMENT_MIN_LEVEL}
              +)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-center">
            <div className="rounded-2xl border bg-secondary/40 p-5 space-y-2">
              <p className="font-display text-lg font-extrabold text-foreground">
                Alcance o Nível {TOURNAMENT_MIN_LEVEL} (🧩 Desbravador de Padrões) para participar!
              </p>
              <p className="text-xs text-muted-foreground">
                Você está no <b>Nível {profile.level}</b> ({profile.xp} XP). O Torneio Semanal
                Ranqueado é liberado automaticamente ao atingir o Nível {TOURNAMENT_MIN_LEVEL}.
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => onOpenChange(false)}
              className="h-12 w-full rounded-2xl font-bold"
            >
              Continuar Subindo de Nível
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <Trophy className="h-6 w-6 text-accent" /> Torneio Semanal Ranqueado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Card do Jogo Oficial da Semana */}
          <div className="rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-card to-accent/15 p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-0.5 text-[11px] font-extrabold uppercase text-primary">
                <Calendar className="h-3.5 w-3.5" /> Semana {snap.weekKey} • Até {snap.endsAtLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-0.5 text-[11px] font-extrabold text-foreground">
                {snap.playerStage.emoji} Sua Etapa: {snap.playerStage.label}
              </span>
              {snap.myStanding && (
                <span className="rounded-full bg-accent/20 px-3 py-0.5 text-xs font-extrabold text-accent">
                  Sua colocação na {snap.playerStage.shortLabel}: #{snap.myStanding.rank} (
                  {snap.myStanding.totalRankedPoints} pts)
                </span>
              )}
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Desafio Oficial Desta Semana
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
                {snap.gameName}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Quem se mantém no <b>Top 5</b> por mais tempo acumula{" "}
                <b>Pontos de Permanência (+2 pts a cada 10 min na colocação)</b> e garante Medalhas
                Semanais + Bônus de XP!
              </p>
            </div>

            {/* Medidores das 10 Entradas Diárias e +100 XP Extra */}
            <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
              <div className="rounded-2xl border bg-card/90 p-3 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Flame className="h-3.5 w-3.5 text-accent" /> Entradas de Hoje
                  </span>
                  <span className="font-mono font-extrabold">
                    {snap.entriesUsedToday} / {TOURNAMENT_DAILY_ENTRIES_LIMIT}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${(snap.entriesUsedToday / TOURNAMENT_DAILY_ENTRIES_LIMIT) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {snap.entriesRemainingToday > 0
                    ? `Você ainda tem ${snap.entriesRemainingToday} tentativas hoje.`
                    : "Você completou todas as 10 tentativas de hoje!"}
                </p>
              </div>

              <div className="rounded-2xl border bg-card/90 p-3 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Zap className="h-3.5 w-3.5 text-success" /> XP Extra Ranqueado Hoje
                  </span>
                  <span className="font-mono font-extrabold text-success">
                    +{snap.extraXpEarnedToday} / {TOURNAMENT_DAILY_EXTRA_XP_CAP} XP
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-success transition-all"
                    style={{
                      width: `${(snap.extraXpEarnedToday / TOURNAMENT_DAILY_EXTRA_XP_CAP) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  +{TOURNAMENT_XP_PER_ENTRY} XP garantidos por entrada (10 entradas = 100 XP extra).
                </p>
              </div>
            </div>

            <Button
              size="lg"
              disabled={snap.entriesRemainingToday <= 0}
              onClick={() => {
                onOpenChange(false);
                onStartRankedEntry(snap.gameId);
              }}
              className="h-13 w-full rounded-2xl font-display text-base font-extrabold shadow-md"
            >
              {snap.entriesRemainingToday > 0 ? (
                <>
                  <Play className="mr-2 h-5 w-5" /> Jogar Entrada Ranqueada Agora (
                  {snap.entriesRemainingToday}/{TOURNAMENT_DAILY_ENTRIES_LIMIT} restantes)
                </>
              ) : (
                "Limite de 10 entradas diárias concluído hoje! Volte amanhã"
              )}
            </Button>
          </div>

          {/* Ranking Top 5 do Torneio Semanal (Por Etapa + Opção Geral Secundária) */}
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-sm font-extrabold flex items-center gap-1.5">
                <Medal className="h-4 w-4 text-accent" /> Top 5 do Torneio por Etapa (Faixa Etária)
              </span>
              <button
                type="button"
                onClick={() => setSelectedStage("TODAS")}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  selectedStage === "TODAS"
                    ? "border-accent bg-accent text-accent-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                🌐 Ver Geral (Todas as idades)
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {AGE_STAGES.map((st) => {
                const isSelected = selectedStage === st.id;
                const isMine = snap.playerStage.id === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStage(st.id)}
                    className={`rounded-xl border px-2.5 py-2 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "bg-background hover:bg-secondary/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 font-display text-xs font-extrabold">
                      <span>
                        {st.emoji} {st.shortLabel}
                      </span>
                      {isMine && (
                        <span
                          className={`rounded px-1 text-[9px] uppercase ${
                            isSelected
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-primary/15 text-primary"
                          }`}
                        >
                          Sua
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[10px] ${
                        isSelected ? "text-primary-foreground/90" : "text-muted-foreground"
                      }`}
                    >
                      {st.ageRangeLabel}
                    </div>
                  </button>
                );
              })}
            </div>

            {snap.top5.length === 0 ? (
              <div className="rounded-xl bg-secondary/40 p-5 text-center text-xs text-muted-foreground">
                Ninguém pontuou no torneio desta semana ainda. Jogue sua 1ª entrada agora para
                assumir o <b>1º lugar</b> e começar a acumular tempo na liderança!
              </div>
            ) : (
              <div className="space-y-2">
                {snap.top5.map((row) => {
                  const isMe = row.playerId === profile.id;
                  return (
                    <div
                      key={row.playerId}
                      className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition-colors ${
                        isMe ? "border-primary bg-primary/10" : "bg-background"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary font-display text-lg font-extrabold">
                          {row.projectedMedal.emoji}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-display text-sm font-extrabold truncate">
                              #{row.rank} {row.nick}
                            </span>
                            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                              {row.stageLabel} ({row.age} anos)
                            </span>
                            {isMe && (
                              <span className="rounded-md bg-primary px-1.5 py-0.2 text-[10px] font-bold text-primary-foreground">
                                VOCÊ
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {row.school} • Nv. {row.level} •{" "}
                            <span className="inline-flex items-center gap-0.5 font-semibold text-accent">
                              <Clock className="h-3 w-3" /> {row.holdMinutes} min no Top 5 (+
                              {row.holdBonusPoints} pts)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-display text-base font-extrabold text-primary">
                          {row.totalRankedPoints} pts
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Recorde: {row.bestScore} ({row.totalEntries}x)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Informações sobre o Sistema de Medalhas */}
          <div className="rounded-2xl border bg-secondary/30 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <div>
              <b className="text-foreground">Sistema de Medalhas Semanais Ativo:</b> Entrar no Top 5
              registra sua medalha da semana (🥇 Ouro, 🥈 Prata, 🥉 Bronze ou 🏅 Elite Top 5) direto
              no seu perfil de jogador!
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
