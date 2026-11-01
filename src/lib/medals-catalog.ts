import { ALL_GAME_IDS, GAME_NAMES, type GameId } from "./game-storage.ts";
import type { PlayerProfile } from "./playfab.ts";
import type { GameStatRow } from "./playfab.ts";

export type MedalRarity = "bronze" | "prata" | "ouro" | "platina" | "diamante" | "heroi";

export type MedalCategory =
  | "nivel"
  | "jogo_nivel"
  | "jogo_perfeito"
  | "jogo_partidas"
  | "x1_vitorias"
  | "x1_semanal"
  | "exploracao"
  | "sem_erros"
  | "atividade"
  | "ranking"
  | "meta"
  | "evento";

export interface MedalCondition {
  type:
    | "player_level"
    | "game_best_level"
    | "game_flawless"
    | "game_match_count"
    | "x1_wins_total"
    | "x1_wins_weekly"
    | "distinct_games"
    | "distinct_flawless_games"
    | "max_daily_xp"
    | "streak_days"
    | "tournament_rank"
    | "all_level_medals"
    | "all_game_medals"
    | "total_medals_count"
    | "beta_tester_bronze"
    | "beta_tester_prata"
    | "beta_tester_ouro"
    | "beta_tester_platina"
    | "beta_tester_heroi"
    | "manual_event";
  threshold?: number;
  gameId?: GameId;
  targetRank?: number; // 1, 2, 3
}

export interface MedalDefinition {
  id: string;
  title: string;
  description: string;
  rarity: MedalRarity;
  category: MedalCategory;
  iconName: string;
  condition: MedalCondition;
  isCustom?: boolean;
  createdByAdmin?: boolean;
  gameId?: GameId;
}

export interface PlayerUnlockedMedal {
  medalId: string;
  unlockedAt: string;
}

export interface AdminMedalNotification {
  id: string;
  studentId: string;
  studentNick: string;
  studentFullName: string;
  studentSchool: string;
  medalId: string;
  medalTitle: string;
  medalRarity: MedalRarity;
  medalIcon: string;
  unlockedAt: string;
  read?: boolean;
}

/** Pre-set curated icon list available for medals and custom admin creations */
export const AVAILABLE_MEDAL_ICONS = [
  "Trophy",
  "Medal",
  "Award",
  "Crown",
  "Flame",
  "Sparkles",
  "Shield",
  "Star",
  "Target",
  "Zap",
  "Swords",
  "Bot",
  "Gem",
  "Rocket",
  "Heart",
  "Brain",
  "CheckCircle",
  "Crosshair",
  "Compass",
  "Lightbulb",
  "Puzzle",
  "Flag",
  "Bookmark",
  "Clock",
] as const;

/** Rarity styling configurations with neon glow border effects */
export const RARITY_INFO: Record<
  MedalRarity,
  {
    label: string;
    weight: number;
    neonBorderClass: string;
    badgeBgClass: string;
    textColor: string;
    glowHex: string;
  }
