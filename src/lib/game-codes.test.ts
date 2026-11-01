import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ADMIN_CONFIG,
  DEFAULT_MASTER_CODE,
  loadAdminConfig,
  saveAdminConfig,
  redeemCode,
  loadUnlocked,
  clearUnlocked,
} from "./game-codes.ts";
import { ALL_GAME_IDS } from "./game-storage.ts";

describe("Liberação Inicial de Jogos e Controle de Bloqueio com SEMED26", () => {
  it("inicia por padrão com jogos liberados (requireCodeGate === false)", () => {
    assert.equal(DEFAULT_ADMIN_CONFIG.requireCodeGate, false);
    assert.equal(DEFAULT_ADMIN_CONFIG.masterCode, "SEMED26");
  });

  it("permite resgatar o código Master SEMED26 para liberar todos os jogos habilitados", () => {
    clearUnlocked();
    const res = redeemCode("SEMED26", {
      ...DEFAULT_ADMIN_CONFIG,
      requireCodeGate: true,
      masterCode: "SEMED26",
    });
    assert.equal(res.status, "all");
    if (res.status === "all") {
      assert.ok(res.games.length >= ALL_GAME_IDS.length);
    }
  });

  it("respeita jogos desmarcados para que não sejam visíveis ou resgatados", () => {
    const customConfig = {
      ...DEFAULT_ADMIN_CONFIG,
      enabledGames: {
        ...DEFAULT_ADMIN_CONFIG.enabledGames,
        logica: false, // desmarcado pelo ADM
      },
    };
    assert.equal(customConfig.enabledGames.logica, false);
    assert.equal(customConfig.enabledGames.cartesiano, true);

    const res = redeemCode(customConfig.gameCodes.logica, customConfig);
    assert.equal(res.status, "disabled");
  });

  it("salva e carrega configuração permitindo travar com SEMED26 e destravar", () => {
    const locked = saveAdminConfig({
      ...DEFAULT_ADMIN_CONFIG,
      requireCodeGate: true,
    });
    assert.equal(locked.requireCodeGate, true);

    const unlocked = saveAdminConfig({
      ...DEFAULT_ADMIN_CONFIG,
      requireCodeGate: false,
    });
    assert.equal(unlocked.requireCodeGate, false);
  });
});
