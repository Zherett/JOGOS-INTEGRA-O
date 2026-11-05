import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeTop5HoldMetrics,
  evaluateTournamentStandings,
  finalizeWeeklyTournamentSeason,
  getTournamentRank,
  getWeekInfo,
  recordWeeklyTournamentAttempt,
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
import { evaluatePlayerMedals } from "./medals-catalog.ts";
import { accumulateTournamentMedal, ensurePlayerSeasonAligned } from "./playfab.ts";

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

  it("calcula corretamente os 19 ranks ranqueados (Bronze I até Mestre 850+) e progressão percentual", () => {
    // Bronze (0 - 90)
    assert.equal(getTournamentRank(0).currentRank.name, "Bronze I");
    assert.equal(getTournamentRank(30).currentRank.name, "Bronze I");
    assert.equal(getTournamentRank(31).currentRank.name, "Bronze II");
    assert.equal(getTournamentRank(60).currentRank.name, "Bronze II");
    assert.equal(getTournamentRank(61).currentRank.name, "Bronze III");
    assert.equal(getTournamentRank(90).currentRank.name, "Bronze III");

    // Prata (91 - 240)
    assert.equal(getTournamentRank(91).currentRank.name, "Prata I");
    assert.equal(getTournamentRank(141).currentRank.name, "Prata II");
    assert.equal(getTournamentRank(191).currentRank.name, "Prata III");

    // Ouro (241 - 450)
    assert.equal(getTournamentRank(241).currentRank.name, "Ouro I");
    assert.equal(getTournamentRank(311).currentRank.name, "Ouro II");
    assert.equal(getTournamentRank(381).currentRank.name, "Ouro III");

    // Platina (451 - 680)
    assert.equal(getTournamentRank(451).currentRank.name, "Platina I");
    assert.equal(getTournamentRank(508).currentRank.name, "Platina II");
    assert.equal(getTournamentRank(565).currentRank.name, "Platina III");
    assert.equal(getTournamentRank(622).currentRank.name, "Platina IV");

    // Diamante (681 - 849)
    assert.equal(getTournamentRank(681).currentRank.name, "Diamante I");
    assert.equal(getTournamentRank(715).currentRank.name, "Diamante II");
    assert.equal(getTournamentRank(749).currentRank.name, "Diamante III");
    assert.equal(getTournamentRank(783).currentRank.name, "Diamante IV");
    assert.equal(getTournamentRank(817).currentRank.name, "Diamante V");

    // Mestre (850+)
    const mestre = getTournamentRank(850);
    assert.equal(mestre.currentRank.name, "Mestre");
    assert.equal(mestre.nextRank, null);
    assert.equal(mestre.progressPercent, 100);

    const mestrePlus = getTournamentRank(1500);
    assert.equal(mestrePlus.currentRank.name, "Mestre");
  });

  it("aplica a regra de pontuação ranqueada (+10 vitória, -5 derrota, -1 por erro, +25 bônus diário de 10 vitórias e piso no 0)", async () => {
    const baseProfile = {
      id: "student_test_1",
      nick: "AlunoRanqueado",
      full_name: "ALUNO TESTE",
      school: "Escola Teste",
      birthdate: "2015-05-10",
      level: 4,
      xp: 400,
      tournamentPoints: 0,
    };

    // 1. Vitória com 10 acertos e 0 erros: +10 pontos
    const r1 = await recordWeeklyTournamentAttempt({
      profile: baseProfile as any,
      score: 100,
      correct: 10,
      wrong: 0,
    });
    assert.equal(r1.pointsDelta, 10);
    assert.equal(r1.newTournamentPoints, 10);
    assert.equal(r1.currentRank.name, "Bronze I");

    // 2. Vitória com 2 erros: +10 - 2 = +8 pontos -> Total 18
    const r2 = await recordWeeklyTournamentAttempt({
      profile: { ...baseProfile, tournamentPoints: 10 } as any,
      score: 80,
      correct: 8,
      wrong: 2,
    });
    assert.equal(r2.pointsDelta, 8);
    assert.equal(r2.newTournamentPoints, 18);

    // 3. Derrota com 1 erro: -5 - 1 = -6 pontos -> Total 12
    const r3 = await recordWeeklyTournamentAttempt({
      profile: { ...baseProfile, tournamentPoints: 18 } as any,
      score: 20,
      correct: 2,
      wrong: 1,
    });
    assert.equal(r3.pointsDelta, -6);
    assert.equal(r3.newTournamentPoints, 12);

    // 4. Piso no zero: perda grande nunca desce abaixo de zero
    const r4 = await recordWeeklyTournamentAttempt({
      profile: { ...baseProfile, tournamentPoints: 2 } as any,
      score: 0,
      correct: 0,
      wrong: 5, // -5 - 5 = -10
    });
    assert.equal(r4.pointsDelta, -10);
    assert.equal(r4.newTournamentPoints, 0); // Floor at 0!

    // 5. Garante que perfis de administradores reais (Josiney / Quemuel) pontuam normalmente e aparecem na classificação
    const rJosiney = await recordWeeklyTournamentAttempt({
      profile: {
        ...baseProfile,
        id: "p_josiney",
        nick: "ZHERET",
        nickNormalized: "josiney",
        isAdmin: true,
        tournamentPoints: 0,
      } as any,
      score: 100,
      correct: 10,
      wrong: 0,
    });
    assert.equal(rJosiney.pointsDelta, 10);
    assert.equal(rJosiney.newTournamentPoints, 10);
    assert.ok(rJosiney.standing !== null);
  });

  it("concede as medalhas de maestria ao alcançar o ápice de cada liga (Bronze III, Prata III, etc)", () => {
    const profBronze3 = {
      id: "p_bronze",
      tournamentPoints: 61,
      unlockedMedals: [],
    };
    const medalsBronze3 = evaluatePlayerMedals({ profile: profBronze3 as any, stats: [] });
    assert.ok(medalsBronze3.some((m) => m.id === "tour_master_bronze"));
    assert.ok(!medalsBronze3.some((m) => m.id === "tour_master_prata"));

    const profPrata3 = {
      id: "p_prata",
      tournamentPoints: 191,
      unlockedMedals: [{ medalId: "tour_master_bronze", earnedAt: "2026-11-01" }],
    };
    const medalsPrata3 = evaluatePlayerMedals({ profile: profPrata3 as any, stats: [] });
    assert.ok(medalsPrata3.some((m) => m.id === "tour_master_prata"));

    const profMestre = {
      id: "p_mestre",
      tournamentPoints: 850,
      unlockedMedals: [],
    };
    const medalsMestre = evaluatePlayerMedals({ profile: profMestre as any, stats: [] });
    assert.ok(medalsMestre.some((m) => m.id === "tour_master_mestre"));
  });

  it("acumula contagem para medalhas semanais repetidas ao invés de duplicar", () => {
    const initialMedals = [
      {
        id: "tour_medal_1",
        weekKey: "2026-W44",
        gameId: "termux" as const,
        rank: 1,
        tier: "gold" as const,
        label: "🥇 Campeão Semanal",
        heldMinutes: 30,
        bonusXpAwarded: 150,
        earnedAt: "2026-11-01T23:59:00Z",
        count: 1,
      },
    ];

    // Ganha outro ouro semanal em semana posterior
    const updated = accumulateTournamentMedal(initialMedals, {
      id: "tour_medal_2",
      weekKey: "2026-W45",
      gameId: "calc" as const,
      rank: 1,
      tier: "gold" as const,
      label: "🥇 Campeão Semanal",
      heldMinutes: 60,
      bonusXpAwarded: 150,
      earnedAt: "2026-11-08T23:59:00Z",
    });

    // Deve ter 1 elemento com count = 2
    assert.equal(updated.length, 1);
    assert.equal(updated[0].count, 2);
    assert.equal(updated[0].heldMinutes, 60);
  });

  it("NÃO concede medalha permanente no meio da semana (apenas projeção temporária com prefixo projected_)", async () => {
    const student = {
      id: "aluno_top1_quarta",
      nick: "AlunoQuarta",
      full_name: "ALUNA QUARTA",
      school: "Escola Centro",
      birthdate: "2015-05-10",
      level: 4,
      xp: 400,
      tournamentPoints: 0,
      tournamentMedals: [],
    };

    const res = await recordWeeklyTournamentAttempt({
      profile: student as any,
      score: 100,
      correct: 10,
      wrong: 0,
    });

    // A medalha projetada gerada possui o prefixo projected_ e NÃO é gravada permanentemente no perfil durante a semana
    assert.ok(res.awardedMedal, "Deve retornar projeção de medalha para o Top 1");
    assert.ok(res.awardedMedal.id.startsWith("projected_"), "Medalha deve ser apenas projeção temporária durante a semana");
  });

  it("ensurePlayerSeasonAligned remove medalhas prematuras da semana corrente que ainda está em disputa", () => {
    const { weekKey } = getWeekInfo();
    const mockAccount: any = {
      profile: {
        id: "aluna_com_medalha_prematura",
        tournamentWeekKey: weekKey,
        tournamentMedals: [
          {
            id: `medal_${weekKey}_etapa_1_r1`,
            weekKey: weekKey, // Medalha indevida emitida na semana em andamento
            rank: 1,
            label: "🥇 Top 1 1ª Etapa (Memória das Cores)",
          },
          {
            id: "medal_2026-W40_etapa_1_r1",
            weekKey: "2026-W40", // Medalha legítima de semana já encerrada
            rank: 1,
            label: "🥇 Top 1 1ª Etapa (Semana 40)",
          },
        ],
      },
      stats: [],
    };

    const aligned = ensurePlayerSeasonAligned(mockAccount, {} as any);
    // A medalha da semana corrente deve ter sido removida!
    assert.equal(aligned.profile.tournamentMedals?.length, 1);
    assert.equal(aligned.profile.tournamentMedals?.[0].weekKey, "2026-W40");
  });

  it("garante preservação de tournamentPoints e rankId no alinhamento da temporada", () => {
    const { weekKey } = getWeekInfo();
    const mockAccount: any = {
      profile: {
        id: "jogador_ranqueado_ativo",
        tournamentWeekKey: weekKey,
        tournamentPoints: 45,
        tournamentRankId: "bronze_2",
        dailyTournamentEntries: 3,
        dailyTournamentXp: 30,
      },
      stats: [],
    };

    const aligned = ensurePlayerSeasonAligned(mockAccount, {} as any);
    assert.equal(aligned.profile.tournamentPoints, 45);
    assert.equal(aligned.profile.tournamentRankId, "bronze_2");
    assert.equal(aligned.profile.tournamentWeekKey, weekKey);
  });
});
