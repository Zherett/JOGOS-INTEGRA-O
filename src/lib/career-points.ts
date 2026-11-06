import type { PlayerProfile } from "./playfab.ts";
import type { MedalRarity } from "./medals-catalog.ts";
import { getLocalDateKey } from "./player-profile.ts";

/** Pontos concedidos por raridade de medalha */
export const MEDAL_POINTS_REWARDS: Record<MedalRarity, number> = {
  bronze: 20,
  prata: 30,
  ouro: 50,
  platina: 100,
  diamante: 150,
  heroi: 150,
};

/** Pontos concedidos ao subir para cada nível (2 a 10) */
export const LEVEL_POINTS_REWARDS: Record<number, number> = {
  2: 30,
  3: 40,
  4: 50,
  5: 75,
  6: 100,
  7: 150,
  8: 200,
  9: 300,
  10: 500,
};

/** Pontos concedidos ao alcançar uma nova classe no torneio semanal */
export const TOURNAMENT_TIER_PROMOTION_POINTS: Record<string, number> = {
  prata: 50,
  ouro: 100,
  platina: 150,
  diamante: 250,
  mestre: 400,
};

export const RECORD_PERSONAL_POINTS = 15;
export const RECORD_STAGE_MAX_POINTS = 50;
export const X1_WIN_POINTS = 10;
export const FLAWLESS_MATCH_POINTS = 10;
export const RANKED_WIN_POINTS = 10;
export const DAILY_LOGIN_POINTS = 25;
export const DAILY_FIRST_GAME_POINTS = 10;

/**
 * Concede pontos ao jogador, atualizando tanto o saldo gastável (pointsBalance)
 * quanto o total histórico acumulado (careerPoints) que governa o Hall da Fama.
 */
export function awardCareerPoints(
  profile: PlayerProfile,
  basePoints: number,
  _reason?: string,
  multiplier = 1,
): { profile: PlayerProfile; pointsAwarded: number } {
  const safeMult = Math.max(1, multiplier);
  const pointsAwarded = Math.round(basePoints * safeMult);
  if (pointsAwarded <= 0) {
    return { profile, pointsAwarded: 0 };
  }

  const currentBalance = profile.pointsBalance ?? 0;
  const currentCareer = profile.careerPoints ?? 0;

  profile.pointsBalance = Math.max(0, currentBalance + pointsAwarded);
  profile.careerPoints = Math.max(0, currentCareer + pointsAwarded);

  return { profile, pointsAwarded };
}

/**
 * Deduz pontos do saldo gastável do jogador (para compras futuras de itens/moeda).
 * O total histórico (careerPoints) NUNCA é reduzido, garantindo que compras
 * não rebaixem o aluno no ranking geral do Hall da Fama.
 */
export function spendCareerPoints(
  profile: PlayerProfile,
  cost: number,
): { success: boolean; newBalance: number } {
  const currentBalance = profile.pointsBalance ?? 0;
  if (cost <= 0) return { success: true, newBalance: currentBalance };
  if (currentBalance < cost) {
    return { success: false, newBalance: currentBalance };
  }

  profile.pointsBalance = currentBalance - cost;
  return { success: true, newBalance: profile.pointsBalance };
}

/**
 * Avalia e concede 25 pontos pelo primeiro login do dia (1x a cada 24h).
 */
export function checkAndApplyDailyLoginPoints(
  profile: PlayerProfile,
  now = new Date(),
  multiplier = 1,
): { profile: PlayerProfile; pointsAwarded: number } {
  const todayKey = getLocalDateKey(now);
  if (profile.lastDailyLoginPointsDate === todayKey) {
    return { profile, pointsAwarded: 0 };
  }

  profile.lastDailyLoginPointsDate = todayKey;
  return awardCareerPoints(profile, DAILY_LOGIN_POINTS, "Login diário", multiplier);
}

/**
 * Avalia e concede 10 pontos por jogar a primeira partida no dia (1x a cada 24h).
 */
export function checkAndApplyFirstGameOfDayPoints(
  profile: PlayerProfile,
  now = new Date(),
  multiplier = 1,
): { profile: PlayerProfile; pointsAwarded: number } {
  const todayKey = getLocalDateKey(now);
  if (profile.lastDailyFirstGamePointsDate === todayKey) {
    return { profile, pointsAwarded: 0 };
  }

  profile.lastDailyFirstGamePointsDate = todayKey;
  return awardCareerPoints(profile, DAILY_FIRST_GAME_POINTS, "Primeiro jogo do dia", multiplier);
}

/**
 * Avalia se o aluno alcançou novos patamares de classe na ranqueada
 * (Prata, Ouro, Platina, Diamante, Mestre) e concede a pontuação devida apenas 1 vez por tier.
 */
