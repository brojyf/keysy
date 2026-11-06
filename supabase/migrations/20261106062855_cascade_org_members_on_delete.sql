alter table public.members
  drop constraint members_org_id_fkey,
  add constraint members_org_id_fkey
    foreign key (org_id) references public.orgs (id) on delete cascade;
