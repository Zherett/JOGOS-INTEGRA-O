import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  adjustXpForGameMode,
  applyDailyXpCap,
  calculatePlayerLevel,
  computeBadges,
  DEFAULT_DAILY_XP_CAP,
  evaluateLeaderboardRankChanges,
  formatFullNameUpper,
  fullNameSlug,
  getAvailableSchoolsForAge,
  isEtapa3OrOlder,
  isMatchVictory,
  isOfficialSemedSchool,
  isValidSchool,
  levelFromXp,
  levelProgress,
  matchesRankingCategory,
  MAX_LEVEL,
  normalizeBirthdatePasswordInput,
  passwordFromBirthdate,
  RANKING_SERIES_OPTIONS,
  resolveDefaultRankingCategory,
  SCHOOLS,
  stageFromAge,
  stageFromBirthdate,
  studentCustomId,
  TEAM_MODE_XP_DIVISOR,
  xpForLevel,
  xpFromMatch,
} from "./player-profile.ts";
import { isSpecialAdminAccount } from "./playfab.ts";

describe("Perfil do Jogador, Escolas, Trava de Níveis (1..10) e Limite Diário de XP", () => {
  it("possui as opções de instituição com Nenhuma (padrão) no início, as 5 escolas oficiais da SEMED Coari e Outro por último", () => {
    const names = SCHOOLS.map((s) => s.name);
    assert.deepEqual(names, [
      "Nenhuma",
      "Raimundo Bezerra",
      "Elisângela Litaiff",
      "Raimunda Cruz",
      "Maria de Nazaré",
      "Ursulina Souza",
      "Outro",
    ]);
    assert.equal(names[0], "Nenhuma");
    assert.equal(names[names.length - 1], "Outro");
    assert.equal(isValidSchool("Nenhuma"), true);
    assert.equal(isValidSchool("Raimundo Bezerra"), true);
    assert.equal(isValidSchool("Outro"), true);
    assert.equal(isValidSchool("Escola Inexistente"), false);
  });

  it("respeita a curva de XP do Nível 1 ao Nível Máximo 10 (8.433 XP)", () => {
    assert.equal(MAX_LEVEL, 10);
    assert.equal(xpForLevel(1), 0);
    assert.equal(xpForLevel(2), 100);
    assert.equal(xpForLevel(3), 354);
    assert.equal(xpForLevel(4), 795);
    assert.equal(xpForLevel(5), 1444);
    assert.equal(xpForLevel(10), 8433);
    // Mesmo com XP muito acima de 8.433, o nível máximo permanece 10
    assert.equal(levelFromXp(50000), 10);
  });

  it("trava o avanço de nível caso faltem partidas, vitórias ou jogos diferentes explorados", () => {
    // Aluno com 1.000 XP (máximo do 1º dia), mas que jogou apenas 1 modalidade (ex: só Lógica)
    const lockedAt2 = levelProgress({
      xp: 1000,
      matchesPlayed: 10,
      wins: 6,
      distinctGames: 1, // Nível 2 pede 1 jogo, mas Nível 3 pede 2 jogos diferentes
    });
    assert.equal(lockedAt2.level, 2);
    assert.equal(lockedAt2.isLockedByMissions, true);

    // Assim que explora 3 jogos diferentes (com 8+ partidas e 4+ vitórias), destrava o Nível 4 no 1º dia
    const unlockedLvl4 = levelProgress({
      xp: 1000,
      matchesPlayed: 8,
      wins: 4,
      distinctGames: 3,
    });
    assert.equal(unlockedLvl4.level, 4);
    assert.equal(unlockedLvl4.isLockedByMissions, false);

    // Para chegar ao Nível 10 (máximo), precisa de 8.433+ XP, 50+ partidas, 30+ vitórias e 9+ jogos diferentes
    assert.equal(
      calculatePlayerLevel({
        xp: 9000,
        matchesPlayed: 50,
        wins: 30,
        distinctGames: 8, // falta 1 jogo diferente para o nível 10
      }),
      9,
    );
    assert.equal(
      calculatePlayerLevel({
        xp: 9000,
        matchesPlayed: 50,
        wins: 30,
        distinctGames: 9,
      }),
      10,
    );
  });

  it("aplica o limite diário de 1.000 XP/dia e renova no dia seguinte", () => {
    assert.equal(DEFAULT_DAILY_XP_CAP, 1000);

    // Ganha 250 XP quando já tinha 850 XP hoje -> recebe apenas 150 XP para fechar 1.000 XP
    const res1 = applyDailyXpCap({
      rawEarnedXp: 250,
      currentDailyXp: 850,
      lastDateKey: "2026-10-31",
      todayKey: "2026-10-31",
      dailyCap: 1000,
    });
    assert.equal(res1.grantedXp, 150);
    assert.equal(res1.newDailyXp, 1000);
    assert.equal(res1.remainingToday, 0);
    assert.equal(res1.wasCapped, true);

    // Nova partida no mesmo dia após bater 1.000 XP -> 0 XP concedido
    const res2 = applyDailyXpCap({
      rawEarnedXp: 180,
      currentDailyXp: res1.newDailyXp,
      lastDateKey: "2026-10-31",
      todayKey: "2026-10-31",
      dailyCap: 1000,
    });
    assert.equal(res2.grantedXp, 0);
    assert.equal(res2.newDailyXp, 1000);

    // No dia seguinte (2026-11-01), o limite diário zera automaticamente
    const resNextDay = applyDailyXpCap({
      rawEarnedXp: 180,
      currentDailyXp: res2.newDailyXp,
      lastDateKey: "2026-10-31",
      todayKey: "2026-11-01",
      dailyCap: 1000,
    });
    assert.equal(resNextDay.grantedXp, 180);
    assert.equal(resNextDay.newDailyXp, 180);
    assert.equal(resNextDay.remainingToday, 820);
    assert.equal(resNextDay.wasCapped, false);
  });

  it("recompensa vitórias com bônus de XP e desbloqueia conquistas até o Nível 10", () => {
    assert.equal(isMatchVictory(80, 8, 2), true);
    const xpVictory = xpFromMatch(80, 8, 2, 2);
    const xpDefeat = xpFromMatch(10, 1, 8, 1);
    assert.ok(xpVictory > xpDefeat);

    const badges = computeBadges({
      existing: [],
      xp: 8500,
      wins: 30,
      matchesPlayed: 50,
      distinctGamesPlayed: 9,
      lastMatchScore: 120,
    });
    const ids = badges.map((b) => b.id);
    assert.ok(ids.includes("primeira_vitoria"));
    assert.ok(ids.includes("nivel_5"));
    assert.ok(ids.includes("nivel_10"));
  });

  it("gera a senha de 6 dígitos DDMMAA a partir da data de nascimento (ex: 20/01/2014 -> 200114) e normaliza nomes", () => {
    assert.equal(passwordFromBirthdate("2014-01-20"), "200114");
    assert.equal(passwordFromBirthdate("20/01/2014"), "200114");
    assert.equal(normalizeBirthdatePasswordInput("200114"), "200114");
    assert.equal(normalizeBirthdatePasswordInput("20/01/2014"), "200114");
    assert.equal(normalizeBirthdatePasswordInput("20012014"), "200114");
    assert.equal(formatFullNameUpper("joão pedro da conceição"), "JOÃO PEDRO DA CONCEIÇÃO");
    assert.equal(fullNameSlug("  João   Pedro da Conceição "), "joao pedro da conceicao");
    assert.equal(
      studentCustomId("João Pedro da Conceição", "2014-01-20"),
      "stu_joao_pedro_da_conceicao_200114",
    );
  });

  it("aloca o aluno na etapa conforme corte de idade (11 anos até dezembro de 2026 no 5º ano) e restringe escolas de 5º ano para > 11 anos", () => {
    const refDateNov = new Date("2026-11-02T12:00:00");
    const refDateDec = new Date("2026-12-31T12:00:00");

    // 1. Fallback por Escola (quando data de nascimento não informada)
    assert.equal(stageFromBirthdate(undefined, refDateNov, "Raimunda Cruz").id, "etapa_1");
    assert.equal(stageFromBirthdate(undefined, refDateNov, "Ursulina Souza").id, "etapa_1");
    assert.equal(stageFromBirthdate(undefined, refDateNov, "Maria de Nazaré").id, "etapa_1");
    assert.equal(stageFromBirthdate(undefined, refDateNov, "Elisângela Litaiff").id, "etapa_1");
    assert.equal(stageFromBirthdate(undefined, refDateNov, "Raimundo Bezerra").id, "etapa_2");

    // 2. 1ª Etapa: até 11 anos (incluindo alunos nascidos em qualquer mês de 2015, como setembro/outubro/dezembro, válidos até dez/2026)
    assert.equal(stageFromAge(10).id, "etapa_1");
    assert.equal(stageFromAge(11).id, "etapa_1");
    assert.equal(stageFromBirthdate("2016-05-10", refDateNov).id, "etapa_1"); // 10 anos
    assert.equal(stageFromBirthdate("2015-09-15", refDateNov, "Elisângela Litaiff").id, "etapa_1"); // 11 anos (mês 9)
    assert.equal(stageFromBirthdate("2015-09-15", refDateDec, "Raimunda Cruz").id, "etapa_1"); // 11 anos em dez/2026
    assert.equal(stageFromBirthdate("2015-10-15", refDateDec, "Maria de Nazaré").id, "etapa_1"); // 11 anos em dez/2026
    assert.equal(stageFromBirthdate("2015-12-20", refDateDec, "Ursulina Souza").id, "etapa_1"); // 11 anos em dez/2026

    // Se o aluno de 11 anos estiver no Raimundo Bezerra (6º ano), vai para 2ª Etapa
    assert.equal(stageFromBirthdate("2015-09-15", refDateNov, "Raimundo Bezerra").id, "etapa_2");

    // 3. 2ª Etapa: 12 a 14 anos (ultrapassou 11 anos)
    assert.equal(stageFromAge(12).id, "etapa_2");
    assert.equal(stageFromAge(14).id, "etapa_2");
    assert.equal(stageFromBirthdate("2014-01-20", refDateNov).id, "etapa_2"); // 12 anos
    assert.equal(stageFromBirthdate("2013-05-10", refDateNov).id, "etapa_2"); // 13 anos

    // Aluno acima de 11 anos (12+ anos) JAMAIS é alocado em Etapa 1 mesmo que passe escola de 5º ano
    assert.equal(stageFromBirthdate("2014-05-10", refDateNov, "Elisângela Litaiff").id, "etapa_2");

    // 4. 3ª Etapa: acima de 14 anos (15+ anos, ex: 15 ou 20 anos)
    assert.equal(stageFromAge(15).id, "etapa_3");
    assert.equal(stageFromAge(20).id, "etapa_3");
    assert.equal(stageFromBirthdate("2011-05-10", refDateNov).id, "etapa_3"); // 15 anos
    assert.equal(stageFromBirthdate("2006-05-10", refDateNov).id, "etapa_3"); // 20 anos
  });

  it("reconhece os dois administradores autorizados JOSINEY e QUEMUEL", () => {
    assert.equal(isSpecialAdminAccount({ nickNormalized: "josiney" }), true);
    assert.equal(isSpecialAdminAccount({ nickNormalized: "quemuel" }), true);
    assert.equal(isSpecialAdminAccount({ id: "admin-josiney" }), true);
    assert.equal(isSpecialAdminAccount({ id: "admin-quemuel" }), true);
    assert.equal(isSpecialAdminAccount({ nickNormalized: "alunoteste" }), false);
  });

  it("reduz o ganho de XP em 4X quando o jogo é disputado em modo equipes/grupos", () => {
    assert.equal(TEAM_MODE_XP_DIVISOR, 4);

    // Modo solo (isTeam = false): mantém XP inalterado
    assert.equal(adjustXpForGameMode(20, false), 20);
    assert.equal(adjustXpForGameMode(12, false), 12);
    assert.equal(adjustXpForGameMode(5, false), 5);

    // Modo equipes (isTeam = true): reduz em 4X (ex: 20 XP vira 5 XP)
    assert.equal(adjustXpForGameMode(20, true), 5);
    assert.equal(adjustXpForGameMode(16, true), 4);
    assert.equal(adjustXpForGameMode(12, true), 3);
    assert.equal(adjustXpForGameMode(4, true), 1);
    // Garante no mínimo 1 XP para partidas concluídas
    assert.equal(adjustXpForGameMode(1, true), 1);
    assert.equal(adjustXpForGameMode(2, true), 1);
  });

  it("bloqueia escolas e turmas do ensino fundamental para jogadores com 15+ anos (Etapa 3)", () => {
    const refDate = new Date("2026-11-01T12:00:00");

    // Aluno com 25 anos (ex: nascido em 2001)
    assert.equal(isEtapa3OrOlder("2001-05-10", refDate), true);
    // Aluno com 15 anos (nascido em 2011)
    assert.equal(isEtapa3OrOlder("2011-03-15", refDate), true);
    // Aluno com 12 anos (nascido em 2014)
    assert.equal(isEtapa3OrOlder("2014-05-10", refDate), false);
    // Aluno com 10 anos (nascido em 2016)
    assert.equal(isEtapa3OrOlder("2016-05-10", refDate), false);

    // Escolas disponíveis para quem tem mais de 15 anos: APENAS 'Nenhuma' e 'Outro' (nenhuma escola exibida)
    const schoolsOver15 = getAvailableSchoolsForAge("2001-05-10", refDate).map((s) => s.name);
    assert.deepEqual(schoolsOver15, ["Nenhuma", "Outro"]);

    // Para quem tem até 11 anos até dezembro de 2026 (ex: nascido no mês 9 de 2015 ou 2016): escolas de 5º ano DEVEM aparecer normalmente
    const refDateDec = new Date("2026-12-31T12:00:00");
    const schoolsSept2015 = getAvailableSchoolsForAge("2015-09-15", refDateDec).map((s) => s.name);
    assert.equal(schoolsSept2015.includes("Raimundo Bezerra"), true);
    assert.equal(schoolsSept2015.includes("Elisângela Litaiff"), true);
    assert.equal(schoolsSept2015.includes("Raimunda Cruz"), true);
    assert.equal(schoolsSept2015.includes("Maria de Nazaré"), true);
    assert.equal(schoolsSept2015.includes("Ursulina Souza"), true);

    // Para quem ultrapassou 11 anos (12 a 14 anos, ex: nascido em 2014): escolas de 5º ano NÃO devem aparecer
    const schoolsOver11 = getAvailableSchoolsForAge("2014-05-10", refDate).map((s) => s.name);
    assert.equal(schoolsOver11.includes("Raimundo Bezerra"), true);
    assert.equal(schoolsOver11.includes("Elisângela Litaiff"), false);
    assert.equal(schoolsOver11.includes("Raimunda Cruz"), false);
    assert.equal(schoolsOver11.includes("Maria de Nazaré"), false);
    assert.equal(schoolsOver11.includes("Ursulina Souza"), false);

    // Para quem tem 10 anos (ex: 2016): escolas de 5º ano aparecem normalmente
    const schoolsUpTo11 = getAvailableSchoolsForAge("2016-05-10", refDate).map((s) => s.name);
    assert.equal(schoolsUpTo11.includes("Elisângela Litaiff"), true);
    assert.equal(schoolsUpTo11.includes("Raimunda Cruz"), true);

    // Aluno com 15+ anos é SEMPRE alocado na Etapa 3 (Comunidade)
    assert.equal(stageFromBirthdate("2001-05-10", refDate, "Elisângela Litaiff").id, "etapa_3");
    assert.equal(stageFromBirthdate("2001-05-10", refDate, "Raimundo Bezerra").id, "etapa_3");
    assert.equal(stageFromBirthdate("2001-05-10", refDate, "Outro").id, "etapa_3");
    assert.equal(stageFromBirthdate("2001-05-10", refDate, "Nenhuma").id, "etapa_3");

    // Validação de escolas oficiais
    assert.equal(isOfficialSemedSchool("Raimundo Bezerra"), true);
    assert.equal(isOfficialSemedSchool("Elisângela Litaiff"), true);
    assert.equal(isOfficialSemedSchool("Nenhuma"), false);
    assert.equal(isOfficialSemedSchool("Outro"), false);
  });

  it("calcula corretamente as setas de subida (▲ verde) e descida (▼ vermelha) no ranking sem jamais marcar 1º lugar com seta vermelha", () => {
    // Leitura inicial do ranking
    const firstSnapshot = evaluateLeaderboardRankChanges(
      [
        { playerId: "aluno_a", rank: 1 },
        { playerId: "aluno_b", rank: 2 },
        { playerId: "aluno_c", rank: 3 },
      ],
      {},
    );

    // O 1º colocado nunca fica com seta vermelha ("down")
    assert.equal(firstSnapshot.entriesWithTrend[0].rankTrend, "up");
    assert.notEqual(firstSnapshot.entriesWithTrend[0].rankTrend, "down");
    assert.equal(firstSnapshot.entriesWithTrend[1].rankTrend, "same");
    assert.equal(firstSnapshot.entriesWithTrend[2].rankTrend, "same");

    // Na leitura seguinte: aluno_c subiu de 3º para 2º (▲ verde) e aluno_b caiu de 2º para 3º (▼ vermelha)
    const secondSnapshot = evaluateLeaderboardRankChanges(
      [
        { playerId: "aluno_a", rank: 1 },
        { playerId: "aluno_c", rank: 2 },
        { playerId: "aluno_b", rank: 3 },
      ],
      firstSnapshot.nextHistory,
    );

    const rowA = secondSnapshot.entriesWithTrend.find((r) => r.playerId === "aluno_a")!;
    const rowC = secondSnapshot.entriesWithTrend.find((r) => r.playerId === "aluno_c")!;
    const rowB = secondSnapshot.entriesWithTrend.find((r) => r.playerId === "aluno_b")!;

    assert.notEqual(rowA.rankTrend, "down"); // 1º lugar nunca cai
    assert.equal(rowC.rankTrend, "up"); // subiu de 3º para 2º
    assert.equal(rowC.previousRank, 3);
    assert.equal(rowB.rankTrend, "down"); // caiu de 2º para 3º
    assert.equal(rowB.previousRank, 2);

    // Se um novo jogador (sincronizado da nuvem) entrar no topo sem que os demais tenham ultrapassado uns aos outros,
    // NINGUÉM abaixo dele deve ficar com seta vermelha ("down") em cascata
    const thirdSnapshotWithNewCloudPlayer = evaluateLeaderboardRankChanges(
      [
        { playerId: "novo_lider", rank: 1 },
        { playerId: "aluno_a", rank: 2 },
        { playerId: "aluno_c", rank: 3 },
        { playerId: "aluno_b", rank: 4 },
      ],
      firstSnapshot.nextHistory, // aluno_a(1), aluno_b(2), aluno_c(3) -> aluno_c passou aluno_b, mas aluno_a não foi ultrapassado por b ou c
    );
    const rowANew = thirdSnapshotWithNewCloudPlayer.entriesWithTrend.find((r) => r.playerId === "aluno_a")!;
    assert.equal(rowANew.rankTrend, "same"); // não caiu em relação aos competidores conhecidos

    // E se houver um histórico antigo corrompido onde todos estavam marcados como "down" sem ninguém ter subido,
    // a invariante corrige todos automaticamente para "same" (—)
    const corruptedHistory = {
      lucas: { lastRank: 3, previousRank: 2, trend: "down" as const },
      andriu: { lastRank: 4, previousRank: 3, trend: "down" as const },
      mika: { lastRank: 5, previousRank: 4, trend: "down" as const },
      renan: { lastRank: 6, previousRank: 5, trend: "down" as const },
    };
    const healedSnapshot = evaluateLeaderboardRankChanges(
      [
        { playerId: "lucas", rank: 3 },
        { playerId: "andriu", rank: 4 },
        { playerId: "mika", rank: 5 },
        { playerId: "renan", rank: 6 },
      ],
      corruptedHistory,
    );
    for (const row of healedSnapshot.entriesWithTrend) {
      assert.equal(row.rankTrend, "same", `Jogador ${row.playerId} não pode ter seta vermelha sem alguém acima ter subido`);
    }
  });

  it("mantém a seleção da etapa somente em 1ª Etapa (5º ano), 2ª Etapa (6º - 9º ano) e 3ª Etapa (15+) e direciona cada aluno para sua etapa", () => {
    const refDate = new Date("2026-11-03T12:00:00");

    assert.equal(RANKING_SERIES_OPTIONS.length, 3);
    assert.deepEqual(
      RANKING_SERIES_OPTIONS.map((o) => o.shortLabel),
      ["1ª Etapa (5º ano)", "2ª Etapa (6º - 9º ano)", "3ª Etapa (15+)"],
    );

    const aluno5Ano = {
      birthdate: "2015-09-15",
      school: "Elisângela Litaiff",
      grade: "5º ano",
    };
    const aluno6Ano = {
      birthdate: "2014-05-10",
      school: "Raimundo Bezerra",
      grade: "6º ano",
    };
    const aluno7Ano = {
      birthdate: "2013-04-20",
      school: "Raimundo Bezerra",
      grade: "7º ano",
    };
    const alunoEtapa3 = {
      birthdate: "2008-03-10",
      school: "Outro",
      grade: null,
    };

    assert.equal(resolveDefaultRankingCategory(aluno5Ano, refDate), "etapa_1");
    assert.equal(resolveDefaultRankingCategory(aluno6Ano, refDate), "etapa_2");
    assert.equal(resolveDefaultRankingCategory(aluno7Ano, refDate), "etapa_2");
    assert.equal(resolveDefaultRankingCategory(alunoEtapa3, refDate), "etapa_3");

    assert.equal(matchesRankingCategory(aluno5Ano, "etapa_1", refDate), true);
    assert.equal(matchesRankingCategory(aluno5Ano, "etapa_2", refDate), false);
    assert.equal(matchesRankingCategory(aluno6Ano, "etapa_2", refDate), true);
    assert.equal(matchesRankingCategory(aluno7Ano, "etapa_2", refDate), true);
    assert.equal(matchesRankingCategory(alunoEtapa3, "etapa_3", refDate), true);
  });
});
