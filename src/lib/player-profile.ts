// Player profile helpers: schools, age, XP and levels.

export const SCHOOLS = [
  { name: "Raimundo Bezerra", range: "6º ao 9º", needsGrade: true },
  { name: "Elisângela Litaiff", range: "5º", needsGrade: false },
  { name: "Raimunda Cruz", range: "5º", needsGrade: false },
  { name: "Ursulina Souza", range: "5º", needsGrade: false },
  { name: "Maria de Nazaré", range: "5º", needsGrade: false },
  { name: "Outra", range: "", needsGrade: false },
] as const;

export const GRADES = ["6º ano", "7º ano", "8º ano", "9º ano"] as const;

export function schoolNeedsGrade(school: string) {
  return SCHOOLS.find((s) => s.name === school)?.needsGrade ?? false;
}

/** Turns a nick into a login-safe identifier. */
export function nickSlug(nick: string) {
  return nick
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

/** Internal login address derived from the nick (players never see it). */
export function nickToEmail(nick: string) {
  return `${nickSlug(nick)}@jogador.desafios.app`;
}

export function ageFrom(birthdate: string): number {
  const b = new Date(`${birthdate}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

/** Next birthday date and how many days are left. */
export function birthdayInfo(birthdate: string) {
  const b = new Date(`${birthdate}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
  const days = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  return {
    date: next,
    label: next.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }),
    daysLeft: days,
    isToday: days === 0,
  };
}

/* ------------------------------ XP and levels ----------------------------- */

/** XP needed to reach a given level (grows gently). */
export function xpForLevel(level: number) {
  return 50 * level * (level - 1);
}

export function levelFromXp(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  return {
    level,
    current: xp - start,
    needed: end - start,
    percent: Math.round(((xp - start) / (end - start)) * 100),
  };
}

/** XP earned by a finished match. */
export function xpFromMatch(score: number, correct: number) {
  return Math.max(0, Math.round(score / 2) + correct * 2);
}

export interface Badge {
  id: string;
  label: string;
  earnedAt: string;
}