> = {
  bronze: {
    label: "Bronze",
    weight: 1,
    neonBorderClass: "border-[#cd7f32] shadow-[0_0_10px_rgba(205,127,50,0.4)]",
    badgeBgClass: "bg-[#cd7f32]/15 text-[#cd7f32] border-[#cd7f32]/30",
    textColor: "text-[#cd7f32]",
    glowHex: "#cd7f32",
  },
  prata: {
    label: "Prata",
    weight: 2,
    neonBorderClass: "border-slate-400 shadow-[0_0_14px_rgba(148,163,184,0.8)]",
    badgeBgClass: "bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white border-slate-500 font-black shadow-xs",
    textColor: "text-slate-800 dark:text-slate-200",
    glowHex: "#94a3b8",
  },
  ouro: {
    label: "Ouro",
    weight: 3,
    neonBorderClass: "border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.7)]",
    badgeBgClass: "bg-amber-400/20 text-amber-300 border-amber-400/40",
    textColor: "text-amber-400",
    glowHex: "#fbbf24",
  },
  platina: {
    label: "Platina",
    weight: 4,
    neonBorderClass: "border-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.8)]",
    badgeBgClass: "bg-cyan-400/20 text-cyan-300 border-cyan-400/40",
    textColor: "text-cyan-400",
    glowHex: "#22d3ee",
  },
  diamante: {
    label: "Diamante",
    weight: 5,
    neonBorderClass: "border-fuchsia-400 shadow-[0_0_22px_rgba(232,121,249,0.9)]",
    badgeBgClass: "bg-fuchsia-400/20 text-fuchsia-300 border-fuchsia-400/40",
    textColor: "text-fuchsia-400",
    glowHex: "#e879f9",
  },
  heroi: {
    label: "Herói",
    weight: 6,
    neonBorderClass: "border-red-500 shadow-[0_0_24px_rgba(239,68,68,0.95)] animate-pulse",
    badgeBgClass: "bg-red-500/25 text-red-500 dark:text-red-400 border-red-500/50 font-black",
    textColor: "text-red-500 dark:text-red-400",
    glowHex: "#ef4444",
  },
};

/** XP bonus granted to the player immediately upon unlocking a medal of each rarity tier */
export const MEDAL_XP_REWARDS: Record<MedalRarity, number> = {
  bronze: 10,
  prata: 20,
  ouro: 30,
  platina: 40,
  diamante: 50,
  heroi: 100,
};

/** Janela oficial de conquista das medalhas especiais de Beta Tester: 01 a 07 de Novembro de 2026 */
export const BETA_TESTER_START = "2026-11-01T00:00:00.000Z";
export const BETA_TESTER_END = "2026-11-07T23:59:59.999Z";

export function isBetaTesterPeriodActive(now = new Date()): boolean {
  const y = now.getFullYear();
  const m = now.getMonth(); // 10 = Novembro (base 0)
  const d = now.getDate();
  if (y === 2026 && m === 10 && d >= 1 && d <= 7) return true;
  const t = now.getTime();
  return t >= new Date(BETA_TESTER_START).getTime() && t <= new Date(BETA_TESTER_END).getTime();
}

/**
 * Builds the complete base medals catalog requested by the user:
 * - 9 Level Medals (Level 2 to 10)
 * - 10 Game Level Medals
 * - 10 Game Flawless (zero erros) Medals
 * - 50 Game Match Count Medals (10, 20, 30, 40, 50 partidas x 10 jogos)
 * - 10 X1 Wins Medals (1 to 10 wins)
 * - 3 X1 Weekly Wins Medals (5, 10, 15 wins)
 * - 3 Exploration Medals (3, 5, 9 games)
 * - 3 Flawless Across Games Medals (3, 5, 8 games)
 * - 1 Max Daily XP Medal
 * - 3 Activity Streak Medals (3, 5, 7 consecutive days)
 * - 3 Ranking Tournament Medals (Top 1 Gold, Top 2 Silver, Top 3 Bronze)
 * - 5 Meta-Medals (Platina & Diamante)
 */
