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
  assert (select email = 'ada@new.example.com' from public.profiles
    where id = '00000000-0000-0000-0000-000000000021'),
    'Auth email changes must sync to the profile';
  assert (select email = 'grace@example.com' from public.profiles
    where id = '00000000-0000-0000-0000-000000000022'),
    'Email changes must not touch other profiles';

  update public.profiles set display_name = 'Ada'
    where id = '00000000-0000-0000-0000-000000000021';
  update auth.users set raw_user_meta_data = '{"full_name": "Countess"}'
    where id = '00000000-0000-0000-0000-000000000021';
  assert (select display_name = 'Ada' and email = 'ada@new.example.com' from public.profiles
    where id = '00000000-0000-0000-0000-000000000021'),
    'Other Auth changes must keep the profile';

  begin
    insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000023', null);
    raise exception 'Users without an email must be rejected';
  exception when not_null_violation then null;
  end;
  assert not exists (select from auth.users where id = '00000000-0000-0000-0000-000000000023'),
    'A failed profile insert must roll back the Auth user';

  begin
    update auth.users set email = null where id = '00000000-0000-0000-0000-000000000022';
    raise exception 'Removing an email must be rejected';
  exception when not_null_violation then null;
  end;
  assert (select email = 'grace@example.com' from auth.users
    where id = '00000000-0000-0000-0000-000000000022'),
    'A failed email sync must roll back the Auth change';
end;
$$;

rollback;
