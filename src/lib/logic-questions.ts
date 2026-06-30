// Question generators for Jogo 1 - Lógica Matemática
// Levels 1-4, with thousands of possible combinations.

export interface Question {
  text: string;
  answer: boolean;
}

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function evalSimpleEq(a: number, b: number, res: number, op: "+" | "-"): boolean {
  return op === "+" ? a + b === res : a - b === res;
}

// Maybe flip the stated result so ~50% are false
function maybeFlip(actual: number): { shown: number; truth: boolean } {
  if (Math.random() < 0.5) return { shown: actual, truth: true };
  // shift by 1-3
  const delta = pick([-3, -2, -1, 1, 2, 3]);
  return { shown: actual + delta, truth: false };
}

function boolExpr(): { text: string; value: boolean } {
  const a = Math.random() < 0.5;
  const b = Math.random() < 0.5;
  const op = pick(["e", "ou"] as const);
  const val = op === "e" ? a && b : a || b;
  const s = (x: boolean) => (x ? "V" : "F");
  return { text: `${s(a)} ${op} ${s(b)}`, value: val };
}

function simpleArith(): { text: string; value: boolean } {
  const op = pick(["+", "-"] as const);
  let a = rng(1, 10), b = rng(1, 10);
  if (op === "-" && b > a) [a, b] = [b, a];
  const actual = op === "+" ? a + b : a - b;
  const { shown, truth } = maybeFlip(actual);
  return { text: `${a} ${op} ${b} = ${shown}`, value: truth };
}

// Level 1: V/F, E, OU, simple equalities
function level1(): Question {
  const kind = pick(["bool", "arith", "arith"]);
  if (kind === "bool") {
    const e = boolExpr();
    return { text: e.text, answer: e.value };
  }
  const a = simpleArith();
  return { text: a.text, answer: a.value };
}

// Level 2: equalities combined with E / OU
function level2(): Question {
  const left = simpleArith();
  const right = simpleArith();
  const op = pick(["e", "ou"] as const);
  const value = op === "e" ? left.value && right.value : left.value || right.value;
  return { text: `${left.text} ${op} ${right.text}`, answer: value };
}

function comparison(): { text: string; value: boolean } {
  const a = rng(0, 12), b = rng(0, 12);
  const op = pick(["<", ">", "<=", ">=", "="] as const);
  let v = false;
  switch (op) {
    case "<": v = a < b; break;
    case ">": v = a > b; break;
    case "<=": v = a <= b; break;
    case ">=": v = a >= b; break;
    case "=": v = a === b; break;
  }
  return { text: `${a} ${op} ${b}`, value: v };
}

// Level 3: comparisons with <, >, <=, >=, = combined
function level3(): Question {
  const left = comparison();
  const right = comparison();
  const op = pick(["e", "ou"] as const);
  const value = op === "e" ? left.value && right.value : left.value || right.value;
  return { text: `${left.text} ${op} ${right.text}`, answer: value };
}

function arithExpr(): { text: string; value: number } {
  const op = pick(["+", "-"] as const);
  let a = rng(1, 12), b = rng(1, 9);
  if (op === "-" && b > a) [a, b] = [b, a];
  return { text: `${a} ${op} ${b}`, value: op === "+" ? a + b : a - b };
}

// Level 4: full arithmetic expressions compared
function level4(): Question {
  // mix: arith COMP arith, or (arith COMP value) e/ou (comp)
  const variant = pick(["compare", "combined"]);
  if (variant === "compare") {
    const l = arithExpr(), r = arithExpr();
    const op = pick(["<", ">", "<=", ">=", "="] as const);
    let v = false;
    switch (op) {
      case "<": v = l.value < r.value; break;
      case ">": v = l.value > r.value; break;
      case "<=": v = l.value <= r.value; break;
      case ">=": v = l.value >= r.value; break;
      case "=": v = l.value === r.value; break;
    }
    return { text: `${l.text} ${op} ${r.text}`, answer: v };
  }
  const l = arithExpr();
  const target = l.value + pick([-2, -1, 0, 0, 1, 2]);
  const leftCmp = pick(["<", ">", "<=", ">=", "="] as const);
  let lv = false;
  switch (leftCmp) {
    case "<": lv = l.value < target; break;
    case ">": lv = l.value > target; break;
    case "<=": lv = l.value <= target; break;
    case ">=": lv = l.value >= target; break;
    case "=": lv = l.value === target; break;
  }
  const right = comparison();
  const op = pick(["e", "ou"] as const);
  const value = op === "e" ? lv && right.value : lv || right.value;
  return { text: `${l.text} ${leftCmp} ${target} ${op} ${right.text}`, answer: value };
}

const GENERATORS = [level1, level2, level3, level4];

export function generateQuestion(level: number, recent: string[]): Question {
  const idx = Math.min(GENERATORS.length, Math.max(1, level)) - 1;
  const gen = GENERATORS[idx];
  for (let i = 0; i < 20; i++) {
    const q = gen();
    if (!recent.includes(q.text)) return q;
  }
  return gen();
}

// Try to balance true/false answers ~50/50 by retrying when imbalanced
export function generateBalanced(
  level: number,
  recent: string[],
  recentAnswers: boolean[],
): Question {
  const last = recentAnswers.slice(-6);
  const trues = last.filter(Boolean).length;
  const wantTrue = trues < last.length / 2;
  for (let i = 0; i < 8; i++) {
    const q = generateQuestion(level, recent);
    if (last.length < 3) return q;
    if (q.answer === wantTrue) return q;
  }
  return generateQuestion(level, recent);
}
