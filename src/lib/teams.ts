// Shared team-mode configuration used by every game

export type PlayMode = "normal" | "equipes";
export type TeamOrderMode = "aleatoria" | "manual";

export interface TeamConfig {
  mode: PlayMode;
  teams: string[];
  /** How the play order is decided when the session starts. */
  order: TeamOrderMode;
}

export const DEFAULT_TEAMS = ["CODEX", "NEXUS", "LOGICS", "SPARKS"];

export const NORMAL_CONFIG: TeamConfig = { mode: "normal", teams: [], order: "aleatoria" };

export const TEAM_NAME_MAX = 15;

export function sanitizeTeamName(name: string, index: number) {
  const clean = name.trim().slice(0, TEAM_NAME_MAX);
  return clean.length ? clean : `EQUIPE ${index + 1}`;
}

export function shuffleTeams(list: string[]): string[] {
  const r = [...list];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/* ---------- Team colors ---------- */

export type TeamColor = "verde" | "vermelho" | "amarelo" | "azul" | "cinza";

const TEAM_COLOR_KEYS: { key: string; color: TeamColor }[] = [
  { key: "SPARKS", color: "verde" },
  { key: "NEXUS", color: "vermelho" },
  { key: "CODEX", color: "amarelo" },
  { key: "LOGICS", color: "azul" },
];

/** Detects the color of a team, even inside a custom name (ex.: "SUPER NEXUS"). */
export function teamColor(name: string | undefined | null): TeamColor {
  if (!name) return "cinza";
  const up = name.toUpperCase();
  return TEAM_COLOR_KEYS.find((t) => up.includes(t.key))?.color ?? "cinza";
}

export const TEAM_COLOR_CLASSES: Record<TeamColor, { card: string; chip: string; ring: string }> = {
  verde:    { card: "bg-emerald-500 text-white hover:bg-emerald-400", chip: "bg-emerald-500 text-white", ring: "ring-emerald-500" },
  vermelho: { card: "bg-rose-500 text-white hover:bg-rose-400",       chip: "bg-rose-500 text-white",    ring: "ring-rose-500" },
  amarelo:  { card: "bg-amber-400 text-slate-900 hover:bg-amber-300", chip: "bg-amber-400 text-slate-900", ring: "ring-amber-400" },
  azul:     { card: "bg-sky-500 text-white hover:bg-sky-400",         chip: "bg-sky-500 text-white",     ring: "ring-sky-500" },
  cinza:    { card: "bg-slate-400 text-white hover:bg-slate-300",     chip: "bg-slate-400 text-white",   ring: "ring-slate-400" },
};

