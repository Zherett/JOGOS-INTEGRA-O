// Player profile helpers: schools, age, XP, levels (1..10), mission gates, daily XP cap, titles and badges.

export const SCHOOLS = [
  { name: "Nenhuma", slug: "nenhuma", range: "", needsGrade: false },
  { name: "Raimundo Bezerra", slug: "raimundo_bezerra", range: "6º ao 9º", needsGrade: true },
  { name: "Elisângela Litaiff", slug: "elisangela_litaiff", range: "5º ano", needsGrade: false },
  { name: "Raimunda Cruz", slug: "raimunda_cruz", range: "5º ano", needsGrade: false },
  { name: "Maria de Nazaré", slug: "maria_de_nazare", range: "5º ano", needsGrade: false },
  { name: "Ursulina Souza", slug: "ursulina_souza", range: "5º ano", needsGrade: false },
  { name: "Outro", slug: "outro", range: "", needsGrade: false },
] as const;

export type SchoolName = (typeof SCHOOLS)[number]["name"];

export const GRADES = ["5º ano", "6º ano", "7º ano", "8º ano", "9º ano"] as const;
export const RAIMUNDO_GRADES = ["6º ano", "7º ano", "8º ano", "9º ano"] as const;

export const OFFICIAL_SEMED_SCHOOLS = [
  "Raimundo Bezerra",
  "Elisângela Litaiff",
  "Raimunda Cruz",
  "Maria de Nazaré",
  "Ursulina Souza",
] as const;

export type OfficialSemedSchoolName = (typeof OFFICIAL_SEMED_SCHOOLS)[number];

export const FIFTH_GRADE_SCHOOLS = [
  "Elisângela Litaiff",
  "Raimunda Cruz",
  "Maria de Nazaré",
  "Ursulina Souza",
] as const;

export function isOfficialSemedSchool(school?: string | null): boolean {
  if (!school) return false;
  return OFFICIAL_SEMED_SCHOOLS.some((s) => s.toLowerCase() === school.trim().toLowerCase());
}

export function is5thGradeSchool(school?: string | null): boolean {
  if (!school) return false;
  const lower = school.trim().toLowerCase();
  return FIFTH_GRADE_SCHOOLS.some((s) => s.toLowerCase() === lower);
}

/**
 * Checks whether a student's age (>= 15 years) places them in Etapa 3 (Comunidade / Outro).
 * Players in Etapa 3 cannot be allocated to Elementary SEMED schools or classes.
 */
export function isEtapa3OrOlder(birthdate?: string | null, now = new Date()): boolean {
  if (!birthdate) return false;
  const b = new Date(`${birthdate}T00:00:00`);
  if (Number.isNaN(b.getTime())) return false;
  const turningAge = now.getFullYear() - b.getFullYear();
  return turningAge >= 15 || ageFrom(birthdate, now) >= 15;
}

/**
 * Returns available school options based on age:
 * - Ao ultrapassar os 15 anos (>= 15 anos): nenhuma escola oficial deve ser exibida (apenas "Nenhuma" e "Outro").
 * - Ao ultrapassar os 11 anos (> 11 anos, ou seja, 12 a 14 anos): escolas de 5º ano NÃO devem aparecer para serem selecionadas
 *   (apenas "Raimundo Bezerra", "Nenhuma" e "Outro").
 * - Até 11 anos (<= 11 anos, incluindo alunos nascidos em 2015 que completam 11 anos até dezembro de 2026):
 *   escolas de 5º ano aparecem normalmente.
 */
export function getAvailableSchoolsForAge(
  birthdate?: string | null,
  now = new Date(),
): typeof SCHOOLS {
  if (!birthdate) return SCHOOLS;

  const age = ageFrom(birthdate, now);

  // 1. Ao ultrapassar 15 anos: nenhuma escola oficial deve ser exibida
  if (age >= 15 || isEtapa3OrOlder(birthdate, now)) {
    return SCHOOLS.filter(
      (s) => s.name === "Nenhuma" || s.name === "Outro",
    ) as unknown as typeof SCHOOLS;
  }

  // 2. Ao ultrapassar 11 anos (> 11 anos, ex: 12 a 14 anos): não deve aparecer escolas de 5º ano
  if (age > 11) {
    return SCHOOLS.filter(
      (s) => !is5thGradeSchool(s.name),
    ) as unknown as typeof SCHOOLS;
  }

  // 3. Até 11 anos (<= 11 anos, válido até dezembro de 2026 para alunos do 5º ano): escolas de 5º ano aparecem normalmente
  return SCHOOLS;
}

export function schoolNeedsGrade(school: string): boolean {
  return SCHOOLS.find((s) => s.name === school)?.needsGrade ?? false;
}

