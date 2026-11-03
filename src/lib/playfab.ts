// Microsoft Azure PlayFab integration module
// Handles player authentication (Username + Password without email), UserData,
// Statistics, Leaderboards (General XP, Per-Game, Per-School), and ADM Config / Scheduled Resets.

import {
  ALL_GAME_IDS,
  clearLocalStats,
  loadStats,
  updateBest,
  type GameId,
} from "./game-storage.ts";
import {
  clearUnlocked,
  DEFAULT_ENABLED_GAMES,
  loadAdminConfig,
  saveAdminConfig,
  saveUnlocked,
  type PlatformAdminConfig,
  type ResetHistoryEntry,
} from "./game-codes.ts";
import {
  adjustXpForGameMode,
  ageFrom,
  applyDailyXpCap,
  calculatePlayerLevel,
  computeBadges,
  evaluateLeaderboardRankChanges,
  formatFullNameUpper,
  fullNameSlug,
  getLocalDateKey,
  isEtapa3OrOlder,
  is5thGradeSchool,
  isMatchVictory,
  isOfficialSemedSchool,
  isValidSchool,
  levelFromXp,
  levelTitle,
  matchesRankingCategory,
  nickSlug,
  normalizeBirthdatePasswordInput,
  passwordFromBirthdate,
  schoolNeedsGrade,
  SCHOOLS,
  schoolSlug,
  stageFromBirthdate,
  studentCustomId,
  TOURNAMENT_DAILY_ENTRIES_LIMIT,
  TOURNAMENT_DAILY_EXTRA_XP_CAP,
  TOURNAMENT_XP_PER_ENTRY,
  X1_DAILY_EXTRA_XP_CAP,
  xpFromMatch,
  type AgeStageId,
  type Badge,
  type RankingFilterCategory,
  type RankHistoryState,
  type RankTrendDirection,
  type TournamentMedal,
  type TurmaCode,
  createTurmaChangeRequest,
  resolveTurmaChangeRequest,
} from "./player-profile.ts";
import {
  calculateEventXpMultiplier,
  getEffectiveDailyXpCap,
  getActiveEventBonuses,
} from "./custom-events.ts";
import {
  aggregateStatsByGame,
  evaluatePlayerMedals,
  getAllAvailableMedals,
  getDistinctFlawlessGames,
  getDistinctGamesPlayed,
  isFlawlessMatch,
  MEDAL_XP_REWARDS,
  type PlayerUnlockedMedal,
  type MedalDefinition,
  type AdminMedalNotification,
} from "./medals-catalog.ts";

const SESSION_KEY = "desafios-playfab-session-v1";
const REGISTRY_KEY = "desafios-playfab-registry-v1";
const ADMIN_AUTH_KEY = "desafios-playfab-admin-auth-v1";
const ADMIN_PIN_KEY = "desafios-playfab-admin-pin-v1";
export const ROSTER_SHARED_GROUP_ID = "SEMED_STUDENT_ROSTER_V1";
export const ADMIN_CONFIG_SHARED_GROUP_ID = "SEMED_PLATFORM_CONFIG_V1";

export interface PlayerProfile {
  id: string;
  playfabId?: string;
  nick: string;
  nickNormalized: string;
  full_name: string;
  school: string;
  grade: string | null;
  turma?: string | null;
  pendingTurmaRequest?: string | null;
  birthdate: string;
  xp: number;
  seasonXp: number;
  level: number;
  wins: number;
  x1Wins?: number;
  weeklyX1Wins?: number;
  weeklyX1WeekKey?: string;
  matchesPlayed: number;
  totalMatches?: number;
  totalPlays?: number;
  distinctGamesPlayed?: number;
  dailyXp?: number;
  dailyX1Xp?: number;
  dailyTournamentXp?: number;
  dailyTournamentEntries?: number;
  dailyXpDate?: string;
  dailyPostCapMatches?: number;
  dailyPostCapDate?: string;
  streakDays?: number;
  lastActiveDate?: string;
  tournamentMedals?: TournamentMedal[];
  unlockedMedals?: PlayerUnlockedMedal[];
  stats?: GameStatRow[];
  badges: Badge[];
  isAdmin?: boolean;
  seasonId: number;
}

export interface GameStatRow {
  game_id: GameId;
  mode?: string;
  plays: number;
  wins: number;
  flawless_wins?: number;
  last_wrong?: number;
  best_score: number;
  best_level: number;
  last_played_at?: string;
  player_id?: string;
  updated_at?: string;
}

export interface SignUpData {
  nick: string;
  password?: string;
  fullName: string;
  school: string;
  grade: string | null;
  turma?: string | null;
  birthdate: string;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  nick: string;
  fullName: string;
  school: string;
  grade: string | null;
  turma?: string | null;
  age: number;
  stage: AgeStageId;
  stageLabel: string;
  level: number;
  rankTitle: string;
  rankEmoji: string;
  value: number; // Medals, XP, or Best Score depending on board
  medalsCount?: number;
  xpValue?: number;
  wins: number;
  rankTrend?: RankTrendDirection;
  previousRank?: number;
  isCurrentPlayer?: boolean;
}

interface StoredAccount {
  profile: PlayerProfile;
  passwordHash: string;
  unlocked: GameId[];
  stats: GameStatRow[];
  updatedAt: string;
}

interface StoredSession {
  playerId: string;
  sessionTicket?: string;
  playfabId?: string;
}

function simpleHash(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export const DEFAULT_PLAYFAB_TITLE_ID = "186F63";

export function getPlayFabTitleId(): string {
  const envId = (import.meta.env?.VITE_PLAYFAB_TITLE_ID as string | undefined)?.trim();
  if (envId) return envId;
  const cfg = loadAdminConfig();
  const cfgId = cfg.playfabTitleId?.trim();
  if (cfgId) return cfgId;
  return DEFAULT_PLAYFAB_TITLE_ID;
}

export function isPlayFabConfigured(): boolean {
  return getPlayFabTitleId().length >= 3;
}

export function getAdminPin(): string {
  if (typeof window !== "undefined") {
    const custom = window.localStorage.getItem(ADMIN_PIN_KEY);
    if (custom && custom.trim().length >= 4) return custom.trim();
  }
  const envPin = (import.meta.env?.VITE_ADMIN_PIN as string | undefined)?.trim();
  return envPin || "SEMED26";
}

export function setAdminPin(newPin: string) {
  if (typeof window === "undefined") return;
  const clean = newPin.trim();
  if (clean.length >= 4) {
    window.localStorage.setItem(ADMIN_PIN_KEY, clean);
  }
}

const ADMIN_TICKET_CACHE_KEY = "desafios-playfab-admin-ticket-v1";
const ADMIN_TICKET_TTL_MS = 20 * 60 * 60 * 1000; // 20 horas
let cachedAdminTicket: string | null = null;
let cachedAdminTicketTime = 0;
let inFlightAdminTicketPromise: Promise<string | null> | null = null;

export function clearCachedAdminPlayFabTicket() {
  cachedAdminTicket = null;
  cachedAdminTicketTime = 0;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(ADMIN_TICKET_CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export async function getAdminPlayFabTicket(): Promise<string | null> {
  if (cachedAdminTicket && Date.now() - cachedAdminTicketTime < ADMIN_TICKET_TTL_MS) {
    return cachedAdminTicket;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(ADMIN_TICKET_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { ticket: string; at: number };
        if (parsed.ticket && Date.now() - parsed.at < ADMIN_TICKET_TTL_MS) {
          cachedAdminTicket = parsed.ticket;
          cachedAdminTicketTime = parsed.at;
          return parsed.ticket;
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (!isPlayFabConfigured()) return null;
  if (inFlightAdminTicketPromise) return inFlightAdminTicketPromise;

  inFlightAdminTicketPromise = (async () => {
    try {
      const res = await callPlayFabClient<PlayFabLoginPayload>("LoginWithPlayFab", {
        Username: "adminjosiney",
        Password: "SEMED2620ZZadm",
      });
      if (res.data?.SessionTicket) {
        cachedAdminTicket = res.data.SessionTicket;
        cachedAdminTicketTime = Date.now();
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              ADMIN_TICKET_CACHE_KEY,
              JSON.stringify({ ticket: cachedAdminTicket, at: cachedAdminTicketTime }),
            );
          } catch {
            /* ignore */
          }
        }
        return cachedAdminTicket;
      }
      return null;
    } finally {
      inFlightAdminTicketPromise = null;
    }
  })();

  return inFlightAdminTicketPromise;
}

export function isSpecialAdminAccount(p?: {
  id?: string;
  nickNormalized?: string;
  isAdmin?: boolean;
} | null): boolean {
  if (!p) return false;
  if (p.isAdmin) return true;
  if (p.id === "admin-system" || p.id?.startsWith("admin-")) return true;
  const n = p.nickNormalized?.toLowerCase();
  return n === "admin" || n === "josiney" || n === "quemuel";
}

export function isAdminUnlockedSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(ADMIN_AUTH_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdminUnlockedSession(unlocked: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (unlocked) window.sessionStorage.setItem(ADMIN_AUTH_KEY, "1");
    else window.sessionStorage.removeItem(ADMIN_AUTH_KEY);
  } catch {
    /* ignore */
  }
}

/* --------------------- Local Registry / Offline Mirror --------------------- */

function loadRegistry(): Record<string, StoredAccount> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REGISTRY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredAccount>;
  } catch {
    return {};
  }
}

function saveRegistry(reg: Record<string, StoredAccount>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
  } catch {
    /* ignore */
  }
}

export function loadStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

