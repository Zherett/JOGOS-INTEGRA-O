// Torneio Semanal Ranqueado (Nível 3+)
// 1 Jogo por semana, limite de 10 entradas diárias (+100 XP extras/dia),
// Ranking Top 5 com Bônus de Permanência ("quem se mantiver na colocação por mais tempo")
// e sistema de Medalhas de Torneio engatilhado.

import { ALL_GAME_IDS, GAME_NAMES, type GameId } from "./game-storage.ts";
import { loadAdminConfig } from "./game-codes.ts";
import {
  grantPlayerTournamentMedal,
  getPlayFabTitleId,
  isPlayFabConfigured,
  loadStoredSession,
  type PlayerProfile,
} from "./playfab.ts";
import {
  ageFrom,
  AGE_STAGES,
  getAgeStageInfo,
  getLocalDateKey,
  isMatchVictory,
  stageFromBirthdate,
  TOURNAMENT_DAILY_ENTRIES_LIMIT,
  TOURNAMENT_DAILY_EXTRA_XP_CAP,
  TOURNAMENT_MIN_LEVEL,
  TOURNAMENT_XP_PER_ENTRY,
  type AgeStageId,
  type TournamentMedal,
} from "./player-profile.ts";

export type { AgeStageId };

const TOURNAMENT_STORAGE_KEY = "desafios-weekly-tournament-v1";

export {
  AGE_STAGES,
  TOURNAMENT_DAILY_ENTRIES_LIMIT,
  TOURNAMENT_DAILY_EXTRA_XP_CAP,
  TOURNAMENT_MIN_LEVEL,
  TOURNAMENT_XP_PER_ENTRY,
};

export type TournamentTier = "bronze" | "prata" | "ouro" | "platina" | "diamante" | "mestre";

export type TournamentRankId =
  | "bronze_1"
  | "bronze_2"
  | "bronze_3"
  | "prata_1"
  | "prata_2"
  | "prata_3"
  | "ouro_1"
  | "ouro_2"
  | "ouro_3"
  | "platina_1"
  | "platina_2"
  | "platina_3"
  | "platina_4"
  | "diamante_1"
  | "diamante_2"
  | "diamante_3"
  | "diamante_4"
  | "diamante_5"
  | "mestre";

export interface TournamentRankDefinition {
  id: TournamentRankId;
  tier: TournamentTier;
  tierName: string;
  division: string;
  name: string;
  minPoints: number;
  maxPoints: number;
  textColor: string;
  badgeBg: string;
  borderColor: string;
  glowHex: string;
  iconName: string;
  shape: "shield" | "crest" | "star" | "diamond" | "hexagon" | "crown";
}

