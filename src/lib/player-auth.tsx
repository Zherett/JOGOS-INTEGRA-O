import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { onMatchSaved, type GameId } from "./game-storage";
import { nickToEmail, nickSlug, levelFromXp, xpFromMatch, type Badge } from "./player-profile";

export interface PlayerProfile {
  id: string;
  nick: string;
  full_name: string;
  school: string;
  grade: string | null;
  birthdate: string;
  xp: number;
  level: number;
  badges: Badge[];
}

export interface GameStatRow {
  game_id: string;
  mode: string;
  plays: number;
  best_score: number;
  best_level: number;
}

export interface SignUpData {
  nick: string;
  password: string;
  fullName: string;
  school: string;
  grade: string | null;
  birthdate: string;
}

interface AuthValue {
  loading: boolean;
  user: User | null;
  profile: PlayerProfile | null;
  unlocked: GameId[];
  stats: GameStatRow[];
  signUp: (data: SignUpData) => Promise<{ error: string | null }>;
  signIn: (nick: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  unlockGames: (games: GameId[]) => Promise<void>;
  recordMatch: (args: {
    gameId: GameId; mode?: string; score: number; level: number; correct: number;
  }) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function usePlayerAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayerAuth must be used inside PlayerAuthProvider");
  return ctx;
}

export function PlayerAuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [unlocked, setUnlocked] = useState<GameId[]>([]);
  const [stats, setStats] = useState<GameStatRow[]>([]);

  const user = session?.user ?? null;

  const loadAll = useCallback(async (uid: string) => {
    const [p, u, s] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("unlocked_games").select("game_id").eq("user_id", uid),
      supabase.from("game_stats").select("game_id, mode, plays, best_score, best_level").eq("user_id", uid),
    ]);
    setProfile(
      p.data
        ? { ...p.data, badges: Array.isArray(p.data.badges) ? (p.data.badges as unknown as Badge[]) : [] }
        : null,
    );
    setUnlocked(((u.data ?? []) as { game_id: string }[]).map((r) => r.game_id as GameId));
    setStats((s.data ?? []) as GameStatRow[]);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s?.user) {
        setProfile(null);
        setUnlocked([]);
        setStats([]);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.id) void loadAll(user.id);
  }, [user?.id, loadAll]);

  const refresh = useCallback(async () => {
    if (user?.id) await loadAll(user.id);
  }, [user?.id, loadAll]);

  const signUp = useCallback(async (data: SignUpData) => {
    const slug = nickSlug(data.nick);
    if (slug.length < 3) return { error: "O apelido precisa ter ao menos 3 letras ou números." };
    if (data.password.length < 6) return { error: "A senha precisa ter ao menos 6 caracteres." };

    const { data: available, error: rpcError } = await supabase.rpc("nick_available", { _nick: slug });
    if (rpcError) return { error: "Não foi possível verificar o apelido. Tente novamente." };
    if (available === false) return { error: "Esse apelido já está em uso. Escolha outro." };

    const { error } = await supabase.auth.signUp({
      email: nickToEmail(data.nick),
      password: data.password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: {
          nick: data.nick.trim(),
          full_name: data.fullName.trim(),
          school: data.school,
          grade: data.grade ?? "",
          birthdate: data.birthdate,
        },
      },
    });
    if (error) {
      return {
        error: error.message.toLowerCase().includes("already")
          ? "Esse apelido já está em uso. Escolha outro."
          : "Não foi possível criar o perfil. Tente novamente.",
      };
    }
    return { error: null };
  }, []);

  const signIn = useCallback(async (nick: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: nickToEmail(nick),
      password,
    });
    if (error) return { error: "Apelido ou senha incorretos." };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUnlocked([]);
    setStats([]);
  }, []);

  const unlockGames = useCallback(
    async (games: GameId[]) => {
      if (!user?.id || games.length === 0) return;
      await supabase
        .from("unlocked_games")
        .upsert(games.map((g) => ({ user_id: user.id, game_id: g })), { onConflict: "user_id,game_id" });
      setUnlocked((cur) => [...new Set([...cur, ...games])]);
    },
    [user?.id],
  );

  const recordMatch = useCallback(
    async ({ gameId, mode = "padrao", score, level, correct }: {
      gameId: GameId; mode?: string; score: number; level: number; correct: number;
    }) => {
      if (!user?.id) return;
      const existing = stats.find((s) => s.game_id === gameId && s.mode === mode);
      const row = {
        user_id: user.id,
        game_id: gameId,
        mode,
        plays: (existing?.plays ?? 0) + 1,
        best_score: Math.max(existing?.best_score ?? 0, score),
        best_level: Math.max(existing?.best_level ?? 1, level),
        last_played_at: new Date().toISOString(),
      };
      await supabase.from("game_stats").upsert(row, { onConflict: "user_id,game_id,mode" });

      const gainedXp = (profile?.xp ?? 0) + xpFromMatch(score, correct);
      await supabase
        .from("profiles")
        .update({ xp: gainedXp, level: levelFromXp(gainedXp) })
        .eq("id", user.id);

      await loadAll(user.id);
    },
    [user?.id, stats, profile?.xp, loadAll],
  );

  useEffect(() => {
    if (!user?.id) {
      onMatchSaved(null);
      return;
    }
    onMatchSaved((id, match) => {
      void recordMatch({
        gameId: id,
        mode: match.mode ?? "padrao",
        score: match.score,
        level: match.level,
        correct: match.correct,
      });
    });
    return () => onMatchSaved(null);
  }, [user?.id, recordMatch]);

  const value = useMemo<AuthValue>(
    () => ({ loading, user, profile, unlocked, stats, signUp, signIn, signOut, unlockGames, recordMatch, refresh }),
    [loading, user, profile, unlocked, stats, signUp, signIn, signOut, unlockGames, recordMatch, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