function saveStoredSession(session: StoredSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (!session) window.localStorage.removeItem(SESSION_KEY);
    else window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

/* --------------------- PlayFab REST API Low-Level Call --------------------- */

interface PlayFabResponse<T> {
  code: number;
  status: string;
  data?: T;
  error?: string;
  errorCode?: number;
  errorMessage?: string;
}

async function callPlayFabClient<T>(
  endpoint: string,
  body: Record<string, unknown>,
  sessionTicket?: string,
): Promise<{ data: T | null; error: string | null; errorCode?: string }> {
  const titleId = getPlayFabTitleId();
  if (!titleId) {
    return { data: null, error: "PlayFab TitleId não configurado." };
  }
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (sessionTicket) {
      headers["X-Authorization"] = sessionTicket;
    }
    const response = await fetch(
      `https://${titleId}.playfabapi.com/Client/${endpoint}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ TitleId: titleId, ...body }),
      },
    );
    const json = (await response.json()) as PlayFabResponse<T>;
    if (!response.ok || json.error) {
      return {
        data: null,
        error: json.errorMessage || json.error || "Erro na comunicação com o PlayFab.",
        errorCode: json.error,
      };
    }
    return { data: json.data ?? null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Falha de rede ao conectar ao PlayFab.",
    };
  }
}

/* --------------------- Scheduled Reset Engine (ADM) ---------------------- */

/** Checks if the ADM scheduled a ranking reset whose timestamp has arrived,
 *  and executes it automatically if due. */
export function checkAndApplyScheduledReset(): PlatformAdminConfig {
  const cfg = loadAdminConfig();
  if (!cfg.scheduledResetAt) return cfg;
  const dueTime = new Date(cfg.scheduledResetAt).getTime();
  if (Number.isNaN(dueTime) || Date.now() < dueTime) return cfg;

  return executeRankingReset({
    clearXp: cfg.scheduledResetClearXp,
    newSeasonName: `Temporada ${cfg.seasonId + 1} • SEMED Coari`,
    reason: `Reset automático agendado para ${new Date(cfg.scheduledResetAt).toLocaleString("pt-BR")}`,
  });
}

export function executeRankingReset(options: {
  clearXp: boolean;
  newSeasonName?: string;
  reason?: string;
}): PlatformAdminConfig {
  const cfg = loadAdminConfig();
  const nowIso = new Date().toISOString();
  const nextSeasonId = cfg.seasonId + 1;
  const entry: ResetHistoryEntry = {
    id: `rst_${Date.now()}`,
    seasonId: cfg.seasonId,
    seasonName: cfg.seasonName,
    executedAt: nowIso,
    resetXp: options.clearXp,
    reason: options.reason || "Reset manual pelo Administrador",
  };

  const nextConfig = saveAdminConfig({
    ...cfg,
    seasonId: nextSeasonId,
    seasonName: options.newSeasonName?.trim() || `Temporada ${nextSeasonId} • SEMED Coari`,
    lastResetAt: nowIso,
    scheduledResetAt: null,
    resetHistory: [entry, ...cfg.resetHistory].slice(0, 25),
  });

  // Reset local registry statistics for the new season
  const reg = loadRegistry();
  for (const key of Object.keys(reg)) {
    const acc = reg[key];
    acc.stats = [];
    acc.profile.seasonXp = 0;
    acc.profile.seasonId = nextConfig.seasonId;
    if (options.clearXp) {
      acc.profile.xp = 0;
      acc.profile.level = 1;
      acc.profile.wins = 0;
      acc.profile.matchesPlayed = 0;
      acc.profile.distinctGamesPlayed = 0;
      acc.profile.dailyXp = 0;
      acc.profile.dailyXpDate = getLocalDateKey();
      acc.profile.badges = [];
    }
    acc.updatedAt = nowIso;
  }
  saveRegistry(reg);
  clearLocalStats();

  // If logged in to PlayFab and CloudScript is available, notify PlayFab
  const session = loadStoredSession();
  if (session?.sessionTicket && isPlayFabConfigured()) {
    void callPlayFabClient(
      "ExecuteCloudScript",
      {
        FunctionName: "AdminResetSeason",
        FunctionParameter: {
          seasonId: nextConfig.seasonId,
          seasonName: nextConfig.seasonName,
          clearXp: options.clearXp,
          lastResetAt: nowIso,
        },
      },
      session.sessionTicket,
    );
  }

  return nextConfig;
}

/* --------------------- Sync Admin Config with PlayFab --------------------- */

/**
 * A configuração global (jogos visíveis, trava SEMED26 etc.) é gravada pelo ADM nos
 * "User Data" PÚBLICOS da conta administradora no PlayFab. Qualquer outra sessão
 * (aluno logado ou visitante) consegue ler esses dados com GetUserData, sem precisar
 * fazer login na conta do ADM — evitando o bloqueio 429 (limite de logins por conta).
 */
const ADMIN_CONFIG_OWNER_PLAYFAB_ID = "FB6662558A38ACAD";
const ADMIN_CONFIG_USERDATA_KEY = "PlatformAdminConfig";
const REMOTE_CONFIG_CACHE_KEY = "desafios-remote-admin-config-v1";
const VIEWER_TICKET_KEY = "desafios-playfab-viewer-ticket-v1";
const VIEWER_USERNAME = "semedvisitante";
const VIEWER_PASSWORD = "SemedVisitante2026";
const VIEWER_TICKET_TTL_MS = 20 * 60 * 60 * 1000; // tickets PlayFab valem 24h

let cachedViewerTicket: string | null = null;
let cachedViewerTicketTime = 0;
let inFlightViewerTicketPromise: Promise<string | null> | null = null;
let inFlightConfigSyncPromise: Promise<PlatformAdminConfig> | null = null;
let lastAdminCloudSyncError: string | null = null;

/** Último erro ao publicar a configuração do ADM na nuvem (null = sucesso). */
export function getLastAdminCloudSyncError(): string | null {
  return lastAdminCloudSyncError;
}

function loadCachedRemoteConfig(): Partial<PlatformAdminConfig> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REMOTE_CONFIG_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PlatformAdminConfig>) : null;
  } catch {
    return null;
  }
}

function storeCachedRemoteConfig(raw: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMOTE_CONFIG_CACHE_KEY, raw);
  } catch {
    /* ignore */
  }
}

/** Ticket de leitura reaproveitado por até 20h no dispositivo (com fallback anti-429). */
async function getViewerPlayFabTicket(): Promise<string | null> {
  if (cachedViewerTicket && Date.now() - cachedViewerTicketTime < VIEWER_TICKET_TTL_MS) {
    return cachedViewerTicket;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(VIEWER_TICKET_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { ticket: string; at: number };
        if (cached.ticket && Date.now() - cached.at < VIEWER_TICKET_TTL_MS) {
          cachedViewerTicket = cached.ticket;
          cachedViewerTicketTime = cached.at;
          return cached.ticket;
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (inFlightViewerTicketPromise) return inFlightViewerTicketPromise;

  inFlightViewerTicketPromise = (async () => {
    try {
      let res = await callPlayFabClient<PlayFabLoginPayload>("LoginWithPlayFab", {
        Username: VIEWER_USERNAME,
        Password: VIEWER_PASSWORD,
      });
      if (!res.data?.SessionTicket && res.errorCode === "AccountNotFound") {
        res = await callPlayFabClient<PlayFabLoginPayload>("RegisterPlayFabUser", {
          Username: VIEWER_USERNAME,
          Password: VIEWER_PASSWORD,
          RequireBothUsernameAndEmail: false,
        });
      }
      // Fallback caso muitos celulares abram simultaneamente e atinjam rate limit na conta padrão
      if (!res.data?.SessionTicket) {
        const uniqueUser = `semedv${Math.random().toString(36).slice(2, 10)}`;
        res = await callPlayFabClient<PlayFabLoginPayload>("RegisterPlayFabUser", {
          Username: uniqueUser,
          Password: VIEWER_PASSWORD,
          RequireBothUsernameAndEmail: false,
        });
      }
      const ticket = res.data?.SessionTicket ?? null;
      if (ticket) {
        cachedViewerTicket = ticket;
        cachedViewerTicketTime = Date.now();
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              VIEWER_TICKET_KEY,
              JSON.stringify({ ticket, at: cachedViewerTicketTime }),
            );
          } catch {
            /* ignore */
          }
        }
      }
      return ticket;
    } finally {
      inFlightViewerTicketPromise = null;
    }
  })();

  return inFlightViewerTicketPromise;
}

function clearViewerTicket() {
  cachedViewerTicket = null;
  cachedViewerTicketTime = 0;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(VIEWER_TICKET_KEY);
  } catch {
    /* ignore */
  }
}

async function readRemoteAdminConfigRaw(ticket: string): Promise<{ raw: string | null; ok: boolean }> {
  const res = await callPlayFabClient<{ Data?: Record<string, { Value: string }> }>(
    "GetUserData",
    { PlayFabId: ADMIN_CONFIG_OWNER_PLAYFAB_ID, Keys: [ADMIN_CONFIG_USERDATA_KEY] },
    ticket,
  );
  if (!res.error) {
    const val = res.data?.Data?.[ADMIN_CONFIG_USERDATA_KEY]?.Value ?? null;
    if (val) return { raw: val, ok: true };
  }
  // Fallback secundário para SharedGroup caso exista
  const sgRes = await callPlayFabClient<{ Data?: Record<string, { Value: string }> }>(
    "GetSharedGroupData",
    { SharedGroupId: ADMIN_CONFIG_SHARED_GROUP_ID },
    ticket,
  );
  if (!sgRes.error && sgRes.data?.Data?.[ADMIN_CONFIG_USERDATA_KEY]?.Value) {
    return { raw: sgRes.data.Data[ADMIN_CONFIG_USERDATA_KEY].Value, ok: true };
  }
  return { raw: null, ok: !res.error };
}

function applyRemoteConfig(
  localCfg: PlatformAdminConfig,
  remote: Partial<PlatformAdminConfig>,
): PlatformAdminConfig {
  // A configuração publicada pelo ADM é sempre a fonte da verdade.
  return saveAdminConfig({
    ...localCfg,
    ...remote,
    enabledGames: { ...DEFAULT_ENABLED_GAMES, ...(remote.enabledGames ?? {}) },
    gameCodes: { ...localCfg.gameCodes, ...(remote.gameCodes ?? {}) },
  } as PlatformAdminConfig);
}

export async function syncAdminConfigFromPlayFab(sessionTicket?: string): Promise<PlatformAdminConfig> {
  if (inFlightConfigSyncPromise && !sessionTicket) return inFlightConfigSyncPromise;

  const run = async (): Promise<PlatformAdminConfig> => {
    const localCfg = checkAndApplyScheduledReset();
    if (!isPlayFabConfigured()) return localCfg;

    // 1. Sessão do próprio aluno; 2. ticket de visitante (cacheado por dispositivo).
    const candidates: Array<() => Promise<string | null>> = [
      async () => sessionTicket ?? loadStoredSession()?.sessionTicket ?? null,
      () => getViewerPlayFabTicket(),
    ];

    for (let i = 0; i < candidates.length; i++) {
      try {
        const ticket = await candidates[i]();
        if (!ticket) continue;
        const { raw, ok } = await readRemoteAdminConfigRaw(ticket);
        if (!ok) {
          if (i === 1) clearViewerTicket(); // ticket expirado: renova no próximo acesso
          continue;
        }
        if (!raw) return localCfg; // ADM ainda não publicou nada
        const remote = JSON.parse(raw) as Partial<PlatformAdminConfig>;
        storeCachedRemoteConfig(raw);
        return applyRemoteConfig(localCfg, remote);
      } catch {
        /* tenta o próximo caminho */
      }
    }

    // Sem conexão / bloqueio temporário: usa a última configuração recebida do ADM.
    const cached = loadCachedRemoteConfig();
    return cached ? applyRemoteConfig(localCfg, cached) : localCfg;
  };

  if (sessionTicket) return run();
  inFlightConfigSyncPromise = run().finally(() => {
    inFlightConfigSyncPromise = null;
  });
  return inFlightConfigSyncPromise;
}

export async function pushAdminConfigToPlayFab(config: PlatformAdminConfig): Promise<PlatformAdminConfig> {
  const saved = saveAdminConfig(config);
  if (!isPlayFabConfigured()) {
    lastAdminCloudSyncError = "PlayFab não configurado.";
    return saved;
  }

  let ticket = await getAdminPlayFabTicket();
  if (!ticket) {
    lastAdminCloudSyncError = "Não foi possível autenticar a conta ADM no PlayFab (aguarde alguns segundos e tente novamente).";
    return saved;
  }
  const raw = JSON.stringify(saved);
  let res = await callPlayFabClient(
    "UpdateUserData",
    { Data: { [ADMIN_CONFIG_USERDATA_KEY]: raw }, Permission: "Public" },
    ticket,
  );
  // Se o ticket cacheado do ADM expirou, renova uma vez automaticamente
  if (res.error) {
    clearCachedAdminPlayFabTicket();
    ticket = await getAdminPlayFabTicket();
    if (ticket) {
      res = await callPlayFabClient(
        "UpdateUserData",
        { Data: { [ADMIN_CONFIG_USERDATA_KEY]: raw }, Permission: "Public" },
        ticket,
      );
    }
  }
  if (res.error) {
    lastAdminCloudSyncError = res.error;
  } else {
    lastAdminCloudSyncError = null;
    storeCachedRemoteConfig(raw);
    // Espelha também no SharedGroup em segundo plano
    if (ticket) {
      void callPlayFabClient(
        "UpdateSharedGroupData",
        {
          SharedGroupId: ADMIN_CONFIG_SHARED_GROUP_ID,
          Data: { [ADMIN_CONFIG_USERDATA_KEY]: raw },
          Permission: "Public",
        },
        ticket,
      );
    }
  }
  return saved;
}

/* --------------------- Auth & Profile Operations --------------------- */

function getCurrentWeekKey(now = new Date()): string {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startMondayOffset = (startOfYear.getDay() + 6) % 7;
  const diffDays = Math.round((todayMidnight.getTime() - startOfYear.getTime()) / 86_400_000);
  const weekNum = Math.floor((diffDays + startMondayOffset) / 7) + 1;
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getPreviousDateKey(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return "";
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  d.setDate(d.getDate() - 1);
  return getLocalDateKey(d);
}

function ensurePlayerSeasonAligned(acc: StoredAccount, cfg: PlatformAdminConfig): StoredAccount {
  const todayKey = getLocalDateKey();
  if (acc.profile.dailyXpDate !== todayKey) {
    acc.profile.dailyXp = 0;
    acc.profile.dailyX1Xp = 0;
    acc.profile.dailyTournamentXp = 0;
    acc.profile.dailyTournamentEntries = 0;
    acc.profile.dailyXpDate = todayKey;
  }
  if (acc.profile.dailyPostCapDate !== todayKey) {
    acc.profile.dailyPostCapMatches = 0;
    acc.profile.dailyPostCapDate = todayKey;
  }
  const currentWeekKey = getCurrentWeekKey();
  if (acc.profile.weeklyX1WeekKey && acc.profile.weeklyX1WeekKey !== currentWeekKey) {
    acc.profile.weeklyX1Wins = 0;
    acc.profile.weeklyX1WeekKey = currentWeekKey;
  }

  const isAdminAcc = isSpecialAdminAccount(acc.profile);

  // Filter out invalid, synthetic tournament, or disabled games from student stats
  if (!isAdminAcc && Array.isArray(acc.stats)) {
    acc.stats = acc.stats.filter(
      (s) =>
        s &&
        s.game_id &&
        ALL_GAME_IDS.includes(s.game_id) &&
        cfg.enabledGames[s.game_id] !== false &&
        s.mode !== "torneio_semanal" &&
        ((s.plays ?? 0) > 0 || (s.best_score ?? 0) > 0),
    );
  }

  const statsMap = aggregateStatsByGame(acc.stats, cfg.enabledGames);
  const aggregatedRows = Array.from(statsMap.values()).filter((s) => s.plays > 0);

  // For students, distinctGamesPlayed is strictly the count of enabled games actually played (never inflated above available games)
  const distinctGames = getDistinctGamesPlayed(
    acc.profile,
    acc.stats,
    undefined,
    cfg.enabledGames,
  );
  acc.profile.distinctGamesPlayed = distinctGames;

  const totalMatchesCount = Math.max(
    acc.profile.matchesPlayed ?? 0,
    acc.profile.totalMatches ?? 0,
    (acc.profile as any).totalPlays ?? 0,
  );
  acc.profile.matchesPlayed = totalMatchesCount;
  acc.profile.totalMatches = totalMatchesCount;

  acc.profile.level = calculatePlayerLevel({
    xp: acc.profile.xp,
    matchesPlayed: totalMatchesCount,
    wins: acc.profile.wins,
    distinctGames: acc.profile.distinctGamesPlayed,
  });

  const allAvailable = getAllAvailableMedals(cfg.customMedals);
  const medalDefMap = new Map<string, MedalDefinition>(allAvailable.map((m) => [m.id, m]));
  const trueFlawlessSet = getDistinctFlawlessGames(
    acc.profile,
    acc.stats,
    undefined,
    cfg.enabledGames,
  );
  const trueFlawlessCount = trueFlawlessSet.size;
  const gamesWith2Plays = aggregatedRows.filter((s) => s.plays >= 2).length;
  const gamesWith10Plays = aggregatedRows.filter((s) => s.plays >= 10).length;

  // Reconcile all unlocked medals so any improperly awarded medal returns to its proper progress
  if (acc.profile.unlockedMedals && acc.profile.unlockedMedals.length > 0 && !isAdminAcc) {
    let filtered = acc.profile.unlockedMedals.filter((m) => {
      // Legacy X1 IDs
      if (m.medalId.startsWith("m_x1_win_") && (acc.profile.x1Wins ?? 0) === 0) {
        return false;
      }
      const def = medalDefMap.get(m.medalId);
      if (!def) return true;
      const cond = def.condition;

      switch (cond.type) {
        case "player_level":
          return acc.profile.level >= (cond.threshold ?? 2);

        case "all_level_medals":
          return acc.profile.level >= 10;

        case "game_best_level": {
          if (!cond.gameId || cfg.enabledGames[cond.gameId] === false) return false;
          const row = statsMap.get(cond.gameId);
          return Boolean(row && row.plays > 0 && row.best_level >= (cond.threshold ?? 3));
        }

        case "game_flawless": {
          if (!cond.gameId || cfg.enabledGames[cond.gameId] === false) return false;
          const row = statsMap.get(cond.gameId);
          const minScore = cond.threshold ?? 30;
          return Boolean(row && row.flawless_wins >= 1 && row.best_score >= minScore);
        }

        case "game_match_count": {
          if (!cond.gameId || cfg.enabledGames[cond.gameId] === false) return false;
          const row = statsMap.get(cond.gameId);
          return Boolean(row && row.plays >= (cond.threshold ?? 10));
        }

        case "distinct_games":
          return distinctGames >= (cond.threshold ?? 3);

        case "distinct_flawless_games":
          return trueFlawlessCount >= (cond.threshold ?? 3);

        case "x1_wins_total":
          return (acc.profile.x1Wins ?? 0) >= (cond.threshold ?? 1);

        case "x1_wins_weekly":
          return (acc.profile.x1Wins ?? 0) >= (cond.threshold ?? 5);

        case "beta_tester_prata":
          return gamesWith2Plays >= 4;

        case "beta_tester_ouro":
          return gamesWith2Plays >= 6;

        case "beta_tester_platina":
          return gamesWith2Plays >= ALL_GAME_IDS.length;

        case "beta_tester_heroi":
          return gamesWith10Plays >= ALL_GAME_IDS.length && acc.profile.level >= 5;

        case "all_game_medals":
          return ALL_GAME_IDS.every((gId) => {
            if (cfg.enabledGames[gId] === false) return false;
            const r = statsMap.get(gId);
            return Boolean(r && r.plays > 0 && r.best_level >= 3);
          });

        default:
          return true;
      }
    });

    // Check total_medals_count (meta_collector_50 / meta_collector_80) after filtering
    filtered = filtered.filter((m) => {
      const def = medalDefMap.get(m.medalId);
      if (def?.condition.type === "total_medals_count") {
        return filtered.length >= (def.condition.threshold ?? 50);
      }
      return true;
    });

    acc.profile.unlockedMedals = filtered;
  }

  // Sanitization: Players in Etapa 3 (15+ years old) cannot belong to elementary SEMED schools or classes.
  // If institution is "Nenhuma" or "Outro", grade and turma are always null.
  if (isEtapa3OrOlder(acc.profile.birthdate)) {
    if (isOfficialSemedSchool(acc.profile.school)) {
      acc.profile.school = "Outro";
    }
    acc.profile.grade = null;
    acc.profile.turma = null;
  } else if (acc.profile.school === "Nenhuma" || acc.profile.school === "Outro") {
    acc.profile.grade = null;
    acc.profile.turma = null;
  }

  // Ensure passive/cumulative medals (level, distinct games, total count, etc.) are awarded when criteria met
  const earnedPassively = evaluatePlayerMedals(
    {
      profile: acc.profile,
      stats: acc.stats,
      todayXpEarned: acc.profile.dailyXp,
      streakDays: acc.profile.streakDays,
      weeklyX1Wins: acc.profile.weeklyX1Wins,
      enabledGames: cfg.enabledGames,
    },
    allAvailable,
  );
  if (earnedPassively.length > 0) {
    const currentUnlocked = [...(acc.profile.unlockedMedals ?? [])];
    const nowIso = new Date().toISOString();
    let updated = false;
    for (const m of earnedPassively) {
      if (!currentUnlocked.some((u) => u.medalId === m.id)) {
        currentUnlocked.push({ medalId: m.id, unlockedAt: nowIso });
        updated = true;
      }
    }
    if (updated) {
      acc.profile.unlockedMedals = currentUnlocked;
    }
  }

  if (acc.profile.seasonId !== cfg.seasonId) {
    acc.profile.seasonId = cfg.seasonId;
    acc.profile.seasonXp = 0;
    acc.stats = [];
    if (cfg.resetHistory[0]?.resetXp) {
      acc.profile.xp = 0;
      acc.profile.level = 1;
      acc.profile.wins = 0;
      acc.profile.matchesPlayed = 0;
      acc.profile.distinctGamesPlayed = 0;
      acc.profile.dailyXp = 0;
    }
  }

  acc.profile.totalMatches = acc.profile.matchesPlayed;
  acc.profile.stats = acc.stats;
  return acc;
}

function findAccountByFullNameAndPassword(
  reg: Record<string, StoredAccount>,
  fullName: string,
  normalizedPass: string,
  birthdateIso?: string,
): StoredAccount | null {
  const targetName = fullNameSlug(fullName);
  if (!targetName) return null;
  const passHash = simpleHash(normalizedPass);

  for (const acc of Object.values(reg)) {
    const accName = fullNameSlug(acc.profile.full_name);
    if (accName !== targetName) continue;
    const accPassFromBirth = passwordFromBirthdate(acc.profile.birthdate);
    if (
      acc.passwordHash === passHash ||
      accPassFromBirth === normalizedPass ||
      (birthdateIso && acc.profile.birthdate === birthdateIso)
    ) {
      return acc;
    }
  }
  return null;
}

function findAccountByFullNameOnly(
  reg: Record<string, StoredAccount>,
  fullName: string,
): StoredAccount | null {
  const targetName = fullNameSlug(fullName);
  if (!targetName) return null;
  for (const acc of Object.values(reg)) {
    if (fullNameSlug(acc.profile.full_name) === targetName) {
      return acc;
    }
  }
  return null;
}

interface PlayFabLoginPayload {
  PlayFabId: string;
  SessionTicket: string;
  InfoResultPayload?: {
    UserData?: Record<string, { Value: string }>;
    PlayerStatistics?: { StatisticName: string; Value: number }[];
    AccountInfo?: { TitleInfo?: { DisplayName?: string }; Username?: string };
  };
}

function buildAccountFromPlayFabPayload(
  payload: PlayFabLoginPayload,
  fallbackNick: string,
  normalizedPassword: string,
  cfg: PlatformAdminConfig,
): StoredAccount {
  const playfabId = payload.PlayFabId;
  const userData = payload.InfoResultPayload?.UserData ?? {};
  const pfStats = payload.InfoResultPayload?.PlayerStatistics ?? [];
  const displayName =
    payload.InfoResultPayload?.AccountInfo?.TitleInfo?.DisplayName || fallbackNick.trim();

  let parsedProfile: Partial<PlayerProfile> = {};
  if (userData.PlayerProfile?.Value) {
    try {
      parsedProfile = JSON.parse(userData.PlayerProfile.Value);
    } catch {
      /* ignore */
    }
  }

  let parsedStats: GameStatRow[] = [];
  if (userData.GameStats?.Value) {
    try {
      parsedStats = JSON.parse(userData.GameStats.Value);
    } catch {
      /* ignore */
    }
  }

  let parsedUnlocked: GameId[] = [];
  if (userData.UnlockedGames?.Value) {
    try {
      parsedUnlocked = JSON.parse(userData.UnlockedGames.Value);
    } catch {
      /* ignore */
    }
  }

  const resolvedNick = parsedProfile.nick || displayName || fallbackNick;
  const slug = nickSlug(resolvedNick) || `pf_${playfabId.toLowerCase()}`;
  const statXp = pfStats.find((s) => s.StatisticName === "XP_Total")?.Value ?? 0;
  const xp = Math.max(parsedProfile.xp ?? 0, statXp);
  const distinctGamesPlayed = getDistinctGamesPlayed(parsedProfile, parsedStats);
  const wins = parsedProfile.wins ?? 0;
  const matchesPlayed = Math.max(
    parsedProfile.matchesPlayed ?? 0,
    parsedProfile.totalMatches ?? 0,
    (parsedProfile as any).totalPlays ?? 0,
  );

  const mergedProfile: PlayerProfile = {
    id: playfabId ?? `pf_${slug}`,
    playfabId,
    nick: resolvedNick,
    nickNormalized: slug,
    full_name: formatFullNameUpper((parsedProfile.full_name || displayName).trim()),
    school:
      parsedProfile.school && isValidSchool(parsedProfile.school)
        ? parsedProfile.school
        : SCHOOLS[0].name,
    grade: parsedProfile.grade ?? null,
    birthdate: parsedProfile.birthdate || "2015-01-01",
    xp,
    seasonXp: parsedProfile.seasonXp ?? xp,
    level: calculatePlayerLevel({
      xp,
      matchesPlayed,
      wins,
      distinctGames: distinctGamesPlayed,
    }),
    wins,
    x1Wins: parsedProfile.x1Wins ?? 0,
    weeklyX1Wins: parsedProfile.weeklyX1Wins ?? 0,
    weeklyX1WeekKey: parsedProfile.weeklyX1WeekKey,
    matchesPlayed,
    distinctGamesPlayed,
    dailyXp: parsedProfile.dailyXp ?? 0,
    dailyXpDate: parsedProfile.dailyXpDate ?? getLocalDateKey(),
    streakDays: parsedProfile.streakDays ?? 1,
    lastActiveDate: parsedProfile.lastActiveDate,
    tournamentMedals: Array.isArray(parsedProfile.tournamentMedals)
      ? parsedProfile.tournamentMedals
      : [],
    unlockedMedals: Array.isArray(parsedProfile.unlockedMedals)
      ? parsedProfile.unlockedMedals
      : [],
    badges: Array.isArray(parsedProfile.badges) ? parsedProfile.badges : [],
    isAdmin: parsedProfile.isAdmin || slug === "admin" || slug === "semed_admin",
    seasonId: parsedProfile.seasonId ?? cfg.seasonId,
  };

  return ensurePlayerSeasonAligned(
    {
      profile: mergedProfile,
      passwordHash: simpleHash(normalizedPassword),
      unlocked: parsedUnlocked,
      stats: parsedStats,
      updatedAt: new Date().toISOString(),
    },
    cfg,
  );
}

export async function playfabSignUp(data: SignUpData): Promise<{
  account: StoredAccount | null;
  error: string | null;
  recoveredNick?: string;
}> {
  const cfg = checkAndApplyScheduledReset();
  const slug = nickSlug(data.nick);
  if (slug.length < 3 || slug.length > 20) {
    return {
      account: null,
      error: "O apelido precisa ter entre 3 e 20 letras ou números (sem espaços).",
    };
  }
  if (!data.fullName.trim()) {
    return { account: null, error: "Informe o seu nome completo." };
  }
  if (!isValidSchool(data.school)) {
    return { account: null, error: "Selecione uma instituição válida." };
  }
  if (!data.birthdate) {
    return { account: null, error: "Informe a sua data de nascimento." };
  }

  // The student's password is automatically derived from their birthdate in DDMMAA format (e.g. 20/01/2014 -> 200114)
  const derivedPassword = passwordFromBirthdate(data.birthdate);
  if (derivedPassword.length < 6) {
    return { account: null, error: "Data de nascimento inválida." };
  }

  const reg = loadRegistry();

  // If a student with the exact same Full Name + Birthdate already exists, log them in automatically!
  const existingByPerson = findAccountByFullNameAndPassword(
    reg,
    data.fullName,
    derivedPassword,
    data.birthdate,
  );
  if (existingByPerson) {
    const aligned = ensurePlayerSeasonAligned(existingByPerson, cfg);
    reg[aligned.profile.nickNormalized] = aligned;
    saveRegistry(reg);
    saveStoredSession({
      playerId: aligned.profile.nickNormalized,
      playfabId: aligned.profile.playfabId,
    });
    syncLocalBrowserFromAccount(aligned);
    return {
      account: aligned,
      error: null,
      recoveredNick: aligned.profile.nick,
    };
  }

  if (reg[slug]) {
    return { account: null, error: "Esse apelido já está em uso. Escolha outro." };
  }

  let playfabId: string | undefined;
  let sessionTicket: string | undefined;

  if (isPlayFabConfigured()) {
    const res = await callPlayFabClient<{
      PlayFabId: string;
      SessionTicket: string;
    }>("RegisterPlayFabUser", {
      Username: slug,
      Password: derivedPassword,
      DisplayName: data.nick.trim().slice(0, 25),
      RequireBothUsernameAndEmail: false,
    });

    if (res.error) {
      if (
        res.errorCode === "UsernameNotAvailable" ||
        res.errorCode === "NameNotAvailable" ||
        res.error.toLowerCase().includes("available")
      ) {
        return { account: null, error: "Esse apelido já está em uso no PlayFab. Escolha outro." };
      }
      return { account: null, error: `PlayFab: ${res.error}` };
    }

    playfabId = res.data?.PlayFabId;
    sessionTicket = res.data?.SessionTicket;

    // Link deterministic CustomId (Full Name + DDMMAA) so the student can always log in or recover by Full Name + Birthdate
    if (sessionTicket) {
      await callPlayFabClient(
        "LinkCustomID",
        {
          CustomId: studentCustomId(data.fullName, derivedPassword),
          ForceLink: true,
        },
        sessionTicket,
      );
    }
  }

  const age = ageFrom(data.birthdate);
  const isOver15 = age >= 15 || isEtapa3OrOlder(data.birthdate);
  const isOver11 = age > 11;
  let resolvedSchool = data.school;
  if (isOver15 && isOfficialSemedSchool(data.school)) {
    resolvedSchool = "Nenhuma";
  } else if (isOver11 && is5thGradeSchool(data.school)) {
    resolvedSchool = "Nenhuma";
  }
  const isNoSchool = resolvedSchool === "Nenhuma" || resolvedSchool === "Outro" || isOver15;
  const resolvedGrade = isNoSchool ? null : data.grade;
  const resolvedTurma = isNoSchool ? null : data.turma;

  const profile: PlayerProfile = {
    id: playfabId ?? `pf_local_${slug}`,
    playfabId,
    nick: data.nick.trim(),
    nickNormalized: slug,
    full_name: formatFullNameUpper(data.fullName.trim()),
    school: resolvedSchool,
    grade: resolvedGrade,
    turma: resolvedTurma,
    birthdate: data.birthdate,
    xp: 0,
    seasonXp: 0,
    level: 1,
    wins: 0,
    matchesPlayed: 0,
    distinctGamesPlayed: 0,
    dailyXp: 0,
    dailyXpDate: getLocalDateKey(),
    badges: [],
    isAdmin: slug === "admin" || slug === "semed_admin",
    seasonId: cfg.seasonId,
  };

  const account: StoredAccount = {
    profile,
    passwordHash: simpleHash(derivedPassword),
    unlocked: [],
    stats: [],
    updatedAt: new Date().toISOString(),
  };

  reg[slug] = account;
  saveRegistry(reg);
  saveStoredSession({ playerId: slug, sessionTicket, playfabId });
  clearLocalStats();
  clearUnlocked();

  if (sessionTicket && isPlayFabConfigured()) {
    await pushProfileToPlayFab(account, sessionTicket);
  }

  return { account, error: null };
}

/**
 * Signs in a student using EITHER their Nickname (Apelido) OR their Full Name (Nome Completo),
 * and their Birthdate password (`DDMMAA`, e.g., `200114` for `20/01/2014`).
 */
export async function playfabSignIn(
  identifier: string,
  rawPassword: string,
): Promise<{
  account: StoredAccount | null;
  error: string | null;
  recoveredNick?: string;
  needsRecovery?: boolean;
}> {
  const cfg = checkAndApplyScheduledReset();
  const cleanId = identifier.trim();
  const normalizedPassword = normalizeBirthdatePasswordInput(rawPassword);

  if (!cleanId || !normalizedPassword) {
    return {
      account: null,
      error: "Informe seu apelido (ou nome completo) e sua data de nascimento (ex: 200114).",
    };
  }

  const reg = loadRegistry();
  // 0. Dedicated Administrators: JOSINEY and QUEMUEL (replaces default admin)
  const rawUpper = rawPassword.trim().toUpperCase();
  const cleanIdLower = cleanId.toLowerCase().trim();

  let matchedAdminKey: "josiney" | "quemuel" | null = null;
  if (
    cleanIdLower === "josiney" ||
    (cleanIdLower === "admin" && rawUpper === "SEMED2620ZZ") ||
    (cleanIdLower === "adm" && rawUpper === "SEMED2620ZZ")
  ) {
    if (rawUpper === "SEMED2620ZZ") {
      matchedAdminKey = "josiney";
    }
  } else if (
    cleanIdLower === "quemuel" ||
    (cleanIdLower === "admin" && rawUpper === "SEMED2620QQ") ||
    (cleanIdLower === "adm" && rawUpper === "SEMED2620QQ")
  ) {
    if (rawUpper === "SEMED2620QQ") {
      matchedAdminKey = "quemuel";
    }
  }

  if (matchedAdminKey) {
    const adminKey = matchedAdminKey;
    const adminNick = adminKey === "josiney" ? "JOSINEY" : "QUEMUEL";
    const adminFullName =
      adminKey === "josiney"
        ? "JOSINEY - ADMINISTRAÇÃO SEMED"
        : "QUEMUEL - ADMINISTRAÇÃO SEMED";

    let adminAcc = reg[adminKey];
    if (!adminAcc) {
      adminAcc = {
        profile: {
          id: `admin-${adminKey}`,
          nick: adminNick,
          nickNormalized: adminKey,
          full_name: adminFullName,
          school: "SEMED - Gestão Central",
          grade: "Gestão",
          turma: "ADM",
          birthdate: "1990-01-01",
          xp: 8500,
          seasonXp: 8500,
          level: 10,
          wins: 50,
          matchesPlayed: 60,
          distinctGamesPlayed: 10,
          badges: [],
          isAdmin: true,
          seasonId: cfg.seasonId,
        },
        passwordHash: simpleHash(rawUpper),
        unlocked: [...ALL_GAME_IDS],
        stats: [],
        updatedAt: new Date().toISOString(),
      };
      reg[adminKey] = adminAcc;
      saveRegistry(reg);
    } else {
      adminAcc.profile.isAdmin = true;
    }
    setAdminUnlockedSession(true);

    let adminSessionTicket: string | undefined;
    let adminPlayFabId: string | undefined;
    if (isPlayFabConfigured()) {
      const pfAdminUser = adminKey === "josiney" ? "adminjosiney" : "adminquemuel";
      const pfAdminPass = adminKey === "josiney" ? "SEMED2620ZZadm" : "SEMED2620QQadm";
      const pfLogin = await callPlayFabClient<PlayFabLoginPayload>("LoginWithPlayFab", {
        Username: pfAdminUser,
        Password: pfAdminPass,
      });
      if (pfLogin.data?.SessionTicket) {
        adminSessionTicket = pfLogin.data.SessionTicket;
        adminPlayFabId = pfLogin.data.PlayFabId;
      }
    }

    saveStoredSession({
      playerId: adminKey,
      sessionTicket: adminSessionTicket ?? `admin-${adminKey}-session-ticket`,
      playfabId: adminPlayFabId,
    });
    syncLocalBrowserFromAccount(adminAcc);
    return { account: adminAcc, error: null };
  }

  const slugCandidate = nickSlug(cleanId);
  const typedAsFullName = cleanId.includes(" ") || !reg[slugCandidate];

  // Resolve target account in local registry by Nick OR by Full Name
  const localByNick = reg[slugCandidate] ?? null;
  const localByFullName =
    findAccountByFullNameAndPassword(reg, cleanId, normalizedPassword) ??
    findAccountByFullNameOnly(reg, cleanId);
  const matchedLocal = localByNick ?? localByFullName;
  const resolvedSlug = matchedLocal ? matchedLocal.profile.nickNormalized : slugCandidate;

  if (isPlayFabConfigured()) {
    // 1. Try LoginWithPlayFab (Username + Password) if we have a valid username slug
    if (resolvedSlug.length >= 3 && resolvedSlug.length <= 20) {
      const res = await callPlayFabClient<PlayFabLoginPayload>("LoginWithPlayFab", {
        Username: resolvedSlug,
        Password: normalizedPassword,
        InfoRequestParameters: {
          GetUserData: true,
          GetPlayerStatistics: true,
          GetUserAccountInfo: true,
        },
      });

      if (!res.error && res.data) {
        const account = buildAccountFromPlayFabPayload(
          res.data,
          matchedLocal?.profile.nick ?? cleanId,
          normalizedPassword,
          cfg,
        );
        reg[account.profile.nickNormalized] = account;
        saveRegistry(reg);
        saveStoredSession({
          playerId: account.profile.nickNormalized,
          sessionTicket: res.data.SessionTicket,
          playfabId: res.data.PlayFabId,
        });
        syncLocalBrowserFromAccount(account);
        return {
          account,
          error: null,
          recoveredNick: typedAsFullName ? account.profile.nick : undefined,
        };
      }
    }

    // 2. If the student typed their Full Name, try LoginWithCustomID (stu_<fullName>_<DDMMAA>)
    const customRes = await callPlayFabClient<PlayFabLoginPayload>("LoginWithCustomID", {
      CustomId: studentCustomId(cleanId, normalizedPassword),
      CreateAccount: false,
      InfoRequestParameters: {
        GetUserData: true,
        GetPlayerStatistics: true,
        GetUserAccountInfo: true,
      },
    });

    if (!customRes.error && customRes.data) {
      const account = buildAccountFromPlayFabPayload(
        customRes.data,
        matchedLocal?.profile.nick ?? cleanId,
        normalizedPassword,
        cfg,
      );
      reg[account.profile.nickNormalized] = account;
      saveRegistry(reg);
      saveStoredSession({
        playerId: account.profile.nickNormalized,
        sessionTicket: customRes.data.SessionTicket,
        playfabId: customRes.data.PlayFabId,
      });
      syncLocalBrowserFromAccount(account);
      return {
        account,
        error: null,
        recoveredNick: account.profile.nick,
      };
    }

    return {
      account: null,
      error:
        "Não encontramos sua conta com esses dados. Confirme seu Nome Completo e selecione sua Data de Nascimento abaixo para entrar automaticamente!",
      needsRecovery: true,
    };
  }

  // Local / Offline mode authentication (matches by Nick OR Full Name + Birthdate password)
  const targetAcc =
    localByNick &&
    (localByNick.passwordHash === simpleHash(normalizedPassword) ||
      passwordFromBirthdate(localByNick.profile.birthdate) === normalizedPassword)
      ? localByNick
      : findAccountByFullNameAndPassword(reg, cleanId, normalizedPassword);

  if (!targetAcc) {
    return {
      account: null,
      error:
        "Apelido ou senha não encontrados. Digite seu Nome Completo e selecione sua Data de Nascimento abaixo para recuperar e entrar automaticamente!",
      needsRecovery: true,
    };
  }

  const aligned = ensurePlayerSeasonAligned(targetAcc, cfg);
  if (
    aligned.profile.isAdmin ||
    isSpecialAdminAccount(aligned.profile) ||
    rawUpper === "SEMED2620ZZ" ||
    rawUpper === "SEMED2620QQ"
  ) {
    aligned.profile.isAdmin = true;
    setAdminUnlockedSession(true);
  }
  reg[aligned.profile.nickNormalized] = aligned;
  saveRegistry(reg);
  saveStoredSession({ playerId: aligned.profile.nickNormalized });
  syncLocalBrowserFromAccount(aligned);
  return {
    account: aligned,
    error: null,
    recoveredNick:
      cleanId.toLowerCase() !== aligned.profile.nick.toLowerCase()
        ? aligned.profile.nick
        : undefined,
  };
}

/**
 * Automatic account recovery & login by Full Name + Birthdate (`YYYY-MM-DD`).
 * If a matching student is found, logs them in immediately and returns their saved `nick`.
 */
export async function playfabRecoverByNameAndBirthdate(
  fullName: string,
  birthdate: string,
): Promise<{
  account: StoredAccount | null;
  error: string | null;
  recoveredNick?: string;
  derivedPassword?: string;
}> {
  const cfg = checkAndApplyScheduledReset();
  const cleanName = fullName.trim();
  const cleanDate = birthdate.trim();
  if (!cleanName || !cleanDate) {
    return {
      account: null,
      error: "Informe seu nome completo e selecione sua data de nascimento.",
    };
  }

  const derivedPassword = passwordFromBirthdate(cleanDate);
  const reg = loadRegistry();

  // Check PlayFab via CustomId or matched local username first when configured
  if (isPlayFabConfigured()) {
    const customRes = await callPlayFabClient<PlayFabLoginPayload>("LoginWithCustomID", {
      CustomId: studentCustomId(cleanName, derivedPassword),
      CreateAccount: false,
      InfoRequestParameters: {
        GetUserData: true,
        GetPlayerStatistics: true,
        GetUserAccountInfo: true,
      },
    });

    if (!customRes.error && customRes.data) {
      const account = buildAccountFromPlayFabPayload(
        customRes.data,
        cleanName,
        derivedPassword,
        cfg,
      );
      reg[account.profile.nickNormalized] = account;
      saveRegistry(reg);
      saveStoredSession({
        playerId: account.profile.nickNormalized,
        sessionTicket: customRes.data.SessionTicket,
        playfabId: customRes.data.PlayFabId,
      });
      syncLocalBrowserFromAccount(account);
      return {
        account,
        error: null,
        recoveredNick: account.profile.nick,
        derivedPassword,
      };
    }
  }

  // Check local registry by Full Name + Birthdate
  const found = findAccountByFullNameAndPassword(reg, cleanName, derivedPassword, cleanDate);
  if (!found) {
    return {
      account: null,
      error:
        "Nenhuma conta foi encontrada com esse Nome Completo e Data de Nascimento. Verifique se digitou igual ao cadastro ou clique em 'Criar perfil'.",
    };
  }

  const aligned = ensurePlayerSeasonAligned(found, cfg);
  reg[aligned.profile.nickNormalized] = aligned;
  saveRegistry(reg);
  saveStoredSession({ playerId: aligned.profile.nickNormalized });
  syncLocalBrowserFromAccount(aligned);

  return {
    account: aligned,
    error: null,
    recoveredNick: aligned.profile.nick,
    derivedPassword,
  };
}

function syncLocalBrowserFromAccount(account: StoredAccount) {
  clearLocalStats();
  for (const s of account.stats) {
    updateBest(s.game_id, s.best_score, s.best_level);
  }
  saveUnlocked(account.unlocked);
}

export function playfabSignOut() {
  saveStoredSession(null);
  setAdminUnlockedSession(false);
  clearLocalStats();
  clearUnlocked();
}

export function getActiveAccount(): StoredAccount | null {
  const cfg = checkAndApplyScheduledReset();
  const session = loadStoredSession();
  if (!session) return null;
  const reg = loadRegistry();
  const acc = reg[session.playerId];
  if (!acc) return null;
  return ensurePlayerSeasonAligned(acc, cfg);
}

async function pushProfileToPlayFab(account: StoredAccount, sessionTicket?: string) {
  const ticket = sessionTicket ?? loadStoredSession()?.sessionTicket;
  if (!ticket || !isPlayFabConfigured()) return;

  const p = account.profile;
  await callPlayFabClient(
    "UpdateUserData",
    {
      Data: {
        PlayerProfile: JSON.stringify({
          nick: p.nick,
          full_name: p.full_name,
          school: p.school,
          grade: p.grade,
          birthdate: p.birthdate,
          xp: p.xp,
          seasonXp: p.seasonXp,
          level: p.level,
          wins: p.wins,
          x1Wins: p.x1Wins ?? 0,
          weeklyX1Wins: p.weeklyX1Wins ?? 0,
          weeklyX1WeekKey: p.weeklyX1WeekKey,
          matchesPlayed: p.matchesPlayed,
          distinctGamesPlayed: p.distinctGamesPlayed ?? 0,
          dailyXp: p.dailyXp ?? 0,
          dailyX1Xp: p.dailyX1Xp ?? 0,
          dailyTournamentXp: p.dailyTournamentXp ?? 0,
          dailyTournamentEntries: p.dailyTournamentEntries ?? 0,
          dailyXpDate: p.dailyXpDate ?? getLocalDateKey(),
          dailyPostCapMatches: p.dailyPostCapMatches ?? 0,
          dailyPostCapDate: p.dailyPostCapDate ?? getLocalDateKey(),
          streakDays: p.streakDays ?? 1,
          lastActiveDate: p.lastActiveDate,
          tournamentMedals: p.tournamentMedals ?? [],
          unlockedMedals: p.unlockedMedals ?? [],
          badges: p.badges,
          isAdmin: p.isAdmin,
          seasonId: p.seasonId,
        }),
        GameStats: JSON.stringify(account.stats),
        UnlockedGames: JSON.stringify(account.unlocked),
      },
      Permission: "Public",
    },
    ticket,
  );

  // Sync into shared student roster for ADM, teachers, and leaderboards across all devices
  try {
    const rosterTicket = (await getAdminPlayFabTicket()) ?? ticket;
    if (rosterTicket) {
      await callPlayFabClient("CreateSharedGroup", { SharedGroupId: ROSTER_SHARED_GROUP_ID }, rosterTicket);
      await callPlayFabClient(
        "UpdateSharedGroupData",
        {
          SharedGroupId: ROSTER_SHARED_GROUP_ID,
          Data: {
            [`stu_${p.nickNormalized}`]: JSON.stringify({
              id: p.id,
              playfabId: p.playfabId,
              nick: p.nick,
              nickNormalized: p.nickNormalized,
              full_name: p.full_name,
              school: p.school,
              grade: p.grade,
              turma: p.turma ?? null,
              birthdate: p.birthdate,
              xp: p.xp,
              seasonXp: p.seasonXp,
              level: p.level,
              wins: p.wins,
              x1Wins: p.x1Wins ?? 0,
              weeklyX1Wins: p.weeklyX1Wins ?? 0,
              weeklyX1WeekKey: p.weeklyX1WeekKey,
              matchesPlayed: p.matchesPlayed,
              distinctGamesPlayed: p.distinctGamesPlayed ?? 0,
              streakDays: p.streakDays ?? 1,
              lastActiveDate: p.lastActiveDate,
              tournamentMedals: p.tournamentMedals ?? [],
              unlockedMedals: p.unlockedMedals ?? [],
              badges: p.badges ?? [],
              stats: account.stats ?? [],
              isAdmin: p.isAdmin,
              seasonId: p.seasonId,
              updatedAt: account.updatedAt,
            }),
          },
          Permission: "Public",
        },
        rosterTicket,
      );
    }
  } catch {
    /* ignore network issues with shared group */
  }
}

/**
 * Downloads and merges all registered students across all schools/devices from PlayFab.
 */
export async function syncStudentRosterFromPlayFab(sessionTicket?: string): Promise<PlayerProfile[]> {
  const cfg = checkAndApplyScheduledReset();
  const ticket = (await getAdminPlayFabTicket()) ?? sessionTicket ?? loadStoredSession()?.sessionTicket;
  if (!ticket || !isPlayFabConfigured()) {
    return getAllRegisteredPlayers();
  }

  try {
    await callPlayFabClient("CreateSharedGroup", { SharedGroupId: ROSTER_SHARED_GROUP_ID }, ticket);
    const res = await callPlayFabClient<{ Data?: Record<string, { Value: string }> }>(
      "GetSharedGroupData",
      { SharedGroupId: ROSTER_SHARED_GROUP_ID },
      ticket,
    );

    const data = res.data?.Data;
    const reg = loadRegistry();
    let updated = false;
    const needsCloudSanitize = new Set<string>();

    // 1. If we received students from the cloud, merge them into local registry
    if (data && Object.keys(data).length > 0) {
      for (const item of Object.values(data)) {
        if (!item?.Value) continue;
        try {
          const parsed = JSON.parse(item.Value) as Partial<PlayerProfile>;
          if (!parsed.nickNormalized) continue;
          const slug = parsed.nickNormalized;
          const existing = reg[slug];

          const mergedProfile: PlayerProfile = {
            id: parsed.id || existing?.profile.id || `pf_${slug}`,
            playfabId: parsed.playfabId || existing?.profile.playfabId,
            nick: parsed.nick || existing?.profile.nick || slug,
            nickNormalized: slug,
            full_name: parsed.full_name || existing?.profile.full_name || "",
            school:
              parsed.school && isValidSchool(parsed.school)
                ? parsed.school
                : existing?.profile.school || SCHOOLS[0].name,
            grade: parsed.grade ?? existing?.profile.grade ?? null,
            turma: parsed.turma ?? existing?.profile.turma ?? null,
            birthdate: parsed.birthdate || existing?.profile.birthdate || "2015-01-01",
            xp: Math.max(parsed.xp ?? 0, existing?.profile.xp ?? 0),
            seasonXp: Math.max(parsed.seasonXp ?? 0, existing?.profile.seasonXp ?? 0),
            level: Math.max(parsed.level ?? 1, existing?.profile.level ?? 1),
            wins: Math.max(parsed.wins ?? 0, existing?.profile.wins ?? 0),
            x1Wins: Math.max(parsed.x1Wins ?? 0, existing?.profile.x1Wins ?? 0),
            weeklyX1Wins: Math.max(parsed.weeklyX1Wins ?? 0, existing?.profile.weeklyX1Wins ?? 0),
            weeklyX1WeekKey: parsed.weeklyX1WeekKey ?? existing?.profile.weeklyX1WeekKey,
            matchesPlayed: Math.max(parsed.matchesPlayed ?? 0, existing?.profile.matchesPlayed ?? 0),
            distinctGamesPlayed: parsed.distinctGamesPlayed ?? existing?.profile.distinctGamesPlayed ?? 0,
            dailyXp: existing?.profile.dailyXp ?? 0,
            dailyXpDate: existing?.profile.dailyXpDate,
            dailyPostCapMatches: parsed.dailyPostCapMatches ?? existing?.profile.dailyPostCapMatches ?? 0,
            dailyPostCapDate: parsed.dailyPostCapDate ?? existing?.profile.dailyPostCapDate,
            streakDays: Math.max(parsed.streakDays ?? 1, existing?.profile.streakDays ?? 1),
            lastActiveDate: parsed.lastActiveDate ?? existing?.profile.lastActiveDate,
            tournamentMedals: parsed.tournamentMedals ?? existing?.profile.tournamentMedals ?? [],
            unlockedMedals: parsed.unlockedMedals ?? existing?.profile.unlockedMedals ?? [],
            badges: parsed.badges ?? existing?.profile.badges ?? [],
            isAdmin: parsed.isAdmin ?? existing?.profile.isAdmin,
            seasonId: parsed.seasonId ?? existing?.profile.seasonId ?? 1,
          };

          // Merge stats per game_id keeping highest best_score, best_level, plays, wins, and flawless_wins
          const incomingStats: GameStatRow[] = Array.isArray((parsed as any).stats)
            ? (parsed as any).stats
            : [];
          const existingStats: GameStatRow[] = existing?.stats ?? [];
          const statsMap = new Map<string, GameStatRow>();
          for (const st of [...existingStats, ...incomingStats]) {
            if (!st || !st.game_id) continue;
            const key = `${st.game_id}__${st.mode || "padrao"}`;
            const cur = statsMap.get(key);
            if (!cur) {
              statsMap.set(key, { ...st });
            } else {
              statsMap.set(key, {
                game_id: st.game_id,
                mode: st.mode || "padrao",
                plays: Math.max(cur.plays ?? 0, st.plays ?? 0),
                wins: Math.max(cur.wins ?? 0, st.wins ?? 0),
                flawless_wins: Math.max(cur.flawless_wins ?? 0, st.flawless_wins ?? 0),
                last_wrong: st.last_wrong ?? cur.last_wrong,
                best_score: Math.max(cur.best_score ?? 0, st.best_score ?? 0),
                best_level: Math.max(cur.best_level ?? 1, st.best_level ?? 1),
                last_played_at:
                  (st.last_played_at || "") > (cur.last_played_at || "")
                    ? st.last_played_at
                    : cur.last_played_at,
              });
            }
          }

          const incomingMedalsCount = Array.isArray(parsed.unlockedMedals)
            ? parsed.unlockedMedals.length
            : 0;
          const incomingDistinct = parsed.distinctGamesPlayed ?? 0;

          const aligned = ensurePlayerSeasonAligned(
            {
              profile: mergedProfile,
              passwordHash:
                existing?.passwordHash ||
                simpleHash(passwordFromBirthdate(mergedProfile.birthdate)),
              unlocked: existing?.unlocked || [],
              stats: Array.from(statsMap.values()),
              updatedAt: (parsed as any).updatedAt || new Date().toISOString(),
            },
            cfg,
          );

          if (
            (aligned.profile.unlockedMedals?.length ?? 0) !== incomingMedalsCount ||
            (aligned.profile.distinctGamesPlayed ?? 0) !== incomingDistinct
          ) {
            needsCloudSanitize.add(slug);
          }

          reg[slug] = aligned;
          updated = true;
        } catch {
          /* ignore JSON parse error */
        }
      }
    }

    // 2. Push any local students that are not yet in the cloud roster (or whose medals/stats were reconciled)
    const missingInCloud: Record<string, string> = {};
    for (const [slug, rawAcc] of Object.entries(reg)) {
      const acc = ensurePlayerSeasonAligned(rawAcc, cfg);
      reg[slug] = acc;
      if (isSpecialAdminAccount(acc.profile)) continue;
      const key = `stu_${slug}`;
      if (!data || !data[key] || needsCloudSanitize.has(slug)) {
        missingInCloud[key] = JSON.stringify({
          id: acc.profile.id,
          playfabId: acc.profile.playfabId,
          nick: acc.profile.nick,
          nickNormalized: acc.profile.nickNormalized,
          full_name: acc.profile.full_name,
          school: acc.profile.school,
          grade: acc.profile.grade,
          turma: acc.profile.turma ?? null,
          birthdate: acc.profile.birthdate,
          xp: acc.profile.xp,
          seasonXp: acc.profile.seasonXp,
          level: acc.profile.level,
          wins: acc.profile.wins,
          x1Wins: acc.profile.x1Wins ?? 0,
          weeklyX1Wins: acc.profile.weeklyX1Wins ?? 0,
          weeklyX1WeekKey: acc.profile.weeklyX1WeekKey,
          matchesPlayed: acc.profile.matchesPlayed,
          distinctGamesPlayed: acc.profile.distinctGamesPlayed ?? 0,
          streakDays: acc.profile.streakDays ?? 1,
          lastActiveDate: acc.profile.lastActiveDate,
          tournamentMedals: acc.profile.tournamentMedals ?? [],
          unlockedMedals: acc.profile.unlockedMedals ?? [],
          badges: acc.profile.badges ?? [],
          stats: acc.stats ?? [],
          isAdmin: acc.profile.isAdmin,
          seasonId: acc.profile.seasonId,
          updatedAt: acc.updatedAt,
        });
      }
    }

    if (Object.keys(missingInCloud).length > 0) {
      await callPlayFabClient(
        "UpdateSharedGroupData",
        {
          SharedGroupId: ROSTER_SHARED_GROUP_ID,
          Data: missingInCloud,
          Permission: "Public",
        },
        ticket,
      );
    }

    if (updated) {
      saveRegistry(reg);
    }
  } catch {
    /* ignore network issues */
  }

  return getAllRegisteredPlayers();
}

/**
 * Allows the Administrator to update student profile data (Birthdate, School, Turma, Full Name)
 * directly from the Admin Panel or Inspect Modal, immediately syncing to local storage and PlayFab cloud.
 */
export async function updateStudentProfileByAdmin(args: {
  playerId: string;
  birthdate?: string;
  school?: string;
  turma?: string | null;
  grade?: string | null;
  fullName?: string;
}): Promise<PlayerProfile | null> {
  const reg = loadRegistry();
  const slug = nickSlug(args.playerId);
  const accEntry = Object.entries(reg).find(
    ([k, acc]) =>
      k === slug ||
      acc.profile.id === args.playerId ||
      acc.profile.nickNormalized === slug ||
      acc.profile.nick.toLowerCase() === args.playerId.toLowerCase(),
  );

  let acc = accEntry ? accEntry[1] : null;

  if (!acc) {
    const all = getAllRegisteredPlayers();
    const found = all.find(
      (p) =>
        p.id === args.playerId ||
        p.nickNormalized === slug ||
        p.nick.toLowerCase() === args.playerId.toLowerCase(),
    );
    if (!found) return null;
    acc = {
      profile: { ...found },
      passwordHash: "",
      unlocked: [],
      stats: [],
      updatedAt: new Date().toISOString(),
    };
  }

  if (args.birthdate) {
    acc.profile.birthdate = args.birthdate;
  }
  if (args.school !== undefined) {
    acc.profile.school = args.school;
  }

  // Validate age restrictions
  const currentAge = ageFrom(acc.profile.birthdate);
  if (currentAge >= 15 || isEtapa3OrOlder(acc.profile.birthdate)) {
    if (isOfficialSemedSchool(acc.profile.school)) {
      acc.profile.school = "Nenhuma";
    }
    acc.profile.turma = null;
    acc.profile.grade = null;
  } else if (currentAge > 11) {
    if (is5thGradeSchool(acc.profile.school)) {
      acc.profile.school = "Nenhuma";
      acc.profile.turma = null;
      acc.profile.grade = null;
    }
  }

  if (args.turma !== undefined) {
    acc.profile.turma = acc.profile.school === "Nenhuma" || acc.profile.school === "Outro" ? null : args.turma;
  }
  if (acc.profile.school === "Nenhuma" || acc.profile.school === "Outro") {
    acc.profile.grade = null;
  } else if (is5thGradeSchool(acc.profile.school)) {
    acc.profile.grade = "5º ano";
  } else if (args.grade !== undefined) {
    acc.profile.grade = args.grade;
  }
  if (args.fullName) {
    acc.profile.full_name = formatFullNameUpper(args.fullName);
  }

  acc.updatedAt = new Date().toISOString();
  reg[acc.profile.nickNormalized] = acc;
  saveRegistry(reg);

  // Sync to PlayFab SharedGroupData
  try {
    const ticket = await getAdminPlayFabTicket();
    if (ticket && isPlayFabConfigured()) {
      await callPlayFabClient(
        "UpdateSharedGroupData",
        {
          SharedGroupId: ROSTER_SHARED_GROUP_ID,
          Data: {
            [`stu_${acc.profile.nickNormalized}`]: JSON.stringify({
              ...acc.profile,
              updatedAt: acc.updatedAt,
            }),
          },
          Permission: "Public",
        },
        ticket,
      );
    }
  } catch (err) {
    console.warn("Failed to sync updated student to PlayFab:", err);
  }

  return acc.profile;
}

export async function playfabUnlockGames(games: GameId[]): Promise<GameId[]> {
  const session = loadStoredSession();
  if (!session) return [];
  const reg = loadRegistry();
  const acc = reg[session.playerId];
  if (!acc) return [];

  acc.unlocked = [...new Set([...acc.unlocked, ...games])];
  acc.updatedAt = new Date().toISOString();
  reg[session.playerId] = acc;
  saveRegistry(reg);
  saveUnlocked(acc.unlocked);

  await pushProfileToPlayFab(acc, session.sessionTicket);
  return acc.unlocked;
}

export async function playfabRecordMatch(args: {
  gameId: GameId;
  mode?: string;
  isTeam?: boolean;
  score: number;
  level: number;
  correct: number;
  wrong?: number;
}): Promise<StoredAccount | null> {
  const cfg = checkAndApplyScheduledReset();
  const session = loadStoredSession();
  if (!session) return null;
  const reg = loadRegistry();
  const acc = reg[session.playerId];
  if (!acc) return null;

  ensurePlayerSeasonAligned(acc, cfg);

  const safeScore = Math.max(0, args.score);
  const safeLevel = Math.max(1, args.level);
  const mode = args.mode ?? "padrao";
  const wrong = args.wrong ?? 0;
  const won = isMatchVictory(safeScore, args.correct, wrong);
  const flawless = isFlawlessMatch({
    score: safeScore,
    correct: args.correct,
    wrong,
    mode,
  });
  const rawEarnedXp = xpFromMatch(safeScore, args.correct, wrong, safeLevel);
  const todayKey = getLocalDateKey();
  const currentWeekKey = getCurrentWeekKey();

  // Update consecutive daily activity streak
  if (acc.profile.lastActiveDate !== todayKey) {
    const yesterdayKey = getPreviousDateKey(todayKey);
    if (acc.profile.lastActiveDate === yesterdayKey) {
      acc.profile.streakDays = (acc.profile.streakDays ?? 1) + 1;
    } else {
      acc.profile.streakDays = 1;
    }
    acc.profile.lastActiveDate = todayKey;
  } else if (!acc.profile.streakDays) {
    acc.profile.streakDays = 1;
  }

  let earnedXp = 0;
  if (mode === "x1_online") {
    // Dedicated +100 XP/day extra cap for Arena X1 (unlimited matches per day)
    if (won) {
      acc.profile.x1Wins = (acc.profile.x1Wins ?? 0) + 1;
      if (acc.profile.weeklyX1WeekKey !== currentWeekKey) {
        acc.profile.weeklyX1Wins = 1;
        acc.profile.weeklyX1WeekKey = currentWeekKey;
      } else {
        acc.profile.weeklyX1Wins = (acc.profile.weeklyX1Wins ?? 0) + 1;
      }
    }
    const x1CapRes = applyDailyXpCap({
      rawEarnedXp: won ? 25 : 10,
      currentDailyXp: acc.profile.dailyX1Xp ?? 0,
      lastDateKey: acc.profile.dailyXpDate,
      todayKey,
      dailyCap: X1_DAILY_EXTRA_XP_CAP,
    });
    earnedXp = x1CapRes.grantedXp;
    acc.profile.dailyX1Xp = x1CapRes.newDailyXp;
    acc.profile.dailyXpDate = todayKey;
  } else if (mode === "torneio_semanal") {
    // Dedicated +100 XP/day extra cap for Weekly Ranked Tournament (10 entries/day × 10 XP = 100 XP)
    const usedEntries = acc.profile.dailyTournamentEntries ?? 0;
    if (usedEntries < TOURNAMENT_DAILY_ENTRIES_LIMIT) {
      acc.profile.dailyTournamentEntries = usedEntries + 1;
      const tourCapRes = applyDailyXpCap({
        rawEarnedXp: TOURNAMENT_XP_PER_ENTRY,
        currentDailyXp: acc.profile.dailyTournamentXp ?? 0,
        lastDateKey: acc.profile.dailyXpDate,
        todayKey,
        dailyCap: TOURNAMENT_DAILY_EXTRA_XP_CAP,
      });
      earnedXp = tourCapRes.grantedXp;
      acc.profile.dailyTournamentXp = tourCapRes.newDailyXp;
      acc.profile.dailyXpDate = todayKey;
    } else {
      earnedXp = 0;
    }
  } else {
    // Normal match XP: default capped at 20 XP per match (can be raised by special event matchXpCap)
    const bonuses = getActiveEventBonuses(args.gameId, cfg.dailyXpCap, 20);
    const multipliedRawXp = Math.round(rawEarnedXp * bonuses.multiplier);
    let cappedMatchXp = Math.min(multipliedRawXp, bonuses.matchXpCap);

    // Quando em equipes (disputas em grupo), o XP ganho é reduzido em 4X (ex: 20 XP vira 5 XP)
    const isTeamMode = Boolean(args.isTeam || mode === "equipes");
    if (isTeamMode) {
      cappedMatchXp = adjustXpForGameMode(cappedMatchXp, true);
    }

    const effectiveDailyCap = bonuses.dailyXpCap;
    const wasAlreadyAtDailyCap =
      acc.profile.dailyXpDate === todayKey && (acc.profile.dailyXp ?? 0) >= effectiveDailyCap;

    const dailyCapResult = applyDailyXpCap({
      rawEarnedXp: cappedMatchXp,
      currentDailyXp: acc.profile.dailyXp ?? 0,
      lastDateKey: acc.profile.dailyXpDate,
      todayKey,
      dailyCap: effectiveDailyCap,
    });
    earnedXp = dailyCapResult.grantedXp;
    acc.profile.dailyXp = dailyCapResult.newDailyXp;
    acc.profile.dailyXpDate = dailyCapResult.dateKey;

    // Reseta partidas pós-cap se mudou o dia
    if (acc.profile.dailyPostCapDate !== todayKey) {
      acc.profile.dailyPostCapMatches = 0;
      acc.profile.dailyPostCapDate = todayKey;
    }

    // Se a partida foi jogada após o limite de XP diário já ter sido alcançado, incrementa o contador diário
    if (wasAlreadyAtDailyCap) {
      acc.profile.dailyPostCapMatches = (acc.profile.dailyPostCapMatches ?? 0) + 1;
    }
  }

  const existingIdx = acc.stats.findIndex(
    (s) => s.game_id === args.gameId && s.mode === mode,
  );

  const nowIso = new Date().toISOString();
  if (existingIdx >= 0) {
    const cur = acc.stats[existingIdx];
    acc.stats[existingIdx] = {
      ...cur,
      plays: cur.plays + 1,
      wins: (cur.wins ?? 0) + (won ? 1 : 0),
      flawless_wins: (cur.flawless_wins ?? 0) + (flawless ? 1 : 0),
      last_wrong: wrong,
      best_score: Math.max(cur.best_score, safeScore),
      best_level: Math.max(cur.best_level, safeLevel),
      last_played_at: nowIso,
    };
  } else {
    acc.stats.push({
      game_id: args.gameId,
      mode,
      plays: 1,
      wins: won ? 1 : 0,
      flawless_wins: flawless ? 1 : 0,
      last_wrong: wrong,
      best_score: safeScore,
      best_level: safeLevel,
      last_played_at: nowIso,
    });
  }

  const isSyntheticTournamentEntry = mode === "torneio_semanal";
  const nextXp = acc.profile.xp + earnedXp;
  const nextSeasonXp = (acc.profile.seasonXp ?? 0) + earnedXp;
  const nextWins = (acc.profile.wins ?? 0) + (!isSyntheticTournamentEntry && won ? 1 : 0);
  const nextMatches = (acc.profile.matchesPlayed ?? 0) + (isSyntheticTournamentEntry ? 0 : 1);
  const distinctGames = getDistinctGamesPlayed(
    acc.profile,
    acc.stats,
    {
      gameId: args.gameId,
      score: safeScore,
      level: safeLevel,
      correct: args.correct,
      wrong,
      mode,
    },
    cfg.enabledGames,
  );

  acc.profile.xp = nextXp;
  acc.profile.seasonXp = nextSeasonXp;
  acc.profile.wins = nextWins;
  acc.profile.matchesPlayed = nextMatches;
  acc.profile.totalMatches = nextMatches;
  acc.profile.distinctGamesPlayed = distinctGames;
  acc.profile.level = calculatePlayerLevel({
    xp: nextXp,
    matchesPlayed: nextMatches,
    wins: nextWins,
    distinctGames,
  });
  acc.profile.badges = computeBadges({
    existing: acc.profile.badges,
    xp: nextXp,
    wins: nextWins,
    matchesPlayed: nextMatches,
    distinctGamesPlayed: distinctGames,
    lastMatchScore: safeScore,
  });

  // Evaluate new medals at the end of the match using the exact final wrong/correct/score counts
  const allMedals = getAllAvailableMedals(cfg.customMedals);
  const newlyAwarded = evaluatePlayerMedals(
    {
      profile: acc.profile,
      stats: acc.stats,
      lastMatch: {
        gameId: args.gameId,
        score: safeScore,
        level: safeLevel,
        correct: args.correct,
        wrong,
        mode,
      },
      todayXpEarned: acc.profile.dailyXp,
      streakDays: acc.profile.streakDays,
      weeklyX1Wins: acc.profile.weeklyX1Wins,
      enabledGames: cfg.enabledGames,
    },
    allMedals,
  );

  if (newlyAwarded.length > 0) {
    const currentUnlocked = acc.profile.unlockedMedals ?? [];
    let medalsBonusXp = 0;
    for (const m of newlyAwarded) {
      currentUnlocked.push({ medalId: m.id, unlockedAt: nowIso });
      medalsBonusXp += MEDAL_XP_REWARDS[m.rarity] ?? 10;
    }
    acc.profile.unlockedMedals = currentUnlocked;

    // Grant instant bonus XP for unlocked medals (Bronze: 10, Prata: 20, Ouro: 30, etc.)
    if (medalsBonusXp > 0) {
      acc.profile.xp += medalsBonusXp;
      acc.profile.seasonXp = (acc.profile.seasonXp ?? 0) + medalsBonusXp;
      acc.profile.level = calculatePlayerLevel({
        xp: acc.profile.xp,
        matchesPlayed: acc.profile.matchesPlayed,
        wins: acc.profile.wins,
        distinctGames: acc.profile.distinctGamesPlayed ?? 1,
      });

      // Re-evaluate in case the bonus XP or newly added medals unlocked a level/meta medal
      const secondaryAwarded = evaluatePlayerMedals(
        {
          profile: acc.profile,
          stats: acc.stats,
          todayXpEarned: acc.profile.dailyXp,
          streakDays: acc.profile.streakDays,
          weeklyX1Wins: acc.profile.weeklyX1Wins,
          enabledGames: cfg.enabledGames,
        },
        allMedals,
      );
      for (const sm of secondaryAwarded) {
        if (!currentUnlocked.some((u) => u.medalId === sm.id)) {
          currentUnlocked.push({ medalId: sm.id, unlockedAt: nowIso });
          newlyAwarded.push(sm);
          const extraXp = MEDAL_XP_REWARDS[sm.rarity] ?? 10;
          medalsBonusXp += extraXp;
          acc.profile.xp += extraXp;
          acc.profile.seasonXp = (acc.profile.seasonXp ?? 0) + extraXp;
        }
      }
      acc.profile.unlockedMedals = currentUnlocked;
    }

    // Send notifications to Admin Mailbox
    const adminNotifs = cfg.adminMedalNotifications ?? [];
    for (const m of newlyAwarded) {
      adminNotifs.unshift({
        id: `adm_notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        studentId: acc.profile.id,
        studentNick: acc.profile.nick,
        studentFullName: acc.profile.full_name,
        studentSchool: acc.profile.school,
        medalId: m.id,
        medalTitle: m.title,
        medalRarity: m.rarity,
        medalIcon: m.iconName,
        unlockedAt: nowIso,
        read: false,
      });
    }
    cfg.adminMedalNotifications = adminNotifs.slice(0, 200); // retain last 200 mailbox entries
    saveAdminConfig(cfg);

    // Dispatch custom browser event for celebration popup
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("desafios:medal-unlocked", {
          detail: {
            medals: newlyAwarded,
            studentNick: acc.profile.nick,
            bonusXp: medalsBonusXp,
          },
        }),
      );
    }
  }

  acc.updatedAt = nowIso;

  reg[session.playerId] = acc;
  saveRegistry(reg);

  // Sync with Azure PlayFab Statistics & UserData
  if (session.sessionTicket && isPlayFabConfigured()) {
    const sSlug = schoolSlug(acc.profile.school);
    const sId = cfg.seasonId;
    const playerStage = stageFromBirthdate(acc.profile.birthdate, new Date(), acc.profile.school);
    const bestGameScore = Math.max(
      safeScore,
      ...acc.stats.filter((s) => s.game_id === args.gameId).map((s) => s.best_score),
    );
    const medalsTotal = acc.profile.unlockedMedals?.length ?? 0;
    const statistics = [
      { StatisticName: "XP_Total", Value: acc.profile.xp },
      { StatisticName: "Medals_Total", Value: medalsTotal },
      { StatisticName: `XP_Season_S${sId}`, Value: acc.profile.seasonXp },
      { StatisticName: `XP_Season_S${sId}_${playerStage.id}`, Value: acc.profile.seasonXp },
      { StatisticName: `Best_${args.gameId}`, Value: bestGameScore },
      { StatisticName: `Best_${args.gameId}_S${sId}`, Value: bestGameScore },
      { StatisticName: `Best_${args.gameId}_S${sId}_${playerStage.id}`, Value: bestGameScore },
      { StatisticName: `School_${sSlug}_XP`, Value: acc.profile.seasonXp },
    ];

    // Try CloudScript first; fall back to direct UpdatePlayerStatistics
    const csRes = await callPlayFabClient(
      "ExecuteCloudScript",
      {
        FunctionName: "RecordMatchResult",
        FunctionParameter: {
          gameId: args.gameId,
          mode,
          score: safeScore,
          level: safeLevel,
          correct: args.correct,
          wrong,
          earnedXp,
          statistics,
        },
      },
      session.sessionTicket,
    );

    if (csRes.error) {
      await callPlayFabClient(
        "UpdatePlayerStatistics",
        { Statistics: statistics },
        session.sessionTicket,
      );
    }

    await pushProfileToPlayFab(acc, session.sessionTicket);
  }

  return acc;
}

