import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALL_GAME_IDS } from "./game-storage.ts";
import { getGameInstructions } from "./game-instructions.ts";

describe("Instruções e Orientações Pedagógicas dos Jogos", () => {
  it("contém instruções completas para todos os jogos registrados na plataforma", () => {
    for (const id of ALL_GAME_IDS) {
      const info = getGameInstructions(id);
      assert.ok(info.objective.length > 10, `Objetivo do jogo ${id} deve ser descritivo`);
      assert.ok(info.howToPlay.length >= 2, `Jogo ${id} deve ter pelo menos 2 passos de como jogar`);
      assert.ok(info.controls.length > 5, `Jogo ${id} deve especificar comandos`);
      assert.ok(info.tips.length > 5, `Jogo ${id} deve ter dicas estratégicas`);
      assert.ok(info.scoring.length > 5, `Jogo ${id} deve descrever pontuação`);
    }
  });

  it("retorna fallback consistente para IDs desconhecidos", () => {
    // @ts-expect-error teste com id inválido
    const fallback = getGameInstructions("jogo_inexistente");
    assert.ok(fallback.objective.length > 0);
    assert.ok(fallback.howToPlay.length > 0);
  });
});