export function schoolSlug(school: string): string {
  const found = SCHOOLS.find((s) => s.name === school);
  if (found) return found.slug;
  return nickSlug(school) || "raimundo_bezerra";
}

export function isValidSchool(school: string): school is SchoolName {
  return SCHOOLS.some((s) => s.name === school);
}

/** Turns a nick into a PlayFab-compatible username (3-20 alphanumeric/underscore chars). */
export function nickSlug(nick: string): string {
  return nick
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

/** Formats a student's full name in UPPERCASE (pt-BR locale) as they type or save. */
export function formatFullNameUpper(fullName: string): string {
  return fullName.toLocaleUpperCase("pt-BR");
}

/** Normalizes a student's full name for case-insensitive and accent-insensitive matching. */
export function fullNameSlug(fullName: string): string {
  return fullName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generates the student's 6-digit password (`DDMMAA`) from their birthdate.
 * Example: `2014-01-20` (20/01/2014) -> `"200114"`.
 */
export function passwordFromBirthdate(birthdate: string): string {
  const clean = birthdate.trim();
  // Format YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${dd}${mm}${yyyy.slice(-2)}`;
  }
  // Format DD/MM/YYYY or DD/MM/YY
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(clean);
  if (brMatch) {
    const [, dd, mm, y] = brMatch;
    return `${dd}${mm}${y.slice(-2)}`;
  }
  const digits = clean.replace(/\D/g, "");
  if (digits.length === 8) {
    // Assume DDMMYYYY
    return `${digits.slice(0, 4)}${digits.slice(6, 8)}`;
  }
  if (digits.length === 6) {
    return digits;
  }
  return clean;
}

/**
 * Normalizes any password typed by the student (e.g. `200114`, `20/01/2014`, `20012014`, `2014-01-20`)
 * into the canonical 6-digit `DDMMAA` password.
 */
export function normalizeBirthdatePasswordInput(rawPassword: string): string {
  const trimmed = rawPassword.trim();
  if (!trimmed) return "";
  const converted = passwordFromBirthdate(trimmed);
  return converted || trimmed;
}

/**
 * Builds a deterministic PlayFab CustomID (3..100 chars) from Full Name + Birthdate (`DDMMAA`)
 * so a student can log in or recover their account using only Full Name + Birthdate on any device.
 */
export function studentCustomId(fullName: string, birthdateOrPassword: string): string {
  const namePart = fullNameSlug(fullName).replace(/\s+/g, "_").slice(0, 65);
  const passPart = normalizeBirthdatePasswordInput(birthdateOrPassword);
  return `stu_${namePart}_${passPart}`.slice(0, 95);
}

export function ageFrom(birthdate: string, now = new Date()): number {
  if (!birthdate) return 10;
  // Robust match for YYYY-MM-DD without timezone shift
  const match = birthdate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const birthYear = parseInt(match[1], 10);
    const birthMonth = parseInt(match[2], 10) - 1; // 0-based
    const birthDay = parseInt(match[3], 10);

    let age = now.getFullYear() - birthYear;
    const m = now.getMonth() - birthMonth;
    if (m < 0 || (m === 0 && now.getDate() < birthDay)) {
      age--;
    }
    return Math.max(0, age);
  }

  const b = new Date(`${birthdate}T00:00:00`);
  if (Number.isNaN(b.getTime())) return 10;
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return Math.max(0, age);
}

export function formatBirthdateBR(birthdate?: string | null): string {
  if (!birthdate) return "";
  const match = birthdate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return birthdate;
}

/* ------------------------ Turmas Escolares (A - F) ------------------------ */

export const VALID_TURMAS = ["A", "B", "C", "D", "E", "F"] as const;
export type TurmaCode = (typeof VALID_TURMAS)[number];

export function isValidTurma(val: string): val is TurmaCode {
  return VALID_TURMAS.includes(val as TurmaCode);
}

export interface TurmaChangeRequest {
  id: string;
  playerId: string;
  playerNick: string;
  playerFullName: string;
  school: string;
  grade: string | null;
  currentTurma: string | null;
  requestedTurma: TurmaCode;
  requestedAt: string;
  status: "pendente" | "aprovada" | "recusada";
}

const TURMA_REQUESTS_KEY = "desafios-turma-requests-v1";

export function loadTurmaRequests(): TurmaChangeRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TURMA_REQUESTS_KEY);
    return raw ? (JSON.parse(raw) as TurmaChangeRequest[]) : [];
  } catch {
    return [];
  }
}

export function saveTurmaRequests(reqs: TurmaChangeRequest[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TURMA_REQUESTS_KEY, JSON.stringify(reqs));
  } catch {
    // ignore
  }
}