/* --------------------- Leaderboards (Rankings) Query --------------------- */

const RANK_HISTORY_STORAGE_KEY = "desafios-leaderboard-rank-history-v2";
let lastRosterLeaderboardSyncAt = 0;

function loadLeaderboardRankHistory(): Record<string, Record<string, RankHistoryState>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RANK_HISTORY_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveLeaderboardRankHistory(history: Record<string, Record<string, RankHistoryState>>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RANK_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    /* ignore storage quota */
  }
}

export type LeaderboardFilter =
  | { kind: "medals"; stage?: RankingFilterCategory }
  | { kind: "xp_season"; stage?: RankingFilterCategory }
  | { kind: "xp_total"; stage?: RankingFilterCategory }
  | { kind: "game"; gameId: GameId; stage?: RankingFilterCategory }
  | { kind: "school"; school: string; stage?: RankingFilterCategory };

export async function fetchLeaderboard(
  filter: LeaderboardFilter,
  maxResults = 50,
): Promise<LeaderboardEntry[]> {
  const cfg = checkAndApplyScheduledReset();
  const session = loadStoredSession();
  const currentId = session?.playerId;

  // 1. Update best_score for already-played enabled games in the logged-in account (never inject unplayed games from shared browser storage)
  if (currentId) {
    const regBefore = loadRegistry();
    const activeAcc = regBefore[currentId];
    if (activeAcc) {
      const browserStats = loadStats();
      let changedLocalStats = false;
      for (const gId of ALL_GAME_IDS) {
        if (cfg.enabledGames[gId] === false) continue;
        const localBest = browserStats[gId]?.bestScore ?? 0;
        const localLevel = browserStats[gId]?.bestLevel ?? 1;
        if (localBest > 0) {
          const existingIdx = activeAcc.stats.findIndex((s) => s.game_id === gId);
          if (existingIdx >= 0 && localBest > activeAcc.stats[existingIdx].best_score) {
            activeAcc.stats[existingIdx].best_score = localBest;
            activeAcc.stats[existingIdx].best_level = Math.max(
              activeAcc.stats[existingIdx].best_level,
              localLevel,
            );
            changedLocalStats = true;
          }
        }
      }
      if (changedLocalStats) {
        regBefore[currentId] = activeAcc;
        saveRegistry(regBefore);
      }
    }
  }

  // 2. Sync shared student roster from PlayFab cloud (throttled to every 8s) so all devices' scores/medals appear
  if (isPlayFabConfigured() && Date.now() - lastRosterLeaderboardSyncAt > 8_000) {
    lastRosterLeaderboardSyncAt = Date.now();
    await syncStudentRosterFromPlayFab(session?.sessionTicket);
  }

  const reg = loadRegistry();
  const localAccounts = Object.values(reg).map((acc) => ensurePlayerSeasonAligned(acc, cfg));
  saveRegistry(reg);

  // Map PlayFab live statistic values (if available) to augment local/roster values
  const playfabStatByPlayer = new Map<string, number>();

  if (session?.sessionTicket && isPlayFabConfigured() && filter.kind !== "medals") {
    const stageParam =
      filter.stage === "etapa_1" || filter.stage === "5º ano"
        ? "etapa_1"
        : filter.stage === "etapa_2" ||
            filter.stage === "6º ano" ||
            filter.stage === "7º ano" ||
            filter.stage === "8º ano" ||
            filter.stage === "9º ano"
          ? "etapa_2"
          : filter.stage === "etapa_3"
            ? "etapa_3"
            : null;

    let statName = stageParam
      ? `XP_Season_S${cfg.seasonId}_${stageParam}`
      : `XP_Season_S${cfg.seasonId}`;
    if (filter.kind === "xp_total") statName = "XP_Total";
    else if (filter.kind === "game") {
      statName = stageParam
        ? `Best_${filter.gameId}_S${cfg.seasonId}_${stageParam}`
        : `Best_${filter.gameId}_S${cfg.seasonId}`;
    } else if (filter.kind === "school") {
      statName = `School_${schoolSlug(filter.school)}_XP`;
    }

    const { data } = await callPlayFabClient<{
      Leaderboard?: {
        PlayFabId: string;
        DisplayName?: string;
        StatValue: number;
        Position: number;
      }[];
    }>(
      "GetLeaderboard",
      {
        StatisticName: statName,
        StartPosition: 0,
        MaxResultsCount: maxResults,
      },
      session.sessionTicket,
    );

    if (data?.Leaderboard && data.Leaderboard.length > 0) {
      for (const row of data.Leaderboard) {
        if (row.PlayFabId) {
          playfabStatByPlayer.set(row.PlayFabId, row.StatValue);
        }
        if (row.DisplayName) {
          playfabStatByPlayer.set(row.DisplayName.toLowerCase(), row.StatValue);
        }
      }
    }
  }

  // 3. Evaluate all registered students (cloud roster + local accounts + PlayFab stats)
  const rows: Omit<LeaderboardEntry, "rank">[] = [];

  for (const acc of localAccounts) {
    const p = acc.profile;
    // Admins are excluded from competitive student leaderboards
    if (isSpecialAdminAccount(p)) continue;

    if (!matchesRankingCategory(p, filter.stage)) continue;
    if (filter.kind === "school" && p.school !== filter.school) continue;

    const pAge = ageFrom(p.birthdate);
    const stInfo = stageFromBirthdate(p.birthdate, new Date(), p.school);
    const pfStatVal =
      (p.playfabId ? playfabStatByPlayer.get(p.playfabId) : undefined) ??
      playfabStatByPlayer.get(p.nick.toLowerCase()) ??
      0;

    const medalsCount = p.unlockedMedals?.length ?? 0;
    const xpValue = p.seasonXp ?? p.xp;

    let value = 0;
    if (filter.kind === "medals") {
      value = medalsCount;
    } else if (filter.kind === "xp_total") {
      value = Math.max(p.xp, pfStatVal);
    } else if (filter.kind === "xp_season" || filter.kind === "school") {
      value = Math.max(xpValue, pfStatVal);
    } else if (filter.kind === "game") {
      const gameRows = acc.stats.filter((s) => s.game_id === filter.gameId);
      const localBest = gameRows.length > 0 ? Math.max(...gameRows.map((g) => g.best_score)) : 0;
      value = Math.max(localBest, pfStatVal);
    }

    if (value <= 0 && filter.kind === "game") continue;

    const titleInfo = levelTitle(p.level);
    rows.push({
      playerId: p.id,
      nick: p.nick,
      fullName: p.full_name || p.nick,
      school: p.school,
      grade: p.grade ?? (is5thGradeSchool(p.school) ? "5º ano" : null),
      turma: p.turma ?? null,
      age: pAge,
      stage: stInfo.id,
      stageLabel: stInfo.shortLabel,
      level: p.level,
      rankTitle: titleInfo.title,
      rankEmoji: titleInfo.emoji,
      value,
      medalsCount,
      xpValue,
      wins: p.wins ?? 0,
      isCurrentPlayer: p.nickNormalized === currentId,
    });
  }

  // 4. Sort according to the selected leaderboard tab
  rows.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    if ((b.xpValue ?? 0) !== (a.xpValue ?? 0)) return (b.xpValue ?? 0) - (a.xpValue ?? 0);
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (a.fullName || a.nick).localeCompare(b.fullName || b.nick);
  });

  const ranked: LeaderboardEntry[] = rows.slice(0, maxResults).map((r, i) => ({
    ...r,
    rank: i + 1,
  }));

  // 5. Compute real rank movement arrows (up / down / same) and persist snapshot
  const normalizedStageKey =
    filter.stage === "etapa_1" || filter.stage === "5º ano"
      ? "etapa_1"
      : filter.stage === "etapa_2" ||
          filter.stage === "6º ano" ||
          filter.stage === "7º ano" ||
          filter.stage === "8º ano" ||
          filter.stage === "9º ano"
        ? "etapa_2"
        : filter.stage === "etapa_3"
          ? "etapa_3"
          : "TODAS";
  const boardKey = `${filter.kind}_${normalizedStageKey}_${
    filter.kind === "game" ? filter.gameId : filter.kind === "school" ? filter.school : "all"
  }`;
  const allHistory = loadLeaderboardRankHistory();
  const prevBoardHistory = allHistory[boardKey] ?? {};
  const { entriesWithTrend, nextHistory } = evaluateLeaderboardRankChanges(ranked, prevBoardHistory);
  allHistory[boardKey] = nextHistory;
  saveLeaderboardRankHistory(allHistory);

  return entriesWithTrend;
}

