// Arena de Desafio X1 Online (1v1 Versus Mode)
// Browser-safe state machine, room/presence synchronization (PlayFab SharedGroupData + BroadcastChannel + localStorage),
// deterministic room codes, and 1v1 Tug-of-War / Score-Race evaluation.

import { GAME_NAMES, type GameId } from "./game-storage.ts";
import { getPlayFabTitleId, isPlayFabConfigured, loadStoredSession } from "./playfab.ts";
import type { AgeStageId } from "./player-profile.ts";

const X1_STORAGE_KEY = "desafios-x1-lobby-state-v1";
const X1_CHANNEL_NAME = "desafios-x1-broadcast-v1";
const LOBBY_SHARED_GROUP_ID = "X1_LOBBY_SEMED_V1";

export const X1_MATCH_DURATION_SEC = 90;
export const X1_ROBOT_INITIAL_HP = 10;
export const X1_VICTORY_BONUS_XP = 50;
export const X1_PARTICIPATION_BONUS_XP = 20;

export type X1RoomStatus = "waiting" | "countdown" | "playing" | "finished";

export interface X1OnlinePlayer {
  playerId: string;
  nick: string;
  fullName: string;
  school: string;
  level: number;
  age?: number;
  stage?: AgeStageId;
  lastSeenAt: number; // epoch ms
  lastActiveAt?: number; // epoch ms
  inRoomCode?: string | null;
}

export interface X1PlayerSideState {
  playerId: string;
  nick: string;
  school: string;
  level: number;
  age?: number;
  stage?: AgeStageId;
  score: number;
  correct: number;
  wrong: number;
  hp: number;
  maxHp: number;
  finished: boolean;
  isBot?: boolean;
  updatedAt: number;
}

export interface X1ChallengeInvite {
  id: string;
  roomCode: string;
  fromNick: string;
  fromSchool: string;
  toPlayerId: string;
  gameId: GameId;
  createdAt: number;
}

export interface X1MatchLogEntry {
  id: string;
  roomCode: string;
  gameId: GameId;
  gameName: string;
  hostNick: string;
  hostSchool: string;
  hostScore: number;
  guestNick: string;
  guestSchool: string;
  guestScore: number;
  winnerId: string | "draw";
  winnerNick: string;
  finishedAt: string;
  read?: boolean;
}

const X1_MATCH_HISTORY_KEY = "desafios-x1-match-history-v1";

export function loadX1MatchHistory(): X1MatchLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(X1_MATCH_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as X1MatchLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveX1MatchHistory(entries: X1MatchLogEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(X1_MATCH_HISTORY_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent("desafios:x1-history-updated"));
  } catch {
    // ignore
  }
}

export function recordX1MatchFinished(room: X1Room): void {
  if (!room.guest || !room.winnerId) return;
  const history = loadX1MatchHistory();
  if (history.some((h) => h.roomCode === room.code)) return;

  let winnerNick = "Empate";
  if (room.winnerId === room.host.playerId) {
    winnerNick = room.host.nick;
  } else if (room.winnerId === room.guest.playerId) {
    winnerNick = room.guest.nick;
  }

  const entry: X1MatchLogEntry = {
    id: `x1_match_${room.code}_${Date.now()}`,
    roomCode: room.code,
    gameId: room.gameId,
    gameName: GAME_NAMES[room.gameId] ?? room.gameId,
    hostNick: room.host.nick,
    hostSchool: room.host.school,
    hostScore: room.host.score,
    guestNick: room.guest.nick,
    guestSchool: room.guest.school,
    guestScore: room.guest.score,
    winnerId: room.winnerId,
    winnerNick,
    finishedAt: new Date(room.finishedAt ?? Date.now()).toISOString(),
    read: false,
  };

  history.unshift(entry);
  saveX1MatchHistory(history.slice(0, 100));
}

export function markAllX1MatchesRead(): void {
  const history = loadX1MatchHistory();
  const updated = history.map((h) => ({ ...h, read: true }));
  saveX1MatchHistory(updated);
}

