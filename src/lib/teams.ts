// Shared team-mode configuration used by every game

export type PlayMode = "normal" | "equipes";

export interface TeamConfig {
  mode: PlayMode;
  teams: string[];
}

export const DEFAULT_TEAMS = ["CODEX", "NEXUS", "LOGICS", "SPARKS"];

export const NORMAL_CONFIG: TeamConfig = { mode: "normal", teams: [] };

export const TEAM_NAME_MAX = 15;

export function sanitizeTeamName(name: string, index: number) {
  const clean = name.trim().slice(0, TEAM_NAME_MAX);
  return clean.length ? clean : `EQUIPE ${index + 1}`;
}