export function createTurmaChangeRequest(args: {
  playerId: string;
  playerNick: string;
  playerFullName: string;
  school: string;
  grade: string | null;
  currentTurma: string | null;
  requestedTurma: TurmaCode;
}): TurmaChangeRequest {
  const reqs = loadTurmaRequests().filter(
    (r) => !(r.playerId === args.playerId && r.status === "pendente"),
  );
  const newReq: TurmaChangeRequest = {
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ...args,
    requestedAt: new Date().toISOString(),
    status: "pendente",
  };
  reqs.unshift(newReq);
  saveTurmaRequests(reqs);
  return newReq;
}

export function resolveTurmaChangeRequest(
  requestId: string,
  decision: "aprovada" | "recusada",
): TurmaChangeRequest | null {
  const reqs = loadTurmaRequests();
  const found = reqs.find((r) => r.id === requestId);
  if (!found) return null;
  found.status = decision;
  saveTurmaRequests(reqs);
  return found;
}

/* --------------- Etapas por Faixa Etária (1ª, 2ª e 3ª Etapa) --------------- */

export type AgeStageId = "etapa_1" | "etapa_2" | "etapa_3";

export interface AgeStageInfo {
  id: AgeStageId;
  shortLabel: string;
  label: string;
  ageRangeLabel: string;
  schoolCycleLabel: string;
  emoji: string;
  minAge: number;
  maxAge: number | null;
}

export const AGE_STAGES: readonly AgeStageInfo[] = [
  {
    id: "etapa_1",
    shortLabel: "1ª Etapa",
    label: "1ª Etapa (Até 11 anos • 5º ano)",
    ageRangeLabel: "Até 11 anos",
    schoolCycleLabel: "5º ano (Raimunda Cruz, Ursulina, Nazaré, Litaiff)",
    emoji: "🌱",
    minAge: 0,
    maxAge: 11,
  },
  {
    id: "etapa_2",
    shortLabel: "2ª Etapa",
    label: "2ª Etapa (11 a 14 anos • 6º ao 9º ano)",
    ageRangeLabel: "11 a 14 anos",
    schoolCycleLabel: "6º ao 9º ano (Raimundo Bezerra)",
    emoji: "⚡",
    minAge: 11,
    maxAge: 14,
  },
  {
    id: "etapa_3",
    shortLabel: "3ª Etapa",
    label: "3ª Etapa (15+ anos • Comunidade / Outro)",
    ageRangeLabel: "15+ anos",
    schoolCycleLabel: "Comunidade / Outro",
    emoji: "🚀",
    minAge: 15,
    maxAge: null,
  },
] as const;

export function getAgeStageInfo(stageId: AgeStageId): AgeStageInfo {
  return AGE_STAGES.find((s) => s.id === stageId) ?? AGE_STAGES[0];
}

/**
 * Allocates a player into one of the 3 Age Stages based on their calculated age:
 * - 1ª Etapa (`etapa_1`): até 11 anos (alunos do 5º ano que completam até 11 anos até dezembro de 2026)
 * - 2ª Etapa (`etapa_2`): 12 a 14 anos (ou 11 anos no Raimundo Bezerra)
 * - 3ª Etapa (`etapa_3`): acima de 14 anos (>= 15)
 */
export function stageFromAge(age: number): AgeStageInfo {
  const safeAge = Math.max(0, Math.floor(age));
  if (safeAge <= 11) return AGE_STAGES[0];
  if (safeAge <= 14) return AGE_STAGES[1];
  return AGE_STAGES[2];
}

/**
 * Calculates the player's stage considering their actual age and school:
 * - Idade >= 15 anos -> 3ª Etapa (Jovens e Adultos / Comunidade)
 * - Idade > 11 anos (12 a 14 anos) -> 2ª Etapa (6º ao 9º ano / Raimundo Bezerra)
 * - Idade <= 11 anos (incluindo alunos que completam 11 anos até dezembro de 2026):
 *   -> Se estiver na escola Raimundo Bezerra (6º ao 9º ano), aloca na 2ª Etapa;
 *   -> Caso contrário (escolas de 5º ano), aloca na 1ª Etapa (5º ano).
 * - Se data não informada: usa a escola como critério auxiliar
 */
export function stageFromBirthdate(
  birthdate?: string | null,
  now = new Date(),
  school?: string | null,
): AgeStageInfo {
  // Se não informou data de nascimento, usa escola informada como fallback
  if (!birthdate) {
    if (school) {
      if (is5thGradeSchool(school)) return AGE_STAGES[0];
      if (school.toLowerCase().includes("bezerra")) return AGE_STAGES[1];
    }
    return AGE_STAGES[0];
  }

  const age = ageFrom(birthdate, now);

  // 0. Jogadores com 15 anos ou mais (Etapa 3) são sempre da 3ª Etapa (Comunidade / Outro)
  if (age >= 15 || isEtapa3OrOlder(birthdate, now)) {
    return AGE_STAGES[2];
  }

  // 1. Jogadores que ultrapassaram 11 anos (12 a 14 anos) pertencem estritamente à 2ª Etapa (6º ao 9º ano)
  if (age > 11) {
    return AGE_STAGES[1];
  }

  // 2. Alunos com até 11 anos (válido até dezembro de 2026):
  // Se estiver matriculado no Raimundo Bezerra (6º ao 9º ano), participa da 2ª Etapa;
  // caso contrário (5º ano), participa da 1ª Etapa.
  if (school && school.toLowerCase().includes("bezerra")) {
    return AGE_STAGES[1];
  }

  return AGE_STAGES[0];
}

