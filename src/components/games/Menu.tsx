import { useState, useEffect } from "react";
import {
  Trophy,
  Star,
  Sparkles,
  KeyRound,
  Medal,
  Lock,
  Clock,
  Calendar,
  Swords,
  Zap,
  Award,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Flame,
  Rocket,
  Target,
} from "lucide-react";
import type { AllStats, GameId } from "@/lib/game-storage";
import { GAME_NAMES } from "@/lib/game-storage";
import { GAME_REGISTRY } from "@/lib/game-registry";
import { TOURNAMENT_MIN_LEVEL, X1_MIN_LEVEL } from "@/lib/player-profile";
import {
  getAllActiveEvents,
  calculateCumulativeActiveBonuses,
  type ActiveEventDisplayItem,
  type CumulativeActiveBonuses,
} from "@/lib/custom-events";
import integracaoPreto from "@/assets/integracao-preto.jpg";
import semed from "@/assets/semed.png";
import type { PlayerProfile } from "@/lib/playfab";
import { stageFromBirthdate } from "@/lib/player-profile";
import {
  formatRecordDateBR,
  getGameStageRecord,
  loadGameRecords,
  type AllGameRecords,
} from "@/lib/game-records";

interface Props {
  stats: AllStats;
  unlocked: GameId[];
  enabledGames: Record<GameId, boolean>;
  requireCodeGate: boolean;
  x1Enabled?: boolean;
  x1OpenNow?: boolean;
  x1HoursLabel?: string;
  tournamentEnabled?: boolean;
  weeklyGameName?: string;
  playerLevel?: number;
  playerProfile?: PlayerProfile | null;
  onSelect: (id: GameId) => void;
  onAddCode: () => void;
  onOpenX1Arena?: () => void;
  onOpenWeeklyTournament?: () => void;
}

