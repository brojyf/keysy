-- Orgs are hard-deleted (#192); nothing reads deleted_at.
alter table public.orgs
  drop column deleted_at;