export const TOURNAMENT_RANKS: TournamentRankDefinition[] = [
  // Bronze (0 - 90 pts)
  {
    id: "bronze_1",
    tier: "bronze",
    tierName: "Bronze",
    division: "I",
    name: "Bronze I",
    minPoints: 0,
    maxPoints: 30,
    textColor: "text-[#b8661d] dark:text-[#cd7f32]",
    badgeBg: "bg-[#f7e4d0] dark:bg-[#3b2310]",
    borderColor: "border-[#cd7f32]",
    glowHex: "#cd7f32",
    iconName: "Shield",
    shape: "shield",
  },
  {
    id: "bronze_2",
    tier: "bronze",
    tierName: "Bronze",
    division: "II",
    name: "Bronze II",
    minPoints: 31,
    maxPoints: 60,
    textColor: "text-[#b8661d] dark:text-[#cd7f32]",
    badgeBg: "bg-[#f7e4d0] dark:bg-[#3b2310]",
    borderColor: "border-[#cd7f32]",
    glowHex: "#cd7f32",
    iconName: "Shield",
    shape: "shield",
  },
  {
    id: "bronze_3",
    tier: "bronze",
    tierName: "Bronze",
    division: "III",
    name: "Bronze III",
    minPoints: 61,
    maxPoints: 90,
    textColor: "text-[#b8661d] dark:text-[#cd7f32]",
    badgeBg: "bg-[#f7e4d0] dark:bg-[#3b2310]",
    borderColor: "border-[#cd7f32]",
    glowHex: "#cd7f32",
    iconName: "Shield",
    shape: "shield",
  },
  // Prata (91 - 240 pts)
  {
    id: "prata_1",
    tier: "prata",
    tierName: "Prata",
    division: "I",
    name: "Prata I",
    minPoints: 91,
    maxPoints: 140,
    textColor: "text-slate-700 dark:text-slate-200",
    badgeBg: "bg-slate-200 dark:bg-slate-700",
    borderColor: "border-slate-400 dark:border-slate-500",
    glowHex: "#94a3b8",
    iconName: "Award",
    shape: "crest",
  },
  {
    id: "prata_2",
    tier: "prata",
    tierName: "Prata",
    division: "II",
    name: "Prata II",
    minPoints: 141,
    maxPoints: 190,
    textColor: "text-slate-700 dark:text-slate-200",
    badgeBg: "bg-slate-200 dark:bg-slate-700",
    borderColor: "border-slate-400 dark:border-slate-500",
    glowHex: "#94a3b8",
    iconName: "Award",
    shape: "crest",
  },
  {
    id: "prata_3",
    tier: "prata",
    tierName: "Prata",
    division: "III",
    name: "Prata III",
    minPoints: 191,
    maxPoints: 240,
    textColor: "text-slate-700 dark:text-slate-200",
    badgeBg: "bg-slate-200 dark:bg-slate-700",
    borderColor: "border-slate-400 dark:border-slate-500",
    glowHex: "#94a3b8",
    iconName: "Award",
    shape: "crest",
  },
  // Ouro (241 - 450 pts)
  {
    id: "ouro_1",
    tier: "ouro",
    tierName: "Ouro",
    division: "I",
    name: "Ouro I",
    minPoints: 241,
    maxPoints: 310,
    textColor: "text-amber-700 dark:text-amber-300",
    badgeBg: "bg-amber-100 dark:bg-amber-950",
    borderColor: "border-amber-400",
    glowHex: "#fbbf24",
    iconName: "Star",
    shape: "star",
  },
  {
    id: "ouro_2",
    tier: "ouro",
    tierName: "Ouro",
    division: "II",
    name: "Ouro II",
    minPoints: 311,
    maxPoints: 380,
    textColor: "text-amber-700 dark:text-amber-300",
    badgeBg: "bg-amber-100 dark:bg-amber-950",
    borderColor: "border-amber-400",
    glowHex: "#fbbf24",
    iconName: "Star",
    shape: "star",
  },
  {
    id: "ouro_3",
    tier: "ouro",
    tierName: "Ouro",
    division: "III",
    name: "Ouro III",
    minPoints: 381,
    maxPoints: 450,
    textColor: "text-amber-700 dark:text-amber-300",
    badgeBg: "bg-amber-100 dark:bg-amber-950",
    borderColor: "border-amber-400",
    glowHex: "#fbbf24",
    iconName: "Star",
    shape: "star",
  },
  // Platina (451 - 680 pts)
  {
    id: "platina_1",
    tier: "platina",
    tierName: "Platina",
    division: "I",
    name: "Platina I",
    minPoints: 451,
    maxPoints: 507,
    textColor: "text-cyan-700 dark:text-cyan-300",
    badgeBg: "bg-cyan-100 dark:bg-cyan-950",
    borderColor: "border-cyan-400",
    glowHex: "#22d3ee",
    iconName: "Sparkles",
    shape: "diamond",
  },
  {
    id: "platina_2",
    tier: "platina",
    tierName: "Platina",
    division: "II",
    name: "Platina II",
    minPoints: 508,
    maxPoints: 564,
    textColor: "text-cyan-700 dark:text-cyan-300",
    badgeBg: "bg-cyan-100 dark:bg-cyan-950",
    borderColor: "border-cyan-400",
    glowHex: "#22d3ee",
    iconName: "Sparkles",
    shape: "diamond",
  },
  {
    id: "platina_3",
    tier: "platina",
    tierName: "Platina",
    division: "III",
    name: "Platina III",
    minPoints: 565,
    maxPoints: 621,
    textColor: "text-cyan-700 dark:text-cyan-300",
    badgeBg: "bg-cyan-100 dark:bg-cyan-950",
    borderColor: "border-cyan-400",
    glowHex: "#22d3ee",
    iconName: "Sparkles",
    shape: "diamond",
  },
  {
    id: "platina_4",
    tier: "platina",
    tierName: "Platina",
    division: "IV",
    name: "Platina IV",
    minPoints: 622,
    maxPoints: 680,
    textColor: "text-cyan-700 dark:text-cyan-300",
    badgeBg: "bg-cyan-100 dark:bg-cyan-950",
    borderColor: "border-cyan-400",
    glowHex: "#22d3ee",
    iconName: "Sparkles",
    shape: "diamond",
  },
  // Diamante (681 - 849 pts)
  {
    id: "diamante_1",
    tier: "diamante",
    tierName: "Diamante",
    division: "I",
    name: "Diamante I",
    minPoints: 681,
    maxPoints: 714,
    textColor: "text-fuchsia-700 dark:text-fuchsia-300",
    badgeBg: "bg-fuchsia-100 dark:bg-fuchsia-950",
    borderColor: "border-fuchsia-400",
    glowHex: "#e879f9",
    iconName: "Sparkles",
    shape: "hexagon",
  },
  {
    id: "diamante_2",
    tier: "diamante",
    tierName: "Diamante",
    division: "II",
    name: "Diamante II",
    minPoints: 715,
    maxPoints: 748,
    textColor: "text-fuchsia-700 dark:text-fuchsia-300",
    badgeBg: "bg-fuchsia-100 dark:bg-fuchsia-950",
    borderColor: "border-fuchsia-400",
    glowHex: "#e879f9",
    iconName: "Sparkles",
    shape: "hexagon",
  },
  {
    id: "diamante_3",
    tier: "diamante",
    tierName: "Diamante",
    division: "III",
    name: "Diamante III",
    minPoints: 749,
    maxPoints: 782,
    textColor: "text-fuchsia-700 dark:text-fuchsia-300",
    badgeBg: "bg-fuchsia-100 dark:bg-fuchsia-950",
    borderColor: "border-fuchsia-400",
    glowHex: "#e879f9",
    iconName: "Sparkles",
    shape: "hexagon",
  },
  {
    id: "diamante_4",
    tier: "diamante",
    tierName: "Diamante",
    division: "IV",
    name: "Diamante IV",
    minPoints: 783,
    maxPoints: 816,
    textColor: "text-fuchsia-700 dark:text-fuchsia-300",
    badgeBg: "bg-fuchsia-100 dark:bg-fuchsia-950",
    borderColor: "border-fuchsia-400",
    glowHex: "#e879f9",
    iconName: "Sparkles",
    shape: "hexagon",
  },
  {
    id: "diamante_5",
    tier: "diamante",
    tierName: "Diamante",
    division: "V",
    name: "Diamante V",
    minPoints: 817,
    maxPoints: 849,
    textColor: "text-fuchsia-700 dark:text-fuchsia-300",
    badgeBg: "bg-fuchsia-100 dark:bg-fuchsia-950",
    borderColor: "border-fuchsia-400",
    glowHex: "#e879f9",
    iconName: "Sparkles",
    shape: "hexagon",
  },
  // Mestre (850+ pts)
  {
    id: "mestre",
    tier: "mestre",
    tierName: "Mestre",
    division: "",
    name: "Mestre",
    minPoints: 850,
    maxPoints: 99999,
    textColor: "text-rose-600 dark:text-rose-300",
    badgeBg: "bg-rose-100 dark:bg-rose-950",
    borderColor: "border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse",
    glowHex: "#f43f5e",
    iconName: "Crown",
    shape: "crown",
  },
];