export function buildBaseMedalsCatalog(): MedalDefinition[] {
  const medals: MedalDefinition[] = [];

  // 1. Nível (Nível 2 ao 10 = 9 medalhas)
  for (let lvl = 2; lvl <= 10; lvl++) {
    const rarity: MedalRarity =
      lvl <= 3 ? "bronze" : lvl <= 6 ? "prata" : lvl <= 9 ? "ouro" : "platina";
    medals.push({
      id: `lvl_${lvl}`,
      title: `Nível ${lvl}`,
      description: `Alcance o Nível ${lvl} na plataforma de desafios de lógica.`,
      rarity,
      category: "nivel",
      iconName: lvl === 10 ? "Crown" : "Star",
      condition: { type: "player_level", threshold: lvl },
    });
  }

  // 2. Por Jogo: Nível Alcançado & Zero Erros
  for (const gId of ALL_GAME_IDS) {
    const gName = GAME_NAMES[gId];
    medals.push({
      id: `game_${gId}_lvl_master`,
      title: `Especialista: ${gName}`,
      description: `Alcance o nível 3 ou superior no jogo ${gName}.`,
      rarity: "prata",
      category: "jogo_nivel",
      iconName: "Target",
      gameId: gId,
      condition: { type: "game_best_level", gameId: gId, threshold: 3 },
    });

    medals.push({
      id: `game_${gId}_flawless`,
      title: `Perfeição: ${gName}`,
      description: `Finalize uma partida de ${gName} com pontuação acima de 30 pontos e ZERO erros!`,
      rarity: "ouro",
      category: "jogo_perfeito",
      iconName: "Sparkles",
      gameId: gId,
      condition: { type: "game_flawless", gameId: gId, threshold: 30 },
    });
  }

  // 3. Por Jogo: Quantidade de Partidas (10, 20, 30, 40, 50 partidas x 10 jogos = 50 medalhas)
  const matchThresholds = [10, 20, 30, 40, 50];
  const thresholdRarities: MedalRarity[] = ["bronze", "prata", "prata", "ouro", "platina"];

  for (const gId of ALL_GAME_IDS) {
    const gName = GAME_NAMES[gId];
    matchThresholds.forEach((count, idx) => {
      medals.push({
        id: `game_${gId}_matches_${count}`,
        title: `${gName}: ${count} Partidas`,
        description: `Complete ${count} partidas no jogo ${gName}.`,
        rarity: thresholdRarities[idx],
        category: "jogo_partidas",
        iconName: count === 50 ? "Award" : "Flame",
        gameId: gId,
        condition: { type: "game_match_count", gameId: gId, threshold: count },
      });
    });
  }

  // 4. Arena X1: Vitórias Gerais (1 a 10 vitórias = 10 medalhas)
  for (let w = 1; w <= 10; w++) {
    const rarity: MedalRarity = w <= 3 ? "bronze" : w <= 7 ? "prata" : "ouro";
    medals.push({
      id: `x1_wins_${w}`,
      title: w === 1 ? "Primeira Vitória no X1" : `Gladiador X1 (${w} Vitórias)`,
      description: `Vença ${w} ${w === 1 ? "partida" : "partidas"} na Arena de Desafio X1 Online.`,
      rarity,
      category: "x1_vitorias",
      iconName: "Swords",
      condition: { type: "x1_wins_total", threshold: w },
    });
  }

  // 5. Arena X1: Desafios Semanais (5, 10, 15 vitórias na semana)
  medals.push(
    {
      id: "x1_weekly_5",
      title: "Guerreiro Semanal do X1",
      description: "Vença 5 batalhas na Arena X1 no período de uma semana.",
      rarity: "prata",
      category: "x1_semanal",
      iconName: "Zap",
      condition: { type: "x1_wins_weekly", threshold: 5 },
    },
    {
      id: "x1_weekly_10",
      title: "Mestre Semanal do X1",
      description: "Vença 10 batalhas na Arena X1 no período de uma semana.",
      rarity: "ouro",
      category: "x1_semanal",
      iconName: "Shield",
      condition: { type: "x1_wins_weekly", threshold: 10 },
    },
    {
      id: "x1_weekly_15",
      title: "Lenda Semanal do X1",
      description: "Vença 15 batalhas na Arena X1 no período de uma semana.",
      rarity: "platina",
      category: "x1_semanal",
      iconName: "Crown",
      condition: { type: "x1_wins_weekly", threshold: 15 },
    },
  );

  // 6. Exploração: Jogos Diferentes (3, 5 e Dinâmico baseado em ALL_GAME_IDS)
  const allGamesThreshold = Math.max(3, ALL_GAME_IDS.length - 1);
  medals.push(
    {
      id: "explore_3_games",
      title: "Curioso da Lógica",
      description: "Jogue pelo menos 3 jogos diferentes na plataforma.",
      rarity: "bronze",
      category: "exploracao",
      iconName: "Compass",
      condition: { type: "distinct_games", threshold: 3 },
    },
    {
      id: "explore_5_games",
      title: "Explorador da Lógica",
      description: "Jogue pelo menos 5 jogos diferentes na plataforma.",
      rarity: "prata",
      category: "exploracao",
      iconName: "Brain",
      condition: { type: "distinct_games", threshold: 5 },
    },
    {
      id: "explore_all_games",
      title: "Mestre de Todos os Jogos",
      description: `Explore e complete partidas em pelo menos ${allGamesThreshold} jogos diferentes da plataforma.`,
      rarity: "ouro",
      category: "exploracao",
      iconName: "Trophy",
      condition: { type: "distinct_games", threshold: allGamesThreshold },
    },
  );

  // 7. Jogos Diferentes Sem Errar (3, 5 e Dinâmico baseado em ALL_GAME_IDS)
  const flawlessMaxThreshold = Math.max(4, ALL_GAME_IDS.length - 2);
  medals.push(
    {
      id: "flawless_3_games",
      title: "Mente Precisa (3 Jogos)",
      description: "Conquiste vitória com zero erros em pelo menos 3 jogos diferentes.",
      rarity: "prata",
      category: "sem_erros",
      iconName: "CheckCircle",
      condition: { type: "distinct_flawless_games", threshold: 3 },
    },
    {
      id: "flawless_5_games",
      title: "Mente Cirúrgica (5 Jogos)",
      description: "Conquiste vitória com zero erros em pelo menos 5 jogos diferentes.",
      rarity: "ouro",
      category: "sem_erros",
      iconName: "Crosshair",
      condition: { type: "distinct_flawless_games", threshold: 5 },
    },
    {
      id: "flawless_8_games",
      title: `Inviolável da Lógica (${flawlessMaxThreshold} Jogos)`,
      description: `Conquiste vitória com zero erros em pelo menos ${flawlessMaxThreshold} jogos diferentes.`,
      rarity: "platina",
      category: "sem_erros",
      iconName: "Gem",
      condition: { type: "distinct_flawless_games", threshold: flawlessMaxThreshold },
    },
  );

  // 8. Máximo de XP Adquirido no Dia
  medals.push({
    id: "max_daily_xp_achieved",
    title: "Potência Diária Máxima",
    description: "Alcance o limite diário completo de XP (1.000 XP) em um único dia.",
    rarity: "ouro",
    category: "atividade",
    iconName: "Zap",
    condition: { type: "max_daily_xp", threshold: 1000 },
  });

  // 9. Sequência Diária de Atividade (3, 5 e 7 dias consecutivos)
  medals.push(
    {
      id: "streak_3_days",
      title: "Hábito Formado (3 Dias)",
      description: "Fique ativo e jogue partidas por 3 dias consecutivos.",
      rarity: "bronze",
      category: "atividade",
      iconName: "Clock",
      condition: { type: "streak_days", threshold: 3 },
    },
    {
      id: "streak_5_days",
      title: "Disciplina de Campeão (5 Dias)",
      description: "Fique ativo e jogue partidas por 5 dias consecutivos.",
      rarity: "prata",
      category: "atividade",
      iconName: "Flame",
      condition: { type: "streak_days", threshold: 5 },
    },
    {
      id: "streak_7_days",
      title: "Constância Lendária (7 Dias)",
      description: "Fique ativo e jogue partidas por 7 dias consecutivos sem falhar nenhum dia!",
      rarity: "ouro",
      category: "atividade",
      iconName: "Rocket",
      condition: { type: "streak_days", threshold: 7 },
    },
  );

  // 10. Ranking do Torneio Semanal (Top 1 Ouro, Top 2 Prata, Top 3 Bronze)
  medals.push(
    {
      id: "tournament_top_1_gold",
      title: "Campeão Semanal (Ouro)",
      description: "Mantenha o 1º lugar da sua etapa no fechamento do torneio semanal (domingo 23:59).",
      rarity: "ouro",
      category: "ranking",
      iconName: "Trophy",
      condition: { type: "tournament_rank", targetRank: 1 },
    },
    {
      id: "tournament_top_2_silver",
      title: "Vice-Campeão Semanal (Prata)",
      description: "Conquiste o 2º lugar da sua etapa no fechamento do torneio semanal.",
      rarity: "prata",
      category: "ranking",
      iconName: "Medal",
      condition: { type: "tournament_rank", targetRank: 2 },
    },
    {
      id: "tournament_top_3_bronze",
      title: "3º Lugar Semanal (Bronze)",
      description: "Conquiste o 3º lugar da sua etapa no fechamento do torneio semanal.",
      rarity: "bronze",
      category: "ranking",
      iconName: "Award",
      condition: { type: "tournament_rank", targetRank: 3 },
    },
  );

  // 11. Meta-Medalhas Especiais Sugeridas (Platina & Diamante)
  medals.push(
    {
      id: "meta_all_level_medals",
      title: "Lenda dos Níveis",
      description: "Conquiste todas as 9 medalhas de nível, atingindo o Nível Máximo 10!",
      rarity: "platina",
      category: "meta",
      iconName: "Crown",
      condition: { type: "all_level_medals" },
    },
    {
      id: "meta_polymata_semed",
      title: "Polímata da SEMED",
      description: "Consiga a medalha de perfeição (zero erros) em pelo menos 5 jogos diferentes.",
      rarity: "platina",
      category: "meta",
      iconName: "Brain",
      condition: { type: "distinct_flawless_games", threshold: 5 },
    },
    {
      id: "meta_collector_50",
      title: "Colecionador Supremo",
      description: "Acumule 50 ou mais medalhas distintas no seu inventário!",
      rarity: "diamante",
      category: "meta",
      iconName: "Gem",
      condition: { type: "total_medals_count", threshold: 50 },
    },
  );

  // 12. Medalhas Especiais Beta Tester (Válidas de 01 a 07 de Novembro)
  medals.push(
    {
      id: "beta_tester_bronze",
      title: "Beta Tester Bronze",
      description: "Crie sua conta e complete pelo menos 1 partida finalizada durante o período Beta (01 a 07 de Novembro).",
      rarity: "bronze",
      category: "evento",
      iconName: "Sparkles",
      condition: { type: "beta_tester_bronze" },
    },
    {
      id: "beta_tester_prata",
      title: "Beta Tester Prata",
      description: "Jogue e finalize pelo menos 2 partidas de 4 jogos diferentes durante o período Beta (01 a 07 de Novembro).",
      rarity: "prata",
      category: "evento",
      iconName: "Sparkles",
      condition: { type: "beta_tester_prata", threshold: 4 },
    },
    {
      id: "beta_tester_ouro",
      title: "Beta Tester Ouro",
      description: "Jogue e finalize pelo menos 2 partidas de 6 jogos diferentes durante o período Beta (01 a 07 de Novembro).",
      rarity: "ouro",
      category: "evento",
      iconName: "Sparkles",
      condition: { type: "beta_tester_ouro", threshold: 6 },
    },
    {
      id: "beta_tester_platina",
      title: "Beta Tester Platina",
      description: "Jogue e finalize pelo menos 2 partidas de todos os jogos da plataforma durante o período Beta (01 a 07 de Novembro).",
      rarity: "platina",
      category: "evento",
      iconName: "Crown",
      condition: { type: "beta_tester_platina", threshold: ALL_GAME_IDS.length },
    },
    {
      id: "beta_tester_heroi",
      title: "Beta Tester Herói",
      description: "Jogue e finalize pelo menos 10 partidas de todos os jogos e alcance o Nível 5 durante o período Beta (01 a 07 de Novembro).",
      rarity: "heroi",
      category: "evento",
      iconName: "Flame",
      condition: { type: "beta_tester_heroi", threshold: 10 },
    },
  );

  return medals;
}

