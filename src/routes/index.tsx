import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Menu } from "@/components/games/Menu";
import { getGameRegistration } from "@/lib/game-registry";
import { CodeGate } from "@/components/games/CodeGate";
import { loadUnlocked } from "@/lib/game-codes";
import { PlayerAuthProvider, usePlayerAuth } from "@/lib/player-auth";
import { PlayerMenu } from "@/components/games/PlayerMenu";
import { PlayerAuthDialog } from "@/components/games/PlayerAuthDialog";
import { X1ArenaDialog } from "@/components/games/X1ArenaDialog";
import { X1MatchOverlay } from "@/components/games/X1MatchOverlay";
import { WeeklyTournamentDialog } from "@/components/games/WeeklyTournamentDialog";
import { MedalUnlockNotification } from "@/components/games/MedalUnlockNotification";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { heartbeatOnlinePlayer, type X1Room } from "@/lib/x1-challenge";
import {
  getWeekInfo,
  recordWeeklyTournamentAttempt,
  resolveWeeklyTournamentGame,
} from "@/lib/weekly-tournament";
import {
  ageFrom,
  getLocalDateKey,
  isX1WindowOpen,
  stageFromBirthdate,
  TOURNAMENT_DAILY_ENTRIES_LIMIT,
  TOURNAMENT_DAILY_EXTRA_XP_CAP,
} from "@/lib/player-profile";
import {
  DEFAULT_STATS,
  GAME_NAMES,
  loadStats,
  type AllStats,
  type GameId,
} from "@/lib/game-storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Desafios de Lógica — Plataforma Educacional" },
      {
        name: "description",
        content:
          "Jogos educativos de lógica matemática e raciocínio para alunos do 5º ao 9º ano.",
      },
      { property: "og:title", content: "Desafios de Lógica" },
      {
        property: "og:description",
        content: "Jogos educativos gamificados — Projeto INTEGRAÇÃO (SEMED Coari).",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IndexPage,
});

export function IndexPage() {
  return (
    <PlayerAuthProvider>
      <Index />
    </PlayerAuthProvider>
  );
}

