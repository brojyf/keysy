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

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'owner@example.com'),
  ('10000000-0000-0000-0000-000000000002', 'other@example.com');
insert into auth.sessions (id, user_id) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002');

insert into auth.refresh_tokens (token, user_id, session_id) values
  ('owner-token', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
  ('other-token', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003');

select public.revoke_all_user_sessions('10000000-0000-0000-0000-000000000001');
do $$
begin
  assert not exists (select from auth.sessions where user_id = '10000000-0000-0000-0000-000000000001'),
    'All target sessions must be deleted';
  assert exists (select from auth.sessions where id = '30000000-0000-0000-0000-000000000003'),
    'Other users sessions must remain';
  assert not exists (select from auth.refresh_tokens where token = 'owner-token'),
    'Target user refresh tokens must be deleted by cascade';
  assert exists (select from auth.refresh_tokens where token = 'other-token'),
    'Other users refresh tokens must remain';
  assert not has_function_privilege('anon', 'public.revoke_all_user_sessions(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.revoke_all_user_sessions(uuid)', 'execute'),
    'Client roles must not execute the function';
end;
$$;
rollback;
