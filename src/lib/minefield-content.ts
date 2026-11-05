// Content generator for "Campo Minado Lógico" (8x8 board of hidden cards)
import { type Shape } from "./shapes-content.ts";

/** Formas geométricas gerais (identificação básica sem sobreposição conceitual). */
export const GENERAL_SHAPES: { shape: Shape; label: string }[] = [
  { shape: "square", label: "Quadrado" },
  { shape: "circle", label: "Círculo" },
  { shape: "oval", label: "Oval" },
  { shape: "triangle", label: "Triângulo" },
  { shape: "rectH", label: "Retângulo" },
  { shape: "diamond", label: "Losango" },
  { shape: "pentagon", label: "Pentágono" },
  { shape: "hexagon", label: "Hexágono" },
  { shape: "trapezoid", label: "Trapézio" },
];

/** Classificações específicas de triângulos quanto aos lados. */
export const TRIANGLE_CLASSIFICATIONS: { shape: Shape; label: string }[] = [
  { shape: "triEquilateral", label: "Triângulo equilátero" },
  { shape: "triIsosceles", label: "Triângulo isósceles" },
  { shape: "triScalene", label: "Triângulo escaleno" },
];

export const TRIANGLE_OPTIONS = [
  "Triângulo equilátero",
  "Triângulo isósceles",
  "Triângulo escaleno",
  "Triângulo retângulo",
] as const;

export const COLS = ["A", "B", "C", "D", "E", "F", "G", "H"];
export const ROWS = [1, 2, 3, 4, 5, 6, 7, 8];

export const POINTS_CORRECT = 5;
export const POINTS_WRONG = 3;
export const ANSWER_SECONDS = 20;
export const ANSWER_TIME_OPTIONS = [20] as const;

export type CardKind = "tf" | "mystery" | "shape" | "bonus";

export interface QuestionCard {
  kind: "tf" | "mystery" | "shape";
  /** Question sentence, shown above the highlighted expression. */
  prompt: string;
  /** Highlighted math expression (optional). */
  expr?: string;
  options: string[];
  answer: string;
  shape?: Shape;
}

export interface BonusCard {
  kind: "bonus";
  points: number; // 1..3 or -1..-3
}

export type MineCard = (QuestionCard | BonusCard) & { id: string; label: string };

function ri(n: number) { return Math.floor(Math.random() * n); }
function rand<T>(a: readonly T[]): T { return a[ri(a.length)]; }
function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = ri(i + 1); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

/* ---------- Verdadeiro ou Falso ---------- */
export function genTF(): QuestionCard {
  const style = ri(3);
  let prompt: string;
  let truth: boolean;
  if (style === 0) {
    const a = 1 + ri(20), b = 1 + ri(20);
    const op = rand([">", "<", "="] as const);
    prompt = `${a} ${op} ${b}`;
    truth = op === ">" ? a > b : op === "<" ? a < b : a === b;
  } else if (style === 1) {
    const a = 1 + ri(12), b = 1 + ri(12), c = 1 + ri(24);
    const op = rand([">", "<"] as const);
    prompt = `${a} + ${b} ${op} ${c}`;
    truth = op === ">" ? a + b > c : a + b < c;
  } else {
    const a = 2 + ri(9), b = 1 + ri(9), c = 1 + ri(60);
    const op = rand([">", "<"] as const);
    prompt = `${a} × ${b} ${op} ${c}`;
    truth = op === ">" ? a * b > c : a * b < c;
  }
  return {
    kind: "tf",
    prompt: "Verdadeiro ou Falso?",
    expr: prompt,
    options: ["Verdadeiro", "Falso"],
    answer: truth ? "Verdadeiro" : "Falso",
  };
}

/* ---------- Conta misteriosa ---------- */
export function genMystery(): QuestionCard {
  const style = ri(4);
  let prompt = "";
  let x = 0;
  if (style === 0) {
    x = 1 + ri(10); const b = 1 + ri(10);
    prompt = `X + ${b} = ${x + b}`;
  } else if (style === 1) {
    x = 2 + ri(15); const b = 1 + ri(x - 1);
    prompt = `X − ${b} = ${x - b}`;
  } else if (style === 2) {
    x = 1 + ri(9); const b = 2 + ri(8);
    prompt = `${b} × X = ${b * x}`;
  } else {
    x = 1 + ri(9); const b = 2 + ri(8);
    prompt = `${x * b} ÷ X = ${b}`;
  }
  const opts = new Set<number>([x]);
  while (opts.size < 4) {
    const d = x + (ri(2) ? 1 : -1) * (1 + ri(4));
    if (d > 0) opts.add(d);
  }
  return {
    kind: "mystery",
    prompt: "Qual o valor de X?",
    expr: prompt,
    options: shuffle([...opts]).map(String),
    answer: String(x),
  };
}

/* ---------- Forma geométrica ---------- */
export function genShape(): QuestionCard {
  // 30% de chance de pergunta específica de classificação de triângulos;
  // 70% de identificação de formas geométricas gerais.
  const isTriangleClassification = Math.random() < 0.3;

  if (isTriangleClassification) {
    const target = rand(TRIANGLE_CLASSIFICATIONS);
    return {
      kind: "shape",
      prompt: "Quanto aos lados, que tipo de triângulo é este?",
      options: shuffle([...TRIANGLE_OPTIONS]),
      answer: target.label,
      shape: target.shape,
    };
  }

  const target = rand(GENERAL_SHAPES);
  const others = shuffle(GENERAL_SHAPES.filter((s) => s.shape !== target.shape)).slice(0, 3);
  return {
    kind: "shape",
    prompt: "Qual é o nome desta forma?",
    options: shuffle([target.label, ...others.map((s) => s.label)]),
    answer: target.label,
    shape: target.shape,
  };
}

export function genBonus(): BonusCard {
  const magnitude = 1 + ri(3);
  const positive = Math.random() < 0.6;
  return { kind: "bonus", points: positive ? magnitude : -magnitude };
}

export function cellLabel(index: number) {
  return `${COLS[index % 8]}${ROWS[Math.floor(index / 8)]}`;
}

/** Builds the 64-card board: ~75% questions, ~25% bonus/penalty cards. */
export function buildBoard(): MineCard[] {
  const cards: MineCard[] = [];
  for (let i = 0; i < 64; i++) {
    const roll = Math.random();
    const base =
      roll < 0.25 ? genBonus()
      : roll < 0.47 ? genTF()
      : roll < 0.72 ? genMystery()
      : genShape();
    cards.push({ ...base, id: `c${i}`, label: cellLabel(i) });
  }
  return cards;
}
