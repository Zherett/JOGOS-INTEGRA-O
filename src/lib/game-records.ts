import type { GameId } from "./game-storage";
import { stageFromBirthdate, type AgeStageId } from "./player-profile";
import { getPlayFabTitleId, loadRegistry, loadStoredSession } from "./playfab";

export const GAME_RECORDS_STORAGE_KEY = "desafios-game-records-v1";

export interface RecordHolder {
  playerId: string;
  nick: string;
  fullName?: string;
  school?: string;
  achievedAt: number; // epoch ms
}

export interface StageGameRecord {
  gameId: GameId;
  stage: AgeStageId;
  score: number;
  holders: RecordHolder[]; // In chronological order of achievement (first to reach is index 0)
  updatedAt: number;
}

export type AllGameRecords = Record<string, StageGameRecord>;
// Key: `${gameId}:${stage}` (e.g. "logica:etapa_1", "rpg:etapa_2")

export function getRecordKey(gameId: GameId, stage: AgeStageId): string {
  return `${gameId}:${stage}`;
}

export function loadGameRecords(): AllGameRecords {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GAME_RECORDS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveGameRecords(records: AllGameRecords) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GAME_RECORDS_STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new CustomEvent("desafios:game-records-updated", { detail: records }));
  } catch {
    /* ignore storage quota errors */
  }
}

/**
 * Pure function: Evaluates and updates the stage record for a game.
 * - If score > current.score: brand new record, replaces holders.
 * - If score === current.score: ties record, appends holder preserving chronological order.
 * - If score < current.score: no change.
 */
export function evaluateStageGameRecordUpdate(
  currentRecord: StageGameRecord | null | undefined,
  candidate: {
    gameId: GameId;
    stage: AgeStageId;
    playerId: string;
    nick: string;
    fullName?: string;
    school?: string;
    score: number;
    achievedAt?: number;
  },
): {
  updatedRecord: StageGameRecord;
  isNewRecord: boolean;
  isTiedRecord: boolean;
} {
  const safeScore = Math.max(0, Math.floor(candidate.score));
  const achievedAt = candidate.achievedAt ?? Date.now();
  const baseRecord: StageGameRecord = currentRecord ?? {
    gameId: candidate.gameId,
    stage: candidate.stage,
    score: 0,
    holders: [],
    updatedAt: achievedAt,
  };

  if (safeScore <= 0) {
    return { updatedRecord: baseRecord, isNewRecord: false, isTiedRecord: false };
  }

  const holderItem: RecordHolder = {
    playerId: candidate.playerId,
    nick: candidate.nick,
    fullName: candidate.fullName,
    school: candidate.school,
    achievedAt,
  };

  // Case 1: Surpassed existing record or first record
  if (safeScore > baseRecord.score) {
    return {
      updatedRecord: {
        gameId: candidate.gameId,
        stage: candidate.stage,
        score: safeScore,
        holders: [holderItem],
        updatedAt: achievedAt,
      },
      isNewRecord: true,
      isTiedRecord: false,
    };
  }

  // Case 2: Tied existing maximum record
  if (safeScore === baseRecord.score && baseRecord.score > 0) {
    const existingIndex = baseRecord.holders.findIndex(
      (h) => h.playerId === candidate.playerId || h.nick.toLowerCase() === candidate.nick.toLowerCase(),
    );

    let updatedHolders: RecordHolder[];
    let isTiedRecord = false;

    if (existingIndex >= 0) {
      // Player already holds this record; keep their original achievedAt
      updatedHolders = [...baseRecord.holders];
      updatedHolders[existingIndex] = {
        ...updatedHolders[existingIndex],
        nick: candidate.nick,
        fullName: candidate.fullName ?? updatedHolders[existingIndex].fullName,
        school: candidate.school ?? updatedHolders[existingIndex].school,
      };
    } else {
      // New distinct player tied the record! Append in chronological order
      updatedHolders = [...baseRecord.holders, holderItem].sort(
        (a, b) => a.achievedAt - b.achievedAt,
      );
      isTiedRecord = true;
    }

    return {
      updatedRecord: {
        ...baseRecord,
        holders: updatedHolders,
        updatedAt: achievedAt,
      },
      isNewRecord: false,
      isTiedRecord,
    };
  }

  // Case 3: Score is lower than current record
  return {
    updatedRecord: baseRecord,
    isNewRecord: false,
    isTiedRecord: false,
  };
}

/**
 * Records a game score for the given player and updates stage records accordingly.
 */
