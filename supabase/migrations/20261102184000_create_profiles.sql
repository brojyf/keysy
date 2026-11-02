create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name varchar(32) not null,
  constraint profiles_display_name_not_blank
    check (display_name ~ '[^[:space:]]')
);

alter table public.profiles enable row level security;

-- The display name starts as the Google name and is never synced again,
-- so later edits by the user are kept.
create function public.initial_display_name(full_name text, email text)
returns varchar(32)
language sql
immutable
set search_path = ''
as $$
  select left(coalesce(
    nullif(regexp_replace(full_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    nullif(regexp_replace(split_part(email, '@', 1), '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    'User'
  ), 32);
$$;

revoke execute on function public.initial_display_name(text, text) from public, anon, authenticated;

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, public.initial_display_name(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger create_profile_after_user_insert
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

insert into public.profiles (id, display_name)
select id, public.initial_display_name(raw_user_meta_data ->> 'full_name', email)
from auth.users
on conflict (id) do nothing;
