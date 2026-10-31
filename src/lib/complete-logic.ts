// "Completando a Lógica" — question generation + generic evaluator.

export type Token =
  | { t: "num"; v: number }
  | { t: "op"; v: string }
  | { t: "slotNum" }
  | { t: "slotOp" };

export interface CQuestion {
  key: string;
  tokens: Token[];
  /** Expected final result (number or V/F). */
  result: number | boolean;
  options: string[]; // operator choices (empty when no op slot)
  hasNum: boolean;
  hasOp: boolean;
  kind: 1 | 2 | 3;
}

const rng = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

const ARITH = ["+", "−", "×", "÷"];
const CMP = ["<", ">", "="];
const LOGIC = ["e", "ou"];

// ---------- Evaluator (precedence: ou < e < comparison < +− < ×÷) ----------
type Val = number | boolean;

function evaluate(tokens: Token[]): Val {
  let i = 0;
  const peek = () => tokens[i];
  const isOp = (s: string[]) => {
    const p = peek();
    return p && p.t === "op" && s.includes(p.v);
  };
  const num = (v: Val): number => {
    if (typeof v !== "number") throw new Error("type");
    return v;
  };
  const bool = (v: Val): boolean => {
    if (typeof v !== "boolean") throw new Error("type");
    return v;
  };
  function atom(): Val {
    const p = tokens[i++];
    if (!p || p.t !== "num") throw new Error("syntax");
    return p.v;
  }
  function mul(): Val {
    let l = atom();
    while (isOp(["×", "÷"])) {
      const op = (tokens[i++] as { v: string }).v;
      const r = num(atom());
      if (op === "×") l = num(l) * r;
      else {
        if (r === 0 || num(l) % r !== 0) throw new Error("div");
        l = num(l) / r;
      }
    }
    return l;
  }
  function add(): Val {
    let l = mul();
    while (isOp(["+", "−"])) {
      const op = (tokens[i++] as { v: string }).v;
      const r = num(mul());
      l = op === "+" ? num(l) + r : num(l) - r;
    }
    return l;
  }
  function cmp(): Val {
    const l = add();
    if (isOp(CMP)) {
      const op = (tokens[i++] as { v: string }).v;
      const a = num(l), b = num(add());
      return op === "<" ? a < b : op === ">" ? a > b : a === b;
    }
    return l;
  }
  function and(): Val {
    let l = cmp();
    while (isOp(["e"])) { i++; const r = bool(cmp()); l = bool(l) && r; }
    return l;
  }
  function or(): Val {
    let l = and();
    while (isOp(["ou"])) { i++; const r = bool(and()); l = bool(l) || r; }
    return l;
  }
  const v = or();
  if (i !== tokens.length) throw new Error("syntax");
  return v;
}

/** Checks a filled-in answer against the expected result. */
export function checkAnswer(q: CQuestion, num: number | null, op: string | null): boolean {
  if (q.hasNum && (num === null || !Number.isFinite(num))) return false;
  if (q.hasOp && !op) return false;
  const filled: Token[] = q.tokens.map((t) =>
    t.t === "slotNum" ? { t: "num", v: num as number } : t.t === "slotOp" ? { t: "op", v: op as string } : t,
  );
  try {
    return evaluate(filled) === q.result;
  } catch {
    return false;
  }
}

// ---------- helpers ----------
const N = (v: number): Token => ({ t: "num", v });
const O = (v: string): Token => ({ t: "op", v });
const SN: Token = { t: "slotNum" };
const SO: Token = { t: "slotOp" };

function arithPair(op: string): [number, number, number] {
  switch (op) {
    case "+": { const a = rng(1, 15), b = rng(1, 15); return [a, b, a + b]; }
    case "−": { let a = rng(2, 18), b = rng(1, 15); if (b > a) [a, b] = [b, a]; return [a, b, a - b]; }
    case "×": { const a = rng(2, 9), b = rng(2, 9); return [a, b, a * b]; }
    default: { const b = rng(2, 9), c = rng(2, 9); return [b * c, b, c]; }
  }
}

function cmpTriple(truth: boolean): [number, string, number] {
  for (;;) {
    const a = rng(0, 12), b = rng(0, 12), op = pick(["<", ">"]);
    if ((op === "<" ? a < b : a > b) === truth) return [a, op, b];
  }
}

