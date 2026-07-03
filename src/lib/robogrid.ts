// RoboGrid game helpers — 10x10 board, colored cells, spatial reasoning.

export const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;
export const ROWS = 10;
export type ColorId = "blue" | "green" | "yellow" | "red" | "pink";

export const COLORS: ColorId[] = ["blue", "green", "yellow", "red", "pink"];

export const COLOR_LABEL: Record<ColorId, string> = {
  blue: "Azul",
  green: "Verde",
  yellow: "Amarelo",
  red: "Vermelho",
  pink: "Rosa",
};

// Tailwind classes for each color (bg + hover states used in buttons).
export const COLOR_BG: Record<ColorId, string> = {
  blue: "bg-sky-500",
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-500",
  pink: "bg-pink-400",
};

export const COLOR_TEXT: Record<ColorId, string> = {
  blue: "text-white",
  green: "text-white",
  yellow: "text-slate-900",
  red: "text-white",
  pink: "text-slate-900",
};

export type Board = ColorId[][]; // [row][col]

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomBoard(): Board {
  const b: Board = [];
  for (let r = 0; r < ROWS; r++) {
    const row: ColorId[] = [];
    for (let c = 0; c < COLS.length; c++) row.push(rand(COLORS));
    b.push(row);
  }
  return b;
}

export interface Coord { col: number; row: number } // col 0..9, row 0..9 (0 = row "1")

export function coordLabel(c: Coord): string {
  return `${COLS[c.col]}${c.row + 1}`;
}

export function randomCoord(): Coord {
  return { col: Math.floor(Math.random() * COLS.length), row: Math.floor(Math.random() * ROWS) };
}

export type QuestionKind = "position" | "color" | "robot";

export interface PositionQ { kind: "position"; target: Coord }
export interface ColorQ { kind: "color"; target: Coord; color: ColorId; options: ColorId[] }
export interface RobotQ {
  kind: "robot";
  start: Coord;
  moves: { dx: number; dy: number; text: string };
  answer: Coord;
  options: Coord[]; // 4 options
  correctIndex: number;
}
export type Question = PositionQ | ColorQ | RobotQ;

export function makePositionQ(): PositionQ {
  return { kind: "position", target: randomCoord() };
}

export function makeColorQ(board: Board): ColorQ {
  const target = randomCoord();
  const color = board[target.row][target.col];
  // options = all 5 colors, shuffled
  const options = [...COLORS].sort(() => Math.random() - 0.5);
  return { kind: "color", target, color, options };
}

// Generates a movement description that stays inside the board.
export function makeRobotQ(): RobotQ {
  // Try up to 50 times to find valid start + moves
  for (let attempt = 0; attempt < 50; attempt++) {
    const start = randomCoord();
    // pick either single direction or a two-part movement
    const twoPart = Math.random() < 0.5;
    let dx = 0, dy = 0;
    const parts: string[] = [];

    const pickAxis = (axis: "x" | "y") => {
      const steps = 1 + Math.floor(Math.random() * 4); // 1..4
      const dir = Math.random() < 0.5 ? -1 : 1;
      if (axis === "x") {
        dx += steps * dir;
        parts.push(`${steps} ${steps === 1 ? "casa" : "casas"} para a ${dir > 0 ? "direita" : "esquerda"}`);
      } else {
        dy += steps * dir;
        // dy positive = down (row increases), negative = up
        parts.push(`${steps} ${steps === 1 ? "casa" : "casas"} para ${dir > 0 ? "baixo" : "cima"}`);
      }
    };

    pickAxis(Math.random() < 0.5 ? "x" : "y");
    if (twoPart) pickAxis(dx === 0 ? "x" : "y");

    const finalCol = start.col + dx;
    const finalRow = start.row + dy;
    if (finalCol < 0 || finalCol >= COLS.length || finalRow < 0 || finalRow >= ROWS) continue;

    const answer: Coord = { col: finalCol, row: finalRow };
    const text = "O robô anda " + parts.join(" e ") + ".";

    // Build 3 plausible wrong options near the answer
    const wrongs: Coord[] = [];
    const tried = new Set<string>([coordLabel(answer)]);
    let safety = 0;
    while (wrongs.length < 3 && safety < 60) {
      safety++;
      const ox = answer.col + (Math.floor(Math.random() * 5) - 2);
      const oy = answer.row + (Math.floor(Math.random() * 5) - 2);
      if (ox < 0 || ox >= COLS.length || oy < 0 || oy >= ROWS) continue;
      const key = `${ox},${oy}`;
      const lbl = coordLabel({ col: ox, row: oy });
      if (tried.has(lbl) || key === `${answer.col},${answer.row}`) continue;
      tried.add(lbl);
      wrongs.push({ col: ox, row: oy });
    }
    if (wrongs.length < 3) continue;

    const all = [answer, ...wrongs].sort(() => Math.random() - 0.5);
    const correctIndex = all.findIndex((c) => c.col === answer.col && c.row === answer.row);

    return {
      kind: "robot",
      start,
      moves: { dx, dy, text },
      answer,
      options: all,
      correctIndex,
    };
  }
  // Fallback: no movement
  const start = randomCoord();
  return {
    kind: "robot",
    start,
    moves: { dx: 0, dy: 0, text: "O robô não se move." },
    answer: start,
    options: [start, ...Array.from({ length: 3 }, () => randomCoord())],
    correctIndex: 0,
  };
}

export function makeQuestionForLevel(level: number, board: Board): Question {
  if (level === 1) return makePositionQ();
  if (level === 2) return makeColorQ(board);
  if (level === 3) return makeRobotQ();
  // Level 4: mixed
  const roll = Math.random();
  if (roll < 1 / 3) return makePositionQ();
  if (roll < 2 / 3) return makeColorQ(board);
  return makeRobotQ();
}
