create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name varchar(32) not null,
  constraint profiles_display_name_not_blank
    check (display_name ~ '[^[:space:]]')
);

alter table public.profiles enable row level security;