function Index() {
  const [view, setView] = useState<"menu" | GameId>("menu");
  const [stats, setStats] = useState<AllStats>(DEFAULT_STATS);
  const [mounted, setMounted] = useState(false);
  const [unlocked, setUnlocked] = useState<GameId[]>([]);
  const [addingCode, setAddingCode] = useState(false);
  const [x1Open, setX1Open] = useState(false);
  const [tournamentOpen, setTournamentOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [activeX1Room, setActiveX1Room] = useState<X1Room | null>(null);
  const [activeRankedGameId, setActiveRankedGameId] = useState<GameId | null>(null);
  const [confirmAbandonOpen, setConfirmAbandonOpen] = useState(false);
  const auth = usePlayerAuth();

  const refreshLocal = () => {
    setStats(loadStats());
    setUnlocked(loadUnlocked());
  };

  async function finishRankedEntry(exitToMenu = true) {
    if (!activeRankedGameId) {
      if (exitToMenu) setView("menu");
      return;
    }
    const gId = activeRankedGameId;
    const latestStats = loadStats();
    const score = latestStats[gId]?.bestScore ?? 0;
    const level = latestStats[gId]?.bestLevel ?? 1;
    setActiveRankedGameId(null);

    if (auth.profile) {
      await recordWeeklyTournamentAttempt({
        profile: auth.profile,
        score: Math.max(10, score),
      });
      await auth.recordMatch({
        gameId: gId,
        mode: "torneio_semanal",
        score: Math.max(10, score),
        level,
        correct: 1,
        wrong: 0,
      });
    }
    refreshLocal();
    if (exitToMenu) {
      setView("menu");
      setTournamentOpen(true);
    }
  }

  useEffect(() => {
    setMounted(true);
    refreshLocal();
  }, [view]);

  // Keep logged-in student visible in the online players list across the platform
  useEffect(() => {
    if (!auth.profile) return;
    const p = auth.profile;
    const pulse = () => {
      heartbeatOnlinePlayer({
        playerId: p.id,
        nick: p.nick,
        fullName: p.full_name,
        school: p.school,
        level: p.level,
        age: ageFrom(p.birthdate),
        stage: stageFromBirthdate(p.birthdate, new Date(), p.school).id,
        inRoomCode: activeX1Room?.code ?? null,
      });
    };
    pulse();
    const id = window.setInterval(pulse, 8000);
    return () => window.clearInterval(id);
  }, [auth.profile, activeX1Room?.code]);

  useEffect(() => {
    if (auth.unlocked.length === 0) return;
    setUnlocked((cur) => [...new Set([...cur, ...auth.unlocked])]);
  }, [auth.unlocked]);

  // Merge local stats with logged-in player's PlayFab stats
  const displayStats = useMemo<AllStats>(() => {
    if (!mounted) return DEFAULT_STATS;
    const merged: AllStats = { ...stats };
    for (const row of auth.stats) {
      const cur = merged[row.game_id] ?? { bestScore: 0, bestLevel: 1 };
      merged[row.game_id] = {
        bestScore: Math.max(cur.bestScore, row.best_score),
        bestLevel: Math.max(cur.bestLevel, row.best_level),
      };
    }
    return merged;
  }, [mounted, stats, auth.stats]);

  const cfg = auth.adminConfig;
  const visibleUnlockedCount = unlocked.filter((id) => cfg.enabledGames[id]).length;
  const showGate =
    mounted &&
    !auth.loading &&
    cfg.requireCodeGate &&
    (addingCode || visibleUnlockedCount === 0);

  const openHour = cfg.x1OpenHour ?? 7;
  const closeHour = cfg.x1CloseHour ?? 19;
  const x1OpenNow =
    Boolean(cfg.x1ForceOpen) || isX1WindowOpen(new Date(), openHour, closeHour);
  const x1HoursLabel = cfg.x1ForceOpen
    ? "Liberado pelo ADM"
    : `${String(openHour).padStart(2, "0")}:00 às ${String(closeHour).padStart(2, "0")}:00`;
  const { weekIndex } = getWeekInfo();
  const weeklyGameId = resolveWeeklyTournamentGame(
    weekIndex,
    cfg.tournamentGameOverride,
    cfg.enabledGames,
  );
  const weeklyGameName = GAME_NAMES[weeklyGameId] ?? weeklyGameId;

  const todayKey = getLocalDateKey();
  const isTodayRecord = auth.profile && auth.profile.dailyXpDate === todayKey;
  const dailyTournamentEntries = isTodayRecord
    ? Math.max(0, auth.profile?.dailyTournamentEntries ?? 0)
    : 0;
  const dailyTournamentXp = isTodayRecord
    ? Math.max(0, auth.profile?.dailyTournamentXp ?? 0)
    : 0;

  const handleExitGame = () => {
    if (activeRankedGameId) {
      setConfirmAbandonOpen(true);
    } else {
      setView("menu");
    }
  };

  const handleConfirmAbandon = () => {
    setActiveRankedGameId(null);
    setConfirmAbandonOpen(false);
    setView("menu");
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <div className="mb-4 flex justify-end">
        <PlayerMenu
          onConfigChanged={() => {
            refreshLocal();
            void auth.refresh();
          }}
        />
      </div>

      {view === "menu" && showGate && (
        <CodeGate
          hasGames={visibleUnlockedCount > 0}
          onUnlocked={(game) => {
            const list = loadUnlocked();
            setUnlocked(list);
            void auth.unlockGames(game ? [game] : list);
            setAddingCode(false);
          }}
          onBack={visibleUnlockedCount > 0 ? () => setAddingCode(false) : undefined}
        />
      )}
      {view === "menu" && !showGate && (
        <Menu
          stats={displayStats}
          unlocked={unlocked}
          enabledGames={cfg.enabledGames}
          requireCodeGate={cfg.requireCodeGate}
          x1Enabled={cfg.x1Enabled ?? true}
          x1OpenNow={x1OpenNow}
          x1HoursLabel={x1HoursLabel}
          tournamentEnabled={cfg.tournamentEnabled ?? true}
          weeklyGameName={weeklyGameName}
          playerLevel={auth.profile?.level}
          onSelect={(id) => {
            setActiveRankedGameId(null);
            setView(id);
          }}
          onAddCode={() => setAddingCode(true)}
          onOpenX1Arena={() => setX1Open(true)}
          onOpenWeeklyTournament={() => setTournamentOpen(true)}
        />
      )}

      {/* Banner Ao Vivo de Entrada no Torneio Semanal Ranqueado */}
      {activeRankedGameId && view === activeRankedGameId && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-primary bg-primary/10 px-4 py-3 shadow-sm">
          <div>
            <div className="font-display text-sm font-extrabold text-primary">
              🏆 TORNEIO SEMANAL RANQUEADO ATIVO — {GAME_NAMES[activeRankedGameId]}
            </div>
            <div className="text-xs text-muted-foreground">
              Entrada <b>{Math.min(TOURNAMENT_DAILY_ENTRIES_LIMIT, dailyTournamentEntries + 1)}/{TOURNAMENT_DAILY_ENTRIES_LIMIT}</b> de hoje • XP Extra Torneio:{" "}
              <b>{dailyTournamentXp}/{TOURNAMENT_DAILY_EXTRA_XP_CAP} XP</b> (+10 XP garantidos ao concluir!)
            </div>
          </div>
          <button
            type="button"
            onClick={() => void finishRankedEntry(true)}
            className="rounded-xl bg-primary px-4 py-2 font-display text-xs font-extrabold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] active:scale-95"
          >
            Concluir Entrada e Salvar no Ranking →
          </button>
        </div>
      )}

      {/* Overlay Ao Vivo do Desafio X1 (1v1) */}
      {activeX1Room && (
        <X1MatchOverlay
          initialRoom={activeX1Room}
          onExitX1={() => {
            setActiveX1Room(null);
            setView("menu");
            refreshLocal();
          }}
        />
      )}

      {/* Execução Dinâmica de Qualquer Jogo Registrado */}
      {(!activeX1Room || activeX1Room.gameId !== "rpg") && view !== "menu" && (() => {
        const reg = getGameRegistration(view);
        if (!reg) return null;
        const GameComponent = reg.component;
        return (
          <GameComponent
            onExit={handleExitGame}
            onStatsChange={refreshLocal}
            isRanked={Boolean(activeRankedGameId && view === activeRankedGameId)}
          />
        );
      })()}

      <X1ArenaDialog
        open={x1Open}
        onOpenChange={setX1Open}
        onStartX1Match={(room) => {
          setActiveRankedGameId(null);
          setActiveX1Room(room);
          setView(room.gameId);
        }}
        onRequireLogin={() => setAuthDialogOpen(true)}
      />

      <WeeklyTournamentDialog
        open={tournamentOpen}
        onOpenChange={setTournamentOpen}
        onStartRankedEntry={(gameId) => {
          setActiveX1Room(null);
          setActiveRankedGameId(gameId);
          setView(gameId);
        }}
        onRequireLogin={() => setAuthDialogOpen(true)}
      />

      <PlayerAuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />

      <MedalUnlockNotification />

      {/* Confirmação de Abandono de Partida Ranqueada */}
      <AlertDialog open={confirmAbandonOpen} onOpenChange={setConfirmAbandonOpen}>
        <AlertDialogContent className="rounded-3xl border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-black text-destructive">
              Abandonar Desafio Ranqueado?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Você está disputando uma partida oficial do <b>Torneio Semanal Ranqueado</b>.
              Se sair agora antes de finalizar a atividade, o seu progresso não será computado no ranking e a tentativa será perdida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl font-bold">
              Continuar Jogando
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAbandon}
              className="rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, Abandonar Partida
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