/** Returns summary stats per school for the School Ranking tab & Admin overview. */
export function getSchoolStandings(): {
  school: string;
  studentsCount: number;
  totalXp: number;
  totalWins: number;
  topStudent: string | null;
}[] {
  const cfg = checkAndApplyScheduledReset();
  const reg = loadRegistry();
  const accounts = Object.values(reg).map((a) => ensurePlayerSeasonAligned(a, cfg));

  return SCHOOLS.map((s) => {
    const members = accounts.filter(
      (a) => a.profile.school === s.name && !isSpecialAdminAccount(a.profile),
    );
    members.sort((a, b) => (b.profile.seasonXp ?? b.profile.xp) - (a.profile.seasonXp ?? a.profile.xp));
    const totalXp = members.reduce((sum, a) => sum + (a.profile.seasonXp ?? a.profile.xp), 0);
    const totalWins = members.reduce((sum, a) => sum + (a.profile.wins ?? 0), 0);
    return {
      school: s.name,
      studentsCount: members.length,
      totalXp,
      totalWins,
      topStudent: members[0] ? (members[0].profile.full_name || members[0].profile.nick) : null,
    };
  }).sort((a, b) => b.totalXp - a.totalXp || b.totalWins - a.totalWins);
}

/** Returns all registered players for the Admin Panel overview. */
export function getAllRegisteredPlayers(): PlayerProfile[] {
  const cfg = checkAndApplyScheduledReset();
  const reg = loadRegistry();
  return Object.values(reg)
    .map((a) => ensurePlayerSeasonAligned(a, cfg).profile)
    .sort((a, b) => b.xp - a.xp);
}

