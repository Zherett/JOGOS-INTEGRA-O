import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu } from "@/components/games/Menu";
import { LogicGame } from "@/components/games/LogicGame";
import { CartesianGame } from "@/components/games/CartesianGame";
import { RoboGridGame } from "@/components/games/RoboGridGame";
import { RpgGame } from "@/components/games/RpgGame";
import { VariableHuntGame } from "@/components/games/VariableHuntGame";
import { ShapeColorGame } from "@/components/games/ShapeColorGame";
import { ColorMemoryGame } from "@/components/games/ColorMemoryGame";
import { PercentGame } from "@/components/games/PercentGame";
import { MinefieldGame } from "@/components/games/MinefieldGame";
import { CodeGate } from "@/components/games/CodeGate";
import { loadUnlocked } from "@/lib/game-codes";
import { PlayerAuthProvider, usePlayerAuth } from "@/lib/player-auth";
import { PlayerMenu } from "@/components/games/PlayerMenu";
import { loadStats, type AllStats, type GameId } from "@/lib/game-storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Desafios de Lógica — Plataforma Educacional" },
      { name: "description", content: "Jogos educativos de lógica matemática e plano cartesiano para alunos do 5º ano." },
      { property: "og:title", content: "Desafios de Lógica" },
      { property: "og:description", content: "Jogos educativos gamificados para o 5º ano do Ensino Fundamental." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  return (
    <PlayerAuthProvider>
      <Index />
    </PlayerAuthProvider>
  );
}

const EMPTY_STATS: AllStats = {
  logica: { bestScore: 0, bestLevel: 1 },
  cartesiano: { bestScore: 0, bestLevel: 1 },
  robogrid: { bestScore: 0, bestLevel: 1 },
  rpg: { bestScore: 0, bestLevel: 1 },
  variaveis: { bestScore: 0, bestLevel: 1 },
  formas: { bestScore: 0, bestLevel: 1 },
  memoria: { bestScore: 0, bestLevel: 1 },
  minado: { bestScore: 0, bestLevel: 1 },
  porcentagem: { bestScore: 0, bestLevel: 1 },
};

function Index() {
  const [view, setView] = useState<"menu" | GameId>("menu");
  const [stats, setStats] = useState<AllStats>(EMPTY_STATS);
  const [mounted, setMounted] = useState(false);
  const [unlocked, setUnlocked] = useState<GameId[]>([]);
  const [addingCode, setAddingCode] = useState(false);
  const auth = usePlayerAuth();

  useEffect(() => {
    setMounted(true);
    setStats(loadStats());
    setUnlocked(loadUnlocked());
  }, [view]);

  useEffect(() => {
    if (auth.unlocked.length === 0) return;
    setUnlocked((cur) => [...new Set([...cur, ...auth.unlocked])]);
  }, [auth.unlocked]);

  const refreshStats = () => setStats(loadStats());
  const displayStats = mounted ? stats : EMPTY_STATS;

  const showGate = mounted && !auth.loading && (addingCode || unlocked.length === 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <div className="mb-4 flex justify-end">
        <PlayerMenu />
      </div>

      {view === "menu" && showGate && (
        <CodeGate
          hasGames={unlocked.length > 0}
          onUnlocked={(game) => {
            const list = loadUnlocked();
            setUnlocked(list);
            void auth.unlockGames(game ? [game] : list);
            setAddingCode(false);
          }}
          onBack={unlocked.length > 0 ? () => setAddingCode(false) : undefined}
        />
      )}
      {view === "menu" && !showGate && (
        <Menu
          stats={displayStats}
          unlocked={unlocked}
          onSelect={(id) => setView(id)}
          onAddCode={() => setAddingCode(true)}
        />
      )}

      {view === "logica" && (
        <LogicGame onExit={() => setView("menu")} onStatsChange={refreshStats} />
      )}
      {view === "cartesiano" && (
        <CartesianGame onExit={() => setView("menu")} onStatsChange={refreshStats} />
      )}
      {view === "robogrid" && (
        <RoboGridGame onExit={() => setView("menu")} onStatsChange={refreshStats} />
      )}
      {view === "variaveis" && (
        <VariableHuntGame onExit={() => setView("menu")} onStatsChange={refreshStats} />
      )}
      {view === "formas" && (
        <ShapeColorGame onExit={() => setView("menu")} onStatsChange={refreshStats} />
      )}
      {view === "memoria" && (
        <ColorMemoryGame onExit={() => setView("menu")} onStatsChange={refreshStats} />
      )}
      {view === "minado" && (
        <MinefieldGame onExit={() => setView("menu")} onStatsChange={refreshStats} />
      )}

      {view === "porcentagem" && (
        <PercentGame onExit={() => setView("menu")} onStatsChange={refreshStats} />
      )}

      {view === "rpg" && (
        <RpgGame onExit={() => setView("menu")} onStatsChange={refreshStats} />
      )}
    </main>
  );
}

