-- Run against a disposable database after applying migrations.
-- All fixtures and assertions are rolled back.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000021', 'ada@example.com'),
  ('00000000-0000-0000-0000-000000000022', 'grace@example.com');

do $$
begin
  assert (select email = 'ada@example.com' from public.profiles
    where id = '00000000-0000-0000-0000-000000000021'),
    'New users must get their Auth email';

  update auth.users set email = 'ada@new.example.com'
    where id = '00000000-0000-0000-0000-000000000021';
  assert (select email = 'ada@example.com' from public.profiles
    where id = '00000000-0000-0000-0000-000000000021'),
    'Auth email changes must not change the profile email';

  update public.profiles set display_name = 'Ada'
    where id = '00000000-0000-0000-0000-000000000021';
  update auth.users set raw_user_meta_data = '{"full_name": "Countess"}'
    where id = '00000000-0000-0000-0000-000000000021';
  assert (select display_name = 'Ada' and email = 'ada@example.com' from public.profiles
    where id = '00000000-0000-0000-0000-000000000021'),
    'Other Auth changes must keep the profile';

  begin
    insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000023', null);
    raise exception 'Users without an email must be rejected';
  exception when not_null_violation then null;
  end;
  assert not exists (select from auth.users where id = '00000000-0000-0000-0000-000000000023'),
    'A failed profile insert must roll back the Auth user';
end;
$$;

rollback;
