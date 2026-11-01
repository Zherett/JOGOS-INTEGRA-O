import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildBaseMedalsCatalog,
  evaluatePlayerMedals,
  getTopShowcaseMedals,
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
});