export function getTournamentRank(points: number): {
  currentRank: TournamentRankDefinition;
  nextRank: TournamentRankDefinition | null;
  progressPercent: number;
  pointsToNext: number;
  pointsInCurrentRank: number;
  pointsForCurrentRank: number;
} {
  const safePoints = Math.max(0, Math.floor(points));
  let curIdx = 0;
  for (let i = 0; i < TOURNAMENT_RANKS.length; i++) {
    if (safePoints >= TOURNAMENT_RANKS[i].minPoints) {
      curIdx = i;
    }
  }

  const currentRank = TOURNAMENT_RANKS[curIdx];
  const nextRank = curIdx < TOURNAMENT_RANKS.length - 1 ? TOURNAMENT_RANKS[curIdx + 1] : null;

  if (!nextRank) {
    return {
      currentRank,
      nextRank: null,
      progressPercent: 100,
      pointsToNext: 0,
      pointsInCurrentRank: safePoints - currentRank.minPoints,
      pointsForCurrentRank: 100,
    };
  }

  const span = Math.max(1, nextRank.minPoints - currentRank.minPoints);
  const inRank = Math.max(0, safePoints - currentRank.minPoints);
  const progressPercent = Math.min(100, Math.round((inRank / span) * 100));
  const pointsToNext = Math.max(0, nextRank.minPoints - safePoints);

  return {
    currentRank,
    nextRank,
    progressPercent,
    pointsToNext,
    pointsInCurrentRank: inRank,
    pointsForCurrentRank: span,
  };
}

