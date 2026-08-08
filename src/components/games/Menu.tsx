import { Brain, Compass, Bot, Swords, Variable, Trophy, Star, Sparkles, Shapes, Palette, Grid3x3, KeyRound } from "lucide-react";
import type { AllStats, GameId } from "@/lib/game-storage";
import integracaoPreto from "@/assets/integracao-preto.asset.json";
import semed from "@/assets/semed.asset.json";

// Toggle to re-enable games in the menu without deleting their code.
const ENABLED_GAMES: Record<GameId, boolean> = {
  logica: true,
  cartesiano: true,
  robogrid: true,
  rpg: false, // temporariamente oculto
  variaveis: true,
  formas: true,
  memoria: true,
  minado: true,
};

interface Props {
  stats: AllStats;
  unlocked: GameId[];
  onSelect: (id: GameId) => void;
  onAddCode: () => void;
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
    id: "formas",
    title: "Formas e Cores",
    subtitle: "Arraste formas geométricas por cor, forma e tamanho",
    icon: <Shapes className="h-10 w-10" />,
    gradient: "from-primary-glow to-accent",
  },
  {
    id: "memoria",
    title: "Memória das Cores",
    subtitle: "Repita a sequência antes do tempo acabar",
    icon: <Palette className="h-10 w-10" />,
    gradient: "from-primary to-accent-glow",
  },
  {
    id: "variaveis",
    title: "Caça às Variáveis",
    subtitle: "Arraste o número certo para resolver a expressão",
    icon: <Variable className="h-10 w-10" />,
    gradient: "from-accent-glow to-primary",
  },
  {
    id: "robogrid",
    title: "RoboGrid",
    subtitle: "Localização espacial em um tabuleiro colorido",
    icon: <Bot className="h-10 w-10" />,
    gradient: "from-primary to-accent",
  },
  {
    id: "minado",
    title: "Campo Minado Lógico",
    subtitle: "Vire cartas do tabuleiro 8×8 e responda desafios",
    icon: <Grid3x3 className="h-10 w-10" />,
    gradient: "from-accent to-primary-glow",
  },
  {
    id: "rpg",
    title: "RPG da Lógica",
    subtitle: "Aventura 2D: derrote monstros resolvendo desafios",
    icon: <Swords className="h-10 w-10" />,
    gradient: "from-accent to-primary",
  },
];

export function Menu({ stats, unlocked, onSelect, onAddCode }: Props) {
  const visible = GAMES.filter((g) => ENABLED_GAMES[g.id] && unlocked.includes(g.id));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <img
          src={integracaoPreto.url}
          alt="Logo do Projeto INTEGRAÇÃO"
          width={160}
          height={80}
          className="h-12 w-auto sm:h-16 rounded-lg object-contain"
        />
        <img
          src={semed.url}
          alt="Logo da SEMED Coari"
          width={160}
          height={80}
          className="h-12 w-auto sm:h-16 rounded-lg object-contain"
        />
      </div>

      <header className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary shadow-sm">
          <Sparkles className="h-3.5 w-3.5" /> Plataforma Educacional
        </div>
        <h1 className="mt-4 font-display text-5xl sm:text-7xl font-extrabold leading-none tracking-tight">
          Desafios de <span className="text-primary">Lógica</span>
        </h1>
        <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
          Jogos rápidos para treinar raciocínio lógico, matemática e coordenação motora. Escolha um desafio e comece!
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-5">
        {visible.map((g) => {
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

        <button
          onClick={onAddCode}
          className="group flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed bg-card/50 p-6 text-center transition-all hover:border-primary hover:bg-card"
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound className="h-7 w-7" />
          </span>
          <span className="font-display text-xl font-bold">Inserir novo código de jogo</span>
          <span className="text-sm text-muted-foreground">Libere mais desafios na plataforma</span>
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Idealizado para alunos do 5º ao 9º ano • Funciona no celular, tablet e computador. Projeto INTEGRAÇÃO — SEMED-COARI.
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