function keyOf(tokens: Token[], result: Val) {
  return tokens.map((t) => (t.t === "num" ? t.v : t.t === "op" ? t.v : t.t === "slotNum" ? "_" : "?")).join(" ") + "=" + String(result);
}

function build(kind: 1 | 2 | 3, tokens: Token[], result: Val, options: string[] = []): CQuestion {
  return {
    key: keyOf(tokens, result),
    tokens, result, kind,
    options: shuffle(options),
    hasNum: tokens.some((t) => t.t === "slotNum"),
    hasOp: tokens.some((t) => t.t === "slotOp"),
  };
}

/** Ensures exactly one option makes the expression right (op-only questions). */
function uniqueOp(q: CQuestion): boolean {
  return q.options.filter((o) => checkAnswer(q, null, o)).length === 1;
}

// ---------- Level 1: drag the operator ----------
function level1(): CQuestion {
  for (;;) {
    let q: CQuestion;
    if (Math.random() < 0.5) {
      // Different truth values make e/ou distinguishable.
      const lt = Math.random() < 0.5;
      const [a, o1, b] = cmpTriple(lt);
      const [c, o2, d] = cmpTriple(!lt);
      const res = Math.random() < 0.5;
      q = build(1, [N(a), O(o1), N(b), SO, N(c), O(o2), N(d)], res, [...LOGIC, pick(["+", "×"]), pick(["−", "÷"])]);
    } else {
      // Keep the fixed comparison neutral so the missing comparator matters.
      const connective = pick(LOGIC);
      const [c, o2, d] = cmpTriple(connective === "e");
      const a = rng(0, 15);
      const b = Math.random() < 0.2 ? a : rng(0, 15);
      const missing: Token[] = [N(a), SO, N(b)];
      const fixed: Token[] = [N(c), O(o2), N(d)];
      const tokens = Math.random() < 0.5
        ? [...missing, O(connective), ...fixed]
        : [...fixed, O(connective), ...missing];
      q = build(1, tokens, Math.random() < 0.5, [...CMP, pick(ARITH)]);
    }
    if (uniqueOp(q)) return q;
  }
}

// ---------- Level 2: type the missing number ----------
function level2(): CQuestion {
  const v = pick(["arith", "arith", "logic", "logic"]);
  if (v === "arith") {
    const op = pick(ARITH);
    const [a, b, c] = arithPair(op);
    return Math.random() < 0.5 ? build(2, [N(a), O(op), SN], c) : build(2, [SN, O(op), N(b)], c);
  }
  // Logic: left side fixed so the right side decides the result.
  const op = pick(LOGIC);
  const leftTruth = op === "e"; // e → left V ; ou → left F
  const [a, o1, b] = cmpTriple(leftTruth);
  const res = Math.random() < 0.5;
  const c = rng(1, 11);
  const o2 = pick(["<", ">"]);
  const right: Token[] = Math.random() < 0.5 ? [N(c), O(o2), SN] : [SN, O(o2), N(c)];
  const left: Token[] = [N(a), O(o1), N(b)];
  return Math.random() < 0.5
    ? build(2, [...left, O(op), ...right], res)
    : build(2, [...right, O(op), ...left], res);
}

// ---------- Level 3: drag + type ----------
function level3(): CQuestion {
  if (Math.random() < 0.5) {
    const op = pick(ARITH);
    const [a, b, c] = arithPair(op);
    const distract = shuffle([...CMP, ...LOGIC]).slice(0, 3);
    return Math.random() < 0.5
      ? build(3, [N(a), SO, SN], c, [op, ...distract])
      : build(3, [SN, SO, N(b)], c, [op, ...distract]);
  }
  const op = pick(LOGIC);
  const leftTruth = op === "e";
  const [a, o1, b] = cmpTriple(leftTruth);
  const res = Math.random() < 0.5;
  const c = rng(1, 11);
  const o2 = pick(["<", ">"]);
  const distract = shuffle(ARITH).slice(0, 3);
  return build(3, [N(a), O(o1), N(b), SO, N(c), O(o2), SN], res, [op, ...distract]);
}

const GENS = [level1, level2, level3];

export function generateQuestion(level: number, used: Set<string>): CQuestion {
  const gen = () => (level >= 4 ? pick(GENS)() : GENS[level - 1]());
  for (let i = 0; i < 60; i++) {
    const q = gen();
    if (!used.has(q.key)) { used.add(q.key); return q; }
  }
  const q = gen();
  used.add(q.key);
  return q;
}
