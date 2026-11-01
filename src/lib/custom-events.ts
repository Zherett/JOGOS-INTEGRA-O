import { GAME_NAMES, type GameId } from "./game-storage.ts";

export type EventBonusType = "dobro_xp" | "xp_1_5x" | "aumentar_limite_diario" | "personalizado";

export interface SpecialEvent {
  id: string;
  title: string;
  description: string;
  scope: "todos" | GameId;
  bonusType: EventBonusType;
  /** Ex: 2000 when bonusType is "aumentar_limite_diario" */
  bonusValue?: number;
  /** Multiplicador de XP (ex: 2x, 1.5x, 3x) */
  xpMultiplier?: number;
  /** Limite de XP por partida/atividade (padrão normal: 20 XP, evento pode elevar para 50 XP, etc.) */
  matchXpCap?: number;
  /** Limite diário de XP geral (padrão normal: 1.000 XP, evento pode elevar para 2.500 XP, etc.) */
  dailyXpCap?: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  linkedMedalId?: string | null;
  objectiveDescription?: string | null;
  createdAt: string;
}

const SPECIAL_EVENTS_KEY = "desafios-special-events-v1";

export function loadSpecialEvents(): SpecialEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SPECIAL_EVENTS_KEY);
    return raw ? (JSON.parse(raw) as SpecialEvent[]) : [];
  } catch {
    return [];
  }
}

export function saveSpecialEvents(events: SpecialEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SPECIAL_EVENTS_KEY, JSON.stringify(events));
    // Trigger custom event so reactive UI (like menu and cards) can refresh immediately
    window.dispatchEvent(new CustomEvent("desafios:special-events-updated"));
  } catch {
    // ignore
  }
}

export function isEventActive(event: SpecialEvent, now = new Date()): boolean {
  if (!event.active) return false;
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return now >= start && now <= end;
}

export function getActiveSpecialEvents(
  events = loadSpecialEvents(),
  now = new Date(),
): SpecialEvent[] {
  return events.filter((e) => isEventActive(e, now));
}

export interface ActiveEventBonuses {
  multiplier: number;
  matchXpCap: number; // default 20 XP
  dailyXpCap: number; // default 1000 XP
  activeEventNames: string[];
}

/**
 * Calculates combined 3 lines of bonuses (XP multiplier, match XP cap, daily XP cap)
 * for a specific game (or "todos") from all currently active special events.
 */
export function getActiveEventBonuses(
  gameId: GameId,
  baseDailyCap = 1000,
  baseMatchCap = 20,
  activeEvents = getActiveSpecialEvents(),
  now = new Date(),
): ActiveEventBonuses {
  let multiplier = 1;
  let matchXpCap = baseMatchCap;
  let dailyXpCap = baseDailyCap;
  const activeEventNames: string[] = [];

  for (const ev of activeEvents) {
    if (ev.scope === "todos" || ev.scope === gameId) {
      if (!activeEventNames.includes(ev.title)) {
        activeEventNames.push(ev.title);
      }

      // Linha 1: Multiplicador de XP
      let mult = ev.xpMultiplier ?? 1;
      if (ev.bonusType === "dobro_xp" && mult < 2) mult = 2;
      if (ev.bonusType === "xp_1_5x" && mult < 1.5) mult = 1.5;
      if (mult > multiplier) multiplier = mult;

      // Linha 2: Limite de XP por partida
      if (ev.matchXpCap && ev.matchXpCap > matchXpCap) {
        matchXpCap = ev.matchXpCap;
      }

      // Linha 3: Limite diário de XP
      const dCap = ev.dailyXpCap ?? (ev.bonusType === "aumentar_limite_diario" ? ev.bonusValue : undefined);
      if (dCap && dCap > dailyXpCap) {
        dailyXpCap = dCap;
      }
    }
  }

  // Combine bonuses from active recurring events
  const activeRecurring = getActiveRecurringEvents(undefined, now);
  for (const ev of activeRecurring) {
    if (ev.scope === "todos" || ev.scope === gameId) {
      if (!activeEventNames.includes(ev.title)) {
        activeEventNames.push(ev.title);
      }
      const mult = ev.xpMultiplier ?? 1;
      if (mult > multiplier) multiplier = mult;
      if (ev.matchXpCap && ev.matchXpCap > matchXpCap) {
        matchXpCap = ev.matchXpCap;
      }
      if (ev.dailyXpCap && ev.dailyXpCap > dailyXpCap) {
        dailyXpCap = ev.dailyXpCap;
      }
    }
  }

  return { multiplier, matchXpCap, dailyXpCap, activeEventNames };
}

