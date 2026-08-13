CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nick TEXT NOT NULL,
  nick_normalized TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  school TEXT NOT NULL,
  grade TEXT,
  birthdate DATE NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Players can create their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Players can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.unlocked_games (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);

GRANT SELECT, INSERT, DELETE ON public.unlocked_games TO authenticated;
GRANT ALL ON public.unlocked_games TO service_role;
ALTER TABLE public.unlocked_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their unlocked games" ON public.unlocked_games
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Players can unlock games for themselves" ON public.unlocked_games
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Players can remove their unlocked games" ON public.unlocked_games
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.game_stats (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'padrao',
  plays INTEGER NOT NULL DEFAULT 0,
  best_score INTEGER NOT NULL DEFAULT 0,
  best_level INTEGER NOT NULL DEFAULT 1,
  last_played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id, mode)
);

GRANT SELECT, INSERT, UPDATE ON public.game_stats TO authenticated;
GRANT ALL ON public.game_stats TO service_role;
ALTER TABLE public.game_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their own stats" ON public.game_stats
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Players can insert their own stats" ON public.game_stats
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Players can update their own stats" ON public.game_stats
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.nick_available(_nick TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE nick_normalized = lower(trim(_nick))
  );
$$;

GRANT EXECUTE ON FUNCTION public.nick_available(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nick, nick_normalized, full_name, school, grade, birthdate)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nick', 'jogador'),
    lower(trim(COALESCE(NEW.raw_user_meta_data ->> 'nick', 'jogador'))),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'school', 'Outra'),
    NULLIF(NEW.raw_user_meta_data ->> 'grade', ''),
    COALESCE((NEW.raw_user_meta_data ->> 'birthdate')::date, '2010-01-01'::date)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();