-- Run as a superuser against a disposable database after applying migrations.
-- All fixtures and assertions are rolled back.
-- GoTrue creates auth.sessions, so a bare supabase/postgres image lacks it.
-- Apply migrations there with check_function_bodies off; this file then adds
-- a stub that matches the production names, types, owner, and grants.
begin;

do $$
begin
  if to_regclass('auth.sessions') is null then
    create table auth.sessions (
      id uuid primary key,
      user_id uuid not null references auth.users (id) on delete cascade,
      created_at timestamptz,
      updated_at timestamptz,
      factor_id uuid,
      not_after timestamptz,
      refreshed_at timestamp,
      user_agent text,
      ip inet,
      tag text
    );
    alter table auth.sessions owner to supabase_auth_admin;
    alter table auth.sessions enable row level security;
    grant select, delete on auth.sessions to postgres;
    alter table auth.refresh_tokens
      add column session_id uuid references auth.sessions (id) on delete cascade;
  end if;
end;
$$;

-- refreshed_at is UTC; a non-UTC session time zone must not shift it.
set local timezone = 'America/Vancouver';

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'owner@example.com'),
  ('10000000-0000-0000-0000-000000000002', 'other@example.com');

insert into auth.sessions (id, user_id, created_at, refreshed_at, not_after, user_agent) values
  -- Refreshed: last used at refreshed_at.
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    '2026-11-01 08:00:00+00', '2026-11-03 12:00:00', null, 'Chrome'),
  -- Never refreshed: last used at created_at.
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
    '2026-11-02 09:00:00+00', null, now() + interval '1 day', 'Safari'),
  -- Same last use as the first session: ordered by ID.
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
    '2026-11-03 12:00:00+00', null, null, null),
  -- Expired.
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
    '2026-11-04 08:00:00+00', null, now() - interval '1 second', 'Expired'),
  -- Another user's session.
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002',
    '2026-11-05 08:00:00+00', null, null, 'Other');

insert into auth.refresh_tokens (token, user_id, session_id) values
  ('owner-token', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002'),
  ('other-token', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000005');

do $$
begin
  assert (select array_agg(id order by ordinality) = array[
      '30000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000003',
      '30000000-0000-0000-0000-000000000002']::uuid[]
    from public.list_user_sessions('10000000-0000-0000-0000-000000000001') with ordinality),
    'Only active own sessions must be listed, newest last use first, then by ID';
  assert (select last_used_at = '2026-11-03 12:00:00+00' and user_agent = 'Chrome'
    from public.list_user_sessions('10000000-0000-0000-0000-000000000001')
    where id = '30000000-0000-0000-0000-000000000001'),
    'Last use must be refreshed_at read as UTC';
  assert (select last_used_at = '2026-11-02 09:00:00+00'
    from public.list_user_sessions('10000000-0000-0000-0000-000000000001')
    where id = '30000000-0000-0000-0000-000000000002'),
    'Last use must fall back to created_at';
  assert (select user_agent is null
    from public.list_user_sessions('10000000-0000-0000-0000-000000000001')
    where id = '30000000-0000-0000-0000-000000000003'),
    'A missing user agent must stay null';

  assert not public.revoke_user_session('10000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000005'),
    'Revoking another user''s session must return false';
  assert exists (select from auth.sessions where id = '30000000-0000-0000-0000-000000000005')
    and exists (select from auth.refresh_tokens where token = 'other-token'),
    'Revoking another user''s session must delete nothing';
  assert not public.revoke_user_session('10000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000099'),
    'Revoking a missing session must return false';

  assert public.revoke_user_session('10000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000002'),
    'Revoking an own session must return true';
  assert not exists (select from auth.sessions where id = '30000000-0000-0000-0000-000000000002'),
    'Revoking an own session must delete it';
  assert not exists (select from auth.refresh_tokens where token = 'owner-token'),
    'Revoking a session must cascade to its refresh tokens';
  assert not public.revoke_user_session('10000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000002'),
    'Revoking a session again must return false';

  assert not has_function_privilege('anon', 'public.list_user_sessions(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.list_user_sessions(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.revoke_user_session(uuid, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.revoke_user_session(uuid, uuid)', 'execute'),
    'Client roles must not execute session functions';
  assert (select bool_and(prosecdef) and bool_and(proowner = 'postgres'::regrole)
    from pg_proc where oid in ('public.list_user_sessions(uuid)'::regprocedure,
      'public.revoke_user_session(uuid, uuid)'::regprocedure)),
    'Session functions must run as their owner, postgres';
end;
$$;

-- Like keysy_api, a role with only EXECUTE and no auth schema access can use the functions.
create role sessions_test_api nologin;
grant execute on function public.list_user_sessions(uuid) to sessions_test_api;
grant execute on function public.revoke_user_session(uuid, uuid) to sessions_test_api;

set local role sessions_test_api;
do $$
begin
  assert (select count(*) = 2
    from public.list_user_sessions('10000000-0000-0000-0000-000000000001')),
    'An EXECUTE-only role must list sessions';
  assert public.revoke_user_session('10000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000003'),
    'An EXECUTE-only role must revoke sessions';
  begin
    perform 1 from auth.sessions;
    raise exception 'An EXECUTE-only role must not read auth.sessions directly';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
