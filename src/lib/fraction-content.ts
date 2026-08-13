// Dynamic question generator for "Desafio das Frações" (5th grade)

export type FractionLevel = 1 | 2 | 3 | 4 | 5 | 6; // 6 = desafio final

export interface PizzaSpec {
  parts: number;
  /** How many slices must end up selected. */
  target: number;
  /** Initial visual state of each slice. */
  initial: boolean[];
}

export interface FractionBuildQuestion {
  kind: "frac-build";
  id: number;
  prompt: string;
  pizzas: PizzaSpec[];
  tip: string;
}

export interface FractionIdQuestion {
  kind: "frac-id";
  id: number;
  prompt: string;
  parts: number;
  filled: number;
  options: string[];
  answer: string;
  tip: string;
}

export type FractionQuestion = FractionBuildQuestion | FractionIdQuestion;

let uid = 1;
const nextId = () => uid++;

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle<T>(list: T[]): T[] {
  const r = [...list];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Builds a pizza with a target and a starting state that is never already correct. */
function makePizza(parts: number, keepMode: boolean): PizzaSpec {
  const target = randomInt(1, parts);
  let startCount = 0;
  if (keepMode) {
    do {
      startCount = randomInt(1, parts);
    } while (startCount === target);
  }
  const idx = shuffle(Array.from({ length: parts }, (_, i) => i)).slice(0, startCount);
  const initial = Array.from({ length: parts }, (_, i) => idx.includes(i));
  return { parts, target, initial };
}

function fracLabel(n: number, d: number) {
  return `${n}/${d}`;
}

function buildQuestion(specs: number[]): FractionBuildQuestion {
  const keepMode = Math.random() < 0.45;
  const pizzas = specs.map((p) => makePizza(p, keepMode));
  const list = pizzas.map((p) => fracLabel(p.target, p.parts)).join(" • ");
  const verb = keepMode ? "Mantenha" : "Selecione";
  const prompt =
    pizzas.length === 1
      ? `${verb} ${list} da pizza`
      : `${verb} estas frações nas pizzas`;
  return {
    kind: "frac-build",
    id: nextId(),
    prompt,
    pizzas,
    tip:
      pizzas.length === 1
        ? `${fracLabel(pizzas[0].target, pizzas[0].parts)} são ${pizzas[0].target} de ${pizzas[0].parts} partes iguais.`
        : "Cada pizza precisa ficar com a quantidade exata de partes da sua fração.",
  };
}

function idQuestion(parts: number): FractionIdQuestion {
  const filled = randomInt(1, parts);
  const answer = fracLabel(filled, parts);
  const pool = shuffle(
    Array.from({ length: parts }, (_, i) => fracLabel(i + 1, parts)).filter((f) => f !== answer),
  ).slice(0, 3);
  return {
    kind: "frac-id",
    id: nextId(),
    parts,
    filled,
    prompt: "Qual fração está representada?",
    options: shuffle([answer, ...pool]),
    answer,
    tip: `${filled} de ${parts} partes iguais = ${answer}.`,
  };
}

const LEVEL_SPECS: Record<Exclude<FractionLevel, 6>, number[]> = {
  1: [4],
  2: [3, 4],
  3: [5, 5],
  4: [4, 8],
  5: [5, 8, 10],
};

/** Slice counts available per level (easier levels use 3/4/5). */
const LEVEL_PARTS: Record<Exclude<FractionLevel, 6>, number[]> = {
  1: [3, 4],
  2: [3, 4],
  3: [4, 5],
  4: [5, 8],
  5: [8, 10],
};

export const ALL_PARTS = [3, 4, 5, 8, 10] as const;

/** Generates the next fraction question. */
export function makeFractionQuestion(level: FractionLevel): FractionQuestion {
  if (level === 6) {
    const lv = pick([1, 2, 3, 4, 5] as const);
    if (Math.random() < 0.3) return idQuestion(pick(ALL_PARTS));
    return buildQuestion(LEVEL_SPECS[lv]);
  }
  // Type C (identify) appears sometimes, mostly on single-pizza levels
  if (Math.random() < (level === 1 ? 0.3 : 0.18)) return idQuestion(pick(LEVEL_PARTS[level]));
  return buildQuestion(LEVEL_SPECS[level]);
}

export const FRACTION_LEVEL_LABELS: Record<FractionLevel, string> = {
  1: "Uma pizza de 4",
  2: "Uma de 3 + uma de 4",
  3: "Duas pizzas de 5",
  4: "Uma de 4 + uma de 8",
  5: "5 + 8 + 10 partes",
  6: "Desafio das Frações",
};

export const FRACTION_QUESTIONS_PER_LEVEL = 5;
