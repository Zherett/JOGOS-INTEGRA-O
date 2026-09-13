REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nick_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nick_available(TEXT) TO anon, authenticated;