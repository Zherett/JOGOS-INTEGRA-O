import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyDailyXpCap,
  calculatePlayerLevel,
  computeBadges,
  DEFAULT_DAILY_XP_CAP,
  formatFullNameUpper,
  fullNameSlug,
  isMatchVictory,
  isValidSchool,
  levelFromXp,
  levelProgress,
  MAX_LEVEL,
  normalizeBirthdatePasswordInput,
  passwordFromBirthdate,
  SCHOOLS,
  stageFromAge,
  stageFromBirthdate,
  studentCustomId,
  xpForLevel,
  xpFromMatch,
} from "./player-profile.ts";
import { isSpecialAdminAccount } from "./playfab.ts";

describe("Perfil do Jogador, Escolas, Trava de Níveis (1..10) e Limite Diário de XP", () => {
  it("possui exatamente as 5 escolas oficiais da SEMED Coari", () => {
    const names = SCHOOLS.map((s) => s.name);
    assert.deepEqual(names, [
      "Raimundo Bezerra",
      "Elisângela Litaiff",
      "Raimunda Cruz",
      "Maria de Nazaré",
      "Ursulina Souza",
    ]);
    assert.equal(isValidSchool("Raimundo Bezerra"), true);
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

  it("aloca o aluno na etapa tendo a Escola como elemento principal ou corte de idade (até 10 anos ou 11 até março)", () => {
    const refDate = new Date("2026-10-31T12:00:00");

    // 1. Elemento Principal: Escola
    // Raimunda Cruz, Ursulina, Maria de Nazaré, Litaiff -> Etapa 1 automaticamente
    assert.equal(stageFromBirthdate("2014-05-10", refDate, "Raimunda Cruz").id, "etapa_1");
    assert.equal(stageFromBirthdate("2014-05-10", refDate, "Ursulina Souza").id, "etapa_1");
    assert.equal(stageFromBirthdate("2014-05-10", refDate, "Maria de Nazaré").id, "etapa_1");
    assert.equal(stageFromBirthdate("2014-05-10", refDate, "Elisângela Litaiff").id, "etapa_1");

    // Raimundo Bezerra -> Etapa 2 automaticamente
    assert.equal(stageFromBirthdate("2015-02-15", refDate, "Raimundo Bezerra").id, "etapa_2");
    assert.equal(stageFromBirthdate("2013-05-10", refDate, "Raimundo Bezerra").id, "etapa_2");

    // 2. Se escola não informada: corte de idade (até 10 anos entra na etapa 1, ou se completar 11 até março)
    assert.equal(stageFromAge(10).id, "etapa_1");
    assert.equal(stageFromBirthdate("2016-05-10", refDate).id, "etapa_1"); // 10 anos
    assert.equal(stageFromBirthdate("2015-02-15", refDate).id, "etapa_1"); // Completa 11 em fevereiro (até março)
    assert.equal(stageFromBirthdate("2015-03-31", refDate).id, "etapa_1"); // Completa 11 em março (até março)

    // 2ª Etapa: 11 a 14 anos (ex: já completou 11 antes ou faz 12/13/14 anos)
    assert.equal(stageFromAge(12).id, "etapa_2");
    assert.equal(stageFromAge(14).id, "etapa_2");
    assert.equal(stageFromBirthdate("2014-01-20", refDate).id, "etapa_2"); // 12 anos
    assert.equal(stageFromBirthdate("2013-05-10", refDate).id, "etapa_2"); // 13 anos

    // 3ª Etapa: acima de 14 anos (15+ anos, ex: 15 ou 20 anos)
    assert.equal(stageFromAge(15).id, "etapa_3");
    assert.equal(stageFromAge(20).id, "etapa_3");
    assert.equal(stageFromBirthdate("2006-05-10", refDate).id, "etapa_3"); // 20 anos
  });

  it("reconhece os dois administradores autorizados JOSINEY e QUEMUEL", () => {
    assert.equal(isSpecialAdminAccount({ nickNormalized: "josiney" }), true);
    assert.equal(isSpecialAdminAccount({ nickNormalized: "quemuel" }), true);
    assert.equal(isSpecialAdminAccount({ id: "admin-josiney" }), true);
    assert.equal(isSpecialAdminAccount({ id: "admin-quemuel" }), true);
    assert.equal(isSpecialAdminAccount({ nickNormalized: "alunoteste" }), false);
  });
});
