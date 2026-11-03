import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildBaseMedalsCatalog,
  calculateMedalProgress,
  evaluatePlayerMedals,
  getDistinctFlawlessGames,
  getTopShowcaseMedals,
  isFlawlessMatch,
  RARITY_INFO,
  type MedalDefinition,
} from "./medals-catalog.ts";
import { ALL_GAME_IDS } from "./game-storage.ts";
import type { PlayerProfile, GameStatRow } from "./playfab.ts";

describe("Sistema Completo de Medalhas e Inventário", () => {
  it("constrói o catálogo base com todas as categorias solicitadas", () => {
    const catalog = buildBaseMedalsCatalog();
    assert.ok(catalog.length >= 90, `Esperado 90+ medalhas, encontrado ${catalog.length}`);

    // Valida 9 medalhas de nível
    const lvlMedals = catalog.filter((m) => m.category === "nivel");
    assert.equal(lvlMedals.length, 9);
    assert.equal(lvlMedals[0].id, "lvl_2");
    assert.equal(lvlMedals[8].id, "lvl_10");

    // Valida 50 medalhas de quantidade de partidas (5 por jogo x 10 jogos)
    const matchMedals = catalog.filter((m) => m.category === "jogo_partidas");
    assert.equal(matchMedals.length, 50);

    // Valida 10 medalhas de zero erros
    const flawlessMedals = catalog.filter((m) => m.category === "jogo_perfeito");
    assert.equal(flawlessMedals.length, 10);

    // Valida medalhas de X1 (10 vitórias totais + 3 semanais)
    const x1Total = catalog.filter((m) => m.category === "x1_vitorias");
    const x1Weekly = catalog.filter((m) => m.category === "x1_semanal");
    assert.equal(x1Total.length, 10);
    assert.equal(x1Weekly.length, 3);
  });

  it("avalia e concede medalhas de nível e zero erros automaticamente", () => {
    const mockProfile: PlayerProfile = {
      id: "p1",
      nick: "AlunoTeste",
      nickNormalized: "alunoteste",
      full_name: "ALUNO TESTE",
      school: "Raimundo Bezerra",
      grade: "6º ano",
      birthdate: "2014-01-20",
      xp: 2000,
      seasonXp: 2000,
      level: 5,
      wins: 6,
      matchesPlayed: 12,
      distinctGamesPlayed: 4,
      badges: [],
      seasonId: 1,
      unlockedMedals: [],
    };

    const mockStats: GameStatRow[] = [
      {
        game_id: "logica",
        mode: "padrao",
        plays: 15,
        wins: 4,
        best_score: 95,
        best_level: 3,
        last_played_at: new Date().toISOString(),
      },
    ];

    const awarded = evaluatePlayerMedals({
      profile: mockProfile,
      stats: mockStats,
      lastMatch: {
        gameId: "logica",
        score: 95,
        level: 3,
        correct: 5,
        wrong: 0,
      },
    });

    const ids = awarded.map((m) => m.id);
    // Deve ganhar medalhas dos níveis 2, 3, 4, 5
    assert.ok(ids.includes("lvl_2"));
    assert.ok(ids.includes("lvl_5"));
    assert.ok(!ids.includes("lvl_6")); // ainda não é nível 6

    // Deve ganhar a medalha de 10 partidas de Lógica
    assert.ok(ids.includes("game_logica_matches_10"));
    // Deve ganhar a de zero erros de Lógica
    assert.ok(ids.includes("game_logica_flawless"));
  });

  it("seleciona automaticamente as 3 medalhas mais raras para vitrine/destaque", () => {
    const medalsList: MedalDefinition[] = [
      {
        id: "m_bronze",
        title: "Bronze Comum",
        description: "",
        rarity: "bronze",
        category: "atividade",
        iconName: "Clock",
        condition: { type: "streak_days", threshold: 3 },
      },
      {
        id: "m_ouro",
        title: "Ouro Supremo",
        description: "",
        rarity: "ouro",
        category: "ranking",
        iconName: "Trophy",
        condition: { type: "tournament_rank", targetRank: 1 },
      },
      {
        id: "m_platina",
        title: "Platina Rara",
        description: "",
        rarity: "platina",
        category: "meta",
        iconName: "Crown",
        condition: { type: "all_level_medals" },
      },
      {
        id: "m_diamante",
        title: "Diamante Lendário",
        description: "",
        rarity: "diamante",
        category: "meta",
        iconName: "Gem",
        condition: { type: "total_medals_count", threshold: 50 },
      },
    ];

    const unlocked = [
      { medalId: "m_bronze", unlockedAt: "2026-10-31" },
      { medalId: "m_ouro", unlockedAt: "2026-10-31" },
      { medalId: "m_platina", unlockedAt: "2026-10-31" },
      { medalId: "m_diamante", unlockedAt: "2026-10-31" },
    ];

    const top3 = getTopShowcaseMedals(unlocked, medalsList);
    assert.equal(top3.length, 3);
    assert.equal(top3[0].id, "m_diamante"); // peso 5
    assert.equal(top3[1].id, "m_platina"); // peso 4
    assert.equal(top3[2].id, "m_ouro"); // peso 3
  });

  it("garante que cada jogo registrado gera automaticamente 7 medalhas dedicadas", () => {
    const catalog = buildBaseMedalsCatalog();

    for (const gId of ALL_GAME_IDS) {
      const gameMedals = catalog.filter((m) => m.gameId === gId);
      assert.equal(
        gameMedals.length,
        7,
        `Jogo ${gId} deveria ter 7 medalhas automáticas (1 nível, 1 sem erros, 5 partidas), mas tem ${gameMedals.length}`
      );
      assert.ok(gameMedals.some((m) => m.id === `game_${gId}_lvl_master`));
      assert.ok(gameMedals.some((m) => m.id === `game_${gId}_flawless`));
      assert.ok(gameMedals.some((m) => m.id === `game_${gId}_matches_10`));
      assert.ok(gameMedals.some((m) => m.id === `game_${gId}_matches_50`));
    }
  });

  it("avalia e desbloqueia medalhas de exploração de múltiplos jogos a partir de distinctGamesPlayed", () => {
    const profile = {
      id: "test-admin",
      nick: "Admin",
      nickNormalized: "admin",
      full_name: "Administrador do Sistema",
      birthdate: "2010-01-01",
      school: "Escola Municipal Raimunda Cruz",
      level: 10,
      xp: 9999,
      matchesPlayed: 50,
      wins: 40,
      distinctGamesPlayed: 10,
      grade: "5º Ano",
      seasonXp: 9999,
      seasonId: 1,
      badges: [],
      unlockedMedals: [],
    };

    const awarded = evaluatePlayerMedals({
      profile,
      stats: [],
    });

    const ids = awarded.map((m) => m.id);
    assert.ok(ids.includes("explore_3_games"));
    assert.ok(ids.includes("explore_5_games")); // Explorador da Lógica
    assert.ok(ids.includes("explore_all_games")); // Mestre de Todos os Jogos
  });

  it("avalia e concede as medalhas especiais de Beta Tester no período de 01 a 07 de Novembro", () => {
    const nov3 = new Date("2026-11-03T14:00:00Z"); // Durante período Beta
    const nov15 = new Date("2026-11-15T14:00:00Z"); // Fora do período Beta

    // Perfil de jogador com 1 partida finalizada
    const profileBronze: PlayerProfile = {
      id: "p_beta",
      nick: "BetaGuy",
      nickNormalized: "betaguy",
      full_name: "BETA GUY",
      school: "Nenhuma",
      grade: null,
      birthdate: "2012-05-10",
      xp: 100,
      seasonXp: 100,
      level: 1,
      wins: 1,
      matchesPlayed: 1,
      distinctGamesPlayed: 1,
      badges: [],
      seasonId: 1,
      unlockedMedals: [],
    };

    const statsBronze: GameStatRow[] = [
      {
        player_id: "p_beta",
        game_id: "logica",
        plays: 1,
        wins: 1,
        best_score: 50,
        best_level: 2,
        updated_at: "2026-11-03T12:00:00Z",
      },
    ];

    // Dentro do período Beta: conquista Beta Tester Bronze
    const awardedNov3 = evaluatePlayerMedals(
      { profile: profileBronze, stats: statsBronze },
      undefined,
      nov3,
    );
    assert.ok(awardedNov3.some((m) => m.id === "beta_tester_bronze"));

    // Fora do período Beta (nov 15): não conquista
    const awardedNov15 = evaluatePlayerMedals(
      { profile: profileBronze, stats: statsBronze },
      undefined,
      nov15,
    );
    assert.ok(!awardedNov15.some((m) => m.id === "beta_tester_bronze"));

    // Jogador avançado com 10 partidas finalizadas em todos os 10 jogos e Nível 5
    const statsHeroi: GameStatRow[] = ALL_GAME_IDS.map((gId) => ({
      player_id: "p_hero",
      game_id: gId,
      plays: 10,
      wins: 8,
      best_score: 100,
      best_level: 5,
      updated_at: "2026-11-03T12:00:00Z",
    }));

    const profileHeroi: PlayerProfile = {
      ...profileBronze,
      level: 5,
      xp: 3000,
    };

    const awardedHero = evaluatePlayerMedals(
      { profile: profileHeroi, stats: statsHeroi },
      undefined,
      nov3,
    );

    const heroMedalIds = awardedHero.map((m) => m.id);
    assert.ok(heroMedalIds.includes("beta_tester_bronze"));
    assert.ok(heroMedalIds.includes("beta_tester_prata"));
    assert.ok(heroMedalIds.includes("beta_tester_ouro"));
    assert.ok(heroMedalIds.includes("beta_tester_platina"));
    assert.ok(heroMedalIds.includes("beta_tester_heroi"));

    // Valida raridade Herói com brilho vermelho
    const heroiMedal = awardedHero.find((m) => m.id === "beta_tester_heroi");
    assert.equal(heroiMedal?.rarity, "heroi");
    assert.equal(RARITY_INFO.heroi.glowHex, "#ef4444");
    assert.equal(RARITY_INFO.heroi.label, "Herói");
  });

  it("NÃO concede medalha de zero erros (individual ou 3 jogos) se a aluna teve 1 ou mais erros no final do jogo", () => {
    const profileWith1Error: PlayerProfile = {
      id: "p_aluna",
      nick: "AlunaTeste",
      nickNormalized: "alunateste",
      full_name: "ALUNA TESTE",
      school: "Raimundo Bezerra",
      grade: "6º ano",
      birthdate: "2014-03-15",
      xp: 600,
      seasonXp: 600,
      level: 3,
      wins: 3,
      matchesPlayed: 3,
      distinctGamesPlayed: 3,
      badges: [],
      seasonId: 1,
      unlockedMedals: [],
    };

    // Jogou 3 jogos distintos com pontuação alta (>= 30) e vitória (wins >= 1),
    // mas cometeu 1 erro em cada (flawless_wins = 0, last_wrong = 1)
    const statsWithErrors: GameStatRow[] = [
      {
        game_id: "logica",
        mode: "padrao",
        plays: 1,
        wins: 1,
        flawless_wins: 0,
        last_wrong: 1,
        best_score: 80,
        best_level: 2,
      },
      {
        game_id: "porcentagem",
        mode: "padrao",
        plays: 1,
        wins: 1,
        flawless_wins: 0,
        last_wrong: 2,
        best_score: 70,
        best_level: 2,
      },
      {
        game_id: "cartesiano",
        mode: "padrao",
        plays: 1,
        wins: 1,
        flawless_wins: 0,
        last_wrong: 1,
        best_score: 90,
        best_level: 2,
      },
    ];

    const lastMatchWith1Error = {
      gameId: "cartesiano" as const,
      score: 90,
      level: 2,
      correct: 9,
      wrong: 1, // Cometeu 1 erro no final do jogo!
    };

    assert.equal(isFlawlessMatch(lastMatchWith1Error), false);
    assert.equal(
      getDistinctFlawlessGames(profileWith1Error, statsWithErrors, lastMatchWith1Error).size,
      0,
    );

    const awarded = evaluatePlayerMedals({
      profile: profileWith1Error,
      stats: statsWithErrors,
      lastMatch: lastMatchWith1Error,
    });

    const ids = awarded.map((m) => m.id);
    // Não pode ganhar medalha individual sem erros nem a de 3 jogos sem erros
    assert.ok(!ids.includes("game_cartesiano_flawless"));
    assert.ok(!ids.includes("flawless_3_games"));
    assert.ok(!ids.includes("flawless_5_games"));
    assert.ok(!ids.includes("flawless_8_games"));

    // Progresso da medalha flawless_3_games deve ser 0/3
    const catalog = buildBaseMedalsCatalog();
    const medal3Flawless = catalog.find((m) => m.id === "flawless_3_games")!;
    const prog = calculateMedalProgress(medal3Flawless, profileWith1Error, statsWithErrors);
    assert.equal(prog.percent, 0);
    assert.ok(prog.progressText.includes("0 de 3"));
  });

  it("concede flawless_3_games somente quando 3 jogos DISTINTOS são finalizados com wrong === 0", () => {
    const profileFlawless: PlayerProfile = {
      id: "p_precisa",
      nick: "MentePrecisa",
      nickNormalized: "menteprecisa",
      full_name: "ALUNA PRECISA",
      school: "Raimundo Bezerra",
      grade: "7º ano",
      birthdate: "2013-07-10",
      xp: 900,
      seasonXp: 900,
      level: 4,
      wins: 4,
      matchesPlayed: 4,
      distinctGamesPlayed: 3,
      badges: [],
      seasonId: 1,
      unlockedMedals: [],
    };

    // Se jogar o mesmo jogo em 2 modos ("padrao" e "equipes") sem erros + 1 segundo jogo sem erros,
    // são apenas 2 jogos distintos (não pode ganhar flawless_3_games ainda)
    const statsTwoDistinctGames: GameStatRow[] = [
      {
        game_id: "logica",
        mode: "padrao",
        plays: 1,
        wins: 1,
        flawless_wins: 1,
        last_wrong: 0,
        best_score: 60,
        best_level: 2,
      },
      {
        game_id: "logica",
        mode: "equipes",
        plays: 1,
        wins: 1,
        flawless_wins: 1,
        last_wrong: 0,
        best_score: 70,
        best_level: 2,
      },
      {
        game_id: "porcentagem",
        mode: "padrao",
        plays: 1,
        wins: 1,
        flawless_wins: 1,
        last_wrong: 0,
        best_score: 50,
        best_level: 2,
      },
    ];

    const awardedTwo = evaluatePlayerMedals({
      profile: profileFlawless,
      stats: statsTwoDistinctGames,
    });
    assert.ok(!awardedTwo.some((m) => m.id === "flawless_3_games"));

    // Ao finalizar o 3º jogo distinto sem nenhum erro (wrong === 0, correct >= 3, score >= 30):
    const thirdFlawlessMatch = {
      gameId: "memoria" as const,
      score: 80,
      level: 2,
      correct: 6,
      wrong: 0,
    };

    const awardedThree = evaluatePlayerMedals({
      profile: profileFlawless,
      stats: statsTwoDistinctGames,
      lastMatch: thirdFlawlessMatch,
    });

    const idsThree = awardedThree.map((m) => m.id);
    assert.ok(idsThree.includes("game_memoria_flawless"));
    assert.ok(idsThree.includes("flawless_3_games"));
  });
});