/** Merges the default catalog with custom medals defined by the administrator */
export function getAllAvailableMedals(customMedals?: MedalDefinition[]): MedalDefinition[] {
  const base = buildBaseMedalsCatalog();
  if (!customMedals || customMedals.length === 0) return base;
  const map = new Map<string, MedalDefinition>();
  base.forEach((m) => map.set(m.id, m));
  customMedals.forEach((m) => map.set(m.id, m));
  return Array.from(map.values());
}

/** Selects the up to 3 highest-rarity / most valuable medals to feature in profile highlights */
export function getTopShowcaseMedals(
  unlockedMedals: PlayerUnlockedMedal[],
  allMedals = getAllAvailableMedals(),
): MedalDefinition[] {
  if (!unlockedMedals || unlockedMedals.length === 0) return [];

  const defMap = new Map<string, MedalDefinition>(allMedals.map((m) => [m.id, m]));
  const list: MedalDefinition[] = [];

  for (const um of unlockedMedals) {
    const def = defMap.get(um.medalId);
    if (def) list.push(def);
  }

  // Sort by rarity weight descending, then by title
  list.sort((a, b) => {
    const weightDiff = RARITY_INFO[b.rarity].weight - RARITY_INFO[a.rarity].weight;
    if (weightDiff !== 0) return weightDiff;
    return a.title.localeCompare(b.title);
  });

  return list.slice(0, 3);
}

