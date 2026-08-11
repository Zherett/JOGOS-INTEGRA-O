// Dynamic question generator for "Desafio das Porcentagens" (5th grade)

export type PercentLevel = 1 | 2 | 3 | 4 | 5; // 5 = modo desafio

export type BarVariant = "bateria" | "carregamento" | "tanque" | "medidor" | "barra";

export interface BaseQuestion {
  id: number;
  prompt: string;
  /** Small highlighted line under the prompt (expression / context). */
  highlight?: string;
  options: string[];
  answer: string;
  tip: string;
}

export interface BarQuestion extends BaseQuestion {
  kind: "bar";
  variant: BarVariant;
  parts: number;
  filled: number;
}

export interface PieQuestion extends BaseQuestion {
  kind: "pie";
  parts: number;
  filled: number;
}

export interface PieBuildQuestion {
  kind: "pie-build";
  id: number;
  prompt: string;
  highlight?: string;
  parts: number;
  /** Number of slices the player must paint. */
  target: number;
  tip: string;
}

export interface ObjectsQuestion extends BaseQuestion {
  kind: "objects";
  emoji: string;
  count: number;
}

export interface WordQuestion extends BaseQuestion {
  kind: "word";
  emoji: string;
}

export type PercentQuestion =
  | BarQuestion
  | PieQuestion
  | PieBuildQuestion
  | ObjectsQuestion
  | WordQuestion;

export const PERCENTS = [10, 25, 50, 75, 100] as const;

export const TIPS: Record<number, string> = {
  10: "10% é uma décima parte (1 de 10 partes).",
  20: "20% é o dobro de 10%.",
  25: "25% significa 1 de 4 partes.",
  30: "30% são 3 décimos do total.",
  40: "40% são 4 décimos do total.",
  50: "50% significa metade.",
  60: "60% são 6 décimos do total.",
  70: "70% são 7 décimos do total.",
  75: "75% significa 3 de 4 partes.",
  80: "80% são 8 décimos do total.",
  90: "90% são 9 décimos do total.",
  100: "100% significa o todo.",
};

let uid = 1;
const nextId = () => uid++;

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function pickAvoid<T>(list: readonly T[], avoid: T | undefined): T {
  if (list.length < 2) return list[0];
  for (let i = 0; i < 12; i++) {
    const v = pick(list);
    if (v !== avoid) return v;
  }
  return pick(list);
}