export function clearX1MatchHistory(): void {
  saveX1MatchHistory([]);
}

export interface X1Room {
  code: string;
  gameId: GameId;
  status: X1RoomStatus;
  seed: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  durationSec: number;
  /** Blue share (0..100) for the 1v1 Tug-of-War bar (50 = balanced center) */
  blueShare: number;
  host: X1PlayerSideState;
  guest: X1PlayerSideState | null;
  winnerId: string | "draw" | null;
}

interface X1LobbyStore {
  players: Record<string, X1OnlinePlayer>;
  rooms: Record<string, X1Room>;
  invites: X1ChallengeInvite[];
  updatedAt: number;
}

/* --------------------- Pure Logic & Evaluators (Testable) --------------------- */

export interface RotatedX1GameInfo {
  currentGame: GameId;
  nextGame: GameId;
  secondsUntilNextRotation: number;
  totalGamesCount: number;
  gameList: GameId[];
}

/**
 * Calculates current active game in the X1 Arena and countdown to next rotation.
 * If 1 game is selected, it stays fixed.
 * If 2 or 3 games are selected, rotates deterministically every `rotationMinutes` (default: 10).
 */
export function getActiveRotatedX1Game(args: {
  availableGames?: GameId[];
  rotationMinutes?: number;
  now?: Date;
}): RotatedX1GameInfo {
  const games: GameId[] =
    args.availableGames && args.availableGames.length > 0
      ? args.availableGames.slice(0, 3)
      : ["rpg", "logica", "porcentagem"];

  const rotationMins = Math.max(1, args.rotationMinutes ?? 10);
  const rotationMs = rotationMins * 60 * 1000;
  const nowMs = (args.now ?? new Date()).getTime();

  if (games.length === 1) {
    return {
      currentGame: games[0],
      nextGame: games[0],
      secondsUntilNextRotation: rotationMins * 60,
      totalGamesCount: 1,
      gameList: games,
    };
  }

  const intervalIndex = Math.floor(nowMs / rotationMs);
  const currentIdx = ((intervalIndex % games.length) + games.length) % games.length;
  const nextIdx = (currentIdx + 1) % games.length;
  const elapsedInInterval = nowMs % rotationMs;
  const msRemaining = rotationMs - elapsedInInterval;

  return {
    currentGame: games[currentIdx],
    nextGame: games[nextIdx],
    secondsUntilNextRotation: Math.max(0, Math.floor(msRemaining / 1000)),
    totalGamesCount: games.length,
    gameList: games,
  };
}

