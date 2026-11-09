-- The api role has no access to schema auth, so it reads and revokes
-- sessions only through these functions.
create function public.list_user_sessions(target_user_id uuid)
returns table (id uuid, user_agent text, last_used_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  -- refreshed_at is a UTC timestamp without time zone.
  select sessions.id, sessions.user_agent,
    coalesce(sessions.refreshed_at at time zone 'UTC', sessions.created_at) as last_used_at
  from auth.sessions as sessions
  where sessions.user_id = target_user_id
    and (sessions.not_after is null or sessions.not_after > now())
  order by last_used_at desc, sessions.id asc;
$$;

revoke execute on function public.list_user_sessions(uuid) from public, anon, authenticated;

-- Refresh tokens and MFA claims of the session are deleted by cascade.
create function public.revoke_user_session(target_user_id uuid, target_session_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with revoked_session as (
    delete from auth.sessions as sessions
    where sessions.id = target_session_id and sessions.user_id = target_user_id
    returning sessions.id
  )
  select exists (select 1 from revoked_session);
$$;

revoke execute on function public.revoke_user_session(uuid, uuid) from public, anon, authenticated;
