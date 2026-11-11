-- profiles.email copies auth.users.email so services can read member emails
-- without access to schema auth. Only these triggers write it.
alter table public.profiles add column email text;

update public.profiles as profiles
set email = users.email
from auth.users as users
where users.id = profiles.id;

alter table public.profiles alter column email set not null;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, public.initial_display_name(new.raw_user_meta_data ->> 'full_name', new.email), new.email);
  return new;
end;
$$;

create function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger sync_profile_email_after_user_update
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();
