-- GoTrue creates auth.sessions, so a bare supabase/postgres image lacks it.
-- .github/scripts/supabase-test-db.sh applies the migrations with
-- check_function_bodies off where they mention auth.sessions, then runs this
-- file. The stub matches the production names, types, owner, and grants.
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
