import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeTop5HoldMetrics,
  evaluateTournamentStandings,
  getWeekInfo,
  resolveWeeklyTournamentGame,
  TOURNAMENT_DAILY_ENTRIES_LIMIT,
  TOURNAMENT_DAILY_EXTRA_XP_CAP,
  TOURNAMENT_MIN_LEVEL,
  TOURNAMENT_XP_PER_ENTRY,
  type TournamentPlayerRecord,
} from "./weekly-tournament.ts";
import {
  isX1WindowOpen,
  X1_DAILY_EXTRA_XP_CAP,
  X1_MIN_LEVEL,
} from "./player-profile.ts";

describe("Torneio Semanal Ranqueado (Nível 3+) e Regras da Arena X1 (Nível 5+, 07h–19h)", () => {
  it("valida os requisitos de nível e limites de XP extra diário (100 XP X1 + 100 XP Ranqueada em 10 entradas)", () => {
    assert.equal(X1_MIN_LEVEL, 5);
    assert.equal(TOURNAMENT_MIN_LEVEL, 3);
    assert.equal(X1_DAILY_EXTRA_XP_CAP, 100);
    assert.equal(TOURNAMENT_DAILY_EXTRA_XP_CAP, 100);
    assert.equal(TOURNAMENT_DAILY_ENTRIES_LIMIT, 10);
    assert.equal(TOURNAMENT_DAILY_ENTRIES_LIMIT * TOURNAMENT_XP_PER_ENTRY, 100);
  });

  it("verifica a janela de funcionamento da Arena X1 (aberta das 07:00 às 19:00 e fechada fora desse horário)", () => {
    const morning = new Date("2026-10-31T08:30:00");
    const afternoon = new Date("2026-10-31T18:59:00");
    const night = new Date("2026-10-31T19:05:00");
    const dawn = new Date("2026-10-31T06:30:00");

    assert.equal(isX1WindowOpen(morning, 7, 19, false), true);
    assert.equal(isX1WindowOpen(afternoon, 7, 19, false), true);
    assert.equal(isX1WindowOpen(night, 7, 19, false), false);
    assert.equal(isX1WindowOpen(dawn, 7, 19, false), false);
    // Quando o ADM ativa o forceOpen, abre em qualquer horário
    assert.equal(isX1WindowOpen(night, 7, 19, true), true);
  });

  it("seleciona o jogo da semana automaticamente ou respeita o override do ADM e vira no domingo às 23:59", () => {
    const g1 = resolveWeeklyTournamentGame(100, null);
    const g2 = resolveWeeklyTournamentGame(101, null);
    assert.notEqual(g1, g2);
    assert.equal(resolveWeeklyTournamentGame(100, "rpg"), "rpg");

    // Sábado e Domingo às 23:59 pertencem à mesma semana; Segunda 00:00 inicia nova semana
    const saturday = new Date("2026-10-31T14:00:00");
    const sundayNight = new Date("2026-11-01T23:59:00");
    const mondayMorning = new Date("2026-11-02T00:01:00");
    assert.equal(getWeekInfo(saturday).weekKey, getWeekInfo(sundayNight).weekKey);
    assert.notEqual(getWeekInfo(sundayNight).weekKey, getWeekInfo(mondayMorning).weekKey);
  });

  it("calcula bônus de permanência no Top 5 (quem se mantém na colocação por mais tempo ganha pontos extras)", () => {
    const now = 1_000_000_000;
    const oneHourAgo = now - 60 * 60_000; // 60 minutos no Top 5 -> +12 pts de permanência

    const metrics = computeTop5HoldMetrics(
      { activeTop5Since: oneHourAgo, accumulatedTop5Ms: 0 },
      now,
    );
    assert.equal(metrics.holdMinutes, 60);
    assert.equal(metrics.holdBonusPoints, 12);

    const records: Record<string, TournamentPlayerRecord> = {
      p1: {
        playerId: "p1",
        nick: "VeteranoTop",
        fullName: "ALUNO UM",
        school: "Raimundo Bezerra",
        level: 5,
        bestScore: 100,
        totalEntries: 4,
        activeTop5Since: oneHourAgo,
        accumulatedTop5Ms: 0,
        updatedAt: now - 10_000,
      },
      p2: {
        playerId: "p2",
        nick: "NovatoRecente",
        fullName: "ALUNO DOIS",
        school: "Elisângela Litaiff",
        level: 4,
        bestScore: 105, // 5 pontos a mais no jogo, porém 0 minutos de permanência
        totalEntries: 1,
        activeTop5Since: now,
        accumulatedTop5Ms: 0,
        updatedAt: now,
      },
    };

    const res = evaluateTournamentStandings(records, now);
    // p1 tem 100 + 12 (permanência) = 112 pts ranqueados, superando p2 (105 pts) por se manter na colocação!
    assert.equal(res.top5[0].playerId, "p1");
    assert.equal(res.top5[0].totalRankedPoints, 112);
    assert.equal(res.top5[0].projectedMedal.tier, "gold");
    assert.equal(res.top5[1].playerId, "p2");
    assert.equal(res.top5[1].projectedMedal.tier, "silver");
  });

  it("separa o Top 5 por Etapa (Faixa Etária) para que um jogador de 20 anos (3ª Etapa) não desbanque um aluno de 10 anos (1ª Etapa)", () => {
    const now = 1_000_000_000;
    const records: Record<string, TournamentPlayerRecord> = {
      kid10: {
        playerId: "kid10",
        nick: "Aluno10Anos",
        fullName: "CRIANCA DEZ ANOS",
        school: "Elisângela Litaiff",
        age: 10,
        stage: "etapa_1",
        level: 4,
        bestScore: 120,
        totalEntries: 3,
        activeTop5Since: now,
        accumulatedTop5Ms: 0,
        updatedAt: now,
      },
      adult20: {
        playerId: "adult20",
        nick: "Jovem20Anos",
        fullName: "JOVEM VINTE ANOS",
        school: "Raimundo Bezerra",
        age: 20,
        stage: "etapa_3",
        level: 8,
        bestScore: 350,
        totalEntries: 5,
        activeTop5Since: now,
        accumulatedTop5Ms: 0,
        updatedAt: now,
      },
    };

    const etapa1 = evaluateTournamentStandings(records, now, "etapa_1");
    const etapa3 = evaluateTournamentStandings(records, now, "etapa_3");
    const geral = evaluateTournamentStandings(records, now, "TODAS");

    // Na 1ª Etapa (até 11 anos), o aluno de 10 anos é 1º colocado (Ouro)!
    assert.equal(etapa1.top5.length, 1);
    assert.equal(etapa1.top5[0].playerId, "kid10");
    assert.equal(etapa1.top5[0].rank, 1);
    assert.equal(etapa1.top5[0].projectedMedal.tier, "gold");

    // Na 3ª Etapa (15+ anos), o jovem de 20 anos é 1º colocado da faixa dele
    assert.equal(etapa3.top5.length, 1);
    assert.equal(etapa3.top5[0].playerId, "adult20");
    assert.equal(etapa3.top5[0].rank, 1);

    // E no Ranking Geral secundário ("TODAS"), ambos aparecem listados
    assert.equal(geral.top5.length, 2);
  });
});
