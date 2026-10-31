import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isEventActive,
  calculateEventXpMultiplier,
  getEffectiveDailyXpCap,
  getActiveEventBonuses,
  formatEventRemainingTime,
  isRecurringEventActive,
  type SpecialEvent,
  type RecurringEvent,
} from "./custom-events.ts";

describe("Eventos Personalizados Criados pelo Administrador", () => {
  it("detecta se um evento está ativo dentro do período de início e fim", () => {
    const now = new Date("2026-10-31T12:00:00Z");
    const activeEv: SpecialEvent = {
      id: "ev_1",
      title: "Fim de Semana 2x XP",
      description: "Ganhe o dobro de XP em todos os jogos!",
      scope: "todos",
      bonusType: "dobro_xp",
      startsAt: "2026-10-31T00:00:00Z",
      endsAt: "2026-11-01T23:59:59Z",
      active: true,
      createdAt: "2026-10-31T00:00:00Z",
    };

    assert.equal(isEventActive(activeEv, now), true);

    // Evento desativado pelo ADM
    const inactiveEv = { ...activeEv, active: false };
    assert.equal(isEventActive(inactiveEv, now), false);

    // Evento que ainda não começou
    const futureEv = {
      ...activeEv,
      startsAt: "2026-11-05T00:00:00Z",
      endsAt: "2026-11-06T00:00:00Z",
    };
    assert.equal(isEventActive(futureEv, now), false);

    // Evento expirado
    const expiredEv = {
      ...activeEv,
      startsAt: "2026-10-20T00:00:00Z",
      endsAt: "2026-10-25T00:00:00Z",
    };
    assert.equal(isEventActive(expiredEv, now), false);
  });

  it("calcula o multiplicador de XP para todos os jogos ou para jogo específico", () => {
    const evTodos: SpecialEvent = {
      id: "ev_all",
      title: "Festival da SEMED",
      description: "",
      scope: "todos",
      bonusType: "dobro_xp",
      startsAt: "2026-10-31T00:00:00Z",
      endsAt: "2026-11-01T23:59:59Z",
      active: true,
      createdAt: "2026-10-31T00:00:00Z",
    };

    const res = calculateEventXpMultiplier("logica", [evTodos]);
    assert.equal(res.multiplier, 2);
    assert.equal(res.eventName, "Festival da SEMED");

    // Evento específico para outro jogo não afeta este
    const evCartesiano: SpecialEvent = {
      id: "ev_cart",
      title: "Desafio Cartesiano",
      description: "",
      scope: "cartesiano",
      bonusType: "dobro_xp",
      startsAt: "2026-10-31T00:00:00Z",
      endsAt: "2026-11-01T23:59:59Z",
      active: true,
      createdAt: "2026-10-31T00:00:00Z",
    };

    const resLogica = calculateEventXpMultiplier("logica", [evCartesiano]);
    assert.equal(resLogica.multiplier, 1);

    const resCartesiano = calculateEventXpMultiplier("cartesiano", [evCartesiano]);
    assert.equal(resCartesiano.multiplier, 2);
  });

  it("sobrescreve o limite diário de XP caso haja evento de aumento", () => {
    const evCap: SpecialEvent = {
      id: "ev_cap",
      title: "Mega Limite de XP",
      description: "",
      scope: "todos",
      bonusType: "aumentar_limite_diario",
      bonusValue: 2500,
      startsAt: "2026-10-31T00:00:00Z",
      endsAt: "2026-11-01T23:59:59Z",
      active: true,
      createdAt: "2026-10-31T00:00:00Z",
    };

    const cap = getEffectiveDailyXpCap(1000, [evCap]);
    assert.equal(cap, 2500);
  });

  it("combina até 3 linhas simultâneas de bônus em eventos especiais (multiplicador, limite por partida e limite diário)", () => {
    const multiBonusEv: SpecialEvent = {
      id: "ev_triple",
      title: "Super Fim de Semana Turbinado",
      description: "2x XP, limite por partida de 50 XP e limite diário de 2500 XP!",
      scope: "todos",
      bonusType: "personalizado",
      xpMultiplier: 2,
      matchXpCap: 50,
      dailyXpCap: 2500,
      startsAt: "2026-10-31T00:00:00Z",
      endsAt: "2026-11-01T23:59:59Z",
      active: true,
      createdAt: "2026-10-31T00:00:00Z",
    };

    const bonuses = getActiveEventBonuses("logica", 1000, 20, [multiBonusEv]);
    assert.equal(bonuses.multiplier, 2);
    assert.equal(bonuses.matchXpCap, 50);
    assert.equal(bonuses.dailyXpCap, 2500);
    assert.ok(bonuses.activeEventNames.includes("Super Fim de Semana Turbinado"));
  });

  it("formata o tempo restante de forma amigável em português", () => {
    const now = new Date("2026-10-31T12:00:00Z");
    assert.equal(
      formatEventRemainingTime("2026-11-02T15:00:00Z", now),
      "2d 3h restantes",
    );
    assert.equal(
      formatEventRemainingTime("2026-10-31T14:30:00Z", now),
      "2h 30m restantes",
    );
    assert.equal(
      formatEventRemainingTime("2026-10-31T12:15:00Z", now),
      "15 min restantes",
    );
    assert.equal(
      formatEventRemainingTime("2026-10-31T11:59:00Z", now),
      "Encerrado",
    );
  });

  it("ativa eventos recorrentes por dias da semana e datas específicas", () => {
    // 2026-10-31 is a Saturday (getDay() === 6)
    const saturday = new Date("2026-10-31T12:00:00Z");
    // 2026-11-02 is a Monday (getDay() === 1)
    const monday = new Date("2026-11-02T12:00:00Z");

    const weekendEv: RecurringEvent = {
      id: "rec_1",
      title: "Fim de Semana Premiado",
      description: "Bônus nos finais de semana",
      scope: "todos",
      daysOfWeek: [6, 0], // Saturday and Sunday
      specificDates: [],
      xpMultiplier: 2,
      matchXpCap: 50,
      dailyXpCap: 2500,
      active: true,
      createdAt: "2026-10-31T00:00:00Z",
    };

    assert.equal(isRecurringEventActive(weekendEv, saturday), true);
    assert.equal(isRecurringEventActive(weekendEv, monday), false);

    // Specific date override (e.g. holiday on Monday 2026-11-02)
    const holidayEv: RecurringEvent = {
      ...weekendEv,
      daysOfWeek: [],
      specificDates: ["2026-11-02"],
    };
    assert.equal(isRecurringEventActive(holidayEv, monday), true);
    assert.equal(isRecurringEventActive(holidayEv, saturday), false);
  });
});
