import { Brain, Compass, Bot, Swords, Trophy, Star, Sparkles } from "lucide-react";
import type { AllStats, GameId } from "@/lib/game-storage";

interface Props {
  stats: AllStats;
  onSelect: (id: GameId) => void;
}

const GAMES: { id: GameId; title: string; subtitle: string; icon: React.ReactNode; gradient: string }[] = [
  {
    id: "logica",
    title: "Lógica Matemática",
    subtitle: "Verdadeiro ou Falso contra o tempo",
    icon: <Brain className="h-10 w-10" />,
    gradient: "from-primary to-primary-glow",
  },
  {
    id: "cartesiano",
    title: "Plano Cartesiano",
    subtitle: "Ache letras e coordenadas no plano",
    icon: <Compass className="h-10 w-10" />,
    gradient: "from-accent to-accent-glow",
  },
  {
    id: "robogrid",
    title: "RoboGrid",
    subtitle: "Localização espacial em um tabuleiro colorido",
    icon: <Bot className="h-10 w-10" />,
    gradient: "from-primary to-accent",
  },
  {
    id: "rpg",
    title: "RPG da Lógica",
    subtitle: "Aventura 2D: derrote monstros resolvendo desafios",
    icon: <Swords className="h-10 w-10" />,
    gradient: "from-accent to-primary",
  },
];

export function Menu({ stats, onSelect }: Props) {
  return (
    <div className="space-y-8">
      <header className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary shadow-sm">
          <Sparkles className="h-3.5 w-3.5" /> Plataforma Educacional
        </div>
        <h1 className="mt-4 font-display text-5xl sm:text-7xl font-extrabold leading-none tracking-tight">
          Desafios de <span className="text-primary">Lógica</span>
        </h1>
        <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
          Jogos rápidos para treinar raciocínio, matemática e o plano cartesiano. Escolha um desafio e comece!
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-5">
        {GAMES.map((g) => {
          const s = stats[g.id];
          return (
            <button
              key={g.id}
              onClick={() => onSelect(g.id)}
              className="group text-left rounded-3xl border bg-card p-6 shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all"
            >
              <div className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${g.gradient} text-white shadow-lg`}>
                {g.icon}
              </div>
              <h2 className="mt-5 font-display text-2xl font-bold">{g.title}</h2>
              <p className="text-muted-foreground">{g.subtitle}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Badge icon={<Trophy className="h-3.5 w-3.5" />} label="Melhor" value={s.bestScore} tone="accent" />
                <Badge icon={<Star className="h-3.5 w-3.5" />} label="Nível" value={s.bestLevel} tone="primary" />
              </div>

              <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-primary-foreground font-bold shadow-md group-hover:bg-primary/90">
                Jogar agora →
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Para alunos do 5º ano • Funciona no celular, tablet e computador
      </p>
    </div>
  );
}

function Badge({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: number; tone: "primary" | "accent" }) {
  const cls = tone === "primary" ? "bg-primary/10 text-primary" : "bg-accent/15 text-accent";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {icon}
      <span className="opacity-80">{label}:</span> <span className="font-bold">{value}</span>
    </span>
  );
}