export interface PlayerStatsContext {
  profile: PlayerProfile;
  stats: GameStatRow[];
  lastMatch?: {
    gameId: GameId;
    score: number;
    level: number;
    correct: number;
    wrong: number;
    mode?: string;
  };
  todayXpEarned?: number;
  streakDays?: number;
  weeklyX1Wins?: number;
}

/**
 * Evaluates all unlocked medals for a player and returns newly awarded medals.
 */
export function evaluatePlayerMedals(
  ctx: PlayerStatsContext,
  allMedals = getAllAvailableMedals(),
  now = new Date(),
): MedalDefinition[] {
  const existingSet = new Set((ctx.profile.unlockedMedals ?? []).map((m) => m.medalId));
  const newlyAwarded: MedalDefinition[] = [];

  const p = ctx.profile;
  const statsMap = new Map<GameId, GameStatRow>();
  ctx.stats.forEach((s) => statsMap.set(s.game_id, s));

  // Pre-calculate statistics
  const distinctGames = Math.max(
    p.distinctGamesPlayed ?? 0,
    new Set(ctx.stats.map((s) => s.game_id)).size,
  );

  let flawlessGamesCount = 0;
  for (const row of ctx.stats) {
    // Has at least one win and best score is high
    if (row.wins >= 1 && row.best_score >= 30) {
      flawlessGamesCount++;
    }
  }

  const currentLevelMedals = [2, 3, 4, 5, 6, 7, 8, 9, 10].filter((lvl) => p.level >= lvl).length;
  const totalCompletedPlays = ctx.stats.reduce((acc, s) => acc + s.plays, 0);
  const gamesWith2Plays = ctx.stats.filter((s) => s.plays >= 2).length;
  const gamesWith10Plays = ctx.stats.filter((s) => s.plays >= 10).length;
  const isBetaActive = isBetaTesterPeriodActive(now);

  for (const medal of allMedals) {
    if (existingSet.has(medal.id)) continue;
    const cond = medal.condition;
    let earned = false;

    switch (cond.type) {
      case "player_level":
        if (p.level >= (cond.threshold ?? 1)) earned = true;
        break;

      case "game_best_level":
        if (cond.gameId) {
          const s = statsMap.get(cond.gameId);
          if (s && s.best_level >= (cond.threshold ?? 1)) earned = true;
        }
        break;

      case "game_flawless":
        if (
          cond.gameId &&
          ctx.lastMatch &&
          ctx.lastMatch.gameId === cond.gameId &&
          ctx.lastMatch.wrong === 0 &&
          ctx.lastMatch.correct >= 3 &&
          ctx.lastMatch.score >= (cond.threshold ?? 30)
        ) {
          earned = true;
        }
        break;

      case "game_match_count":
        if (cond.gameId) {
          const s = statsMap.get(cond.gameId);
          if (s && s.plays >= (cond.threshold ?? 10)) earned = true;
        }
        break;

      case "x1_wins_total":
        // Tracked strictly in profile.x1Wins (online 1v1 Arena X1 wins only, NOT solo vs CPU)
        if ((p.x1Wins ?? 0) >= (cond.threshold ?? 1)) earned = true;
        break;

      case "x1_wins_weekly":
        if ((ctx.weeklyX1Wins ?? 0) >= (cond.threshold ?? 5)) earned = true;
        break;

      case "distinct_games":
        if (distinctGames >= (cond.threshold ?? 3)) earned = true;
        break;

      case "distinct_flawless_games":
        if (flawlessGamesCount >= (cond.threshold ?? 3)) earned = true;
        break;

      case "max_daily_xp":
        if ((ctx.todayXpEarned ?? p.dailyXp ?? 0) >= (cond.threshold ?? 1000)) earned = true;
        break;

      case "streak_days":
        if ((ctx.streakDays ?? 1) >= (cond.threshold ?? 3)) earned = true;
        break;

      case "tournament_rank":
        // Awarded via tournament finish evaluator
        break;

      case "all_level_medals":
        if (currentLevelMedals === 9) earned = true;
        break;

      case "total_medals_count":
        if ((ctx.profile.unlockedMedals?.length ?? 0) >= (cond.threshold ?? 50)) earned = true;
        break;

      case "beta_tester_bronze":
        if (isBetaActive && (totalCompletedPlays >= 1 || (p.totalPlays ?? 0) >= 1)) {
          earned = true;
        }
        break;

      case "beta_tester_prata":
        if (isBetaActive && gamesWith2Plays >= 4) {
          earned = true;
        }
        break;

      case "beta_tester_ouro":
        if (isBetaActive && gamesWith2Plays >= 6) {
          earned = true;
        }
        break;

      case "beta_tester_platina":
        if (isBetaActive && gamesWith2Plays >= ALL_GAME_IDS.length) {
          earned = true;
        }
        break;

      case "beta_tester_heroi":
        if (isBetaActive && gamesWith10Plays >= ALL_GAME_IDS.length && p.level >= 5) {
          earned = true;
        }
        break;

      case "manual_event":
        // Only granted manually by ADM
        break;

      default:
        break;
    }

    if (earned) {
      newlyAwarded.push(medal);
    }
  }

  return newlyAwarded;
}

