// Storage helpers for best scores per game
const KEY = "desafios-logica-stats-v1";

export type GameId = "logica" | "cartesiano" | "robogrid";

export interface GameStats {
  bestScore: number;
  bestLevel: number;
}

export type AllStats = Record<GameId, GameStats>;

const DEFAULT: AllStats = {
  logica: { bestScore: 0, bestLevel: 1 },
  cartesiano: { bestScore: 0, bestLevel: 1 },
  robogrid: { bestScore: 0, bestLevel: 1 },
};

export function loadStats(): AllStats {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function saveStats(stats: AllStats) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(stats));
}

export function updateBest(id: GameId, score: number, level: number): AllStats {
  const cur = loadStats();
  const next: AllStats = {
    ...cur,
    [id]: {
      bestScore: Math.max(cur[id].bestScore, score),
      bestLevel: Math.max(cur[id].bestLevel, level),
    },
  };
  saveStats(next);
  return next;
}