/** Generates a 4-digit numeric room code (e.g., `"4829"`). */
export function generateRoomCode(existingCodes: string[] = []): string {
  for (let i = 0; i < 30; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (!existingCodes.includes(code)) return code;
  }
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Calculates the 1v1 Tug-of-War blue share (`0..100`) for Score-Race games
 * based on the live score difference between Host (Blue) and Guest (Red).
 */
export function computeScoreRaceBlueShare(hostScore: number, guestScore: number): number {
  const diff = hostScore - guestScore;
  // Each 10 points of lead shifts the bar by ~6%, clamped between 8% and 92%
  const shifted = 50 + diff * 0.6;
  return Math.max(8, Math.min(92, Math.round(shifted)));
}

/**
 * Applies a 1v1 Robot Battle answer to a room from either the `"host"` (Blue, left)
 * or `"guest"` (Red, right) perspective.
 * - Host correct answer pushes `blueShare` right (`+18%`) and deals `1` HP damage to Guest (or `3` HP on `100%` Blue Super Hit!).
 * - Guest correct answer pushes `blueShare` left (`-18%`, i.e., Red grows!) and deals `1` HP damage to Host (or `3` HP on `0%` Blue / `100%` Red Super Hit!).
 */
export function applyX1RobotBattleAnswer(args: {
  room: X1Room;
  role: "host" | "guest";
  isCorrect: boolean;
}): {
  room: X1Room;
  isSuperHit: boolean;
  damageDealt: number;
} {
  const next: X1Room = {
    ...args.room,
    host: { ...args.room.host },
    guest: args.room.guest ? { ...args.room.guest } : null,
  };

  if (!next.guest || next.status !== "playing") {
    return { room: next, isSuperHit: false, damageDealt: 0 };
  }

  const me = args.role === "host" ? next.host : next.guest;
  const opp = args.role === "host" ? next.guest : next.host;
  const now = Date.now();
  me.updatedAt = now;

  if (!args.isCorrect) {
    me.wrong += 1;
    me.score = Math.max(0, me.score - 5);
    // Penalty pushes the bar 10% toward the opponent
    next.blueShare =
      args.role === "host"
        ? Math.max(0, next.blueShare - 10)
        : Math.min(100, next.blueShare + 10);
    return { room: next, isSuperHit: false, damageDealt: 0 };
  }

  me.correct += 1;
  let isSuperHit = false;
  let damageDealt = 1;

  if (args.role === "host") {
    const rawBlue = next.blueShare + 18;
    if (rawBlue >= 100) {
      isSuperHit = true;
      damageDealt = 3;
      next.blueShare = 55;
      me.score += 35;
    } else {
      next.blueShare = rawBlue;
      me.score += 15;
    }
  } else {
    // Guest is Red (pushing blueShare toward 0)
    const rawBlue = next.blueShare - 18;
    if (rawBlue <= 0) {
      isSuperHit = true;
      damageDealt = 3;
      next.blueShare = 45;
      me.score += 35;
    } else {
      next.blueShare = rawBlue;
      me.score += 15;
    }
  }

  opp.hp = Math.max(0, opp.hp - damageDealt);
  if (opp.hp <= 0) {
    next.status = "finished";
    next.finishedAt = now;
    next.winnerId = me.playerId;
    next.blueShare = args.role === "host" ? 100 : 0;
  }

  return { room: next, isSuperHit, damageDealt };
}

/**
 * Determines the winner of an X1 room when time expires or both players finish.
 */
export function resolveX1Winner(room: X1Room): string | "draw" {
  if (!room.guest) return room.host.playerId;
  if (room.gameId === "rpg") {
    if (room.host.hp !== room.guest.hp) {
      return room.host.hp > room.guest.hp ? room.host.playerId : room.guest.playerId;
    }
  }
  if (room.host.score !== room.guest.score) {
    return room.host.score > room.guest.score ? room.host.playerId : room.guest.playerId;
  }
  if (room.host.correct !== room.guest.correct) {
    return room.host.correct > room.guest.correct ? room.host.playerId : room.guest.playerId;
  }
  return "draw";
}

/* --------------------- Store & Real-Time Transport Layer --------------------- */

let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(X1_CHANNEL_NAME);
      channel.onmessage = () => {
        notifyListeners();
      };
    } catch {
      channel = null;
    }
  }
  return channel;
}