export interface TournamentPlayerRecord {
  playerId: string;
  nick: string;
  fullName: string;
  school: string;
  birthdate?: string;
  age?: number;
  stage?: AgeStageId;
  level: number;
  bestScore: number;
  totalEntries: number;
  tournamentPoints?: number;
  dailyWinsCount?: number;
  dailyMatchesCount?: number;
  dailyDateKey?: string;
  dailyBonusAwarded?: boolean;
  highestRankId?: TournamentRankId;
  /** Timestamp (epoch ms) when the player entered the Top 5 of their Etapa (null if currently outside Top 5) */
  activeTop5Since: number | null;
  /** Accumulated milliseconds previously spent inside the Top 5 of their Etapa this week */
  accumulatedTop5Ms: number;
  updatedAt: number;
}

export interface TournamentStandingRow {
  rank: number;
  playerId: string;
  nick: string;
  fullName: string;
  school: string;
  age: number;
  stage: AgeStageId;
  stageLabel: string;
  level: number;
  bestScore: number;
  tournamentPoints: number;
  currentRank: TournamentRankDefinition;
  holdMinutes: number;
  holdBonusPoints: number;
  totalRankedPoints: number;
  totalEntries: number;
  projectedMedal: {
    tier: "gold" | "silver" | "bronze" | "elite";
    emoji: string;
    label: string;
    bonusXp: number;
  };
}

interface WeeklyTournamentStore {
  weekKey: string;
  gameId: GameId;
  records: Record<string, TournamentPlayerRecord>;
  updatedAt: number;
}

