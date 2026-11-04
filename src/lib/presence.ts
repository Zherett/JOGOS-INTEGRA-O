// Modulo de Presenca e Rastreamento de Status Online dos Jogadores
// Browser-safe: Verde = Online (< 5 min), Cinza = Inativo (5 a 10 min), Vermelho = Offline (> 10 min ou desconectado)

import { useEffect, useState } from "react";
import { nickSlug } from "./player-profile.ts";
import {
  getAdminPlayFabTicket,
  getPlayFabTitleId,
  isPlayFabConfigured,
  loadStoredSession,
} from "./playfab.ts";

export type PresenceStatus = "online" | "idle" | "offline";

export interface PlayerPresenceRecord {
  playerId: string;
  playfabId?: string;
  nick?: string;
  nickNormalized?: string;
  lastSeenAt: number;   // Timestamp em ms do último heartbeat (aba aberta/viva)
  lastActiveAt: number; // Timestamp em ms da última interação do aluno (clique, toque, tecla)
  idleMs?: number;      // Tempo inativo medido no relógio do dispositivo do próprio aluno
  disconnected?: boolean;
}

export interface PresenceStore {
  players: Record<string, PlayerPresenceRecord>;
  updatedAt: number;
}

// Limiares de tempo especificados:
export const PRESENCE_ONLINE_MAX_AGE_MS = 5 * 60 * 1000;   // 5 minutos
export const PRESENCE_IDLE_MAX_AGE_MS = 10 * 60 * 1000;    // 10 minutos
export const PRESENCE_DISCONNECT_MAX_AGE_MS = 2 * 60 * 1000; // 2 minutos sem heartbeat = aba fechada

const PRESENCE_STORAGE_KEY = "desafios-presence-store-v1";
const LOCAL_LAST_ACTIVE_KEY = "desafios-local-last-active-v1";
export const PRESENCE_SHARED_GROUP_ID = "SEMED_PRESENCE_V1";
export const PRESENCE_UPDATED_EVENT = "desafios:presence-updated";

/**
 * Avalia de forma pura e deterministica o status de presenca de um jogador.
 * - Verde ("online"): fez interacao ha menos de 5 minutos (com heartbeat ativo).
 * - Cinza ("idle"): sem interacao entre 5 e 10 minutos (aba continua aberta).
 * - Vermelho ("offline"): mais de 10 minutos sem interacao OU sem heartbeat recente (aba fechada).
 */
export function computePresenceStatus(
  record?: { lastSeenAt?: number; lastActiveAt?: number; idleMs?: number; disconnected?: boolean } | null,
  now = Date.now()
): PresenceStatus {
  if (
    !record ||
    record.disconnected ||
    typeof record.lastSeenAt !== "number" ||
    record.lastSeenAt <= 0
  ) {
    return "offline";
  }

  // Se o heartbeat está mais antigo que o limite de desconexão (2 min), a aba foi fechada/suspensa
  const timeSinceSeen = Math.max(0, now - record.lastSeenAt);
  if (timeSinceSeen > PRESENCE_DISCONNECT_MAX_AGE_MS) {
    return "offline";
  }

  const lastActive = typeof record.lastActiveAt === "number" && record.lastActiveAt > 0
    ? record.lastActiveAt
    : record.lastSeenAt;

  const timeSinceActive =
    typeof record.idleMs === "number" && record.idleMs >= 0
      ? Math.max(0, timeSinceSeen + record.idleMs)
      : Math.max(0, now - lastActive);

  if (timeSinceActive <= PRESENCE_ONLINE_MAX_AGE_MS) {
    return "online";
  }

  if (timeSinceActive <= PRESENCE_IDLE_MAX_AGE_MS) {
    return "idle";
  }

  return "offline";
}

/**
 * Retorna uma descricao textual legivel para acessibilidade e tooltip
 */