export function stageForPlayer(
  school?: string | null,
  birthdate?: string | null,
  now = new Date(),
): AgeStageInfo {
  return stageFromBirthdate(birthdate, now, school);
}

/* --------------------- Categorias de Série / Etapa para o Ranking --------------------- */

export type RankingFilterCategory =
  | AgeStageId
  | "5º ano"
  | "6º ano"
  | "7º ano"
  | "8º ano"
  | "9º ano"
  | "TODAS";

export interface RankingSeriesOption {
  id: Exclude<RankingFilterCategory, "TODAS" | "etapa_1">;
  shortLabel: string;
  label: string;
  description: string;
  emoji: string;
}

export const RANKING_SERIES_OPTIONS: readonly RankingSeriesOption[] = [
  {
    id: "5º ano",
    shortLabel: "5º ano",
    label: "5º ano (1ª Etapa • Até 11 anos)",
    description: "Raimunda Cruz, Ursulina, Nazaré, Litaiff",
    emoji: "🌱",
  },
  {
    id: "6º ano",
    shortLabel: "6º ano",
    label: "6º ano (2ª Etapa)",
    description: "Raimundo Bezerra • 6º ano",
    emoji: "⚡",
  },
  {
    id: "7º ano",
    shortLabel: "7º ano",
    label: "7º ano (2ª Etapa)",
    description: "Raimundo Bezerra • 7º ano",
    emoji: "⚡",
  },
  {
    id: "8º ano",
    shortLabel: "8º ano",
    label: "8º ano (2ª Etapa)",
    description: "Raimundo Bezerra • 8º ano",
    emoji: "⚡",
  },
  {
    id: "9º ano",
    shortLabel: "9º ano",
    label: "9º ano (2ª Etapa)",
    description: "Raimundo Bezerra • 9º ano",
    emoji: "⚡",
  },
  {
    id: "etapa_2",
    shortLabel: "2ª Etapa (6º ao 9º)",
    label: "2ª Etapa Geral (6º ao 9º ano)",
    description: "Todos os alunos de 11 a 14 anos",
    emoji: "⚡",
  },
  {
    id: "etapa_3",
    shortLabel: "3ª Etapa (15+ anos)",
    label: "3ª Etapa (15+ anos • Comunidade)",
    description: "Comunidade / Outro",
    emoji: "🚀",
  },
] as const;

export function getRankingCategoryLabel(category: RankingFilterCategory): string {
  if (category === "TODAS") return "Geral (Todas as Séries)";
  if (category === "etapa_1" || category === "5º ano") {
    return "5º ano (1ª Etapa • Até 11 anos)";
  }
  const found = RANKING_SERIES_OPTIONS.find((o) => o.id === category);
  return found ? found.label : category;
}

/**
 * Resolves the default Ranking filter for a logged-in player based on the grade/series they compete in:
 * - Student in 5º ano (or 1ª Etapa): sees "5º ano"
 * - Student in 6º, 7º, 8º or 9º ano: sees their exact grade ("6º ano", "7º ano", "8º ano", "9º ano")
 * - Student in 2ª Etapa without specific grade set: sees "etapa_2"
 * - Student in 3ª Etapa (15+ years): sees "etapa_3"
 */
export function resolveDefaultRankingCategory(
  profile?: { birthdate?: string | null; school?: string | null; grade?: string | null } | null,
  now = new Date(),
): RankingFilterCategory {
  if (!profile) return "5º ano";
  const st = stageFromBirthdate(profile.birthdate, now, profile.school);
  if (st.id === "etapa_3") return "etapa_3";
  if (st.id === "etapa_1") return "5º ano";
  if (
    profile.grade === "6º ano" ||
    profile.grade === "7º ano" ||
    profile.grade === "8º ano" ||
    profile.grade === "9º ano"
  ) {
    return profile.grade;
  }
  return "etapa_2";
}

/**
 * Checks whether a student profile belongs to the selected Ranking series/stage filter.
 */
