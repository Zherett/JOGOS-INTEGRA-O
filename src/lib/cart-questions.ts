// Cartesian plane question generator
export type Mode = "findLetter" | "findPosition";

export interface Point { x: number; y: number; label: string }

export interface CartQuestion {
  mode: Mode;
  points: Point[];
  // findLetter: ask "which letter at (x,y)?" -> correct = label
  // findPosition: ask "where is letter X?" -> correct point + distractors
  targetLabel: string;
  options: string[]; // displayed choices (letters or "(x,y)")
  correctIndex: number;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function randomPoints(count: number): Point[] {
  const used = new Set<string>();
  const pts: Point[] = [];
  while (pts.length < count) {
    const x = rng(-8, 8);
    const y = rng(-8, 8);
    const k = `${x},${y}`;
    if (used.has(k)) continue;
    used.add(k);
    pts.push({ x, y, label: LETTERS[pts.length] });
  }
  return pts;
}

function fmt(p: { x: number; y: number }) {
  return `(${p.x}, ${p.y})`;
}

export function generateCartQuestion(level: number): CartQuestion {
  const count = level >= 2 ? 4 : 4;
  const points = randomPoints(count);
  const target = points[rng(0, points.length - 1)];

  if (level === 1) {
    // mode: find letter at position
    const options = points.map((p) => p.label);
    return {
      mode: "findLetter",
      points,
      targetLabel: target.label,
      options,
      correctIndex: options.indexOf(target.label),
    };
  }

  // level 2+: find position of letter
  // generate 3 plausible distractor coordinates not equal to target
  const used = new Set<string>([`${target.x},${target.y}`]);
  const distractors: { x: number; y: number }[] = [];
  while (distractors.length < 3) {
    // perturb target a bit for plausibility
    const dx = rng(-3, 3);
    const dy = rng(-3, 3);
    const x = Math.max(-8, Math.min(8, target.x + dx));
    const y = Math.max(-8, Math.min(8, target.y + dy));
    const k = `${x},${y}`;
    if (used.has(k)) continue;
    used.add(k);
    distractors.push({ x, y });
  }
  const all = [{ x: target.x, y: target.y }, ...distractors];
  // shuffle
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const options = all.map(fmt);
  const correctIndex = all.findIndex((p) => p.x === target.x && p.y === target.y);
  return {
    mode: "findPosition",
    points,
    targetLabel: target.label,
    options,
    correctIndex,
  };
}