/** Computes a deterministic Monday-to-Sunday week key (`YYYY-Www`, flipping Sunday 23:59 -> Monday 00:00). */
export function getWeekInfo(now = new Date()): {
  weekKey: string;
  weekIndex: number;
  endsAtLabel: string;
} {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startMondayOffset = (startOfYear.getDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  const diffDays = Math.round((todayMidnight.getTime() - startOfYear.getTime()) / 86_400_000);
  const weekNum = Math.floor((diffDays + startMondayOffset) / 7) + 1;
  const weekKey = `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;

  // Current week's Sunday 23:59
  const daysUntilSunday = (7 - now.getDay()) % 7;
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSunday);
  const endsAtLabel = `${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às 23:59`;

  return {
    weekKey,
    weekIndex: now.getFullYear() * 53 + weekNum,
    endsAtLabel,
  };
}

/** Selects the Weekly Ranked Tournament game (ADM override or automatic weekly rotation). */
export function resolveWeeklyTournamentGame(
  weekIndex: number,
  overrideGame?: GameId | null,
  enabledGames?: Record<GameId, boolean>,
): GameId {
  if (overrideGame && (!enabledGames || enabledGames[overrideGame])) {
    return overrideGame;
  }
  const pool = enabledGames
    ? ALL_GAME_IDS.filter((id) => enabledGames[id])
    : ALL_GAME_IDS;
  const safePool = pool.length > 0 ? pool : ALL_GAME_IDS;
  return safePool[Math.abs(weekIndex) % safePool.length];
}

/** Calculates total minutes spent in the Top 5 and the corresponding permanence bonus points. */
export function computeTop5HoldMetrics(
  record: Pick<TournamentPlayerRecord, "activeTop5Since" | "accumulatedTop5Ms">,
  nowMs = Date.now(),
): { holdMinutes: number; holdBonusPoints: number } {
  const activeMs =
    record.activeTop5Since !== null ? Math.max(0, nowMs - record.activeTop5Since) : 0;
  const totalMs = Math.max(0, (record.accumulatedTop5Ms ?? 0) + activeMs);
  const holdMinutes = Math.floor(totalMs / 60_000);
  // +2 ranked points for every 10 minutes holding a Top 5 position (up to +300 bonus points/week)
  const holdBonusPoints = Math.min(300, Math.floor(holdMinutes / 10) * 2);
  return { holdMinutes, holdBonusPoints };
}

export function projectedMedalForRank(
  rank: number,
  holdMinutes: number,
): TournamentStandingRow["projectedMedal"] {
  const holdExtraXp = Math.min(100, Math.floor(holdMinutes / 30) * 5);
  if (rank === 1) {
    return {
      tier: "gold",
      emoji: "🥇",
      label: "Ouro • Campeão da Semana",
      bonusXp: 150 + holdExtraXp,
    };
  }
  if (rank === 2) {
    return {
      tier: "silver",
      emoji: "🥈",
      label: "Prata • Vice-Campeão Semanal",
      bonusXp: 100 + holdExtraXp,
    };
  }
  if (rank === 3) {
    return {
      tier: "bronze",
      emoji: "🥉",
      label: "Bronze • 3º Lugar Semanal",
      bonusXp: 75 + holdExtraXp,
    };
  }
  return {
    tier: "elite",
    emoji: "🏅",
    label: "Elite • Top 5 da Semana",
    bonusXp: 50 + holdExtraXp,
  };
}

/**
 * Re-evaluates all tournament records per Age Stage (1ª, 2ª, 3ª Etapa),
 * updates `activeTop5Since` for who is inside vs. outside the Top 5 of their Etapa,
 * and returns the sorted Top 5 leaderboard (for the requested `stageFilter` or `"TODAS"`).
 */
export function evaluateTournamentStandings(
  recordsMap: Record<string, TournamentPlayerRecord>,
  nowMs = Date.now(),
  stageFilter?: AgeStageId | "TODAS",
): {
  top5: TournamentStandingRow[];
  allStandings: TournamentStandingRow[];
  updatedRecords: Record<string, TournamentPlayerRecord>;
} {
  const list = Object.values(recordsMap)
    .filter((rec) => {
      const pId = rec.playerId.toLowerCase();
      const nick = rec.nick.toLowerCase();
      return (
        pId !== "admin-system" &&
        !pId.startsWith("admin-") &&
        pId !== "admin" &&
        pId !== "josiney" &&
        pId !== "quemuel" &&
        nick !== "admin" &&
        nick !== "josiney" &&
        nick !== "quemuel"
      );
    })
    .map((rec) => {
      const resolvedAge =
        rec.age ?? (rec.birthdate ? ageFrom(rec.birthdate, new Date(nowMs)) : 10);
      const resolvedStage: AgeStageId =
        rec.stage ??
        (rec.birthdate ? stageFromBirthdate(rec.birthdate, new Date(nowMs), rec.school).id : "etapa_1");
      const stInfo = getAgeStageInfo(resolvedStage);
      const { holdMinutes, holdBonusPoints } = computeTop5HoldMetrics(rec, nowMs);
      const tourPoints =
        typeof rec.tournamentPoints === "number"
          ? Math.max(0, rec.tournamentPoints)
          : Math.max(0, rec.bestScore ?? 0);
      const currentRank = getTournamentRank(tourPoints).currentRank;
      return {
        rec: {
          ...rec,
          age: resolvedAge,
          stage: resolvedStage,
          tournamentPoints: tourPoints,
        },
        stage: resolvedStage,
        stageLabel: stInfo.shortLabel,
        age: resolvedAge,
        tournamentPoints: tourPoints,
        currentRank,
        holdMinutes,
        holdBonusPoints,
        totalRankedPoints: tourPoints + holdBonusPoints,
      };
    });

  // Ordena prioritariamente por Pontos Totais (Pontos Ranqueados + Bônus de Permanência no Top 5)
  list.sort(
    (a, b) =>
      b.totalRankedPoints - a.totalRankedPoints ||
      b.tournamentPoints - a.tournamentPoints ||
      b.rec.bestScore - a.rec.bestScore ||
      b.holdMinutes - a.holdMinutes ||
      a.rec.updatedAt - b.rec.updatedAt,
  );

  // Track Top 5 independently within each Etapa (1ª Etapa, 2ª Etapa, 3ª Etapa)
  const stageCounters: Record<AgeStageId, number> = {
    etapa_1: 0,
    etapa_2: 0,
    etapa_3: 0,
  };

  const updatedRecords: Record<string, TournamentPlayerRecord> = {};
  const stageStandingsMap: Record<AgeStageId, TournamentStandingRow[]> = {
    etapa_1: [],
    etapa_2: [],
    etapa_3: [],
  };
  const generalStandings: TournamentStandingRow[] = [];

  list.forEach((item, globalIndex) => {
    stageCounters[item.stage] += 1;
    const stageRank = stageCounters[item.stage];
    const isTop5InStage = stageRank <= 5;
    const copy: TournamentPlayerRecord = { ...item.rec };

    if (isTop5InStage && copy.activeTop5Since === null) {
      copy.activeTop5Since = nowMs;
    } else if (!isTop5InStage && copy.activeTop5Since !== null) {
      copy.accumulatedTop5Ms += Math.max(0, nowMs - copy.activeTop5Since);
      copy.activeTop5Since = null;
    }

    updatedRecords[copy.playerId] = copy;

    const stageRow: TournamentStandingRow = {
      rank: stageRank,
      playerId: copy.playerId,
      nick: copy.nick,
      fullName: copy.fullName,
      school: copy.school,
      age: item.age,
      stage: item.stage,
      stageLabel: item.stageLabel,
      level: copy.level,
      bestScore: copy.bestScore,
      tournamentPoints: item.tournamentPoints,
      currentRank: item.currentRank,
      holdMinutes: item.holdMinutes,
      holdBonusPoints: item.holdBonusPoints,
      totalRankedPoints: item.totalRankedPoints,
      totalEntries: copy.totalEntries,
      projectedMedal: projectedMedalForRank(stageRank, item.holdMinutes),
    };
    stageStandingsMap[item.stage].push(stageRow);

    generalStandings.push({
      ...stageRow,
      rank: globalIndex + 1,
      projectedMedal: projectedMedalForRank(globalIndex + 1, item.holdMinutes),
    });
  });

  const targetList =
    stageFilter && stageFilter !== "TODAS"
      ? stageStandingsMap[stageFilter]
      : generalStandings;

  return {
    top5: targetList.slice(0, 5),
    allStandings: targetList,
    updatedRecords,
  };
}

/* --------------------- Local & PlayFab Persistence --------------------- */

function loadTournamentStore(now = new Date()): WeeklyTournamentStore {
  const cfg = loadAdminConfig();
  const { weekKey, weekIndex } = getWeekInfo(now);
  const activeGame = resolveWeeklyTournamentGame(
    weekIndex,
    cfg.tournamentGameOverride,
    cfg.enabledGames,
  );

  const empty: WeeklyTournamentStore = {
    weekKey,
    gameId: activeGame,
    records: {},
    updatedAt: now.getTime(),
  };

  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(TOURNAMENT_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<WeeklyTournamentStore>;
    if (parsed.weekKey !== weekKey) {
      return empty;
    }
    return {
      weekKey,
      gameId: activeGame,
      records: parsed.records ?? {},
      updatedAt: parsed.updatedAt ?? now.getTime(),
    };
  } catch {
    return empty;
  }
}

function saveTournamentStore(store: WeeklyTournamentStore) {
  if (typeof window === "undefined") return;
  store.updatedAt = Date.now();
  try {
    window.localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export async function syncWeeklyTournamentWithPlayFab(): Promise<void> {
  if (!isPlayFabConfigured()) return;
  const session = loadStoredSession();
  const titleId = getPlayFabTitleId();
  if (!session?.sessionTicket || !titleId) return;

  const store = loadTournamentStore();
  const groupId = `TOURNAMENT_${store.weekKey.replace(/[^A-Z0-9_]/gi, "_")}`;

  try {
    await fetch(`https://${titleId}.playfabapi.com/Client/CreateSharedGroup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Authorization": session.sessionTicket,
      },
      body: JSON.stringify({ TitleId: titleId, SharedGroupId: groupId }),
    });

    const getRes = await fetch(`https://${titleId}.playfabapi.com/Client/GetSharedGroupData`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Authorization": session.sessionTicket,
      },
      body: JSON.stringify({ TitleId: titleId, SharedGroupId: groupId }),
    });
    const json = (await getRes.json()) as {
      data?: { Data?: Record<string, { Value: string }> };
    };

    if (json.data?.Data?.Standings?.Value) {
      const remoteRecords = JSON.parse(json.data.Data.Standings.Value) as Record<
        string,
        TournamentPlayerRecord
      >;
      for (const [id, r] of Object.entries(remoteRecords)) {
        const local = store.records[id];
        if (
          !local ||
          (r.tournamentPoints ?? 0) > (local.tournamentPoints ?? 0) ||
          r.bestScore > local.bestScore ||
          r.updatedAt > local.updatedAt
        ) {
          store.records[id] = r;
        }
      }
    }

    const evaluated = evaluateTournamentStandings(store.records);
    store.records = evaluated.updatedRecords;
    saveTournamentStore(store);

    await fetch(`https://${titleId}.playfabapi.com/Client/UpdateSharedGroupData`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Authorization": session.sessionTicket,
      },
      body: JSON.stringify({
        TitleId: titleId,
        SharedGroupId: groupId,
        Data: { Standings: JSON.stringify(store.records) },
        Permission: "Public",
      }),
    });
  } catch {
    /* ignore network errors */
  }
}

