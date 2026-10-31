///////////////////////////////////////////////////////////////////////////////
// Microsoft Azure PlayFab — CloudScript Oficial da Plataforma Desafios de Lógica
// Como usar no PlayFab Game Manager:
//   1. Acesse o painel do seu título no PlayFab (https://developer.playfab.com)
//   2. Vá em: Automation -> CloudScript -> Revisions (Legacy)
//   3. Cole este código e clique em "Save and deployrevision"
///////////////////////////////////////////////////////////////////////////////

// Limites máximos plausíveis por partida para validação Anti-Cheat no servidor
var MAX_SCORE_BY_GAME = {
  logica: 1200,
  cartesiano: 900,
  formas: 800,
  memoria: 800,
  variaveis: 1000,
  robogrid: 1000,
  porcentagem: 900,
  minado: 350,
  completar: 900,
  rpg: 3000
};

/**
 * Registra o resultado de uma partida com validação Anti-Cheat no servidor
 * e atualiza os Leaderboards do PlayFab (XP_Total, XP_Season, Best_<gameId>, School_<slug>_XP).
 */
handlers.RecordMatchResult = function (args, context) {
  var gameId = String(args.gameId || "logica");
  var score = Math.max(0, Math.floor(Number(args.score) || 0));
  var maxAllowed = MAX_SCORE_BY_GAME[gameId] || 1500;

  // Proteção Anti-Cheat: limita scores adulterados via DevTools
  if (score > maxAllowed) {
    score = maxAllowed;
  }

  var statsToUpdate = Array.isArray(args.statistics) ? args.statistics : [];
  if (statsToUpdate.length > 0) {
    server.UpdatePlayerStatistics({
      PlayFabId: currentPlayerId,
      Statistics: statsToUpdate
    });
  }

  return {
    ok: true,
    validatedScore: score,
    playerId: currentPlayerId
  };
};

/**
 * Salva as configurações globais do Painel do Administrador (ADM) no TitleData do PlayFab
 * para que todos os dispositivos recebam os mesmos códigos de jogos, jogos ativos e resets agendados.
 */
handlers.SavePlatformAdminConfig = function (args, context) {
  if (!args || !args.config) {
    return { ok: false, error: "Configuração ausente." };
  }
  server.SetTitleData({
    Key: "PlatformAdminConfig",
    Value: JSON.stringify(args.config)
  });
  return { ok: true };
};

/**
 * Registra no TitleData a abertura de uma nova temporada acionada pelo Administrador.
 */
handlers.AdminResetSeason = function (args, context) {
  var existing = server.GetTitleData({ Keys: ["PlatformAdminConfig"] });
  var cfg = {};
  if (existing && existing.Data && existing.Data.PlatformAdminConfig) {
    try {
      cfg = JSON.parse(existing.Data.PlatformAdminConfig);
    } catch (e) {
      cfg = {};
    }
  }

  cfg.seasonId = args.seasonId || ((cfg.seasonId || 1) + 1);
  cfg.seasonName = args.seasonName || ("Temporada " + cfg.seasonId + " • SEMED Coari");
  cfg.lastResetAt = args.lastResetAt || new Date().toISOString();
  cfg.scheduledResetAt = null;
  cfg.updatedAt = new Date().toISOString();

  server.SetTitleData({
    Key: "PlatformAdminConfig",
    Value: JSON.stringify(cfg)
  });

  return { ok: true, seasonId: cfg.seasonId };
};