/**
 * Grants a Weekly Ranked Tournament medal (and optional holding bonus XP) to a player profile.
 */
export async function grantPlayerTournamentMedal(
  medal: TournamentMedal,
): Promise<PlayerProfile | null> {
  const session = loadStoredSession();
  if (!session) return null;
  const reg = loadRegistry();
  const acc = reg[session.playerId];
  if (!acc) return null;

  const existing = acc.profile.tournamentMedals ?? [];
  if (existing.some((m) => m.id === medal.id)) {
    return acc.profile;
  }

  acc.profile.tournamentMedals = [medal, ...existing];
  if (medal.bonusXpAwarded > 0) {
    acc.profile.xp += medal.bonusXpAwarded;
    acc.profile.seasonXp = (acc.profile.seasonXp ?? 0) + medal.bonusXpAwarded;
    acc.profile.level = calculatePlayerLevel({
      xp: acc.profile.xp,
      matchesPlayed: acc.profile.matchesPlayed,
      wins: acc.profile.wins,
      distinctGames: acc.profile.distinctGamesPlayed ?? 0,
    });
  }
  acc.updatedAt = new Date().toISOString();
  reg[session.playerId] = acc;
  saveRegistry(reg);
  await pushProfileToPlayFab(acc, session.sessionTicket);
  return acc.profile;
}

