create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name varchar(32) not null,
  constraint orgs_name_not_blank
    check (name ~ '[^[:space:]]')
);

create table public.members (
  org_id uuid not null references public.orgs (id),
  user_id uuid not null references auth.users (id),
  role text not null,
  primary key (org_id, user_id),
  constraint members_role_valid
    check (role in ('owner', 'admin', 'developer'))
);

alter table public.orgs enable row level security;
alter table public.members enable row level security;
