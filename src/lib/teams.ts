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
