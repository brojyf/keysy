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
  end if;
end;
$$;

insert into public.orgs (id, name) values
  ('61000000-0000-0000-0000-000000000001', 'Purge org');

insert into auth.users (id, email) values
  ('62000000-0000-0000-0000-000000000001', 'purged@example.com'),
  ('62000000-0000-0000-0000-000000000002', 'inside-window@example.com'),
  ('62000000-0000-0000-0000-000000000003', 'never-deleted@example.com'),
  ('62000000-0000-0000-0000-000000000004', 'cancelled@example.com');

update public.profiles set deleted_at = now() - interval '31 days'
where id = '62000000-0000-0000-0000-000000000001';
update public.profiles set deleted_at = now() - interval '30 days' + interval '1 second'
where id = '62000000-0000-0000-0000-000000000002';
update public.profiles set deleted_at = now() - interval '31 days'
where id = '62000000-0000-0000-0000-000000000004';
update public.profiles set deleted_at = null
where id = '62000000-0000-0000-0000-000000000004';

insert into public.members (org_id, user_id, role) values
  ('61000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', 'developer'),
  ('61000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000002', 'admin'),
  ('61000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000003', 'developer'),
  ('61000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000004', 'developer');

insert into auth.sessions (id, user_id) values
  ('63000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001'),
  ('63000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000002'),
  ('63000000-0000-0000-0000-000000000003', '62000000-0000-0000-0000-000000000003'),
  ('63000000-0000-0000-0000-000000000004', '62000000-0000-0000-0000-000000000004');

insert into public.invitations (org_id, email, role, started_at) values
  ('61000000-0000-0000-0000-000000000001', 'purged@example.com', 'developer', now());

select public.purge_deleted_accounts();

do $$
begin
  assert not exists (select from auth.users where id = '62000000-0000-0000-0000-000000000001'),
    'Accounts deleted for more than 30 days must be purged';
  assert not exists (select from public.profiles where id = '62000000-0000-0000-0000-000000000001'),
    'Purging an account must cascade to its profile';
  assert not exists (select from public.members where user_id = '62000000-0000-0000-0000-000000000001'),
    'Purging an account must delete its memberships';
  assert not exists (select from auth.sessions where user_id = '62000000-0000-0000-0000-000000000001'),
    'Purging an account must cascade to its sessions';

  assert (select count(*) = 3 from auth.users where id in (
    '62000000-0000-0000-0000-000000000002',
    '62000000-0000-0000-0000-000000000003',
    '62000000-0000-0000-0000-000000000004')),
    'Accounts inside the window, never deleted, or cancelled must remain';
  assert (select count(*) = 3 from public.profiles where id in (
    '62000000-0000-0000-0000-000000000002',
    '62000000-0000-0000-0000-000000000003',
    '62000000-0000-0000-0000-000000000004')),
    'Every kept account must keep its profile';
  assert (select count(*) = 3 from public.members where user_id in (
    '62000000-0000-0000-0000-000000000002',
    '62000000-0000-0000-0000-000000000003',
    '62000000-0000-0000-0000-000000000004')),
    'Every kept account must keep its membership';
  assert (select count(*) = 3 from auth.sessions where user_id in (
    '62000000-0000-0000-0000-000000000002',
    '62000000-0000-0000-0000-000000000003',
    '62000000-0000-0000-0000-000000000004')),
    'Every kept account must keep its sessions';
  assert exists (select from public.orgs where id = '61000000-0000-0000-0000-000000000001'),
    'Purging an account must keep its org';
  assert exists (select from public.invitations where email = 'purged@example.com'),
    'Purging an account must keep invitations for its email';
  assert exists (select from cron.job where jobname = 'purge-deleted-accounts'
      and schedule = '0 3 * * *' and command = 'select public.purge_deleted_accounts()'),
    'Account purging must run daily at 03:00 UTC';
  assert not has_function_privilege('anon', 'public.purge_deleted_accounts()', 'execute')
    and not has_function_privilege('authenticated', 'public.purge_deleted_accounts()', 'execute'),
    'Client roles must not execute account purging';
end;
$$;

rollback;