/**
 * Calculates XP multiplier from active events for a specific game (or "todos").
 */
export function calculateEventXpMultiplier(
  gameId: GameId,
  activeEvents = getActiveSpecialEvents(),
): { multiplier: number; eventName?: string } {
  const bonuses = getActiveEventBonuses(gameId, 1000, 20, activeEvents);
  return {
    multiplier: bonuses.multiplier,
    eventName: bonuses.activeEventNames[0],
  };
}

/**
 * Calculates effective daily XP cap taking into account any active "aumentar_limite_diario" events.
 */
export function getEffectiveDailyXpCap(
  baseCap = 1000,
  activeEvents = getActiveSpecialEvents(),
): number {
  let maxCap = baseCap;
  for (const ev of activeEvents) {
    const dCap = ev.dailyXpCap ?? (ev.bonusType === "aumentar_limite_diario" ? ev.bonusValue : undefined);
    if (dCap && dCap > maxCap) {
      maxCap = dCap;
    }
  }
  return maxCap;
}

export function formatEventRemainingTime(endsAt: string, now = new Date()): string {
  const end = new Date(endsAt);
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return "Encerrado";

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) {
    const remHours = diffHours % 24;
    return `${diffDays}d ${remHours}h restantes`;
  }
  if (diffHours >= 1) {
    const remMin = diffMin % 60;
    return `${diffHours}h ${remMin}m restantes`;
  }
  if (diffMin >= 1) {
    return `${diffMin} min restantes`;
  }
  return "Menos de 1 min";
}

export function createSpecialEvent(args: {
  title: string;
  description: string;
  scope: "todos" | GameId;
  bonusType: EventBonusType;
  bonusValue?: number;
  xpMultiplier?: number;
  matchXpCap?: number;
  dailyXpCap?: number;
  durationHours: number;
  linkedMedalId?: string | null;
  objectiveDescription?: string | null;
  now?: Date;
}): SpecialEvent {
  const now = args.now ?? new Date();
  const endsAt = new Date(now.getTime() + args.durationHours * 3600 * 1000).toISOString();

  const ev: SpecialEvent = {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: args.title.trim(),
    description: args.description.trim(),
    scope: args.scope,
    bonusType: args.bonusType,
    bonusValue: args.bonusValue,
    xpMultiplier: args.xpMultiplier,
    matchXpCap: args.matchXpCap,
    dailyXpCap: args.dailyXpCap,
    startsAt: now.toISOString(),
    endsAt,
    active: true,
    linkedMedalId: args.linkedMedalId ?? null,
    objectiveDescription: args.objectiveDescription?.trim() ?? null,
    createdAt: now.toISOString(),
  };

  const list = loadSpecialEvents();
  list.unshift(ev);
  saveSpecialEvents(list);
  return ev;
}

/* ---------------------- EVENTOS RECORRENTES ---------------------- */

export interface RecurringEvent {
  id: string;
  title: string;
  description: string;
  scope: "todos" | GameId;
  /** Dias da semana: 0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado */
  daysOfWeek: number[];
  /** Datas específicas no formato YYYY-MM-DD */
  specificDates: string[];
  /** Multiplicador de XP (ex: 2x, 1.5x, 3x) */
  xpMultiplier?: number;
  /** Limite de XP por partida/atividade */
  matchXpCap?: number;
  /** Limite diário de XP geral */
  dailyXpCap?: number;
  active: boolean;
  linkedMedalId?: string | null;
  objectiveDescription?: string | null;
  createdAt: string;
}