export function matchesRankingCategory(
  profile: { birthdate?: string | null; school?: string | null; grade?: string | null },
  category?: RankingFilterCategory | null,
  now = new Date(),
): boolean {
  if (!category || category === "TODAS") return true;
  const st = stageFromBirthdate(profile.birthdate, now, profile.school);
  if (category === "etapa_3") return st.id === "etapa_3";
  if (category === "etapa_1" || category === "5º ano") return st.id === "etapa_1";
  if (category === "etapa_2") return st.id === "etapa_2";
  if (
    category === "6º ano" ||
    category === "7º ano" ||
    category === "8º ano" ||
    category === "9º ano"
  ) {
    if (st.id !== "etapa_2") return false;
    const normalizedGrade = profile.grade?.trim().toLowerCase() ?? "";
    return normalizedGrade === category.toLowerCase();
  }
  return true;
}

/* --------------------- Cálculo Real de Subida / Descida no Ranking --------------------- */

export type RankTrendDirection = "up" | "down" | "same";

export interface RankHistoryState {
  lastRank: number;
  previousRank: number;
  trend: RankTrendDirection;
}

/**
 * Computes real rank movement arrows (up / down / same) by comparing each player's current rank
 * against their previously recorded rank on the same leaderboard.
 *
 * Rules:
 * - Se o aluno subiu de posição (ex: estava em 2º e foi para 1º, ou de 3º para 2º): `trend = "up"` (seta verde ▲).
 * - Se o aluno caiu de posição (ex: estava em 1º e foi para 2º, ou de 2º para 3º): `trend = "down"` (seta vermelha ▼).
 * - O 1º colocado (`rank === 1`) NUNCA pode ter seta vermelha (`"down"`), pois não há posição acima de 1º lugar.
 */
export function evaluateLeaderboardRankChanges<T extends { playerId: string; rank: number }>(
  entries: T[],
  prevHistory: Record<string, RankHistoryState> = {},
): {
  entriesWithTrend: (T & { rankTrend: RankTrendDirection; previousRank: number })[];
  nextHistory: Record<string, RankHistoryState>;
} {
  const nextHistory: Record<string, RankHistoryState> = { ...prevHistory };

  const entriesWithTrend = entries.map((entry) => {
    const currentRank = entry.rank;
    const prev = prevHistory[entry.playerId];
    let trend: RankTrendDirection = "same";
    let previousRank = currentRank;

    if (!prev) {
      // Primeiro registro deste jogador neste ranking: 1º lugar destaca em verde (topo), demais neutro
      trend = currentRank === 1 ? "up" : "same";
      previousRank = currentRank;
    } else if (currentRank < prev.lastRank) {
      // Subiu de colocação (ex: 2º -> 1º, 3º -> 2º)
      trend = "up";
      previousRank = prev.lastRank;
    } else if (currentRank > prev.lastRank) {
      // Caiu de colocação (ex: 1º -> 2º, 2º -> 3º)
      trend = "down";
      previousRank = prev.lastRank;
    } else {
      // Manteve a mesma colocação desde a última leitura
      trend = prev.trend;
      previousRank = prev.previousRank ?? currentRank;
    }

    // Regra de segurança absoluta: quem está em 1º lugar jamais pode estar com seta vermelha de queda
    if (currentRank === 1 && trend === "down") {
      trend = "up";
      previousRank = 1;
    }

    nextHistory[entry.playerId] = {
      lastRank: currentRank,
      previousRank,
      trend,
    };

    return {
      ...entry,
      rankTrend: trend,
      previousRank,
    };
  });

  return { entriesWithTrend, nextHistory };
}

/** Next birthday date and how many days are left. */
export function birthdayInfo(birthdate: string) {
  const b = new Date(`${birthdate || "2015-01-01"}T00:00:00`);
  const safeB = Number.isNaN(b.getTime()) ? new Date("2015-01-01T00:00:00") : b;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), safeB.getMonth(), safeB.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, safeB.getMonth(), safeB.getDate());
  const days = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  return {
    date: next,
    label: next.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }),
    daysLeft: days,
    isToday: days === 0,
  };
}

/* --------------- XP, Level 1..10 Gates & Daily XP Cap --------------- */

export const MAX_LEVEL = 10;
export const DEFAULT_DAILY_XP_CAP = 1000;
export const X1_MIN_LEVEL = 5;
export const TOURNAMENT_MIN_LEVEL = 3;
export const X1_DAILY_EXTRA_XP_CAP = 100;
export const TOURNAMENT_DAILY_EXTRA_XP_CAP = 100;
export const TOURNAMENT_DAILY_ENTRIES_LIMIT = 10;
export const TOURNAMENT_XP_PER_ENTRY = 10;

/** Fator de redução de XP quando uma partida é jogada em equipes/grupos (redução de 4X) */
export const TEAM_MODE_XP_DIVISOR = 4;