/**
 * Grants a custom or base medal directly to a specific player (used by ADM for manual event awards).
 */
export async function grantPlayerMedalManually(
  targetPlayerId: string,
  medal: MedalDefinition,
): Promise<{ success: boolean; error?: string }> {
  const reg = loadRegistry();
  const acc = reg[targetPlayerId] || Object.values(reg).find((a) => a.profile.id === targetPlayerId);
  if (!acc) {
    return { success: false, error: "Aluno não encontrado no registro." };
  }

  const unlocked = acc.profile.unlockedMedals ?? [];
  if (unlocked.some((m) => m.medalId === medal.id)) {
    return { success: true }; // already unlocked
  }

  const nowIso = new Date().toISOString();
  unlocked.push({ medalId: medal.id, unlockedAt: nowIso });
  acc.profile.unlockedMedals = unlocked;
  acc.updatedAt = nowIso;

  const cfg = loadAdminConfig();
  const notifs = cfg.adminMedalNotifications ?? [];
  notifs.unshift({
    id: `adm_notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    studentId: acc.profile.id,
    studentNick: acc.profile.nick,
    studentFullName: acc.profile.full_name,
    studentSchool: acc.profile.school,
    medalId: medal.id,
    medalTitle: medal.title,
    medalRarity: medal.rarity,
    medalIcon: medal.iconName,
    unlockedAt: nowIso,
    read: true,
  });
  cfg.adminMedalNotifications = notifs.slice(0, 200);
  saveAdminConfig(cfg);

  reg[acc.profile.nickNormalized] = acc;
  saveRegistry(reg);

  const session = loadStoredSession();
  if (session?.sessionTicket && isPlayFabConfigured() && acc.profile.id === session.playerId) {
    await pushProfileToPlayFab(acc, session.sessionTicket);
  }

  return { success: true };
}

/**
 * Sets player's class letter (Turma A-F) initially if not chosen during sign up.
 */
export async function playfabSetInitialTurma(turma: TurmaCode): Promise<PlayerProfile | null> {
  const session = loadStoredSession();
  if (!session) return null;
  const reg = loadRegistry();
  const acc = reg[session.playerId];
  if (!acc) return null;

  // Regular players can only set their turma if it wasn't already set
  if (acc.profile.turma && !acc.profile.isAdmin) {
    return acc.profile;
  }

  acc.profile.turma = turma;
  acc.updatedAt = new Date().toISOString();
  reg[session.playerId] = acc;
  saveRegistry(reg);
  syncLocalBrowserFromAccount(acc);
  await pushProfileToPlayFab(acc, session.sessionTicket);
  return acc.profile;
}

/**
 * Allows a regular player to set their School, Grade (Série) and Turma ONE TIME if they left them
 * unset ("Nenhuma" or null) when creating their profile. Once selected, these fields become fixed
 * and can only be modified by the Administrator (ADM).
 */
export async function playfabCompleteInitialSchoolSetup(args: {
  school?: string;
  grade?: string | null;
  turma?: TurmaCode | null;
}): Promise<{ profile: PlayerProfile | null; error: string | null }> {
  const session = loadStoredSession();
  if (!session) {
    return { profile: null, error: "Você precisa estar logado para atualizar seu perfil." };
  }
  const reg = loadRegistry();
  const acc = reg[session.playerId];
  if (!acc) {
    return { profile: null, error: "Perfil não encontrado." };
  }

  const p = acc.profile;
  const currentAge = ageFrom(p.birthdate);
  const isOver15 = currentAge >= 15 || isEtapa3OrOlder(p.birthdate);
  const isOver11 = currentAge > 11;

  if (isOver15) {
    return {
      profile: p,
      error: "Para 15 anos ou mais (3ª Etapa • Comunidade), não há vínculo com escolas ou séries do ensino fundamental.",
    };
  }

  const schoolAlreadyLocked = Boolean(p.school && p.school !== "Nenhuma");
  const gradeAlreadyLocked = Boolean(p.grade);
  const turmaAlreadyLocked = Boolean(p.turma);

  // 1. School (only if not yet selected)
  if (!schoolAlreadyLocked && args.school && args.school !== "Nenhuma") {
    if (isOver11 && is5thGradeSchool(args.school)) {
      return {
        profile: p,
        error: "Alunos acima de 11 anos não podem selecionar escolas de 5º ano.",
      };
    }
    p.school = args.school;
  }

  // 2. Grade / Série (only if not yet selected)
  if (!gradeAlreadyLocked) {
    if (is5thGradeSchool(p.school)) {
      p.grade = "5º ano";
    } else if (schoolNeedsGrade(p.school)) {
      if (args.grade) {
        p.grade = args.grade;
      }
    }
  }

  // 3. Turma (only if not yet selected and school is an official SEMED school)
  if (!turmaAlreadyLocked && args.turma && isOfficialSemedSchool(p.school)) {
    p.turma = args.turma;
  }

  acc.updatedAt = new Date().toISOString();
  reg[session.playerId] = acc;
  saveRegistry(reg);
  syncLocalBrowserFromAccount(acc);
  await pushProfileToPlayFab(acc, session.sessionTicket);

  return { profile: acc.profile, error: null };
}

/**
 * Submits a request to the ADM to change the student's class (Turma A-F).
 */
export async function playfabRequestTurmaChange(
  requestedTurma: TurmaCode,
): Promise<PlayerProfile | null> {
  const session = loadStoredSession();
  if (!session) return null;
  const reg = loadRegistry();
  const acc = reg[session.playerId];
  if (!acc) return null;

  acc.profile.pendingTurmaRequest = requestedTurma;
  acc.updatedAt = new Date().toISOString();
  reg[session.playerId] = acc;
  saveRegistry(reg);
  syncLocalBrowserFromAccount(acc);

  createTurmaChangeRequest({
    playerId: acc.profile.id,
    playerNick: acc.profile.nick,
    playerFullName: acc.profile.full_name,
    school: acc.profile.school,
    grade: acc.profile.grade,
    currentTurma: acc.profile.turma ?? null,
    requestedTurma,
  });

  return acc.profile;
}

/**
 * Approves a student's class change request in the ADM panel.
 */
export async function playfabApproveTurmaRequest(requestId: string): Promise<boolean> {
  const resolved = resolveTurmaChangeRequest(requestId, "aprovada");
  if (!resolved) return false;

  const reg = loadRegistry();
  for (const key of Object.keys(reg)) {
    const acc = reg[key];
    if (acc.profile.id === resolved.playerId || acc.profile.nick === resolved.playerNick) {
      acc.profile.turma = resolved.requestedTurma;
      acc.profile.pendingTurmaRequest = null;
      acc.updatedAt = new Date().toISOString();
      reg[key] = acc;
      saveRegistry(reg);
      break;
    }
  }
  return true;
}

/**
 * Rejects a student's class change request in the ADM panel.
 */
export async function playfabRejectTurmaRequest(requestId: string): Promise<boolean> {
  const resolved = resolveTurmaChangeRequest(requestId, "recusada");
  if (!resolved) return false;

  const reg = loadRegistry();
  for (const key of Object.keys(reg)) {
    const acc = reg[key];
    if (acc.profile.id === resolved.playerId || acc.profile.nick === resolved.playerNick) {
      acc.profile.pendingTurmaRequest = null;
      acc.updatedAt = new Date().toISOString();
      reg[key] = acc;
      saveRegistry(reg);
      break;
    }
  }
  return true;
}

/**
 * Finds a player's public profile by ID or Nick for inspect modal
 */
export function getPlayerPublicProfile(identifier: string): PlayerProfile | null {
  const cfg = checkAndApplyScheduledReset();
  const reg = loadRegistry();
  const clean = identifier.trim().toLowerCase();
  for (const acc of Object.values(reg)) {
    const p = acc.profile;
    if (
      p.id.toLowerCase() === clean ||
      p.nickNormalized === clean ||
      p.nick.toLowerCase() === clean
    ) {
      return ensurePlayerSeasonAligned(acc, cfg).profile;
    }
  }
  return null;
}

export { ALL_GAME_IDS };
