create unique index members_one_owner_per_org
  on public.members (org_id)
  where role = 'owner';
