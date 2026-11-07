/**
 * season-cycle.ts
 *
 * Módulo de Lógica de Ciclos de Temporada (Duração em Dias, Presets de 7/14/30 dias,
 * Extensão de Prazos, Renovação Automática em Cadeia e Indicadores de Progresso).
 */

export const SEASON_DURATION_PRESETS = [7, 14, 30] as const;
export type SeasonDurationPreset = (typeof SEASON_DURATION_PRESETS)[number];

export const DEFAULT_SEASON_DURATION_DAYS: SeasonDurationPreset = 14;

export interface SeasonProgressInfo {
  start: Date;
  end: Date | null;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  remainingHours: number;
  progressPercent: number;
  isExpired: boolean;
  formattedCountdown: string;
  formattedRangeLabel: string;
}

/**
 * Calcula a data de início e término exatas a partir de uma data base e da quantidade de dias.
 * Se uma temporada dura N dias (ex: 7 ou 14 dias), o encerramento ocorre no N-ésimo dia às 23:59:59.999.
 */
export function computeSeasonDates(
  startDate: Date = new Date(),
  durationDays: number = DEFAULT_SEASON_DURATION_DAYS,
): { start: Date; end: Date } {
  const start = new Date(startDate);
  const daysOffset = Math.max(1, durationDays) - 1;
  const end = new Date(start);
  end.setDate(end.getDate() + daysOffset);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Estende uma data de encerramento em um número específico de dias (ex: +3, +7, +14).
 * Mantém o horário padronizado de encerramento (23:59:59).
 */
export function extendSeasonDate(
  currentEndDate: Date,
  additionalDays: number,
): Date {
  const safeDays = Math.max(1, additionalDays);
  const baseMs = currentEndDate instanceof Date && !Number.isNaN(currentEndDate.getTime())
    ? currentEndDate.getTime()
    : Date.now();
  const nextEnd = new Date(baseMs + safeDays * 24 * 60 * 60 * 1000);
  nextEnd.setHours(23, 59, 59, 999);
  return nextEnd;
}

/**
 * Converte um objeto Date para o formato ISO aceito pelo <input type="datetime-local">
 * preservando o fuso horário local do navegador (YYYY-MM-DDTHH:mm).
 */
export function toDatetimeLocalString(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Faz o parse seguro de uma string datetime-local para Date.
 */
export function parseDatetimeLocal(str: string): Date | null {
  if (!str || typeof str !== "string") return null;
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Calcula métricas completas de progresso e contagem regressiva para a temporada vigente.
 */
export function getSeasonProgress(
  startIso?: string | null,
  endIso?: string | null,
  nowMs = Date.now(),
): SeasonProgressInfo {
  const now = new Date(nowMs);
  const start = startIso ? new Date(startIso) : new Date(nowMs - 7 * 24 * 60 * 60 * 1000);
  const safeStart = Number.isNaN(start.getTime()) ? new Date(nowMs - 7 * 24 * 60 * 60 * 1000) : start;

  const end = endIso ? new Date(endIso) : null;
  const safeEnd = end && !Number.isNaN(end.getTime()) ? end : null;

  if (!safeEnd) {
    return {
      start: safeStart,
      end: null,
      totalDays: 14,
      elapsedDays: 0,
      remainingDays: 14,
      remainingHours: 0,
      progressPercent: 0,
      isExpired: false,
      formattedCountdown: "Encerramento não agendado (Ciclo Contínuo)",
      formattedRangeLabel: `Iniciada em ${safeStart.toLocaleDateString("pt-BR")}`,
    };
  }

  const totalMs = Math.max(1000, safeEnd.getTime() - safeStart.getTime());
  const elapsedMs = Math.max(0, nowMs - safeStart.getTime());
  const remainingMs = Math.max(0, safeEnd.getTime() - nowMs);

  const totalDays = Math.max(1, Math.round(totalMs / (24 * 60 * 60 * 1000)));
  const elapsedDays = Math.min(totalDays, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
  const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
  const remainingHours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
  const isExpired = nowMs >= safeEnd.getTime();

  let formattedCountdown = "";
  if (isExpired) {
    formattedCountdown = "Temporada Concluída! Aguardando renovação...";
  } else if (remainingDays === 0 && remainingHours <= 1) {
    const remainingMins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    formattedCountdown = `Última hora! Termina em ${remainingMins} min`;
  } else if (remainingDays === 0) {
    formattedCountdown = `Termina hoje! Restam ${remainingHours}h`;
  } else {
    formattedCountdown = `Termina em ${remainingDays}d e ${remainingHours}h (${safeEnd.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${safeEnd.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})`;
  }

  const formattedRangeLabel = `${safeStart.toLocaleDateString("pt-BR")} até ${safeEnd.toLocaleDateString("pt-BR")} (${totalDays} dias)`;

  return {
    start: safeStart,
    end: safeEnd,
    totalDays,
    elapsedDays,
    remainingDays,
    remainingHours,
    progressPercent,
    isExpired,
    formattedCountdown,
    formattedRangeLabel,
  };
}
