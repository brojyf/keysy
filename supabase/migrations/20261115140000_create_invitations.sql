-- Members join only after they accept an invitation. Accept and cancel delete
-- the row, so there is no status column. An invitation is expired when
-- started_at + 7 days has passed.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  email text not null,
  role text not null,
  -- Start of the current 7-day period. Resending or re-inviting an expired
  -- invitation restarts it; resending a pending one does not.
  started_at timestamptz not null default now(),
  -- Each invitation can be resent once every 24 hours. The first send sets it.
  last_sent_at timestamptz not null default now(),
  constraint invitations_one_per_email_per_org
    unique (org_id, email),
  constraint invitations_email_lowercase
    check (email = lower(email)),
  constraint invitations_role_valid
    check (role in ('admin', 'developer'))
);

alter table public.invitations enable row level security;

-- Each org sends at most 50 invitation emails per 24-hour window, which starts
-- at the first send. New invitations and resends both count.
alter table public.orgs
  add column invitation_window_started_at timestamptz,
  add column invitation_window_sends integer not null default 0;

select cron.schedule(
  'delete-old-invitations',
  '0 3 * * *',
  $$delete from public.invitations where started_at < now() - interval '37 days'$$
);