export const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo", short: "Dom" },
  { value: 1, label: "Segunda-feira", short: "Seg" },
  { value: 2, label: "Terça-feira", short: "Ter" },
  { value: 3, label: "Quarta-feira", short: "Qua" },
  { value: 4, label: "Quinta-feira", short: "Qui" },
  { value: 5, label: "Sexta-feira", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
];

export const DEFAULT_RECURRING_EVENTS: RecurringEvent[] = [
  {
    id: "rec_sabado_xp",
    title: "+50% de XP do SÁBADO",
    description: "jogue qualquer partida e ganhe mais 50% de XP e um limite diário de 1500 XP",
    scope: "todos",
    daysOfWeek: [6], // 6 = Sábado
    specificDates: [],
    xpMultiplier: 1.5,
    matchXpCap: 30,
    dailyXpCap: 1500,
    active: true,
    linkedMedalId: null,
    objectiveDescription: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rec_domingo_xp",
    title: "DOBRO DE XP DO DOMINGO",
    description: "Aproveite o domingo com dobro de XP em todos os jogos e limite diário expandido para 2000 XP!",
    scope: "todos",
    daysOfWeek: [0], // 0 = Domingo
    specificDates: [],
    xpMultiplier: 2.0,
    matchXpCap: 40,
    dailyXpCap: 2000,
    active: true,
    linkedMedalId: null,
    objectiveDescription: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const RECURRING_EVENTS_KEY = "desafios-recurring-events-v1";

export function loadRecurringEvents(): RecurringEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECURRING_EVENTS_KEY);
    if (raw === null) {
      localStorage.setItem(RECURRING_EVENTS_KEY, JSON.stringify(DEFAULT_RECURRING_EVENTS));
      return [...DEFAULT_RECURRING_EVENTS];
    }
    return JSON.parse(raw) as RecurringEvent[];
  } catch {
    return [];
  }
}

export function saveRecurringEvents(events: RecurringEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECURRING_EVENTS_KEY, JSON.stringify(events));
    window.dispatchEvent(new CustomEvent("desafios:special-events-updated"));
  } catch {
    // ignore
  }
}

export function isRecurringEventActive(event: RecurringEvent, now = new Date()): boolean {
  if (!event.active) return false;
  const currentDay = now.getDay();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayDateStr = `${year}-${month}-${day}`;

  const matchesDayOfWeek = (event.daysOfWeek ?? []).includes(currentDay);
  const matchesDate = (event.specificDates ?? []).includes(todayDateStr);

  return matchesDayOfWeek || matchesDate;
}

export function getActiveRecurringEvents(
  events = loadRecurringEvents(),
  now = new Date(),
): RecurringEvent[] {
  return events.filter((e) => isRecurringEventActive(e, now));
}

