// Storage helpers for best scores per game
const KEY = "desafios-logica-stats-v1";
const LAST_KEY = "desafios-logica-last-v1";

export type GameId = "logica" | "cartesiano" | "robogrid" | "rpg" | "variaveis" | "formas" | "memoria" | "minado";

export interface GameStats {
  bestScore: number;
  bestLevel: number;
}

export type AllStats = Record<GameId, GameStats>;

export interface LastMatch {
  score: number;
  correct: number;
  wrong: number;
  level: number;
  at: number; // epoch ms
}

export type AllLastMatches = Partial<Record<GameId, LastMatch>>;

const DEFAULT: AllStats = {
  logica: { bestScore: 0, bestLevel: 1 },
  cartesiano: { bestScore: 0, bestLevel: 1 },
  robogrid: { bestScore: 0, bestLevel: 1 },
  rpg: { bestScore: 0, bestLevel: 1 },
  variaveis: { bestScore: 0, bestLevel: 1 },
  formas: { bestScore: 0, bestLevel: 1 },
  memoria: { bestScore: 0, bestLevel: 1 },
  minado: { bestScore: 0, bestLevel: 1 },
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

function loadAllLast(): AllLastMatches {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LAST_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function loadLastMatch(id: GameId): LastMatch | null {
  return loadAllLast()[id] ?? null;
}

export function saveLastMatch(id: GameId, match: Omit<LastMatch, "at"> & { at?: number }) {
  if (typeof window === "undefined") return;
  const all = loadAllLast();
  all[id] = { ...match, at: match.at ?? Date.now() };
  window.localStorage.setItem(LAST_KEY, JSON.stringify(all));
}
