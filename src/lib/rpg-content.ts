// RPG da Lógica — content generators (enemies, challenges)
import { generateBalanced, ALL_OPS, type Question } from "./logic-questions";

export type Difficulty = "very-easy" | "easy" | "medium" | "hard" | "very-hard";

export const DIFFICULTY_TIME: Record<Difficulty, number> = {
  "very-easy": 30,
  easy: 25,
  medium: 20,
  hard: 15,
  "very-hard": 10,
};

export interface EnemyDef {
  kind: string;
  name: string;
  emoji: string;
  hp: number; // respostas certas para derrotar
  xp: number;
  coins: number;
  difficulty: Difficulty;
  color: string;
  size: number; // px
  boss?: boolean;
}

export const ENEMIES: EnemyDef[] = [
  { kind: "slime", name: "Slime", emoji: "🟢", hp: 1, xp: 6, coins: 3, difficulty: "very-easy", color: "#4ade80", size: 40 },
  { kind: "bat", name: "Morcego", emoji: "🦇", hp: 2, xp: 10, coins: 4, difficulty: "easy", color: "#a78bfa", size: 42 },
  { kind: "goblin", name: "Goblin", emoji: "👺", hp: 3, xp: 16, coins: 6, difficulty: "easy", color: "#84cc16", size: 46 },
  { kind: "skeleton", name: "Esqueleto", emoji: "💀", hp: 5, xp: 26, coins: 10, difficulty: "medium", color: "#e5e7eb", size: 48 },
  { kind: "knight", name: "Cavaleiro Sombrio", emoji: "🛡️", hp: 8, xp: 42, coins: 18, difficulty: "hard", color: "#94a3b8", size: 52 },
];

export const MINI_BOSS: EnemyDef = {
  kind: "ogre", name: "Ogro Mini-Chefe", emoji: "👹", hp: 10, xp: 80, coins: 40,
  difficulty: "hard", color: "#f97316", size: 68, boss: true,
};

export const BOSSES: EnemyDef[] = [
  { kind: "demon", name: "Demônio da Lógica", emoji: "😈", hp: 12, xp: 120, coins: 60, difficulty: "hard", color: "#dc2626", size: 78, boss: true },
  { kind: "dragon", name: "Dragão do Cálculo", emoji: "🐉", hp: 15, xp: 200, coins: 100, difficulty: "very-hard", color: "#7c3aed", size: 90, boss: true },
];

// Map difficulty → question generator level
function difficultyToLevel(d: Difficulty): number {
  switch (d) {
    case "very-easy": return 1;
    case "easy": return 1;
    case "medium": return 2;
    case "hard": return 3;
    case "very-hard": return 4;
  }
}

export function makeChallenge(d: Difficulty, recent: string[], recentAns: boolean[]): Question {
  return generateBalanced(difficultyToLevel(d), recent, recentAns, ALL_OPS);
}

// XP required to reach next level (cumulative simple curve)
export function xpForNext(level: number): number {
  return 40 + (level - 1) * 30;
}
