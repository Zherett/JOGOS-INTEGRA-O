// Question generator for "Caça às Variáveis" — drag & drop mode
// Each question: an expression with ONE unknown box. Player must find the
// number that satisfies it. We generate 4-8 numeric options including the
// correct answer, unique, positive integers, in shuffled positions.

export type VarOp = "add" | "sub" | "mul" | "div";

export interface VarQuestion {
  // Rendered as three tokens: left, op, right → boxIndex (0|2) marks where the box is.
  left: string;   // number or "?"
  op: "+" | "−" | "×" | "÷";
  right: string;  // number or "?"
  result: number; // right-hand side of "="
  answer: number; // value that goes inside the box
  options: number[]; // shuffled list including `answer`
}

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

function opsForLevel(level: number): VarOp[] {
  switch (level) {
    case 1: return ["add"];
    case 2: return ["add", "sub"];
    case 3: return ["mul"];
    case 4: return ["div"];
    default: return ["add", "sub", "mul", "div"];
  }
}

const SYMBOL: Record<VarOp, "+" | "−" | "×" | "÷"> = {
  add: "+", sub: "−", mul: "×", div: "÷",
};

interface RawExpr {
  a: number; b: number; op: VarOp; result: number;
}

function buildExpr(op: VarOp): RawExpr {
  let a: number, b: number, result: number;
  switch (op) {
    case "add":
      a = rng(1, 12); b = rng(1, 12); result = a + b; break;
    case "sub":
      a = rng(3, 20); b = rng(1, a - 1); result = a - b; break;
    case "mul":
      a = rng(2, 10); b = rng(2, 10); result = a * b; break;
    case "div":
      b = rng(2, 10); result = rng(2, 10); a = b * result; break;
  }
  return { a, b, op, result };
}

function makeOptions(answer: number, count: number): number[] {
  const set = new Set<number>([answer]);
  let guard = 0;
  while (set.size < count && guard++ < 200) {
    const delta = pick([-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, -7]);
    const cand = answer + delta;
    if (cand > 0 && cand <= 99) set.add(cand);
  }
  // Fill remaining if needed
  let extra = 1;
  while (set.size < count) {
    const cand = answer + extra;
    if (cand > 0 && cand <= 99) set.add(cand);
    extra++;
  }
  const arr = Array.from(set);
  // Fisher–Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateVariableQuestion(level: number, previous?: string): VarQuestion {
  const ops = opsForLevel(level);
  let q: VarQuestion | null = null;
  for (let i = 0; i < 12; i++) {
    const op = pick(ops);
    const e = buildExpr(op);
    // Decide which position hides the variable.
    // For subtraction and division we allow either the minuend/dividend
    // or subtrahend/divisor to be unknown — both give unique positive
    // integer answers here.
    const hideLeft = Math.random() < 0.5;
    const answer = hideLeft ? e.a : e.b;
    const optionCount = rng(4, 8);
    const cand: VarQuestion = {
      left: hideLeft ? "?" : String(e.a),
      op: SYMBOL[e.op],
      right: hideLeft ? String(e.b) : "?",
      result: e.result,
      answer,
      options: makeOptions(answer, optionCount),
    };
    const sig = `${cand.left}${cand.op}${cand.right}=${cand.result}`;
    if (sig !== previous) { q = cand; break; }
    q = cand;
  }
  return q!;
}