export function adjustXpForGameMode(matchXp: number, isTeam = false): number {
  if (!isTeam) return matchXp;
  return Math.max(1, Math.round(matchXp / TEAM_MODE_XP_DIVISOR));
}

export interface TournamentMedal {
  id: string;
  weekKey: string;
  gameId: string;
  rank: number; // 1..5
  tier: "gold" | "silver" | "bronze" | "elite";
  label: string;
  heldMinutes: number;
  bonusXpAwarded: number;
  earnedAt: string;
}

export interface LevelRankTitle {
  minLevel: number;
  title: string;
  emoji: string;
}

export interface LevelRequirement {
  level: number;
  title: string;
  emoji: string;
  /** Cumulative XP required to unlock this level */
  minXp: number;
  /** Minimum finished matches required */
  minMatches: number;
  /** Minimum won matches required */
  minWins: number;
  /** Minimum distinct games explored on the platform */
  minDistinctGames: number;
}

/**
 * Progressive requirements from Level 1 to Level 10 (MAX_LEVEL).
 * With the default 1,000 XP/day cap:
 * - On Day 1 (max 1,000 XP), a player can reach at most Level 4 (795 XP), stopping short of Level 5 (1,444 XP).
 * - Reaching Level 10 (8,433 XP) requires at least 9 days (~1+ week) of daily XP plus 50 matches, 30 wins, and 9 distinct games.
 */
export const LEVEL_REQUIREMENTS: LevelRequirement[] = [
  { level: 1, title: "Iniciante da Lógica", emoji: "🌱", minXp: 0, minMatches: 0, minWins: 0, minDistinctGames: 0 },
  { level: 2, title: "Explorador Digital", emoji: "🔍", minXp: 100, minMatches: 2, minWins: 1, minDistinctGames: 1 },
  { level: 3, title: "Desbravador de Padrões", emoji: "🧩", minXp: 354, minMatches: 5, minWins: 2, minDistinctGames: 2 },
  { level: 4, title: "Calculista Ágil", emoji: "⚡", minXp: 795, minMatches: 8, minWins: 4, minDistinctGames: 3 },
  { level: 5, title: "Programador Júnior", emoji: "🤖", minXp: 1444, minMatches: 12, minWins: 6, minDistinctGames: 4 },
  { level: 6, title: "Estrategista Booleano", emoji: "🛡️", minXp: 2322, minMatches: 18, minWins: 9, minDistinctGames: 5 },
  { level: 7, title: "Mestre dos Algoritmos", emoji: "🧠", minXp: 3445, minMatches: 25, minWins: 13, minDistinctGames: 6 },
  { level: 8, title: "Arquiteto de Dados", emoji: "🚀", minXp: 4829, minMatches: 33, minWins: 18, minDistinctGames: 7 },
  { level: 9, title: "Guardião da Lógica", emoji: "👑", minXp: 6487, minMatches: 42, minWins: 24, minDistinctGames: 8 },
  { level: 10, title: "Lenda da Lógica", emoji: "🌟", minXp: 8433, minMatches: 50, minWins: 30, minDistinctGames: 9 },
];

export const LEVEL_TITLES: LevelRankTitle[] = LEVEL_REQUIREMENTS.map((r) => ({
  minLevel: r.level,
  title: r.title,
  emoji: r.emoji,
}));

export function getLevelRequirement(level: number): LevelRequirement {
  const clamped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return LEVEL_REQUIREMENTS[clamped - 1];
}

export function levelTitle(level: number): LevelRankTitle {
  const req = getLevelRequirement(level);
  return { minLevel: req.level, title: req.title, emoji: req.emoji };
}

/** Cumulative XP needed to reach a given level (1..10). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level >= MAX_LEVEL) return LEVEL_REQUIREMENTS[MAX_LEVEL - 1].minXp;
  return LEVEL_REQUIREMENTS[Math.floor(level) - 1].minXp;
}

/** Cost in XP to advance from `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return xpForLevel(level + 1) - xpForLevel(level);
}

/**
 * Pure XP-based level lookup (capped at MAX_LEVEL = 10).
 * Used when only XP is known; when full player stats are available, use `calculatePlayerLevel`.
 */
export function levelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let lvl = 1;
  for (const req of LEVEL_REQUIREMENTS) {
    if (safeXp >= req.minXp) lvl = req.level;
  }
  return Math.min(MAX_LEVEL, lvl);
}

export interface PlayerProgressionInput {
  xp: number;
  matchesPlayed?: number;
  wins?: number;
  distinctGames?: number;
}

/**
 * Calculates the player's actual unlocked level (1..10) enforcing ALL level gates:
 * XP + Matches Played + Wins + Distinct Games Explored.
 */