export function formatPresenceTooltip(
  status: PresenceStatus,
  record?: { lastActiveAt?: number; lastSeenAt?: number } | null,
  now = Date.now()
): string {
  switch (status) {
    case "online":
      return "Online — Ativo agora";
    case "idle": {
      const last = record?.lastActiveAt || record?.lastSeenAt;
      if (last) {
        const mins = Math.max(5, Math.floor((now - last) / 60000));
        return `Inativo há ${mins} min (conectado)`;
      }
      return "Inativo (conectado)";
    }
    case "offline":
    default:
      return "Offline";
  }
}

/**
 * Carrega a base local de presenca
 */
export function loadPresenceStore(): PresenceStore {
  if (typeof window === "undefined") {
    return { players: {}, updatedAt: 0 };
  }
  try {
    const raw = localStorage.getItem(PRESENCE_STORAGE_KEY);
    if (!raw) return { players: {}, updatedAt: 0 };
    return JSON.parse(raw) as PresenceStore;
  } catch {
    return { players: {}, updatedAt: 0 };
  }
}

/**
 * Salva e notifica os componentes do aplicativo
 */
export function savePresenceStore(store: PresenceStore): void {
  if (typeof window === "undefined") return;
  try {
    store.updatedAt = Date.now();
    localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent(PRESENCE_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

/**
 * Registra atividade do usuario local na aba (mouse, tecla, toque, scroll)
 */
let lastLocalActivityTimestamp = Date.now();

export function recordLocalUserActivity(now = Date.now()): void {
  lastLocalActivityTimestamp = now;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(LOCAL_LAST_ACTIVE_KEY, String(now));
    } catch {
      // ignore
    }
  }
}

export function getLocalUserLastActiveAt(): number {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(LOCAL_LAST_ACTIVE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > lastLocalActivityTimestamp) {
          lastLocalActivityTimestamp = parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  return lastLocalActivityTimestamp;
}

/**
 * Atualiza o pulso de presenca de um jogador
 */
export function recordPlayerHeartbeat(
  playerId: string,
  data?: {
    playfabId?: string;
    nick?: string;
    nickNormalized?: string;
    lastActiveAt?: number;
    lastSeenAt?: number;
    idleMs?: number;
    disconnected?: boolean;
  }
): PlayerPresenceRecord | null {
  if (!playerId) return null;
  const store = loadPresenceStore();
  const now = Date.now();
  const existing = store.players[playerId];

  const lastSeenAt = data?.disconnected ? 0 : (data?.lastSeenAt ?? now);
  const lastActiveAt = data?.lastActiveAt ?? existing?.lastActiveAt ?? lastSeenAt;
  const resolvedNick = data?.nick ?? existing?.nick;
  const resolvedSlug =
    data?.nickNormalized ||
    (resolvedNick ? nickSlug(resolvedNick) : existing?.nickNormalized);
  const idleMs =
    typeof data?.idleMs === "number"
      ? Math.max(0, data.idleMs)
      : lastSeenAt > 0
        ? Math.max(0, lastSeenAt - lastActiveAt)
        : 0;

  const record: PlayerPresenceRecord = {
    playerId,
    playfabId: data?.playfabId ?? existing?.playfabId,
    nick: resolvedNick,
    nickNormalized: resolvedSlug,
    lastSeenAt,
    lastActiveAt,
    idleMs,
    disconnected: Boolean(data?.disconnected),
  };

  store.players[playerId] = record;
  if (resolvedSlug) {
    store.players[resolvedSlug] = record;
    store.players[`pf_${resolvedSlug}`] = record;
  }
  if (record.playfabId) {
    store.players[record.playfabId] = record;
  }

  savePresenceStore(store);
  return record;
}

/* --------------------- Sincronização em Nuvem (PlayFab SharedGroup) --------------------- */

let presenceGroupCreated = false;
let lastPresenceCloudSyncAt = 0;
let inFlightPresenceSync: Promise<void> | null = null;
const observedRemotePulses = new Map<
  string,
  { remoteSeenAt: number; observedLocalAt: number }
>();

async function callPresencePlayFab(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  if (typeof window === "undefined" || !isPlayFabConfigured()) return null;
  const titleId = getPlayFabTitleId();
  if (!titleId) return null;
  const session = loadStoredSession();
  const ticket = session?.sessionTicket ?? (await getAdminPlayFabTicket());
  if (!ticket) return null;

  try {
    const res = await fetch(`https://${titleId}.playfabapi.com/Client/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Authorization": ticket,
      },
      body: JSON.stringify({ TitleId: titleId, ...body }),
    });
    const json = (await res.json()) as { data?: Record<string, unknown> };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Envia o pulso de presença do jogador atual para o SharedGroup global no PlayFab.
 */
export async function pushPresenceToPlayFab(record: PlayerPresenceRecord): Promise<void> {
  if (typeof window === "undefined" || !isPlayFabConfigured()) return;
  try {
    if (!presenceGroupCreated) {
      await callPresencePlayFab("CreateSharedGroup", {
        SharedGroupId: PRESENCE_SHARED_GROUP_ID,
      });
      presenceGroupCreated = true;
    }
    const slug =
      record.nickNormalized ||
      (record.nick ? nickSlug(record.nick) : nickSlug(record.playerId));
    const key = `pres_${slug || record.playerId}`;
    await callPresencePlayFab("UpdateSharedGroupData", {
      SharedGroupId: PRESENCE_SHARED_GROUP_ID,
      Data: {
        [key]: JSON.stringify({
          playerId: record.playerId,
          playfabId: record.playfabId,
          nick: record.nick,
          nickNormalized: slug,
          lastSeenAt: record.lastSeenAt,
          lastActiveAt: record.lastActiveAt,
          idleMs:
            typeof record.idleMs === "number"
              ? record.idleMs
              : Math.max(0, record.lastSeenAt - record.lastActiveAt),
          disconnected: Boolean(record.disconnected),
        }),
      },
      Permission: "Public",
    });
  } catch {
    /* ignore network issues */
  }
}

/**
 * Baixa os registros de presença de todos os alunos na nuvem (PlayFab),
 * normalizando os timestamps para eliminar problemas de relógio desajustado entre dispositivos.
 */
export async function syncPresenceFromPlayFab(force = false): Promise<void> {
  if (typeof window === "undefined" || !isPlayFabConfigured()) return;
  const now = Date.now();
  if (!force && now - lastPresenceCloudSyncAt < 4000) return;
  if (inFlightPresenceSync) return inFlightPresenceSync;

  inFlightPresenceSync = (async () => {
    try {
      lastPresenceCloudSyncAt = Date.now();
      if (!presenceGroupCreated) {
        await callPresencePlayFab("CreateSharedGroup", {
          SharedGroupId: PRESENCE_SHARED_GROUP_ID,
        });
        presenceGroupCreated = true;
      }

      const res = (await callPresencePlayFab("GetSharedGroupData", {
        SharedGroupId: PRESENCE_SHARED_GROUP_ID,
      })) as {
        Data?: Record<string, { Value: string; LastUpdated?: string }>;
      } | null;

      if (!res?.Data) return;

      const store = loadPresenceStore();
      const localSessionId = loadStoredSession()?.playerId;
      const syncNow = Date.now();
      let changed = false;

      for (const [key, entry] of Object.entries(res.Data)) {
        if (!entry?.Value) continue;
        try {
          const remote = JSON.parse(entry.Value) as Partial<PlayerPresenceRecord>;
          if (!remote.playerId && !remote.nickNormalized && !remote.nick) continue;

          const slug =
            remote.nickNormalized ||
            (remote.nick ? nickSlug(remote.nick) : key.replace(/^pres_/, ""));
          const pId = remote.playerId || `pf_${slug}`;

          // Não sobrescreve o pulso local da própria sessão ativa neste navegador
          if (
            localSessionId &&
            (pId === localSessionId || slug === localSessionId)
          ) {
            continue;
          }

          if (remote.disconnected || !remote.lastSeenAt || remote.lastSeenAt <= 0) {
            const offRec: PlayerPresenceRecord = {
              playerId: pId,
              playfabId: remote.playfabId,
              nick: remote.nick,
              nickNormalized: slug,
              lastSeenAt: 0,
              lastActiveAt: 0,
              idleMs: 0,
              disconnected: true,
            };
            store.players[pId] = offRec;
            if (slug) {
              store.players[slug] = offRec;
              store.players[`pf_${slug}`] = offRec;
            }
            if (remote.playfabId) {
              store.players[remote.playfabId] = offRec;
            }
            changed = true;
            continue;
          }

          // Calcula há quanto tempo o pulso foi enviado sem depender do fuso/relógio local do dispositivo do aluno:
          // 1. Prioriza o timestamp oficial do servidor PlayFab (`LastUpdated`)
          // 2. Caso ausente, rastreia quando `remote.lastSeenAt` mudou localmente ou usa a diferença direta se relógios próximos
          const obsKey = slug || pId;
          const prevObs = observedRemotePulses.get(obsKey);
          if (!prevObs || prevObs.remoteSeenAt !== remote.lastSeenAt) {
            observedRemotePulses.set(obsKey, {
              remoteSeenAt: remote.lastSeenAt,
              observedLocalAt: syncNow,
            });
          }

          let seenAgeMs = Math.max(0, syncNow - remote.lastSeenAt);
          if (entry.LastUpdated) {
            const serverMs = Date.parse(entry.LastUpdated);
            if (!Number.isNaN(serverMs)) {
              seenAgeMs = Math.max(0, syncNow - serverMs);
            }
          } else if (prevObs && prevObs.remoteSeenAt !== remote.lastSeenAt) {
            seenAgeMs = 0;
          } else if (prevObs && Math.abs(syncNow - remote.lastSeenAt) > 10 * 60 * 1000) {
            seenAgeMs = Math.max(0, syncNow - prevObs.observedLocalAt);
          }

          const remoteIdleMs =
            typeof remote.idleMs === "number" && remote.idleMs >= 0
              ? remote.idleMs
              : Math.max(0, remote.lastSeenAt - (remote.lastActiveAt ?? remote.lastSeenAt));

          const normalizedSeenAt = Math.max(1, syncNow - seenAgeMs);
          const normalizedActiveAt = Math.max(1, normalizedSeenAt - remoteIdleMs);

          const normalizedRec: PlayerPresenceRecord = {
            playerId: pId,
            playfabId: remote.playfabId,
            nick: remote.nick,
            nickNormalized: slug,
            lastSeenAt: normalizedSeenAt,
            lastActiveAt: normalizedActiveAt,
            idleMs: remoteIdleMs,
            disconnected: false,
          };

          store.players[pId] = normalizedRec;
          if (slug) {
            store.players[slug] = normalizedRec;
            store.players[`pf_${slug}`] = normalizedRec;
          }
          if (remote.playfabId) {
            store.players[remote.playfabId] = normalizedRec;
          }
          changed = true;
        } catch {
          /* ignore malformed entry */
        }
      }

      if (changed) {
        savePresenceStore(store);
      }
    } finally {
      inFlightPresenceSync = null;
    }
  })();

  return inFlightPresenceSync;
}

/**
 * Obtem os dados de presenca de um jogador, checando o storage local por ID, PlayFabId ou Nick,
 * e tambem a loja do lobby X1 (que sincroniza com o PlayFab na nuvem).
 */
export function getPlayerPresenceData(
  playerId: string,
  hints?: { playfabId?: string; nick?: string; nickNormalized?: string },
): PlayerPresenceRecord | null {
  if (!playerId && !hints?.nickNormalized && !hints?.nick && !hints?.playfabId) {
    return null;
  }

  const cleanId = (playerId || "").trim();
  const slugHint =
    hints?.nickNormalized ||
    (hints?.nick ? nickSlug(hints.nick) : cleanId.startsWith("pf_") ? cleanId.slice(3) : nickSlug(cleanId));

  const candidateKeys = new Set<string>();
  if (cleanId) {
    candidateKeys.add(cleanId);
    candidateKeys.add(cleanId.toLowerCase());
  }
  if (hints?.playfabId) candidateKeys.add(hints.playfabId);
  if (slugHint) {
    candidateKeys.add(slugHint);
    candidateKeys.add(`pf_${slugHint}`);
  }

  // 1. Verificar presence store por chaves diretas e por varredura de alias
  const store = loadPresenceStore();
  let rec: PlayerPresenceRecord | undefined;

  for (const k of candidateKeys) {
    const candidate = store.players[k];
    if (candidate && (!rec || candidate.lastSeenAt > rec.lastSeenAt)) {
      rec = candidate;
    }
  }

  if (!rec) {
    for (const item of Object.values(store.players)) {
      if (!item) continue;
      const itemSlug = item.nickNormalized || (item.nick ? nickSlug(item.nick) : "");
      if (
        (cleanId && (item.playerId === cleanId || item.playfabId === cleanId)) ||
        (hints?.playfabId && item.playfabId === hints.playfabId) ||
        (slugHint && itemSlug === slugHint)
      ) {
        if (!rec || item.lastSeenAt > rec.lastSeenAt) {
          rec = item;
        }
      }
    }
  }

  // 2. Se nao encontrou ou dados estao desatualizados, verificar x1-lobby-state
  if (typeof window !== "undefined") {
    try {
      const x1Raw = localStorage.getItem("desafios-x1-lobby-state-v1");
      if (x1Raw) {
        const x1Store = JSON.parse(x1Raw) as {
          players?: Record<
            string,
            { playerId?: string; lastSeenAt?: number; lastActiveAt?: number; nick?: string }
          >;
        };
        for (const [k, x1Player] of Object.entries(x1Store.players ?? {})) {
          if (!x1Player || typeof x1Player.lastSeenAt !== "number") continue;
          const x1Slug = x1Player.nick ? nickSlug(x1Player.nick) : "";
          const matches =
            candidateKeys.has(k) ||
            (x1Player.playerId && candidateKeys.has(x1Player.playerId)) ||
            (slugHint && x1Slug === slugHint);
          if (matches && (!rec || x1Player.lastSeenAt > rec.lastSeenAt)) {
            rec = {
              playerId: cleanId || x1Player.playerId || k,
              nick: x1Player.nick ?? rec?.nick,
              nickNormalized: x1Slug || slugHint,
              lastSeenAt: x1Player.lastSeenAt,
              lastActiveAt: x1Player.lastActiveAt ?? x1Player.lastSeenAt,
            };
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return rec ?? null;
}

export type PresenceTargetInput =
  | string
  | {
      id: string;
      playfabId?: string;
      nick?: string;
      nickNormalized?: string;
    };

/**
 * Calcula o sumario de presenca para uma lista de IDs ou perfis de jogadores
 */
export function computePresenceSummary(
  targets: PresenceTargetInput[],
  now = Date.now()
): { online: number; idle: number; offline: number; total: number } {
  let online = 0;
  let idle = 0;
  let offline = 0;

  for (const item of targets) {
    const data =
      typeof item === "string"
        ? getPlayerPresenceData(item)
        : getPlayerPresenceData(item.id, {
            playfabId: item.playfabId,
            nick: item.nick,
            nickNormalized: item.nickNormalized,
          });
    const status = computePresenceStatus(data, now);
    if (status === "online") online++;
    else if (status === "idle") idle++;
    else offline++;
  }

  return {
    online,
    idle,
    offline,
    total: targets.length,
  };
}

/**
 * Hook para obter a presenca reativa de um jogador com atualizacao automatica
 */
export function usePlayerPresence(
  playerId?: string,
  hints?: { playfabId?: string; nick?: string; nickNormalized?: string },
): {
  status: PresenceStatus;
  tooltip: string;
  data: PlayerPresenceRecord | null;
} {
  const [data, setData] = useState<PlayerPresenceRecord | null>(() =>
    playerId ? getPlayerPresenceData(playerId, hints) : null
  );
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!playerId) {
      setData(null);
      return;
    }

    const refresh = () => {
      setData(getPlayerPresenceData(playerId, hints));
    };

    refresh();

    // Reagir a eventos de presenca e lobby X1
    window.addEventListener(PRESENCE_UPDATED_EVENT, refresh);
    window.addEventListener("desafios:x1-lobby-updated", refresh);
    window.addEventListener("storage", refresh);

    // Timer para recomputar limiares de tempo (5 min / 10 min) e sincronizar da nuvem
    const timer = setInterval(() => {
      setTick((t) => t + 1);
      void syncPresenceFromPlayFab();
      refresh();
    }, 10000);

    return () => {
      window.removeEventListener(PRESENCE_UPDATED_EVENT, refresh);
      window.removeEventListener("desafios:x1-lobby-updated", refresh);
      window.removeEventListener("storage", refresh);
      clearInterval(timer);
    };
  }, [playerId, hints?.playfabId, hints?.nick, hints?.nickNormalized]);

  const status = computePresenceStatus(data);
  const tooltip = formatPresenceTooltip(status, data);

  return { status, tooltip, data };
}

/**
 * Hook que rastreia a atividade do jogador logado e emite heartbeats periodicos locais e na nuvem PlayFab
 */
export function usePresenceTracker(player?: {
  playerId?: string;
  playfabId?: string;
  nick?: string;
  nickNormalized?: string;
} | null) {
  useEffect(() => {
    // Mesmo sem jogador logado (ou enquanto o ADM observa), sincroniza presenças da nuvem periodicamente
    void syncPresenceFromPlayFab(true);
    const cloudPollId = setInterval(() => {
      void syncPresenceFromPlayFab();
    }, 10000);

    if (!player?.playerId) {
      return () => clearInterval(cloudPollId);
    }

    const playerId = player.playerId;
    const playfabId = player.playfabId;
    const nick = player.nick;
    const nickNormalized = player.nickNormalized || (nick ? nickSlug(nick) : undefined);

    let lastRecordedActivity = Date.now();
    recordLocalUserActivity(lastRecordedActivity);

    //Pulso imediato e periodico a cada 12 segundos (local + nuvem PlayFab)
    const pulse = (disconnected = false) => {
      const now = Date.now();
      const activeAt = getLocalUserLastActiveAt();
      const idleMs = Math.max(0, now - activeAt);
      const rec = recordPlayerHeartbeat(playerId, {
        playfabId,
        nick,
        nickNormalized,
        lastActiveAt: activeAt,
        lastSeenAt: disconnected ? 0 : now,
        idleMs,
        disconnected,
      });
      if (rec) {
        void pushPresenceToPlayFab(rec);
      }
      if (!disconnected) {
        void syncPresenceFromPlayFab();
      }
    };

    // Throttle de interacao do usuario (no maximo uma gravacao a cada 3 segundos)
    const onUserInteraction = () => {
      const now = Date.now();
      const wasIdleOrStale = now - lastRecordedActivity >= 60_000;
      if (now - lastRecordedActivity >= 3000) {
        lastRecordedActivity = now;
        recordLocalUserActivity(now);
        // Se estava inativo há 1+ min e voltou a interagir, envia pulso imediato para ficar Verde na hora
        if (wasIdleOrStale) {
          pulse(false);
        } else {
          recordPlayerHeartbeat(playerId, {
            playfabId,
            nick,
            nickNormalized,
            lastActiveAt: now,
            lastSeenAt: now,
            idleMs: 0,
          });
        }
      }
    };

    const onVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        const now = Date.now();
        lastRecordedActivity = now;
        recordLocalUserActivity(now);
        pulse(false);
      }
    };

    const onPageHide = () => {
      pulse(true);
    };

    window.addEventListener("pointerdown", onUserInteraction, { passive: true });
    window.addEventListener("keydown", onUserInteraction, { passive: true });
    window.addEventListener("touchstart", onUserInteraction, { passive: true });
    window.addEventListener("scroll", onUserInteraction, { passive: true });
    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);

    pulse(false);
    const intervalId = setInterval(() => pulse(false), 12000);

    return () => {
      window.removeEventListener("pointerdown", onUserInteraction);
      window.removeEventListener("keydown", onUserInteraction);
      window.removeEventListener("touchstart", onUserInteraction);
      window.removeEventListener("scroll", onUserInteraction);
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      clearInterval(intervalId);
      clearInterval(cloudPollId);
    };
  }, [player?.playerId, player?.playfabId, player?.nick, player?.nickNormalized]);
}

