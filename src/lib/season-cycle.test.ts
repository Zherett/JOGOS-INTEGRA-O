import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeSeasonDates,
  extendSeasonDate,
  getSeasonProgress,
  toDatetimeLocalString,
  parseDatetimeLocal,
  SEASON_DURATION_PRESETS,
} from "./season-cycle.ts";

describe("Gestão de Ciclos de Temporada (season-cycle)", () => {
  it("contém os presets padrão de 7, 14 e 30 dias", () => {
    assert.deepEqual(SEASON_DURATION_PRESETS, [7, 14, 30]);
  });

  it("calcula datas de início e término com encerramento às 23:59:59", () => {
    const baseDate = new Date("2026-11-01T00:00:00");
    const { start, end } = computeSeasonDates(baseDate, 14);

    assert.equal(start.getTime(), baseDate.getTime());
    assert.equal(end.getHours(), 23);
    assert.equal(end.getMinutes(), 59);
    assert.equal(end.getSeconds(), 59);
    // De 01/11 até 14/11 são exatamente 14 dias (01, 02 ... 14)
    assert.equal(end.getDate(), 14);
  });

  it("estende o prazo da temporada mantendo 23:59:59 e empurrando a data final", () => {
    const currentEnd = new Date("2026-11-14T23:59:59.999Z");
    const extendedEnd = extendSeasonDate(currentEnd, 7);

    assert.equal(extendedEnd.getHours(), 23);
    assert.equal(extendedEnd.getMinutes(), 59);
    const addedDays = Math.round((extendedEnd.getTime() - currentEnd.getTime()) / (24 * 60 * 60 * 1000));
    assert.equal(addedDays, 7);
  });

  it("calcula progresso, dias decorridos e contagem regressiva da temporada", () => {
    const start = new Date("2026-11-01T00:00:00Z");
    const end = new Date("2026-11-15T23:59:59Z");
    // Simulando dia 08 (metade do ciclo)
    const midPoint = new Date("2026-11-08T12:00:00Z").getTime();

    const info = getSeasonProgress(start.toISOString(), end.toISOString(), midPoint);
    assert.equal(info.isExpired, false);
    assert.equal(info.totalDays, 15);
    assert.ok(info.elapsedDays >= 7);
    assert.ok(info.remainingDays >= 7);
    assert.ok(info.progressPercent >= 45 && info.progressPercent <= 55);
    assert.match(info.formattedCountdown, /Termina em 7d/);
  });

  it("detecta temporada concluída quando a data atual ultrapassa a data final", () => {
    const start = new Date("2026-11-01T00:00:00Z");
    const end = new Date("2026-11-10T23:59:59Z");
    const afterEnd = new Date("2026-11-11T00:00:00Z").getTime();

    const info = getSeasonProgress(start.toISOString(), end.toISOString(), afterEnd);
    assert.equal(info.isExpired, true);
    assert.equal(info.remainingDays, 0);
    assert.equal(info.progressPercent, 100);
    assert.match(info.formattedCountdown, /Temporada Concluída/);
  });

  it("formata e converte datas para input datetime-local com segurança", () => {
    const d = new Date(2026, 10, 15, 14, 30); // 15 de Novembro de 2026, 14:30
    const str = toDatetimeLocalString(d);
    assert.equal(str, "2026-11-15T14:30");

    const parsed = parseDatetimeLocal(str);
    assert.ok(parsed);
    assert.equal(parsed?.getFullYear(), 2026);
    assert.equal(parsed?.getMonth(), 10);
    assert.equal(parsed?.getDate(), 15);
  });
});