export interface MedalProgressInfo {
  percent: number;
  progressText: string;
}

/**
 * Calculates current progress towards unlocking a locked medal.
 */
export function calculateMedalProgress(
  medal: MedalDefinition,
  profile?: PlayerProfile | null,
  stats: GameStatRow[] = [],
): MedalProgressInfo {
  if (!profile) {
    return { percent: 0, progressText: "" };
  }

  const cond = medal.condition;
  const statsMap = new Map<GameId, GameStatRow>();
  stats.forEach((s) => statsMap.set(s.game_id, s));

  switch (cond.type) {
    case "player_level": {
      const target = cond.threshold ?? 2;
      const cur = profile.level;
      const pct = Math.min(100, Math.round((cur / target) * 100));
      return {
        percent: pct,
        progressText: `Nível ${cur} de ${target} alcançado`,
      };
    }
    case "game_best_level": {
      const gId = cond.gameId!;
      const cur = statsMap.get(gId)?.best_level ?? 1;
      const target = cond.threshold ?? 3;
      const pct = Math.min(100, Math.round((cur / target) * 100));
      return {
        percent: pct,
        progressText: `Nível ${cur} de ${target}`,
      };
    }
    case "game_match_count": {
      const gId = cond.gameId!;
      const cur = statsMap.get(gId)?.plays ?? 0;
      const target = cond.threshold ?? 10;
      const pct = Math.min(100, Math.round((cur / target) * 100));
      return {
        percent: pct,
        progressText: `${cur} de ${target} partidas concluídas`,
      };
    }
    case "x1_wins_total": {
      const cur = profile.x1Wins ?? 0;
      const target = cond.threshold ?? 1;
      const pct = Math.min(100, Math.round((cur / target) * 100));
      return {
        percent: pct,
        progressText: `${cur} de ${target} vitórias conquistadas no X1 Online`,
      };
    }
    case "distinct_games": {
      const distinct = Math.max(profile.distinctGamesPlayed ?? 0, stats.length);
      const target = cond.threshold ?? 3;
      const pct = Math.min(100, Math.round((distinct / target) * 100));
      return {
        percent: pct,
        progressText: `${distinct} de ${target} jogos explorados`,
      };
    }
    case "distinct_flawless_games": {
      let count = 0;
      for (const row of stats) {
        if (row.wins >= 1 && row.best_score >= 30) count++;
      }
      const target = cond.threshold ?? 3;
      const pct = Math.min(100, Math.round((count / target) * 100));
      return {
        percent: pct,
        progressText: `${count} de ${target} jogos com vitória sem erros`,
      };
    }
    case "total_medals_count": {
      const count = profile.unlockedMedals?.length ?? 0;
      const target = cond.threshold ?? 50;
      const pct = Math.min(100, Math.round((count / target) * 100));
      return {
        percent: pct,
        progressText: `${count} de ${target} medalhas obtidas`,
      };
    }
    case "all_level_medals": {
      const cur = profile.level;
      const pct = Math.min(100, Math.round((cur / 10) * 100));
      return {
        percent: pct,
        progressText: `Nível ${cur}/10 para Lenda dos Níveis`,
      };
    }
    case "beta_tester_bronze": {
      const totalPlays = stats.reduce((acc, s) => acc + s.plays, 0);
      const pct = totalPlays >= 1 || (profile.totalPlays ?? 0) >= 1 ? 100 : 0;
      return {
        percent: pct,
        progressText: `${pct === 100 ? 1 : 0} de 1 partida finalizada`,
      };
    }
    case "beta_tester_prata": {
      const games = stats.filter((s) => s.plays >= 2).length;
      const target = 4;
      const pct = Math.min(100, Math.round((games / target) * 100));
      return {
        percent: pct,
        progressText: `${games} de ${target} jogos com 2+ partidas finalizadas`,
      };
    }
    case "beta_tester_ouro": {
      const games = stats.filter((s) => s.plays >= 2).length;
      const target = 6;
      const pct = Math.min(100, Math.round((games / target) * 100));
      return {
        percent: pct,
        progressText: `${games} de ${target} jogos com 2+ partidas finalizadas`,
      };
    }
    case "beta_tester_platina": {
      const games = stats.filter((s) => s.plays >= 2).length;
      const target = ALL_GAME_IDS.length;
      const pct = Math.min(100, Math.round((games / target) * 100));
      return {
        percent: pct,
        progressText: `${games} de ${target} jogos com 2+ partidas finalizadas`,
      };
    }
    case "beta_tester_heroi": {
      const games = stats.filter((s) => s.plays >= 10).length;
      const targetGames = ALL_GAME_IDS.length;
      const lvlTarget = 5;
      const lvlPct = Math.min(1, profile.level / lvlTarget);
      const gamesPct = Math.min(1, games / targetGames);
      const pct = Math.min(100, Math.round(((lvlPct + gamesPct) / 2) * 100));
      return {
        percent: pct,
        progressText: `${games} de ${targetGames} jogos com 10+ partidas (Nível ${profile.level}/${lvlTarget})`,
      };
    }
    default:
      return { percent: 0, progressText: medal.description };
  }
}
