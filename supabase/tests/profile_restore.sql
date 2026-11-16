-- Run as a superuser against a disposable database after applying migrations.
-- All fixtures and assertions are rolled back.
-- GoTrue creates auth.sessions, so on a bare supabase/postgres image create the
-- auth.sessions stub from sessions.sql before applying migrations.
begin;

insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000001', 'deleted@example.com'),
  ('40000000-0000-0000-0000-000000000002', 'active@example.com'),
  ('40000000-0000-0000-0000-000000000003', 'other-deleted@example.com');

update public.profiles set deleted_at = '2026-11-10 12:00:00+00'
where id in ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003');

-- Supabase Auth inserts sessions as supabase_auth_admin, which cannot write public.profiles.
set local role supabase_auth_admin;
insert into auth.sessions (id, user_id, created_at) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', now()),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', now());
reset role;

do $$
begin
  assert (select deleted_at is null from public.profiles
    where id = '40000000-0000-0000-0000-000000000001'),
    'A new session must restore a deleted profile';
  assert (select deleted_at is null from public.profiles
    where id = '40000000-0000-0000-0000-000000000002'),
    'A new session must leave an active profile active';
  assert (select deleted_at = '2026-11-10 12:00:00+00' from public.profiles
    where id = '40000000-0000-0000-0000-000000000003'),
    'A new session must not restore other profiles';

  assert not has_function_privilege('anon', 'public.restore_deleted_profile()', 'execute')
    and not has_function_privilege('authenticated', 'public.restore_deleted_profile()', 'execute'),
    'Client roles must not execute the restore function';
  assert (select prosecdef and proowner = 'postgres'::regrole
    from pg_proc where oid = 'public.restore_deleted_profile()'::regprocedure),
    'The restore function must run as its owner, postgres';
end;
$$;

rollback;