function notifyListeners() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeX1Updates(fn: () => void): () => void {
  listeners.add(fn);
  getChannel();
  const onStorage = (e: StorageEvent) => {
    if (e.key === X1_STORAGE_KEY) notifyListeners();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function loadStore(): X1LobbyStore {
  const empty: X1LobbyStore = { players: {}, rooms: {}, invites: [], updatedAt: Date.now() };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(X1_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<X1LobbyStore>;
    const now = Date.now();

    // Prune stale players (> 90s inactive) and old rooms (> 15 min)
    const players: Record<string, X1OnlinePlayer> = {};
    for (const [id, p] of Object.entries(parsed.players ?? {})) {
      if (now - p.lastSeenAt < 90_000) players[id] = p;
    }

    const rooms: Record<string, X1Room> = {};
    for (const [code, r] of Object.entries(parsed.rooms ?? {})) {
      if (now - r.createdAt < 15 * 60_000) rooms[code] = r;
    }

    const invites = (parsed.invites ?? []).filter((inv) => now - inv.createdAt < 120_000);

    return { players, rooms, invites, updatedAt: parsed.updatedAt ?? now };
  } catch {
    return empty;
  }
}

function saveStore(store: X1LobbyStore) {
  if (typeof window === "undefined") return;
  store.updatedAt = Date.now();
  try {
    window.localStorage.setItem(X1_STORAGE_KEY, JSON.stringify(store));
    getChannel()?.postMessage({ type: "sync", at: store.updatedAt });
  } catch {
    /* ignore */
  }
  notifyListeners();
}

/* --------------------- PlayFab SharedGroupData Cloud Sync --------------------- */

async function callPlayFabSharedGroup(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  if (!isPlayFabConfigured()) return null;
  const session = loadStoredSession();
  const titleId = getPlayFabTitleId();
  if (!session?.sessionTicket || !titleId) return null;

  try {
    const res = await fetch(`https://${titleId}.playfabapi.com/Client/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Authorization": session.sessionTicket,
      },
      body: JSON.stringify({ TitleId: titleId, ...body }),
    });
    const json = (await res.json()) as { data?: Record<string, unknown>; error?: string };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function syncX1WithPlayFabCloud(activeRoomCode?: string | null): Promise<void> {
  if (!isPlayFabConfigured()) return;
  const store = loadStore();

  // 1. Ensure Lobby SharedGroup exists and sync active rooms/players
  await callPlayFabSharedGroup("CreateSharedGroup", {
    SharedGroupId: LOBBY_SHARED_GROUP_ID,
  });

  const remoteLobby = (await callPlayFabSharedGroup("GetSharedGroupData", {
    SharedGroupId: LOBBY_SHARED_GROUP_ID,
  })) as { Data?: Record<string, { Value: string }> } | null;

  let changed = false;
  if (remoteLobby?.Data?.LobbySnapshot?.Value) {
    try {
      const remoteStore = JSON.parse(remoteLobby.Data.LobbySnapshot.Value) as Partial<X1LobbyStore>;
      const now = Date.now();
      for (const [id, p] of Object.entries(remoteStore.players ?? {})) {
        if (now - p.lastSeenAt < 90_000) {
          const local = store.players[id];
          if (!local || p.lastSeenAt > local.lastSeenAt) {
            store.players[id] = p;
            changed = true;
          }
        }
      }
      for (const [code, r] of Object.entries(remoteStore.rooms ?? {})) {
        if (now - r.createdAt < 15 * 60_000) {
          const local = store.rooms[code];
          const remoteTime = Math.max(r.host.updatedAt, r.guest?.updatedAt ?? 0, r.createdAt);
          const localTime = local
            ? Math.max(local.host.updatedAt, local.guest?.updatedAt ?? 0, local.createdAt)
            : 0;
          if (!local || remoteTime > localTime) {
            store.rooms[code] = r;
            changed = true;
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Push merged snapshot
  await callPlayFabSharedGroup("UpdateSharedGroupData", {
    SharedGroupId: LOBBY_SHARED_GROUP_ID,
    Data: {
      LobbySnapshot: JSON.stringify({
        players: store.players,
        rooms: store.rooms,
        invites: store.invites,
      }),
    },
    Permission: "Public",
  });

  if (activeRoomCode && store.rooms[activeRoomCode]) {
    const roomGroupId = `X1_ROOM_${activeRoomCode}`;
    const remoteRoomData = (await callPlayFabSharedGroup("GetSharedGroupData", {
      SharedGroupId: roomGroupId,
    })) as { Data?: Record<string, { Value: string }> } | null;

    if (remoteRoomData?.Data?.Room?.Value) {
      try {
        const remoteRoom = JSON.parse(remoteRoomData.Data.Room.Value) as X1Room;
        const localRoom = store.rooms[activeRoomCode];
        const remoteUpdated = Math.max(
          remoteRoom.host.updatedAt,
          remoteRoom.guest?.updatedAt ?? 0,
        );
        const localUpdated = Math.max(
          localRoom.host.updatedAt,
          localRoom.guest?.updatedAt ?? 0,
        );
        if (remoteUpdated > localUpdated) {
          store.rooms[activeRoomCode] = remoteRoom;
          changed = true;
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (changed) {
    saveStore(store);
  }
}

async function pushRoomToPlayFab(room: X1Room) {
  if (!isPlayFabConfigured()) return;
  const roomGroupId = `X1_ROOM_${room.code}`;
  await callPlayFabSharedGroup("CreateSharedGroup", { SharedGroupId: roomGroupId });
  await callPlayFabSharedGroup("UpdateSharedGroupData", {
    SharedGroupId: roomGroupId,
    Data: { Room: JSON.stringify(room) },
    Permission: "Public",
  });
  void syncX1WithPlayFabCloud(room.code);
}

/* --------------------- Public Lobby & Room Operations --------------------- */

export function heartbeatOnlinePlayer(player: {
  playerId: string;
  nick: string;
  fullName: string;
  school: string;
  level: number;
  age?: number;
  stage?: AgeStageId;
  inRoomCode?: string | null;
  lastActiveAt?: number;
}) {
  const store = loadStore();
  const now = Date.now();
  const existing = store.players[player.playerId];
  store.players[player.playerId] = {
    ...player,
    lastSeenAt: now,
    lastActiveAt: player.lastActiveAt ?? existing?.lastActiveAt ?? now,
  };
  saveStore(store);
}

export function getX1LobbySnapshot(currentPlayerId?: string) {
  const store = loadStore();
  const onlinePlayers = Object.values(store.players).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  const openRooms = Object.values(store.rooms)
    .filter((r) => r.status === "waiting")
    .sort((a, b) => b.createdAt - a.createdAt);
  const myInvites = currentPlayerId
    ? store.invites.filter((inv) => inv.toPlayerId === currentPlayerId)
    : [];

  return {
    onlinePlayers,
    openRooms,
    myInvites,
  };
}

export function getX1Room(code: string): X1Room | null {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const store = loadStore();
  return store.rooms[clean] ?? null;
}

export function createX1Room(args: {
  host: {
    playerId: string;
    nick: string;
    school: string;
    level: number;
    age?: number;
    stage?: AgeStageId;
  };
  gameId: GameId;
  inviteTargetPlayerId?: string;
}): X1Room {
  const store = loadStore();
  const code = generateRoomCode(Object.keys(store.rooms));
  const now = Date.now();

  const room: X1Room = {
    code,
    gameId: args.gameId,
    status: "waiting",
    seed: Math.floor(Math.random() * 1_000_000),
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    durationSec: X1_MATCH_DURATION_SEC,
    blueShare: 50,
    host: {
      playerId: args.host.playerId,
      nick: args.host.nick,
      school: args.host.school,
      level: args.host.level,
      age: args.host.age,
      stage: args.host.stage,
      score: 0,
      correct: 0,
      wrong: 0,
      hp: X1_ROBOT_INITIAL_HP,
      maxHp: X1_ROBOT_INITIAL_HP,
      finished: false,
      updatedAt: now,
    },
    guest: null,
    winnerId: null,
  };

  store.rooms[code] = room;

  if (args.inviteTargetPlayerId) {
    store.invites.push({
      id: `inv_${now}_${code}`,
      roomCode: code,
      fromNick: args.host.nick,
      fromSchool: args.host.school,
      toPlayerId: args.inviteTargetPlayerId,
      gameId: args.gameId,
      createdAt: now,
    });
  }

  saveStore(store);
  void pushRoomToPlayFab(room);
  return room;
}

export function dismissX1Invite(inviteId: string) {
  const store = loadStore();
  store.invites = store.invites.filter((i) => i.id !== inviteId);
  saveStore(store);
}

export function joinX1Room(args: {
  code: string;
  guest: { playerId: string; nick: string; school: string; level: number; isBot?: boolean };
}): { room: X1Room | null; error: string | null } {
  const clean = args.code.trim().toUpperCase();
  const store = loadStore();
  const room = store.rooms[clean];

  if (!room) {
    return { room: null, error: "Sala não encontrada. Verifique o código de 4 dígitos." };
  }
  if (room.host.playerId === args.guest.playerId) {
    return { room, error: null };
  }
  if (room.guest && room.guest.playerId !== args.guest.playerId && room.status !== "waiting") {
    return { room: null, error: "Esta sala já está cheia e em andamento." };
  }

  const now = Date.now();
  room.guest = {
    playerId: args.guest.playerId,
    nick: args.guest.nick,
    school: args.guest.school,
    level: args.guest.level,
    score: 0,
    correct: 0,
    wrong: 0,
    hp: X1_ROBOT_INITIAL_HP,
    maxHp: X1_ROBOT_INITIAL_HP,
    finished: false,
    isBot: args.guest.isBot,
    updatedAt: now,
  };
  room.status = "playing";
  room.startedAt = now;
  room.blueShare = 50;

  // Remove any pending invites for this room
  store.invites = store.invites.filter((inv) => inv.roomCode !== clean);
  store.rooms[clean] = room;
  saveStore(store);
  void pushRoomToPlayFab(room);

  return { room, error: null };
}

/**
 * Updates live score / progress for a player in a Score-Race X1 match.
 */
export function updateX1PlayerProgress(args: {
  code: string;
  playerId: string;
  score: number;
  correct: number;
  wrong: number;
  finished?: boolean;
}): X1Room | null {
  const store = loadStore();
  const room = store.rooms[args.code];
  if (!room) return null;

  const isHost = room.host.playerId === args.playerId;
  const side = isHost ? room.host : room.guest;
  if (!side) return room;

  const now = Date.now();
  side.score = Math.max(0, args.score);
  side.correct = Math.max(0, args.correct);
  side.wrong = Math.max(0, args.wrong);
  if (args.finished) side.finished = true;
  side.updatedAt = now;

  if (room.guest) {
    room.blueShare = computeScoreRaceBlueShare(room.host.score, room.guest.score);
    if (room.host.finished && room.guest.finished && room.status !== "finished") {
      room.status = "finished";
      room.finishedAt = now;
      room.winnerId = resolveX1Winner(room);
      recordX1MatchFinished(room);
    }
  }

  store.rooms[args.code] = room;
  saveStore(store);
  void pushRoomToPlayFab(room);
  return room;
}

/**
 * Submits a True/False answer in a 1v1 Robot Tug-of-War X1 match (`gameId === "rpg"`).
 */
export function submitX1RobotClashAnswer(args: {
  code: string;
  playerId: string;
  isCorrect: boolean;
}): { room: X1Room | null; isSuperHit: boolean; damageDealt: number } {
  const store = loadStore();
  const room = store.rooms[args.code];
  if (!room || !room.guest) {
    return { room: room ?? null, isSuperHit: false, damageDealt: 0 };
  }

  const role: "host" | "guest" = room.host.playerId === args.playerId ? "host" : "guest";
  const res = applyX1RobotBattleAnswer({
    room,
    role,
    isCorrect: args.isCorrect,
  });

  store.rooms[args.code] = res.room;
  saveStore(store);
  if (res.room.status === "finished") {
    recordX1MatchFinished(res.room);
  }
  void pushRoomToPlayFab(res.room);
  return res;
}

export function finishX1RoomByTimeout(code: string): X1Room | null {
  const store = loadStore();
  const room = store.rooms[code];
  if (!room) return null;
  if (room.status !== "finished") {
    room.status = "finished";
    room.finishedAt = Date.now();
    room.winnerId = resolveX1Winner(room);
    recordX1MatchFinished(room);
    store.rooms[code] = room;
    saveStore(store);
    void pushRoomToPlayFab(room);
  }
  return room;
}

export function closeX1Room(code: string) {
  const store = loadStore();
  delete store.rooms[code];
  store.invites = store.invites.filter((i) => i.roomCode !== code);
  saveStore(store);
}
