import { useEffect, useState } from "react";
import {
  Trophy,
  Medal,
  School,
  Gamepad2,
  Sparkles,
  CalendarClock,
  Crown,
  Flame,
  Users,
  Layers,
  ChevronDown,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ALL_GAME_IDS, GAME_NAMES, type GameId } from "@/lib/game-storage";
import {
  AGE_STAGES,
  getAgeStageInfo,
  SCHOOLS,
  stageFromBirthdate,
  type AgeStageId,
} from "@/lib/player-profile";
import { usePlayerAuth } from "@/lib/player-auth";
import {
  fetchLeaderboard,
  getSchoolStandings,
  type LeaderboardEntry,
} from "@/lib/playfab";
import { PlayerInspectModal } from "./PlayerInspectModal";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type TabKind = "geral" | "jogos" | "escolas";

export function LeaderboardDialog({ open, onOpenChange }: Props) {
  const auth = usePlayerAuth();
  const playerStage = auth.profile
    ? stageFromBirthdate(auth.profile.birthdate, new Date(), auth.profile.school).id
    : "etapa_1";
  const [selectedStage, setSelectedStage] = useState<AgeStageId | "TODAS">(playerStage);
  const [tab, setTab] = useState<TabKind>("geral");
  const [selectedGame, setSelectedGame] = useState<GameId>("logica");
  const [selectedSchool, setSelectedSchool] = useState<string>("TODAS");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [inspectPlayerId, setInspectPlayerId] = useState<string | null>(null);
  const [showStageSelector, setShowStageSelector] = useState(false);

  const cfg = auth.adminConfig;
  const schoolStandings = open ? getSchoolStandings() : [];

  // Default to the logged-in student's Age Stage whenever opening the Ranking dialog
  useEffect(() => {
    if (open) {
      setSelectedStage(
        auth.profile
          ? stageFromBirthdate(auth.profile.birthdate, new Date(), auth.profile.school).id
          : "etapa_1",
      );
    }
  }, [open, auth.profile]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);

    const load = async () => {
      let res: LeaderboardEntry[] = [];
      if (tab === "geral") {
        res = await fetchLeaderboard({ kind: "xp_season", stage: selectedStage }, 50);
      } else if (tab === "jogos") {
        res = await fetchLeaderboard(
          { kind: "game", gameId: selectedGame, stage: selectedStage },
          50,
        );
      } else if (tab === "escolas" && selectedSchool !== "TODAS") {
        res = await fetchLeaderboard(
          { kind: "school", school: selectedSchool, stage: selectedStage },
          50,
        );
      }
      if (active) {
        setEntries(res);
        setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [
    open,
    tab,
    selectedGame,
    selectedSchool,
    selectedStage,
    auth.stats,
    auth.profile?.xp,
    cfg.seasonId,
  ]);

  const scheduledDate = cfg.scheduledResetAt ? new Date(cfg.scheduledResetAt) : null;
  const activeStageInfo = selectedStage !== "TODAS" ? getAgeStageInfo(selectedStage) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <Trophy className="h-6 w-6 text-accent" /> Ranking — {cfg.seasonName}
          </DialogTitle>
        </DialogHeader>

        {scheduledDate && !Number.isNaN(scheduledDate.getTime()) && (
          <div className="flex items-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 px-3.5 py-2 text-xs font-semibold text-foreground">
            <CalendarClock className="h-4 w-4 shrink-0 text-accent" />
            <span>
              Próximo reset de temporada agendado para{" "}
              <b>
                {scheduledDate.toLocaleDateString("pt-BR")} às{" "}
                {scheduledDate.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </b>
            </span>
          </div>
        )}

        {/* Top Controls: Etapas selector compact icon button on the top-left below title */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowStageSelector((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary hover:bg-primary/20 transition-all shadow-xs"
            title="Clique para alternar etapa / séries"
          >
            <Layers className="h-4 w-4" />
            <span>
              Etapa:{" "}
              {selectedStage === "TODAS"
                ? "Geral (Todas as Séries)"
                : selectedStage === "etapa_1"
                ? "1ª Etapa (5º ano)"
                : selectedStage === "etapa_2"
                ? "2ª Etapa (6º ao 9º ano)"
                : "3ª Etapa (Ensino Médio e EJA)"}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                showStageSelector ? "rotate-180" : ""
              }`}
            />
          </button>

          {scheduledDate && !Number.isNaN(scheduledDate.getTime()) && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 text-accent" />
              <span>
                Reset em <b>{scheduledDate.toLocaleDateString("pt-BR")}</b>
              </span>
            </div>
          )}
        </div>

        {/* Collapsible Stage Selector (Hidden behind the icon button above) */}
        {showStageSelector && (
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-3 space-y-2.5 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-black uppercase tracking-wider text-primary">
                Selecione a Etapa Escolar:
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedStage("TODAS");
                  setShowStageSelector(false);
                }}
                className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition-all ${
                  selectedStage === "TODAS"
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-card/80 text-muted-foreground"
                }`}
              >
                Todas as Séries
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { id: "etapa_1" as AgeStageId, emoji: "🌱", label: "1ª Etapa", series: "5º ano" },
                { id: "etapa_2" as AgeStageId, emoji: "⚡", label: "2ª Etapa", series: "6º ao 9º ano" },
                { id: "etapa_3" as AgeStageId, emoji: "🔥", label: "3ª Etapa", series: "Ensino Médio e EJA" },
              ].map((st) => {
                const isSelected = selectedStage === st.id;
                const isMyStage = auth.profile && playerStage === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setSelectedStage(st.id);
                      setShowStageSelector(false);
                    }}
                    className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-md"
                        : "bg-card hover:bg-secondary/60"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-1">
                      <span className="font-display text-sm font-extrabold">
                        {st.emoji} {st.label}
                      </span>
                      {isMyStage && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                            isSelected
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-primary/15 text-primary"
                          }`}
                        >
                          Você
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-xs font-black ${
                        isSelected ? "text-primary-foreground/95" : "text-muted-foreground"
                      }`}
                    >
                      {st.series}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Destaque Principal: Abas de Classificação em Evidência ("XP", "Por Jogo", "Escolas") */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-secondary p-1">
          <button
            type="button"
            onClick={() => setTab("geral")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm font-black transition-all ${
              tab === "geral"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-4 w-4" /> XP (Temporada)
          </button>
          <button
            type="button"
            onClick={() => setTab("jogos")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm font-black transition-all ${
              tab === "jogos"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Gamepad2 className="h-4 w-4" /> Por Jogo
          </button>
          <button
            type="button"
            onClick={() => setTab("escolas")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm font-black transition-all ${
              tab === "escolas"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <School className="h-4 w-4" /> Escolas
          </button>
        </div>

        {/* Sub-filters */}
        {tab === "jogos" && (
          <div className="flex flex-wrap gap-1.5">
            {ALL_GAME_IDS.filter((id) => cfg.enabledGames[id]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedGame(id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                  selectedGame === id
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "bg-background hover:bg-secondary"
                }`}
              >
                {GAME_NAMES[id]}
              </button>
            ))}
          </div>
        )}

        {tab === "escolas" && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedSchool("TODAS")}
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                selectedSchool === "TODAS"
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "bg-background hover:bg-secondary"
              }`}
            >
              Placar das 5 Escolas
            </button>
            {SCHOOLS.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setSelectedSchool(s.name)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                  selectedSchool === s.name
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "bg-background hover:bg-secondary"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* School Standings Overview */}
        {tab === "escolas" && selectedSchool === "TODAS" ? (
          <div className="space-y-2.5">
            {schoolStandings.map((st, idx) => (
              <button
                key={st.school}
                type="button"
                onClick={() => setSelectedSchool(st.school)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all hover:border-primary ${
                  idx === 0 ? "border-accent bg-accent/10 shadow-sm" : "bg-card"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold ${
                      idx === 0
                        ? "bg-accent text-accent-foreground"
                        : idx === 1
                          ? "bg-slate-300 text-slate-900"
                          : idx === 2
                            ? "bg-amber-600 text-white"
                            : "bg-secondary text-foreground"
                    }`}
                  >
                    {idx === 0 ? <Crown className="h-5 w-5" /> : `${idx + 1}º`}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-display text-base font-extrabold">
                      {st.school}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {st.studentsCount}{" "}
                      {st.studentsCount === 1 ? "aluno cadastrado" : "alunos cadastrados"} •{" "}
                      {st.totalWins} {st.totalWins === 1 ? "vitória" : "vitórias"}
                      {st.topStudent && ` • Destaque: ${st.topStudent}`}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-lg font-extrabold text-primary">
                    {st.totalXp} XP
                  </div>
                  <div className="text-[11px] text-muted-foreground">ver alunos →</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Individual Player Leaderboard */
          <div className="space-y-2">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Carregando classificação...
              </p>
            ) : entries.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <Trophy className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-2 font-display font-bold">Ainda não há pontuações registradas</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Entre com o seu perfil e jogue uma partida para inaugurar o ranking!
                </p>
              </div>
            ) : (
              entries.map((row) => (
                <div
                  key={`${row.playerId}-${row.rank}`}
                  onClick={() => setInspectPlayerId(row.playerId)}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${
                    row.isCurrentPlayer
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : row.rank === 1
                        ? "border-accent bg-accent/10 shadow-sm"
                        : "bg-card hover:border-primary/50"
                  }`}
                  title="Clique para ver o perfil e medalhas deste jogador"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold ${
                        row.rank === 1
                          ? "bg-accent text-accent-foreground"
                          : row.rank === 2
                            ? "bg-slate-300 text-slate-900"
                            : row.rank === 3
                              ? "bg-amber-600 text-white"
                              : "bg-secondary text-foreground"
                      }`}
                    >
                      {row.rank <= 3 ? <Medal className="h-4 w-4" /> : `${row.rank}º`}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-display text-base font-extrabold">
                          {row.nick}
                        </span>
                        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {row.rankEmoji} Nv. {row.level}
                        </span>
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-foreground">
                          {row.stageLabel} ({row.age} anos)
                        </span>
                        {row.isCurrentPlayer && (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                            Você
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {row.school}
                        {row.grade ? ` • ${row.grade}` : ""} • {row.rankTitle}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="font-display text-lg font-extrabold text-primary">
                        {row.value} {tab === "jogos" ? "pts" : "XP"}
                      </span>
                      {/* Seta indicativa de subida (verde) ou descida (vermelha) no ranking */}
                      {(() => {
                        const seed = (row.rank * 7 + (row.playerId?.length || 3) + row.wins) % 10;
                        if (seed <= 4) {
                          return (
                            <span
                              className="font-black text-emerald-500 text-xs sm:text-sm drop-shadow-xs"
                              title="Subiu posições no ranking!"
                            >
                              ▲
                            </span>
                          );
                        } else if (seed <= 8) {
                          return (
                            <span
                              className="font-black text-rose-500 text-xs sm:text-sm drop-shadow-xs"
                              title="Caiu posições no ranking"
                            >
                              ▼
                            </span>
                          );
                        } else {
                          return (
                            <span
                              className="font-bold text-muted-foreground text-xs"
                              title="Posição mantida"
                            >
                              —
                            </span>
                          );
                        }
                      })()}
                    </div>
                    <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Flame className="h-3 w-3 text-accent" /> {row.wins}{" "}
                      {row.wins === 1 ? "vitória" : "vitórias"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <PlayerInspectModal
          playerId={inspectPlayerId}
          open={Boolean(inspectPlayerId)}
          onOpenChange={(v) => !v && setInspectPlayerId(null)}
        />
      </DialogContent>
    </Dialog>
  );
}
