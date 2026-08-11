// Access-code system: each game is unlocked by a unique code.
import type { GameId } from "./game-storage";

const UNLOCK_KEY = "desafios-logica-unlocked-v1";

/** Codes for the games that already exist on the platform. */
export const GAME_CODES: Record<GameId, string> = {
  logica: "L1MT26",
  cartesiano: "C2PL26",
  formas: "F3FC26",
  memoria: "M4CR26",
  variaveis: "V5CV26",
  robogrid: "R6RG26",
  minado: "N7CM26",
  porcentagem: "Q9PC26",
  rpg: "P8RP26",
};

/** Reserved codes for games still in production (accepted, nothing to play yet). */
const RESERVED_CODES = [
  "X1AB26", "X2CD26", "X3EF26", "X4GH26", "X5IJ26",
  "X6KL26", "X7MN26", "X8OP26", "X9QR26", "Y1ST26",
];

/** Unlocks every game at once (for the teacher). */
export const MASTER_CODE = "SEMED26";

export type CodeResult =
  | { status: "ok"; game: GameId }
  | { status: "all" }
  | { status: "reserved" }
  | { status: "already"; game: GameId }
  | { status: "invalid" };

export function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function loadUnlocked(): GameId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(UNLOCK_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as GameId[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveUnlocked(list: GameId[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(UNLOCK_KEY, JSON.stringify([...new Set(list)]));
}

/** Validates a code and unlocks the matching game. */
export function redeemCode(raw: string): CodeResult {
  const code = normalizeCode(raw);
  if (!code) return { status: "invalid" };

  if (code === MASTER_CODE) {
    const all = (Object.keys(GAME_CODES) as GameId[]).filter((g) => g !== "rpg");
    saveUnlocked([...loadUnlocked(), ...all]);
    return { status: "all" };
  }

  const entry = (Object.entries(GAME_CODES) as [GameId, string][]).find(([, c]) => c === code);
  if (entry) {
    const [game] = entry;
    const current = loadUnlocked();
    if (current.includes(game)) return { status: "already", game };
    saveUnlocked([...current, game]);
    return { status: "ok", game };
  }

  if (RESERVED_CODES.includes(code)) return { status: "reserved" };
  return { status: "invalid" };
}
