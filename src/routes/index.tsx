import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu } from "@/components/games/Menu";
import { LogicGame } from "@/components/games/LogicGame";
import { CartesianGame } from "@/components/games/CartesianGame";
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

function Index() {
  const [view, setView] = useState<"menu" | GameId>("menu");
  const [stats, setStats] = useState<AllStats>(() => loadStats());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setStats(loadStats());
  }, [view]);

  const refreshStats = () => setStats(loadStats());
  const displayStats = mounted ? stats : loadStatsSSR();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      {view === "menu" && <Menu stats={stats} onSelect={(id) => setView(id)} />}
      {view === "logica" && (
        <LogicGame onExit={() => setView("menu")} onStatsChange={refreshStats} />
      )}
      {view === "cartesiano" && (
        <CartesianGame onExit={() => setView("menu")} onStatsChange={refreshStats} />
      )}
    </main>
  );
}