export function recordGameStageScore(candidate: {
  gameId: GameId;
  stage: AgeStageId;
  playerId: string;
  nick: string;
  fullName?: string;
  school?: string;
  score: number;
  achievedAt?: number;
}): { updatedRecord: StageGameRecord; isNewRecord: boolean; isTiedRecord: boolean } {
  const all = loadGameRecords();
  const key = getRecordKey(candidate.gameId, candidate.stage);
  const current = all[key];
  const res = evaluateStageGameRecordUpdate(current, candidate);

  if (res.isNewRecord || res.isTiedRecord) {
    all[key] = res.updatedRecord;
    saveGameRecords(all);
    void syncGameRecordsWithPlayFab(all);
  }

  return res;
}

/**
 * Retrieves the current record and holders for a game and stage.
 */
export function getGameStageRecord(
  gameId: GameId,
  stage: AgeStageId,
  records?: AllGameRecords,
): StageGameRecord | null {
  const store = records ?? loadGameRecords();
  const key = getRecordKey(gameId, stage);
  const rec = store[key];
  if (!rec || rec.score <= 0 || rec.holders.length === 0) {
    return null;
  }
  return rec;
}

/**
 * Populates/seeds records from the local registered students roster.
 */
export function seedRecordsFromRegistry(): AllGameRecords {
  const store = loadGameRecords();
  const reg = loadRegistry();
  let changed = false;

  for (const acc of Object.values(reg)) {
    if (!acc.profile || !acc.stats) continue;
    const p = acc.profile;
    const stage = stageFromBirthdate(p.birthdate, new Date(), p.school).id;

    for (const s of acc.stats) {
      if (!s.game_id || (s.best_score ?? 0) <= 0) continue;
      const key = getRecordKey(s.game_id, stage);
      const cur = store[key];
      const res = evaluateStageGameRecordUpdate(cur, {
        gameId: s.game_id,
        stage,
        playerId: p.id,
        nick: p.nick,
        fullName: p.full_name,
        school: p.school,
        score: s.best_score,
        achievedAt: s.last_played_at ? new Date(s.last_played_at).getTime() : 1_700_000_000_000,
      });

      if (res.isNewRecord || res.isTiedRecord) {
        store[key] = res.updatedRecord;
        changed = true;
      }
    }
  }

  if (changed) {
    saveGameRecords(store);
  }
  return store;
}

/**
 * Synchronizes stage game records with PlayFab SharedGroupData so all players share records in real-time.
 */
export async function syncGameRecordsWithPlayFab(
  localStore?: AllGameRecords,
): Promise<AllGameRecords> {
  const session = loadStoredSession();
  const titleId = getPlayFabTitleId();
  const store = localStore ?? loadGameRecords();
  if (!session || !session.sessionTicket || !titleId) return store;

  const groupId = "GameStageRecords_v1";

  try {
    // 1. Ensure SharedGroup exists
    await fetch(`https://${titleId}.playfabapi.com/Client/CreateSharedGroup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Authorization": session.sessionTicket,
      },
      body: JSON.stringify({ TitleId: titleId, SharedGroupId: groupId }),
    });

    // 2. Fetch remote records
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

    let hasLocalChanges = false;

    if (json.data?.Data?.Records?.Value) {
      const remote = JSON.parse(json.data.Data.Records.Value) as AllGameRecords;
      for (const [key, remRec] of Object.entries(remote)) {
        const locRec = store[key];
        if (!locRec || remRec.score > locRec.score) {
          store[key] = remRec;
          hasLocalChanges = true;
        } else if (remRec.score === locRec.score) {
          // Merge holders
          const mergedMap = new Map<string, RecordHolder>();
          for (const h of locRec.holders) mergedMap.set(h.playerId, h);
          for (const h of remRec.holders) {
            if (!mergedMap.has(h.playerId)) {
              mergedMap.set(h.playerId, h);
            } else {
              const cur = mergedMap.get(h.playerId)!;
              if (h.achievedAt < cur.achievedAt) {
                mergedMap.set(h.playerId, h);
              }
            }
          }
          const sortedHolders = Array.from(mergedMap.values()).sort(
            (a, b) => a.achievedAt - b.achievedAt,
          );
          if (sortedHolders.length !== locRec.holders.length) {
            locRec.holders = sortedHolders;
            hasLocalChanges = true;
          }
        }
      }
    }

    if (hasLocalChanges) {
      saveGameRecords(store);
    }

    // 3. Push merged records back to SharedGroupData
    await fetch(`https://${titleId}.playfabapi.com/Client/UpdateSharedGroupData`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Authorization": session.sessionTicket,
      },
      body: JSON.stringify({
        TitleId: titleId,
        SharedGroupId: groupId,
        Data: { Records: JSON.stringify(store) },
        Permission: "Public",
      }),
    });
  } catch {
    /* ignore offline/network errors */
  }

  return store;
}

/** Formats date in Brazilian format DD/MM/AAAA */
export function formatRecordDateBR(epochMs: number): string {
  if (!epochMs || Number.isNaN(epochMs)) return "";
  const d = new Date(epochMs);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