export function calculatePlayerLevel(input: PlayerProgressionInput): number {
  const safeXp = Math.max(0, Math.floor(input.xp));
  const matches = Math.max(0, Math.floor(input.matchesPlayed ?? 0));
  const wins = Math.max(0, Math.floor(input.wins ?? 0));
  const distinct = Math.max(0, Math.floor(input.distinctGames ?? 0));

  let unlockedLevel = 1;
  for (const req of LEVEL_REQUIREMENTS) {
    if (req.level === 1) continue;
    const meetsAll =
      safeXp >= req.minXp &&
      matches >= req.minMatches &&
      wins >= req.minWins &&
      distinct >= req.minDistinctGames;
    if (meetsAll) {
      unlockedLevel = req.level;
    } else {
      break;
    }
  }
  return Math.min(MAX_LEVEL, unlockedLevel);
}

export interface LevelMissionCheckItem {
  key: "xp" | "matches" | "wins" | "distinctGames";
  label: string;
  current: number;
  required: number;
  met: boolean;
}

/**
 * Full progression status for UI display (PlayerMenu, Profile Dialog, etc.).
 * Accepts either a raw `xp` number (backwards compatible) or a `PlayerProgressionInput` object.
 */
export function levelProgress(input: number | PlayerProgressionInput) {
  const stats: PlayerProgressionInput =
    typeof input === "number"
      ? {
          xp: input,
          matchesPlayed: 999,
          wins: 999,
          distinctGames: 99,
        }
      : input;

  const safeXp = Math.max(0, Math.floor(stats.xp));
  const matches = Math.max(0, Math.floor(stats.matchesPlayed ?? 0));
  const wins = Math.max(0, Math.floor(stats.wins ?? 0));
  const distinct = Math.max(0, Math.floor(stats.distinctGames ?? 0));

  const level = calculatePlayerLevel({
    xp: safeXp,
    matchesPlayed: matches,
    wins,
    distinctGames: distinct,
  });
  const xpOnlyLevel = levelFromXp(safeXp);
  const isMaxLevel = level >= MAX_LEVEL;
  const currentReq = getLevelRequirement(level);
  const nextReq = isMaxLevel ? null : getLevelRequirement(level + 1);

  const start = currentReq.minXp;
  const end = nextReq ? nextReq.minXp : currentReq.minXp;
  const needed = Math.max(1, end - start);
  const currentInBracket = Math.max(0, safeXp - start);
  const percent = isMaxLevel
    ? 100
    : Math.min(100, Math.round((currentInBracket / needed) * 100));

  const checklist: LevelMissionCheckItem[] = nextReq
    ? [
        {
          key: "xp",
          label: "XP acumulado",
          current: safeXp,
          required: nextReq.minXp,
          met: safeXp >= nextReq.minXp,
        },
        {
          key: "matches",
          label: "Partidas concluídas",
          current: matches,
          required: nextReq.minMatches,
          met: matches >= nextReq.minMatches,
        },
        {
          key: "wins",
          label: "Vitórias conquistadas",
          current: wins,
          required: nextReq.minWins,
          met: wins >= nextReq.minWins,
        },
        {
          key: "distinctGames",
          label: "Jogos diferentes explorados",
          current: distinct,
          required: nextReq.minDistinctGames,
          met: distinct >= nextReq.minDistinctGames,
        },
      ]
    : [];

  const isLockedByMissions =
    !isMaxLevel && nextReq !== null && safeXp >= nextReq.minXp && level < xpOnlyLevel;

  return {
    level,
    xpOnlyLevel,
    isMaxLevel,
    isLockedByMissions,
    title: currentReq.title,
    emoji: currentReq.emoji,
    current: isMaxLevel ? safeXp : currentInBracket,
    needed: isMaxLevel ? 0 : needed,
    nextLevelXp: end,
    percent,
    nextRequirement: nextReq,
    checklist,
  };
}

/* ------------------------- Daily XP Cap Helpers ------------------------- */

/** Returns local date string in `YYYY-MM-DD` format for tracking the daily XP limit. */
export function getLocalDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface DailyXpCapResult {
  /** XP actually granted after applying the daily cap */
  grantedXp: number;
  /** Updated daily XP accumulated on `dateKey` */
  newDailyXp: number;
  /** Remaining XP the player can still earn today */
  remainingToday: number;
  /** True if raw XP was reduced or zeroed because of the daily cap */
  wasCapped: boolean;
  /** Active date key (`YYYY-MM-DD`) */
  dateKey: string;
}

/**
 * Enforces the daily XP limit (default 1,000 XP/day).
 * Resets automatically when `lastDateKey !== todayKey`.
 */
