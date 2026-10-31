import { useState, useEffect } from "react";
import {
  Trophy,
  Star,
  Sparkles,
  KeyRound,
  Medal,
  Lock,
  Clock,
  Swords,
  Zap,
  Award,
} from "lucide-react";
import type { AllStats, GameId } from "@/lib/game-storage";
import { GAME_NAMES } from "@/lib/game-storage";
import { GAME_REGISTRY } from "@/lib/game-registry";
import { TOURNAMENT_MIN_LEVEL, X1_MIN_LEVEL } from "@/lib/player-profile";
import {
  getActiveSpecialEvents,
  formatEventRemainingTime,
  type SpecialEvent,
} from "@/lib/custom-events";
import integracaoPreto from "@/assets/integracao-preto.jpg";
import semed from "@/assets/semed.png";

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
  onSelect,
  onAddCode,
  onOpenX1Arena,
  onOpenWeeklyTournament,
}: Props) {
  const visible = GAME_REGISTRY.filter(
    (g) => enabledGames[g.id] && (!requireCodeGate || unlocked.includes(g.id)),
  );
  const canTournament = playerLevel >= TOURNAMENT_MIN_LEVEL;
  const canX1 = playerLevel >= X1_MIN_LEVEL && x1OpenNow;

  const [activeEvents, setActiveEvents] = useState<SpecialEvent[]>(() => getActiveSpecialEvents());

  useEffect(() => {
    const update = () => setActiveEvents(getActiveSpecialEvents());
    window.addEventListener("desafios:special-events-updated", update);
    const id = window.setInterval(update, 10000);
    return () => {
      window.removeEventListener("desafios:special-events-updated", update);
      window.clearInterval(id);
    };
  }, []);

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

      {/* Banner de Eventos Especiais Ativos (Dobro de XP / Limite Estendido) */}
      {activeEvents.map((ev) => {
        const remaining = formatEventRemainingTime(ev.endsAt);
        return (
          <div
            key={ev.id}
            className="rounded-3xl border-2 border-amber-500 bg-gradient-to-r from-amber-500/15 via-primary/10 to-amber-500/15 p-4 sm:p-5 shadow-lg animate-in fade-in-50"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-black text-white uppercase tracking-wider animate-pulse">
                    <Zap className="h-3.5 w-3.5" /> Evento Especial Ativo
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-card border px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                    <Clock className="h-3 w-3 text-amber-500" /> {remaining}
                  </span>
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-black text-foreground">
                  {ev.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {ev.description || "Aproveite os bônus especiais em vigor nesta temporada!"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="rounded-2xl border-2 border-amber-500/40 bg-card px-3.5 py-2 text-center shadow-sm">
                  <span className="block text-[10px] font-black uppercase text-amber-500">BÔNUS DO EVENTO</span>
                  <span className="font-display text-base font-black text-foreground">
                    {ev.bonusType === "dobro_xp"
                      ? "🔥 Dobro de XP (2x XP)"
                      : ev.bonusType === "xp_1_5x"
                      ? "⚡ 1.5x de XP (+50%)"
                      : `🚀 Limite ${ev.bonusValue} XP/dia`}
                  </span>
                  <span className="block text-[10px] text-muted-foreground font-semibold">
                    {ev.scope === "todos" ? "Todos os Jogos" : GAME_NAMES[ev.scope]}
                  </span>
                </span>
              </div>
            </div>

            {ev.linkedMedalId && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-card/80 border p-2 text-xs">
                <Award className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="font-bold text-foreground">Medalha Comemorativa do Evento:</span>
                <span className="text-muted-foreground">
                  {ev.objectiveDescription || "Conclua os desafios do evento para desbloquear!"}
                </span>
              </div>
            )}
          </div>
        );
      })}

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
                  label="Melhor"
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

              <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-primary-foreground font-bold shadow-md group-hover:bg-primary/90">
                Jogar agora →
              </div>
            </button>
          );
        })}

        {requireCodeGate && (
          <button
            onClick={onAddCode}
            className="group flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed bg-card/50 p-6 text-center transition-all hover:border-primary hover:bg-card"
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <KeyRound className="h-7 w-7" />
            </span>
            <span className="font-display text-xl font-bold">Inserir novo código de jogo</span>
            <span className="text-sm text-muted-foreground">
              Libere mais desafios na plataforma
            </span>
          </button>
        )}
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