export function checkTournamentTierPromotion(
  rankId: string,
  profile: PlayerProfile,
  multiplier = 1,
): { profile: PlayerProfile; pointsAwarded: number; newTiers: string[] } {
  const tier = rankId.split("_")[0]?.toLowerCase();
  if (!tier || !TOURNAMENT_TIER_PROMOTION_POINTS[tier]) {
    return { profile, pointsAwarded: 0, newTiers: [] };
  }

  const achieved = new Set<string>(profile.achievedTournamentTiers ?? []);
  if (achieved.has(tier)) {
    return { profile, pointsAwarded: 0, newTiers: [] };
  }

  achieved.add(tier);
  profile.achievedTournamentTiers = Array.from(achieved);

  const basePoints = TOURNAMENT_TIER_PROMOTION_POINTS[tier];
  const { pointsAwarded } = awardCareerPoints(
    profile,
    basePoints,
    `Promoção para Liga ${tier.toUpperCase()}`,
    multiplier,
  );

  return { profile, pointsAwarded, newTiers: [tier] };
}

/**
 * Avalia se o jogador subiu para um nível que ainda não foi recompensado em pontos.
 */
export function checkLevelPromotionPoints(
  level: number,
  profile: PlayerProfile,
  multiplier = 1,
): { profile: PlayerProfile; pointsAwarded: number } {
  if (level < 2 || level > 10) {
    return { profile, pointsAwarded: 0 };
  }

  const rewarded = new Set<number>(profile.achievedLevelsPoints ?? []);
  let totalAwarded = 0;

  // Garante que todos os níveis até o atual foram recompensados
  for (let lvl = 2; lvl <= level; lvl++) {
    if (!rewarded.has(lvl)) {
      rewarded.add(lvl);
      const basePts = LEVEL_POINTS_REWARDS[lvl] ?? 0;
      if (basePts > 0) {
        const { pointsAwarded } = awardCareerPoints(
          profile,
          basePts,
          `Alcance do Nível ${lvl}`,
          multiplier,
        );
        totalAwarded += pointsAwarded;
      }
    }
  }

  profile.achievedLevelsPoints = Array.from(rewarded);
  return { profile, pointsAwarded: totalAwarded };
}

/**
 * Calcula a pontuação histórica retroativa para jogadores já existentes com base
 * nas medalhas desbloqueadas e no nível atual, evitando que comecem do zero.
 */
export function calculateRetroactivePoints(profile: PlayerProfile): number {
  let sum = 0;

  // 1. Pontos de medalhas já conquistadas
  if (Array.isArray(profile.unlockedMedals)) {
    for (const m of profile.unlockedMedals) {
      const rarity = (m.rarity ?? "bronze") as MedalRarity;
      sum += MEDAL_POINTS_REWARDS[rarity] ?? 20;
    }
  }

  // 2. Pontos de níveis já alcançados
  const lvl = Math.min(10, Math.max(1, profile.level ?? 1));
  for (let l = 2; l <= lvl; l++) {
    sum += LEVEL_POINTS_REWARDS[l] ?? 0;
  }

  // 3. Pontos de vitórias acumuladas no X1
  if ((profile.x1Wins ?? 0) > 0) {
    sum += (profile.x1Wins ?? 0) * X1_WIN_POINTS;
  }

  return sum;
}

/**
 * Garante que o perfil possua `careerPoints` e `pointsBalance` inicializados,
 * aplicando reconciliação retroativa justa caso estejam zerados/indefinidos.
 */
export function ensurePlayerCareerPointsInitialized(profile: PlayerProfile): PlayerProfile {
  const needsInit =
    profile.careerPoints === undefined ||
    profile.pointsBalance === undefined ||
    (profile.careerPoints === 0 && ((profile.level ?? 1) > 1 || (profile.unlockedMedals?.length ?? 0) > 0));

  if (needsInit) {
    const retroPoints = calculateRetroactivePoints(profile);
    const existingCareer = profile.careerPoints ?? 0;
    const finalPoints = Math.max(existingCareer, retroPoints);
    profile.careerPoints = finalPoints;
    profile.pointsBalance = Math.max(profile.pointsBalance ?? 0, finalPoints);

    // Marca os níveis já atingidos para não duplicar no futuro
    const curLevel = Math.min(10, Math.max(1, profile.level ?? 1));
    const lvlList: number[] = [];
    for (let l = 2; l <= curLevel; l++) {
      lvlList.push(l);
    }
    profile.achievedLevelsPoints = Array.from(new Set([...(profile.achievedLevelsPoints ?? []), ...lvlList]));
  }

  return profile;
}