export function applyDailyXpCap(args: {
  rawEarnedXp: number;
  currentDailyXp?: number;
  lastDateKey?: string;
  todayKey?: string;
  dailyCap?: number;
}): DailyXpCapResult {
  const todayKey = args.todayKey ?? getLocalDateKey();
  const cap = Math.max(100, Math.floor(args.dailyCap ?? DEFAULT_DAILY_XP_CAP));
  const raw = Math.max(0, Math.floor(args.rawEarnedXp));
  const usedToday =
    args.lastDateKey === todayKey ? Math.max(0, Math.floor(args.currentDailyXp ?? 0)) : 0;

  const remainingBefore = Math.max(0, cap - usedToday);
  const grantedXp = Math.min(raw, remainingBefore);
  const newDailyXp = usedToday + grantedXp;
  const remainingToday = Math.max(0, cap - newDailyXp);

  return {
    grantedXp,
    newDailyXp,
    remainingToday,
    wasCapped: grantedXp < raw,
    dateKey: todayKey,
  };
}

/**
 * Checks whether the Arena X1 is currently within its operating hours (default 07:00 to 19:00 local time).
 */
export function isX1WindowOpen(
  now = new Date(),
  openHour = 7,
  closeHour = 19,
  forceOpen = false,
): boolean {
  if (forceOpen) return true;
  const h = now.getHours();
  if (openHour <= closeHour) {
    return h >= openHour && h < closeHour;
  }
  return h >= openHour || h < closeHour;
}

/** Determines whether a match counts as a "Victory" (Jogo Ganho). */
export function isMatchVictory(score: number, correct: number, wrong = 0): boolean {
  if (correct <= 0 && score <= 0) return false;
  const total = correct + wrong;
  const accuracy = total > 0 ? correct / total : 1;
  return (correct >= 3 && accuracy >= 0.6 && score > 0) || score >= 40;
}

/** Calculates raw XP earned from a finished match (before applying the daily XP cap).
 *  Rewards participation, score, accuracy, game level reached, and victory bonus! */
export function xpFromMatch(
  score: number,
  correct: number,
  wrong = 0,
  gameLevel = 1,
): number {
  const safeScore = Math.max(0, score);
  const safeCorrect = Math.max(0, correct);
  if (safeScore === 0 && safeCorrect === 0) return 0;

  const total = safeCorrect + Math.max(0, wrong);
  const accuracy = total > 0 ? safeCorrect / total : 1;

  const participationXp = 15;
  const scoreXp = Math.floor(safeScore * 0.8);
  const accuracyXp = Math.round(accuracy * 35);
  const levelBonusXp = Math.max(1, gameLevel) * 12;
  const won = isMatchVictory(safeScore, safeCorrect, wrong);
  const flawless = won && wrong === 0 && safeCorrect >= 4;
  const victoryBonusXp = flawless ? 50 : won ? 30 : 0;

  return participationXp + scoreXp + accuracyXp + levelBonusXp + victoryBonusXp;
}

export interface Badge {
  id: string;
  label: string;
  earnedAt: string;
}

export function computeBadges(args: {
  existing: Badge[];
  xp: number;
  wins: number;
  matchesPlayed?: number;
  distinctGamesPlayed: number;
  lastMatchScore: number;
}): Badge[] {
  const map = new Map<string, Badge>(args.existing.map((b) => [b.id, b]));
  const now = new Date().toISOString();
  const level = calculatePlayerLevel({
    xp: args.xp,
    matchesPlayed: args.matchesPlayed ?? args.wins,
    wins: args.wins,
    distinctGames: args.distinctGamesPlayed,
  });

  const grant = (id: string, label: string) => {
    if (!map.has(id)) map.set(id, { id, label, earnedAt: now });
  };

  if ((args.matchesPlayed ?? 0) >= 1 || args.distinctGamesPlayed >= 1) {
    grant("primeira_missao", "🎯 Primeira Missão");
  }
  if (args.wins >= 1) grant("primeira_vitoria", "🏆 Primeira Vitória");
  if (args.wins >= 5) grant("cinco_vitorias", "🔥 Vencedor em Série (5 vitórias)");
  if (args.wins >= 15) grant("quinze_vitorias", "⚔️ Campeão Imbatível (15 vitórias)");
  if (args.lastMatchScore >= 100) grant("centuriao", "💯 Centurião (100+ pts)");
  if (args.distinctGamesPlayed >= 5) grant("explorador", "🧠 Explorador Completo (5 jogos)");
  if (args.distinctGamesPlayed >= 9) grant("mestre_jogos", "🎮 Dominador da Plataforma (9+ jogos)");
  if (args.xp >= 1000) grant("xp_1000", "💎 1.000 XP Acumulados");
  if (args.xp >= 5000) grant("xp_5000", "🏅 5.000 XP Acumulados");
  if (level >= 5) grant("nivel_5", "🤖 Programador Júnior (Nível 5)");
  if (level >= 10) grant("nivel_10", "🌟 Lenda da Lógica (Nível 10)");

  return Array.from(map.values());
}
