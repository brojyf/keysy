-- Supabase session inactivity timeouts need the Pro plan. This job ends
-- sessions unused for 30 days, which matches the auth refresh cookie lifetime.
create extension if not exists pg_cron with schema pg_catalog;

-- Refresh tokens and MFA claims of each session are deleted by cascade.
create function public.delete_idle_sessions()
returns void
language sql
security definer
set search_path = ''
as $$
  -- refreshed_at is a UTC timestamp without time zone.
  delete from auth.sessions as sessions
  where coalesce(sessions.refreshed_at at time zone 'UTC', sessions.created_at)
    < now() - interval '30 days';
$$;

revoke execute on function public.delete_idle_sessions() from public, anon, authenticated;

select cron.schedule('delete-idle-sessions', '0 3 * * *', 'select public.delete_idle_sessions()');