export function getWeeklyTournamentSnapshot(
  profile?: PlayerProfile | null,
  stageFilter?: AgeStageId | "TODAS",
) {
  const now = new Date();
  const store = loadTournamentStore(now);
  const { weekKey, endsAtLabel } = getWeekInfo(now);
  const playerStageInfo = profile
    ? stageFromBirthdate(profile.birthdate, now, profile.school)
    : AGE_STAGES[0];
  const effectiveStage: AgeStageId | "TODAS" = stageFilter ?? playerStageInfo.id;
  const evaluated = evaluateTournamentStandings(store.records, now.getTime(), effectiveStage);
  const myStageEvaluated = evaluateTournamentStandings(
    store.records,
    now.getTime(),
    playerStageInfo.id,
  );

  const todayKey = getLocalDateKey(now);
  const isToday = profile?.dailyXpDate === todayKey;
  const entriesUsedToday = isToday ? Math.max(0, profile?.dailyTournamentEntries ?? 0) : 0;
  const entriesRemainingToday = Math.max(0, TOURNAMENT_DAILY_ENTRIES_LIMIT - entriesUsedToday);
  const extraXpEarnedToday = isToday ? Math.max(0, profile?.dailyTournamentXp ?? 0) : 0;
  const myStanding = profile
    ? (myStageEvaluated.allStandings.find((s) => s.playerId === profile.id) ?? null)
    : null;

  const currentPoints = Math.max(
    0,
    myStanding?.tournamentPoints ?? profile?.tournamentPoints ?? 0,
  );
  const rankInfo = getTournamentRank(currentPoints);

  return {
    weekKey,
    endsAtLabel,
    gameId: store.gameId,
    gameName: GAME_NAMES[store.gameId] ?? store.gameId,
    playerStage: playerStageInfo,
    selectedStage: effectiveStage,
    top5: evaluated.top5,
    allStandings: evaluated.allStandings,
    myStanding,
    entriesUsedToday,
    entriesRemainingToday,
    extraXpEarnedToday,
    canEnterLevel: (profile?.level ?? 1) >= TOURNAMENT_MIN_LEVEL,
    tournamentPoints: currentPoints,
    rankInfo,
  };
}

