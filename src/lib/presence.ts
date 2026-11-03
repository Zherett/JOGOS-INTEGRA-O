// Modulo de Presenca e Rastreamento de Status Online dos Jogadores
// Browser-safe: Verde = Online (< 5 min), Cinza = Inativo (5 a 10 min), Vermelho = Offline (> 10 min ou desconectado)

import { useEffect, useState } from "react";

export type PresenceStatus = "online" | "idle" | "offline";

export interface PlayerPresenceRecord {
  playerId: string;
  nick?: string;
  lastSeenAt: number;   // Timestamp em ms do último heartbeat (aba aberta/viva)
  lastActiveAt: number; // Timestamp em ms da última interação do aluno (clique, toque, tecla)
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
export const PRESENCE_UPDATED_EVENT = "desafios:presence-updated";

/**
 * Avalia de forma pura e deterministica o status de presenca de um jogador.
 * - Verde ("online"): fez interacao ha menos de 5 minutos (com heartbeat ativo).
 * - Cinza ("idle"): sem interacao entre 5 e 10 minutos (aba continua aberta).
 * - Vermelho ("offline"): mais de 10 minutos sem interacao OU sem heartbeat recente (aba fechada).
 */
export function computePresenceStatus(
  record?: { lastSeenAt?: number; lastActiveAt?: number } | null,
  now = Date.now()
): PresenceStatus {
  if (!record || typeof record.lastSeenAt !== "number" || record.lastSeenAt <= 0) {
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

  const timeSinceActive = Math.max(0, now - lastActive);

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
  data?: { nick?: string; lastActiveAt?: number; lastSeenAt?: number }
): void {
  if (!playerId) return;
  const store = loadPresenceStore();
  const now = Date.now();
  const existing = store.players[playerId];

  const lastSeenAt = data?.lastSeenAt ?? now;
  const lastActiveAt = data?.lastActiveAt ?? existing?.lastActiveAt ?? lastSeenAt;

  store.players[playerId] = {
    playerId,
    nick: data?.nick ?? existing?.nick,
    lastSeenAt,
    lastActiveAt,
  };

  savePresenceStore(store);
}

/**
 * Obtem os dados de presenca de um jogador, checando o storage local e tambem
 * a loja do lobby X1 (que sincroniza com o PlayFab na nuvem).
 */
export function getPlayerPresenceData(playerId: string): PlayerPresenceRecord | null {
  if (!playerId) return null;

  // 1. Verificar presence store
  const store = loadPresenceStore();
  let rec = store.players[playerId];

  // 2. Se nao encontrou ou dados estao desatualizados, verificar x1-lobby-state
  if (typeof window !== "undefined") {
    try {
      const x1Raw = localStorage.getItem("desafios-x1-lobby-state-v1");
      if (x1Raw) {
        const x1Store = JSON.parse(x1Raw) as { players?: Record<string, { lastSeenAt?: number; lastActiveAt?: number; nick?: string }> };
        const x1Player = x1Store.players?.[playerId];
        if (x1Player && typeof x1Player.lastSeenAt === "number") {
          if (!rec || x1Player.lastSeenAt > rec.lastSeenAt) {
            rec = {
              playerId,
              nick: x1Player.nick ?? rec?.nick,
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

/**
 * Calcula o sumario de presenca para uma lista de IDs de jogadores
 */
export function computePresenceSummary(
  playerIds: string[],
  now = Date.now()
): { online: number; idle: number; offline: number; total: number } {
  let online = 0;
  let idle = 0;
  let offline = 0;

  for (const id of playerIds) {
    const data = getPlayerPresenceData(id);
    const status = computePresenceStatus(data, now);
    if (status === "online") online++;
    else if (status === "idle") idle++;
    else offline++;
  }

  return {
    online,
    idle,
    offline,
    total: playerIds.length,
  };
}

/**
 * Hook para obter a presenca reativa de um jogador com atualizacao automatica
 */
export function usePlayerPresence(playerId?: string): {
  status: PresenceStatus;
  tooltip: string;
  data: PlayerPresenceRecord | null;
} {
  const [data, setData] = useState<PlayerPresenceRecord | null>(() =>
    playerId ? getPlayerPresenceData(playerId) : null
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!playerId) {
      setData(null);
      return;
    }

    const refresh = () => {
      setData(getPlayerPresenceData(playerId));
    };

    refresh();

    // Reagir a eventos de presenca e lobby X1
    window.addEventListener(PRESENCE_UPDATED_EVENT, refresh);
    window.addEventListener("desafios:x1-lobby-updated", refresh);
    window.addEventListener("storage", refresh);

    // Timer para recomputar limiares de tempo (5 min / 10 min) a cada 15 segundos
    const timer = setInterval(() => {
      setTick((t) => t + 1);
      refresh();
    }, 15000);

    return () => {
      window.removeEventListener(PRESENCE_UPDATED_EVENT, refresh);
      window.removeEventListener("desafios:x1-lobby-updated", refresh);
      window.removeEventListener("storage", refresh);
      clearInterval(timer);
    };
  }, [playerId]);

  const status = computePresenceStatus(data);
  const tooltip = formatPresenceTooltip(status, data);

  return { status, tooltip, data };
}

/**
 * Hook que rastreia a atividade do jogador logado e emite heartbeats periodicos
 */
export function usePresenceTracker(player?: {
  playerId?: string;
  nick?: string;
} | null) {
  useEffect(() => {
    if (!player?.playerId) return;

    const playerId = player.playerId;
    const nick = player.nick;

    let lastRecordedActivity = Date.now();
    recordLocalUserActivity(lastRecordedActivity);

    // Throttle de interacao do usuario (no maximo uma gravacao a cada 3 segundos)
    const onUserInteraction = () => {
      const now = Date.now();
      if (now - lastRecordedActivity >= 3000) {
        lastRecordedActivity = now;
        recordLocalUserActivity(now);
      }
    };

    window.addEventListener("pointerdown", onUserInteraction, { passive: true });
    window.addEventListener("keydown", onUserInteraction, { passive: true });
    window.addEventListener("touchstart", onUserInteraction, { passive: true });
    window.addEventListener("scroll", onUserInteraction, { passive: true });

    // Pulso imediato e periodico a cada 15 segundos
    const pulse = () => {
      const activeAt = getLocalUserLastActiveAt();
      recordPlayerHeartbeat(playerId, {
        nick,
        lastActiveAt: activeAt,
        lastSeenAt: Date.now(),
      });
    };

    pulse();
    const intervalId = setInterval(pulse, 15000);

    return () => {
      window.removeEventListener("pointerdown", onUserInteraction);
      window.removeEventListener("keydown", onUserInteraction);
      window.removeEventListener("touchstart", onUserInteraction);
      window.removeEventListener("scroll", onUserInteraction);
      clearInterval(intervalId);
    };
  }, [player?.playerId, player?.nick]);
}