export function Menu({
  stats,
  unlocked,
  enabledGames,
  requireCodeGate,
  x1Enabled = true,
  x1OpenNow = true,
  x1HoursLabel = "07:00 às 19:00",
  tournamentEnabled = true,
  weeklyGameName = "Batalha de Robôs",
  playerLevel = 1,
  playerProfile = null,
  onSelect,
  onAddCode,
  onOpenX1Arena,
  onOpenWeeklyTournament,
}: Props) {
  const isGameEnabled = (id: GameId) => Boolean(enabledGames && enabledGames[id] === true);
  const visible = GAME_REGISTRY.filter(
    (g) => isGameEnabled(g.id) && (!requireCodeGate || unlocked.includes(g.id)),
  );
  const canTournament = playerLevel >= TOURNAMENT_MIN_LEVEL;
  const canX1 = playerLevel >= X1_MIN_LEVEL && x1OpenNow;

  const stageId = playerProfile
    ? stageFromBirthdate(playerProfile.birthdate, new Date(), playerProfile.school).id
    : "etapa_1";

  const [gameRecords, setGameRecords] = useState<AllGameRecords>(() => loadGameRecords());

  useEffect(() => {
    const handler = () => setGameRecords(loadGameRecords());
    window.addEventListener("desafios:game-records-updated", handler);
    return () => window.removeEventListener("desafios:game-records-updated", handler);
  }, []);

  const [activeEvents, setActiveEvents] = useState<ActiveEventDisplayItem[]>(() =>
    getAllActiveEvents(),
  );
  const [cumulativeBonuses, setCumulativeBonuses] = useState<CumulativeActiveBonuses>(() =>
    calculateCumulativeActiveBonuses(),
  );
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [eventsPanelOpen, setEventsPanelOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      setActiveEvents(getAllActiveEvents());
      setCumulativeBonuses(calculateCumulativeActiveBonuses());
    };
    window.addEventListener("desafios:special-events-updated", update);
    const id = window.setInterval(update, 10000);
    return () => {
      window.removeEventListener("desafios:special-events-updated", update);
      window.clearInterval(id);
    };
  }, []);

  // Auto-avanço sutil quando há múltiplos eventos ativos
  useEffect(() => {
    if (activeEvents.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentEventIndex((prev) => (prev + 1) % activeEvents.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [activeEvents.length]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <img
          src={integracaoPreto}
          alt="Logo do Projeto INTEGRAÇÃO"
          width={160}
          height={80}
          className="h-12 w-auto sm:h-16 rounded-lg object-contain"
        />
        <img
          src={semed}
          alt="Logo da SEMED Coari"
          width={160}
          height={80}
          className="h-12 w-auto sm:h-16 rounded-lg object-contain"
        />
      </div>

      {/* Painel Retrátil Minimalista: Bônus Acumulados + Faixa de Eventos da Semana no Mesmo Bloco */}
      {(cumulativeBonuses.hasActiveBonuses || activeEvents.length > 0) && (() => {
        const currentEv =
          activeEvents.length > 0 ? activeEvents[currentEventIndex % activeEvents.length] : null;
        const handlePrev = () => {
          if (activeEvents.length <= 1) return;
          setCurrentEventIndex((prev) => (prev - 1 + activeEvents.length) % activeEvents.length);
        };
        const handleNext = () => {
          if (activeEvents.length <= 1) return;
          setCurrentEventIndex((prev) => (prev + 1) % activeEvents.length);
        };

        return (
          <div className="rounded-3xl border-2 border-amber-400/70 bg-gradient-to-r from-amber-500/10 via-card to-amber-500/10 shadow-sm overflow-hidden transition-all">
            {/* Barra Superior Minimalista (Sempre Visível — Clique para Abrir/Fechar) */}
            <button
              type="button"
              onClick={() => setEventsPanelOpen((v) => !v)}
              className="flex w-full flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-amber-500/10"
            >
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-2xs">
                  <Zap className="h-3 w-3 fill-white" /> Bônus & Eventos Ativos
                </span>

                {/* Resumo Minimalista dos Bônus em Pílulas Compactas */}
                {cumulativeBonuses.totalMultiplier > 1 && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 text-[11px] font-extrabold text-amber-700 dark:text-amber-300">
                    <Flame className="h-3 w-3 text-amber-500 fill-amber-500" />
                    {cumulativeBonuses.totalMultiplier}x XP
                  </span>
                )}
                {cumulativeBonuses.totalDailyCap > 1000 && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-extrabold text-cyan-700 dark:text-cyan-300">
                    <Rocket className="h-3 w-3 text-cyan-500" />
                    {cumulativeBonuses.totalDailyCap.toLocaleString("pt-BR")} XP/dia
                  </span>
                )}
                {cumulativeBonuses.totalMatchCap > 20 && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/15 px-2 py-0.5 text-[11px] font-extrabold text-primary">
                    <Target className="h-3 w-3" />
                    {cumulativeBonuses.totalMatchCap} XP/partida
                  </span>
                )}

                {currentEv && (
                  <span className=" truncate text-xs font-bold text-muted-foreground hidden md:inline">
                    • {currentEv.title} ({currentEv.remainingTime})
                  </span>
                )}
              </div>

              <span className="inline-flex items-center gap-1 rounded-xl border border-amber-400/60 bg-card px-3 py-1 text-xs font-extrabold text-foreground shadow-2xs shrink-0">
                {eventsPanelOpen ? (
                  <>
                    Ocultar bônus e eventos <ChevronUp className="h-3.5 w-3.5 text-amber-500" />
                  </>
                ) : (
                  <>
                    Visualizar bônus e eventos <ChevronDown className="h-3.5 w-3.5 text-amber-500" />
                  </>
                )}
              </span>
            </button>

            {/* Conteúdo Retrátil: Bloquinhos Menores de Bônus + Faixa de Eventos da Semana */}
            {eventsPanelOpen && (
              <div className="border-t border-amber-400/30 p-3 sm:p-4 space-y-3 bg-card/60 animate-in fade-in-50 duration-200">
                {/* 1. Bloquinhos Compactos de Bônus Ativos Acumulados */}
                {cumulativeBonuses.hasActiveBonuses && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {cumulativeBonuses.totalMultiplier > 1 && (
                      <div className="flex items-center gap-2.5 rounded-xl border border-amber-400/50 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-card px-3 py-2 shadow-2xs">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500 text-white">
                          <Flame className="h-4 w-4 fill-white" />
                        </div>
                        <div className="min-w-0 leading-tight">
                          <p className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            Multiplicador Ativo
                          </p>
                          <p className="font-display text-sm sm:text-base font-black text-foreground">
                            {cumulativeBonuses.totalMultiplier}x de XP{" "}
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              (+{Math.round((cumulativeBonuses.totalMultiplier - 1) * 100)}%)
                            </span>
                          </p>
                        </div>
                      </div>
                    )}

                    {cumulativeBonuses.totalDailyCap > 1000 && (
                      <div className="flex items-center gap-2.5 rounded-xl border border-cyan-400/50 bg-gradient-to-br from-cyan-500/15 via-cyan-500/5 to-card px-3 py-2 shadow-2xs">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-500 text-white">
                          <Rocket className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 leading-tight">
                          <p className="text-[9px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                            Limite Diário Total
                          </p>
                          <p className="font-display text-sm sm:text-base font-black text-foreground">
                            {cumulativeBonuses.totalDailyCap.toLocaleString("pt-BR")} XP/dia{" "}
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              (+{cumulativeBonuses.totalExtraDaily.toLocaleString("pt-BR")})
                            </span>
                          </p>
                        </div>
                      </div>
                    )}

                    {cumulativeBonuses.totalMatchCap > 20 && (
                      <div className="flex items-center gap-2.5 rounded-xl border border-primary/50 bg-gradient-to-br from-primary/15 via-primary/5 to-card px-3 py-2 shadow-2xs">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                          <Target className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 leading-tight">
                          <p className="text-[9px] font-black uppercase tracking-wider text-primary">
                            Teto por Partida
                          </p>
                          <p className="font-display text-sm sm:text-base font-black text-foreground">
                            {cumulativeBonuses.totalMatchCap} XP/partida{" "}
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              (+{cumulativeBonuses.totalExtraMatch})
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Faixa de Eventos da Semana (Carrossel Compacto Integrado) */}
                {currentEv && (
                  <div className="relative overflow-hidden rounded-2xl border border-amber-400/60 bg-gradient-to-r from-amber-500/10 via-primary/5 to-amber-500/10 p-3 sm:p-3.5 pl-9 pr-9 sm:pl-11 sm:pr-11">
                    {activeEvents.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={handlePrev}
                          title="Evento anterior"
                          aria-label="Evento anterior"
                          className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900/70 text-white shadow-xs transition-all hover:bg-neutral-900"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleNext}
                          title="Próximo evento"
                          aria-label="Próximo evento"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900/70 text-white shadow-xs transition-all hover:bg-neutral-900"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-black text-white uppercase tracking-wider">
                            <Zap className="h-3 w-3 fill-white" /> {currentEv.badgeLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 dark:bg-card border border-amber-200 dark:border-amber-900/50 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            <Clock className="h-3 w-3 text-amber-500" /> {currentEv.remainingTime}
                          </span>
                          {currentEv.activePeriodLabel && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 dark:bg-card/80 border border-amber-200/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              <Calendar className="h-2.5 w-2.5 text-primary" /> {currentEv.activePeriodLabel}
                            </span>
                          )}
                        </div>

                        <h3 className="font-display text-base sm:text-lg font-black text-foreground tracking-tight">
                          {currentEv.title}
                        </h3>

                        <p className="text-xs text-muted-foreground font-medium line-clamp-2">
                          {currentEv.description}
                        </p>
                      </div>

                      {/* Resumo dos Bônus deste Evento Específico */}
                      <div className="shrink-0 w-full sm:w-auto">
                        <div className="rounded-xl border border-amber-300 dark:border-amber-600 bg-white dark:bg-card px-3 py-2 shadow-2xs text-center flex flex-col items-center justify-center min-w-[170px] gap-1">
                          <span className="text-[9px] font-black uppercase tracking-wider text-amber-500">
                            {currentEv.bonusTitle}
                          </span>
                          <div className="flex flex-wrap justify-center gap-1 w-full">
                            {currentEv.bonusBadges && currentEv.bonusBadges.length > 0 ? (
                              currentEv.bonusBadges.map((badge, bIdx) => (
                                <div
                                  key={bIdx}
                                  className="flex items-center justify-center gap-1 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-black text-foreground"
                                >
                                  <span>{badge.icon}</span>
                                  <span className="whitespace-nowrap">{badge.label}</span>
                                </div>
                              ))
                            ) : (
                              <span className="font-display text-xs font-black text-foreground whitespace-nowrap">
                                {currentEv.bonusHighlight}
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-muted-foreground font-semibold">
                            {currentEv.bonusScopeText}
                          </span>
                        </div>
                      </div>
                    </div>

                    {currentEv.linkedMedalId && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-card/80 border px-2.5 py-1.5 text-[11px]">
                        <Award className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span className="font-bold text-foreground">Medalha do Evento:</span>
                        <span className="text-muted-foreground truncate">
                          {currentEv.objectiveDescription || "Conclua os desafios do evento para desbloquear!"}
                        </span>
                      </div>
                    )}

                    {activeEvents.length > 1 && (
                      <div className="mt-2 flex justify-center gap-1">
                        {activeEvents.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setCurrentEventIndex(idx)}
                            aria-label={`Ir para evento ${idx + 1}`}
                            className={`h-1.5 rounded-full transition-all ${
                              idx === currentEventIndex % activeEvents.length
                                ? "w-5 bg-amber-500"
                                : "w-1.5 bg-amber-300 dark:bg-amber-800"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      <header className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary shadow-sm">
          <Sparkles className="h-3.5 w-3.5" /> Plataforma Educacional
        </div>
        <h1 className="mt-4 font-display text-5xl sm:text-7xl font-extrabold leading-none tracking-tight">
          Desafios de <span className="text-primary">Lógica</span>
        </h1>
        <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
          Jogos rápidos para treinar raciocínio lógico, matemática e coordenação motora. Escolha um
          desafio e comece!
        </p>
      </header>

      {/* Modos Competitivos Especiais: Torneio Semanal (Nv 3+) & Arena X1 (Nv 5+, 07h–19h) */}
      {(tournamentEnabled || x1Enabled) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {tournamentEnabled && onOpenWeeklyTournament && (
            <button
              type="button"
              onClick={onOpenWeeklyTournament}
              className="group flex flex-col justify-between rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-amber-500/10 p-5 text-left shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-primary">
                    <Medal className="h-3.5 w-3.5" /> Nível {TOURNAMENT_MIN_LEVEL}+ • +100 XP
                    Extra/Dia
                  </span>
                  {!canTournament && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      <Lock className="h-3 w-3" /> Requer Nv. {TOURNAMENT_MIN_LEVEL}
                    </span>
                  )}
                </div>
                <h2 className="font-display text-2xl font-extrabold flex items-center gap-2">
                  🏆 Torneio Semanal Ranqueado
                </h2>
                <p className="text-xs text-muted-foreground">
                  Jogo da semana: <b className="text-foreground">{weeklyGameName}</b>. Você tem{" "}
                  <b>10 entradas por dia</b> para subir ao Top 5, acumular tempo na colocação e
                  conquistar medalhas!
                </p>
              </div>

              <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground shadow-sm w-fit">
                {canTournament
                  ? "Ver Top 5 & Jogar Ranqueada →"
                  : `Bloqueado (Alcance o Nível ${TOURNAMENT_MIN_LEVEL})`}
              </div>
            </button>
          )}

          {x1Enabled && onOpenX1Arena && (
            <button
              type="button"
              onClick={onOpenX1Arena}
              className="group flex flex-col justify-between rounded-3xl border-2 border-accent/40 bg-gradient-to-br from-sky-500/10 via-card to-rose-500/10 p-5 text-left shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-accent">
                    <Swords className="h-3.5 w-3.5" /> Nível {X1_MIN_LEVEL}+ • +100 XP Extra/Dia
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    <Clock className="h-3 w-3" /> {x1HoursLabel}
                  </span>
                </div>
                <h2 className="font-display text-2xl font-extrabold flex items-center gap-2">
                  ⚔️ Arena de Batalha X1 Online
                </h2>
                <p className="text-xs text-muted-foreground">
                  Crie uma sala ou desafie colegas online no 1 vs 1! Partidas ilimitadas das{" "}
                  <b>{x1HoursLabel}</b> com bônus de até <b>+100 XP extras por dia</b>.
                </p>
              </div>

              <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-extrabold text-accent-foreground shadow-sm w-fit">
                {playerLevel < X1_MIN_LEVEL
                  ? `Bloqueado (Alcance o Nível ${X1_MIN_LEVEL})`
                  : !x1OpenNow
                    ? `Fechada agora (Abre ${x1HoursLabel})`
                    : canX1
                      ? "Abrir Arena X1 (1 vs 1) →"
                      : "Ver Arena X1 →"}
              </div>
            </button>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-5">
        {visible.map((g) => {
          const s = stats[g.id] ?? { bestScore: 0, bestLevel: 1 };
          const stageRecord = getGameStageRecord(g.id, stageId, gameRecords);
          return (
            <button
              key={g.id}
              onClick={() => onSelect(g.id)}
              className="group text-left rounded-3xl border bg-card p-6 shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all"
            >
              <div
                className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${g.gradient} text-white shadow-lg`}
              >
                {g.icon}
              </div>
              <h2 className="mt-5 font-display text-2xl font-bold">{g.title}</h2>
              <p className="text-muted-foreground">{g.subtitle}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Badge
                  icon={<Trophy className="h-3.5 w-3.5" />}
                  label="Seu Melhor"
                  value={s.bestScore}
                  tone="accent"
                />
                <Badge
                  icon={<Star className="h-3.5 w-3.5" />}
                  label="Nível"
                  value={s.bestLevel}
                  tone="primary"
                />
              </div>

              {/* Recorde da Etapa e Detentor(es) */}
              <div className="mt-4 rounded-2xl border bg-secondary/40 p-3 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Trophy className="h-3.5 w-3.5" /> Recorde da Etapa:
                  </span>
                  <span className="font-mono font-extrabold text-foreground">
                    {stageRecord ? `${stageRecord.score} pts` : "Ainda sem recorde"}
                  </span>
                </div>
                {stageRecord && stageRecord.holders.length > 0 && (
                  <div className="text-[11px] text-muted-foreground truncate">
                    <span className="font-bold text-foreground">
                      Detentor{stageRecord.holders.length > 1 ? "es" : ""}:
                    </span>{" "}
                    {stageRecord.holders.map((h, i) => (
                      <span key={h.playerId + i}>
                        {i > 0 && " • "}
                        <b className="text-foreground">{i + 1}º {h.nick}</b>
                        {h.achievedAt > 0 && ` (${formatRecordDateBR(h.achievedAt)})`}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-primary-foreground font-bold shadow-md group-hover:bg-primary/90">
                Jogar agora →
              </div>
            </button>
          );
        })}

        {/* Botão de inserir código sempre disponível na página inicial */}
        <button
          onClick={onAddCode}
          className="group flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed bg-card/50 p-6 text-center transition-all hover:border-primary hover:bg-card"
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="h-7 w-7" />
          </span>
          <span className="font-display text-xl font-bold">Inserir novo código de jogo</span>
          <span className="text-sm text-muted-foreground">
            Libere novos desafios ou digite o código da turma
          </span>
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Idealizado para alunos do 5º ao 9º ano • Funciona no celular, tablet e computador. Projeto
        INTEGRAÇÃO — SEMED-COARI.
      </p>
    </div>
  );
}

function Badge({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "accent";
}) {
  const cls = tone === "primary" ? "bg-primary/10 text-primary" : "bg-accent/15 text-accent";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}
    >
      {icon}
      <span className="opacity-80">{label}:</span> <span className="font-bold">{value}</span>
    </span>
  );
}
