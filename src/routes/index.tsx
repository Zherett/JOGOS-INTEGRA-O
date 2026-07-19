import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu } from "@/components/games/Menu";
import { LogicGame } from "@/components/games/LogicGame";
import { CartesianGame } from "@/components/games/CartesianGame";
import { RoboGridGame } from "@/components/games/RoboGridGame";
import { RpgGame } from "@/components/games/RpgGame";
import { VariableHuntGame } from "@/components/games/VariableHuntGame";
import { loadStats, type AllStats, type GameId } from "@/lib/game-storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Desafios de Lógica — Plataforma Educacional" },
      { name: "description", content: "Jogos educativos de lógica matemática e plano cartesiano para alunos do 5º ano." },
      { property: "og:title", content: "Desafios de Lógica" },
      { property: "og:description", content: "Jogos educativos gamificados para o 5º ano do Ensino Fundamental." },
    ],
  }),
  component: Index,
});

const EMPTY_STATS: AllStats = {
  logica: { bestScore: 0, bestLevel: 1 },
  cartesiano: { bestScore: 0, bestLevel: 1 },
  robogrid: { bestScore: 0, bestLevel: 1 },
  rpg: { bestScore: 0, bestLevel: 1 },
  variaveis: { bestScore: 0, bestLevel: 1 },
};

function Index() {
  const [view, setView] = useState<"menu" | GameId>("menu");
  const [stats, setStats] = useState<AllStats>(EMPTY_STATS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setStats(loadStats());
  }, [view]);

  const refreshStats = () => setStats(loadStats());
  const displayStats = mounted ? stats : EMPTY_STATS;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      {view === "menu" && <Menu stats={displayStats} onSelect={(id) => setView(id)} />}
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
      {view === "rpg" && (
        <RpgGame onExit={() => setView("menu")} onStatsChange={refreshStats} />
      )}
    </main>
  );
}

