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
  stageFromBirthdate,
  TOURNAMENT_DAILY_ENTRIES_LIMIT,
  TOURNAMENT_DAILY_EXTRA_XP_CAP,
  TOURNAMENT_MIN_LEVEL,
  TOURNAMENT_XP_PER_ENTRY,
  type AgeStageId,
  type TournamentMedal,
} from "./player-profile.ts";

const TOURNAMENT_STORAGE_KEY = "desafios-weekly-tournament-v1";

export {
  AGE_STAGES,
  TOURNAMENT_DAILY_ENTRIES_LIMIT,
  TOURNAMENT_DAILY_EXTRA_XP_CAP,
  TOURNAMENT_MIN_LEVEL,
  TOURNAMENT_XP_PER_ENTRY,
};

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
    .filter(
      (rec) =>
        rec.playerId !== "admin-system" &&
        rec.nick.toLowerCase() !== "admin" &&
        rec.playerId !== "admin",
    )
    .map((rec) => {
    const resolvedAge =
      rec.age ?? (rec.birthdate ? ageFrom(rec.birthdate, new Date(nowMs)) : 10);
    const resolvedStage: AgeStageId =
      rec.stage ??
      (rec.birthdate ? stageFromBirthdate(rec.birthdate, new Date(nowMs), rec.school).id : "etapa_1");
    const stInfo = getAgeStageInfo(resolvedStage);
    const { holdMinutes, holdBonusPoints } = computeTop5HoldMetrics(rec, nowMs);
    return {
      rec: {
        ...rec,
        age: resolvedAge,
        stage: resolvedStage,
      },
      stage: resolvedStage,
      stageLabel: stInfo.shortLabel,
      age: resolvedAge,
      holdMinutes,
      holdBonusPoints,
      totalRankedPoints: rec.bestScore + holdBonusPoints,
    };
  });

  // Sort by Total Ranked Points (Best Score + Top 5 Hold Bonus), then Hold Time, then Best Score
  list.sort(
    (a, b) =>
      b.totalRankedPoints - a.totalRankedPoints ||
      b.holdMinutes - a.holdMinutes ||
      b.rec.bestScore - a.rec.bestScore ||
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
        if (!local || r.bestScore > local.bestScore || r.updatedAt > local.updatedAt) {
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
  };
}

/**
 * Records a finished Ranked Tournament attempt for the logged-in player,
 * updates Top 5 permanence tracking in their Etapa, and stages/awards their Top 5 Tournament Medal!
 */
export async function recordWeeklyTournamentAttempt(args: {
  profile: PlayerProfile;
  score: number;
}): Promise<{
  standing: TournamentStandingRow | null;
  awardedMedal: TournamentMedal | null;
}> {
  // Admin accounts can test the games, but are not recorded into competitive student standings
  if (
    args.profile.isAdmin ||
    args.profile.id === "admin-system" ||
    args.profile.nickNormalized === "admin"
  ) {
    return { standing: null, awardedMedal: null };
  }

  const nowMs = Date.now();
  const nowDate = new Date(nowMs);
  const store = loadTournamentStore(nowDate);
  const safeScore = Math.max(0, Math.floor(args.score));
  const existing = store.records[args.profile.id];
  const pAge = ageFrom(args.profile.birthdate, nowDate);
  const pStage = stageFromBirthdate(args.profile.birthdate, nowDate, args.profile.school);

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

  // If the student is in the Top 5 of their Etapa, stage/update their Weekly Tournament Medal on their profile!
  if (myRow && myRow.rank <= 5) {
    const medal: TournamentMedal = {
      id: `medal_${store.weekKey}_${pStage.id}_r${myRow.rank}`,
      weekKey: store.weekKey,
      gameId: store.gameId,
      rank: myRow.rank,
      tier: myRow.projectedMedal.tier,
      label: `${myRow.projectedMedal.emoji} Top ${myRow.rank} ${pStage.shortLabel} (${GAME_NAMES[store.gameId]})`,
      heldMinutes: myRow.holdMinutes,
      bonusXpAwarded: 0, // Daily +10 XP is granted via playfabRecordMatch("torneio_semanal")
      earnedAt: new Date(nowMs).toISOString(),
    };
    await grantPlayerTournamentMedal(medal);
    awardedMedal = medal;
  }

  return { standing: myRow, awardedMedal };
}