/**
 * Registra o resultado da partida ranqueada:
 * - Vitória = +10 pontos
 * - Derrota = -5 pontos
 * - Erro de questão = -1 ponto (por questão errada)
 * - Vencer todas as 10 partidas diárias = +25 pontos de bônus diário
 * - Trava no zero: nunca desce abaixo de 0 pontos (Bronze I)
 */
export async function recordWeeklyTournamentAttempt(args: {
  profile: PlayerProfile;
  score: number;
  correct?: number;
  wrong?: number;
}): Promise<{
  standing: TournamentStandingRow | null;
  awardedMedal: TournamentMedal | null;
  pointsDelta: number;
  newTournamentPoints: number;
  currentRank: TournamentRankDefinition;
  dailyBonusAwarded: boolean;
}> {
  const pId = args.profile.id.toLowerCase();
  const nick = args.profile.nickNormalized?.toLowerCase();
  if (
    args.profile.isAdmin ||
    pId === "admin-system" ||
    pId.startsWith("admin-") ||
    nick === "admin" ||
    nick === "josiney" ||
    nick === "quemuel"
  ) {
    const curRank = getTournamentRank(0).currentRank;
    return {
      standing: null,
      awardedMedal: null,
      pointsDelta: 0,
      newTournamentPoints: 0,
      currentRank: curRank,
      dailyBonusAwarded: false,
    };
  }

  const nowMs = Date.now();
  const nowDate = new Date(nowMs);
  const todayKey = getLocalDateKey(nowDate);
  const store = loadTournamentStore(nowDate);
  const safeScore = Math.max(0, Math.floor(args.score));
  const safeCorrect = Math.max(0, args.correct ?? 0);
  const safeWrong = Math.max(0, args.wrong ?? 0);
  const won = isMatchVictory(safeScore, safeCorrect, safeWrong);

  const existing = store.records[args.profile.id];
  const pAge = ageFrom(args.profile.birthdate, nowDate);
  const pStage = stageFromBirthdate(args.profile.birthdate, nowDate, args.profile.school);

  // Regra de pontuação ranqueada:
  // Vitória: +10 pontos | Derrota: -5 pontos | Erro: -1 ponto por questão
  const baseDelta = won ? 10 : -5;
  const errorPenalty = safeWrong * 1;
  let pointsDelta = baseDelta - errorPenalty;

  // Acompanhamento do bônus diário das 10 vitórias
  const isSameDay = existing?.dailyDateKey === todayKey;
  const currentDailyMatches = isSameDay ? (existing?.dailyMatchesCount ?? 0) : 0;
  const currentDailyWins = isSameDay ? (existing?.dailyWinsCount ?? 0) : 0;
  const nextDailyMatches = currentDailyMatches + 1;
  const nextDailyWins = currentDailyWins + (won ? 1 : 0);
  let dailyBonusAwarded = false;

  if (nextDailyMatches === 10 && nextDailyWins === 10 && !existing?.dailyBonusAwarded) {
    pointsDelta += 25;
    dailyBonusAwarded = true;
  }

  const curPoints = Math.max(0, existing?.tournamentPoints ?? args.profile.tournamentPoints ?? 0);
  const newTournamentPoints = Math.max(0, curPoints + pointsDelta);
  const rankInfo = getTournamentRank(newTournamentPoints);

  store.records[args.profile.id] = {
    playerId: args.profile.id,
    nick: args.profile.nick,
    fullName: args.profile.full_name,
    school: args.profile.school,
    birthdate: args.profile.birthdate,
    age: pAge,
    stage: pStage.id,
    level: args.profile.level,
    bestScore: Math.max(existing?.bestScore ?? 0, safeScore),
    totalEntries: (existing?.totalEntries ?? 0) + 1,
    tournamentPoints: newTournamentPoints,
    dailyWinsCount: nextDailyWins,
    dailyMatchesCount: nextDailyMatches,
    dailyDateKey: todayKey,
    dailyBonusAwarded: dailyBonusAwarded || (isSameDay ? (existing?.dailyBonusAwarded ?? false) : false),
    highestRankId: rankInfo.currentRank.id,
    activeTop5Since: existing?.activeTop5Since ?? null,
    accumulatedTop5Ms: existing?.accumulatedTop5Ms ?? 0,
    updatedAt: nowMs,
  };

  const evaluated = evaluateTournamentStandings(store.records, nowMs, pStage.id);
  store.records = evaluated.updatedRecords;
  saveTournamentStore(store);
  void syncWeeklyTournamentWithPlayFab();

  const myRow = evaluated.allStandings.find((s) => s.playerId === args.profile.id) ?? null;
  let awardedMedal: TournamentMedal | null = null;

  // Se o aluno está no Top 5 de sua Etapa, atualiza/concede a medalha semanal Top 5 de forma acumulativa
  if (myRow && myRow.rank <= 5) {
    const medal: TournamentMedal = {
      id: `medal_${store.weekKey}_${pStage.id}_r${myRow.rank}`,
      weekKey: store.weekKey,
      gameId: store.gameId,
      rank: myRow.rank,
      tier: myRow.projectedMedal.tier,
      label: `${myRow.projectedMedal.emoji} Top ${myRow.rank} ${pStage.shortLabel} (${GAME_NAMES[store.gameId]})`,
      heldMinutes: myRow.holdMinutes,
      bonusXpAwarded: 0,
      earnedAt: new Date(nowMs).toISOString(),
    };
    await grantPlayerTournamentMedal(medal);
    awardedMedal = medal;
  }

  // Atualiza pontos do torneio no perfil local
  args.profile.tournamentPoints = newTournamentPoints;
  args.profile.tournamentRankId = rankInfo.currentRank.id;
  args.profile.bestTournamentPoints = Math.max(
    args.profile.bestTournamentPoints ?? 0,
    newTournamentPoints,
  );

  return {
    standing: myRow,
    awardedMedal,
    pointsDelta,
    newTournamentPoints,
    currentRank: rankInfo.currentRank,
    dailyBonusAwarded,
  };
}