export function createRecurringEvent(args: {
  title: string;
  description: string;
  scope: "todos" | GameId;
  daysOfWeek: number[];
  specificDates: string[];
  xpMultiplier?: number;
  matchXpCap?: number;
  dailyXpCap?: number;
  linkedMedalId?: string | null;
  objectiveDescription?: string | null;
  now?: Date;
}): RecurringEvent {
  const now = args.now ?? new Date();
  const ev: RecurringEvent = {
    id: `rec_ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: args.title.trim(),
    description: args.description.trim(),
    scope: args.scope,
    daysOfWeek: args.daysOfWeek,
    specificDates: args.specificDates,
    xpMultiplier: args.xpMultiplier,
    matchXpCap: args.matchXpCap,
    dailyXpCap: args.dailyXpCap,
    active: true,
    linkedMedalId: args.linkedMedalId ?? null,
    objectiveDescription: args.objectiveDescription?.trim() ?? null,
    createdAt: now.toISOString(),
  };

  const list = loadRecurringEvents();
  list.unshift(ev);
  saveRecurringEvents(list);
  return ev;
}

/* ---------------------- MODELO UNIFICADO DE EXIBIÇÃO NO MENU ---------------------- */

export interface ActiveEventDisplayItem {
  id: string;
  title: string;
  description: string;
  scope: "todos" | GameId;
  badgeLabel: string;
  remainingTime: string;
  bonusTitle: string;
  bonusHighlight: string;
  bonusScopeText: string;
  linkedMedalId?: string | null;
  objectiveDescription?: string | null;
  isRecurring: boolean;
}

/**
 * Retorna todos os eventos ativos no momento (pontuais criados pelo ADM + recorrentes por dia da semana/data)
 * formatados para exibição imediata no banner com carrossel da tela inicial.
 */
export function getAllActiveEvents(
  specialEvents = getActiveSpecialEvents(),
  recurringEvents = getActiveRecurringEvents(),
  now = new Date(),
): ActiveEventDisplayItem[] {
  const items: ActiveEventDisplayItem[] = [];

  // 1. Eventos Pontuais (SpecialEvent)
  for (const ev of specialEvents) {
    let highlight = "⚡ Bônus Especial";
    if (ev.dailyXpCap) {
      highlight = `🚀 Limite ${ev.dailyXpCap} XP/dia`;
    } else if (ev.bonusType === "aumentar_limite_diario") {
      highlight = `🚀 Limite ${ev.bonusValue ?? 2000} XP/dia`;
    } else if (ev.xpMultiplier && ev.xpMultiplier > 1) {
      highlight =
        ev.xpMultiplier === 2
          ? "🔥 Dobro de XP (2x XP)"
          : `⚡ +${Math.round((ev.xpMultiplier - 1) * 100)}% de XP (${ev.xpMultiplier}x)`;
    } else if (ev.bonusType === "dobro_xp") {
      highlight = "🔥 Dobro de XP (2x XP)";
    } else if (ev.bonusType === "xp_1_5x") {
      highlight = "⚡ 1.5x de XP (+50%)";
    }

    items.push({
      id: ev.id,
      title: ev.title,
      description: ev.description || "Aproveite os bônus especiais em vigor nesta temporada!",
      scope: ev.scope,
      badgeLabel: "EVENTO ESPECIAL ATIVO",
      remainingTime: formatEventRemainingTime(ev.endsAt, now),
      bonusTitle: "BÔNUS DO EVENTO",
      bonusHighlight: highlight,
      bonusScopeText: ev.scope === "todos" ? "Todos os Jogos" : (GAME_NAMES[ev.scope] ?? ev.scope),
      linkedMedalId: ev.linkedMedalId,
      objectiveDescription: ev.objectiveDescription,
      isRecurring: false,
    });
  }

  // 2. Eventos Recorrentes (RecurringEvent)
  for (const ev of recurringEvents) {
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    let highlight = "⚡ Bônus Ativo";
    if (ev.dailyXpCap) {
      highlight = `🚀 Limite ${ev.dailyXpCap} XP/dia`;
    } else if (ev.xpMultiplier && ev.xpMultiplier > 1) {
      highlight =
        ev.xpMultiplier === 2
          ? "🔥 Dobro de XP (2x XP)"
          : `⚡ +${Math.round((ev.xpMultiplier - 1) * 100)}% de XP (${ev.xpMultiplier}x)`;
    } else if (ev.matchXpCap) {
      highlight = `🎯 Limite ${ev.matchXpCap} XP/partida`;
    }

    items.push({
      id: ev.id,
      title: ev.title,
      description: ev.description || "Aproveite os bônus automáticos deste dia!",
      scope: ev.scope,
      badgeLabel: "EVENTO ESPECIAL ATIVO",
      remainingTime: formatEventRemainingTime(endOfDay.toISOString(), now),
      bonusTitle: "BÔNUS DO EVENTO",
      bonusHighlight: highlight,
      bonusScopeText: ev.scope === "todos" ? "Todos os Jogos" : (GAME_NAMES[ev.scope] ?? ev.scope),
      linkedMedalId: ev.linkedMedalId,
      objectiveDescription: ev.objectiveDescription,
      isRecurring: true,
    });
  }

  return items;
}