function shuffle<T>(list: T[]): T[] {
  const r = [...list];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Builds 4 unique options containing the answer. */
function optionsFrom(answer: string, pool: string[]): string[] {
  const set: string[] = [answer];
  for (const p of shuffle(pool)) {
    if (set.length >= 4) break;
    if (!set.includes(p)) set.push(p);
  }
  return shuffle(set);
}

const PCT_POOL = ["10%", "25%", "50%", "75%", "100%"];

function pctOptions(answer: number) {
  return optionsFrom(`${answer}%`, PCT_POOL.concat(["20%", "40%", "60%", "90%"]));
}

function numberOptions(answer: number, total: number) {
  const pool = [
    total / 10, total / 4, total / 2, (total * 3) / 4, total,
    answer + 1, Math.max(1, answer - 1), answer * 2,
  ]
    .filter((n) => Number.isInteger(n) && n > 0 && n !== answer)
    .map(String);
  return optionsFrom(String(answer), pool);
}

/* ------------------------- Level 1: bars & battery ------------------------- */

const BAR_VARIANTS: BarVariant[] = ["bateria", "carregamento", "tanque", "medidor", "barra"];

const BAR_PROMPTS: Record<BarVariant, string> = {
  bateria: "Qual é a porcentagem aproximada da bateria?",
  carregamento: "Quanto já foi carregado?",
  tanque: "Qual porcentagem do tanque está cheia?",
  medidor: "Qual porcentagem o medidor está marcando?",
  barra: "Qual porcentagem está pintada na barra?",
};

function makeBar(avoid?: number): BarQuestion {
  const useTenths = Math.random() < 0.4;
  const parts = useTenths ? 10 : 4;
  const value = useTenths
    ? pickAvoid([10, 20, 30, 50, 70, 90, 100] as const, avoid)
    : pickAvoid([25, 50, 75, 100] as const, avoid);
  const filled = Math.round((value / 100) * parts);
  const variant = pick(BAR_VARIANTS);
  return {
    kind: "bar",
    id: nextId(),
    variant,
    parts,
    filled,
    prompt: BAR_PROMPTS[variant],
    options: pctOptions(value),
    answer: `${value}%`,
    tip: TIPS[value] ?? `${value}% de ${parts} partes = ${filled} partes.`,
  };
}

/* ---------------------------- Level 2: diagrams ---------------------------- */

function makePie(avoid?: number): PieQuestion | PieBuildQuestion {
  const useTenths = Math.random() < 0.35;
  const parts = useTenths ? 10 : 4;
  const value = useTenths
    ? pickAvoid([10, 20, 30, 50, 60, 80, 90] as const, avoid)
    : pickAvoid([25, 50, 75, 100] as const, avoid);
  const filled = Math.round((value / 100) * parts);

  if (Math.random() < 0.4) {
    return {
      kind: "pie-build",
      id: nextId(),
      prompt: "Represente a porcentagem no diagrama",
      highlight: `${value}%`,
      parts,
      target: filled,
      tip: TIPS[value] ?? `${value}% = ${filled} de ${parts} partes.`,
    };
  }

  return {
    kind: "pie",
    id: nextId(),
    parts,
    filled,
    prompt: "Qual porcentagem está representada?",
    options: pctOptions(value),
    answer: `${value}%`,
    tip: TIPS[value] ?? `${filled} de ${parts} partes = ${value}%.`,
  };
}

/* --------------------------- Level 3: quantities --------------------------- */

const OBJECTS: { emoji: string; plural: string }[] = [
  { emoji: "🍎", plural: "maçãs" },
  { emoji: "✏️", plural: "lápis" },
  { emoji: "⚽", plural: "bolas" },
  { emoji: "⭐", plural: "estrelas" },
  { emoji: "📚", plural: "livros" },
  { emoji: "🪙", plural: "moedas" },
  { emoji: "🧒", plural: "alunos" },
];

function makeObjects(avoid?: number): ObjectsQuestion {
  const obj = pick(OBJECTS);
  const pct = pickAvoid([10, 25, 50, 75] as const, avoid);
  const totals = pct === 10 ? [10, 20, 30, 40] : pct === 25 || pct === 75 ? [8, 12, 16, 20] : [8, 10, 12, 16, 20];
  const count = pick(totals);
  const answer = Math.round((pct / 100) * count);
  return {
    kind: "objects",
    id: nextId(),
    emoji: obj.emoji,
    count,
    prompt: `Quantas ${obj.plural} representam ${pct}%?`,
    highlight: `${pct}% de ${count} ${obj.plural}`,
    options: numberOptions(answer, count),
    answer: String(answer),
    tip: `${TIPS[pct]} ${pct}% de ${count} = ${answer}.`,
  };
}

/* ------------------------ Level 4: everyday problems ----------------------- */

function makeWord(avoid?: number): WordQuestion {
  const pct = pickAvoid([10, 25, 50, 75] as const, avoid);
  const type = Math.floor(Math.random() * 5);

  if (type === 0) {
    const price = pick([40, 60, 80, 100, 200]);
    const answer = Math.round((pct / 100) * price);
    return {
      kind: "word", id: nextId(), emoji: "🎒",
      prompt: `Uma mochila custa R$ ${price} e está com ${pct}% de desconto. Qual é o valor do desconto?`,
      highlight: `${pct}% de R$ ${price}`,
      options: numberOptions(answer, price),
      answer: String(answer),
      tip: `${TIPS[pct]} O desconto é R$ ${answer}.`,
    };
  }

  if (type === 1) {
    const level = pick([10, 25, 50, 75]);
    const answer = 100 - level;
    return {
      kind: "word", id: nextId(), emoji: "🔋",
      prompt: `A bateria do celular está com ${level}%. Quanto falta para chegar a 100%?`,
      highlight: `100% − ${level}%`,
      options: pctOptions(answer),
      answer: `${answer}%`,
      tip: `100% − ${level}% = ${answer}%.`,
    };
  }

  if (type === 2) {
    const total = pick([20, 40, 60, 80]);
    const answer = Math.round((pct / 100) * total);
    return {
      kind: "word", id: nextId(), emoji: "✏️",
      prompt: `Uma caixa possui ${total} lápis. ${pct}% são azuis. Quantos lápis azuis existem?`,
      highlight: `${pct}% de ${total}`,
      options: numberOptions(answer, total),
      answer: String(answer),
      tip: `${TIPS[pct]} São ${answer} lápis azuis.`,
    };
  }

  if (type === 3) {
    const total = pick([20, 24, 28, 32]);
    const answer = Math.round((pct / 100) * total);
    return {
      kind: "word", id: nextId(), emoji: "🧒",
      prompt: `Uma turma possui ${total} alunos e ${pct}% faltaram. Quantos alunos faltaram?`,
      highlight: `${pct}% de ${total} alunos`,
      options: numberOptions(answer, total),
      answer: String(answer),
      tip: `${TIPS[pct]} Faltaram ${answer} alunos.`,
    };
  }

  const total = pick([20, 40, 50, 100]);
  const answer = Math.round((pct / 100) * total);
  return {
    kind: "word", id: nextId(), emoji: "🛒",
    prompt: `A loja tinha ${total} brinquedos e vendeu ${pct}%. Quantos brinquedos foram vendidos?`,
    highlight: `${pct}% de ${total}`,
    options: numberOptions(answer, total),
    answer: String(answer),
    tip: `${TIPS[pct]} Foram ${answer} brinquedos.`,
  };
}

/* --------------------------------- Public --------------------------------- */

function valueOf(q: PercentQuestion): number | undefined {
  if (q.kind === "pie-build") return (q.target / q.parts) * 100;
  if (q.kind === "bar" || q.kind === "pie") return parseInt(q.answer, 10);
  const m = q.highlight?.match(/(\d+)%/);
  return m ? parseInt(m[1], 10) : undefined;
}

/** Generates the next question, avoiding repeating the previous one. */
export function makeQuestion(level: PercentLevel, previous?: PercentQuestion): PercentQuestion {
  const avoid = previous ? valueOf(previous) : undefined;
  const kinds: PercentLevel[] = [1, 2, 3, 4];
  const target: PercentLevel =
    level === 5
      ? (pickAvoid(kinds, previous ? kindToLevel(previous) : undefined) as PercentLevel)
      : level;

  switch (target) {
    case 1: return makeBar(avoid);
    case 2: return makePie(avoid);
    case 3: return makeObjects(avoid);
    default: return makeWord(avoid);
  }
}

function kindToLevel(q: PercentQuestion): PercentLevel {
  if (q.kind === "bar") return 1;
  if (q.kind === "pie" || q.kind === "pie-build") return 2;
  if (q.kind === "objects") return 3;
  return 4;
}

export const LEVEL_LABELS: Record<PercentLevel, string> = {
  1: "Barras e Bateria",
  2: "Diagramas de Pizza",
  3: "Porcentagem de Quantidades",
  4: "Situações do Cotidiano",
  5: "Modo Desafio",
};

export const QUESTIONS_PER_LEVEL = 5;
