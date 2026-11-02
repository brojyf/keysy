-- Run against a disposable database after applying migrations.
-- All fixtures and assertions are rolled back.
begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');

do $$
declare
  invalid_name text;
begin
  insert into public.profiles (id, display_name)
    values ('00000000-0000-0000-0000-000000000001', 'A');
  update public.profiles set display_name = repeat('名', 32)
    where id = '00000000-0000-0000-0000-000000000001';
  assert (select char_length(display_name) = 32 from public.profiles
    where id = '00000000-0000-0000-0000-000000000001'),
    'Names must accept 32 multibyte characters';

  insert into public.profiles (id, display_name)
    values ('00000000-0000-0000-0000-000000000002', repeat('名', 32));

  foreach invalid_name in array array['', '   ', E'\t\n'] loop
    begin
      update public.profiles set display_name = invalid_name
        where id = '00000000-0000-0000-0000-000000000001';
      raise exception 'Blank names must be rejected';
    exception when check_violation then null;
    end;
  end loop;

  begin
    update public.profiles set display_name = repeat('名', 33)
      where id = '00000000-0000-0000-0000-000000000001';
    raise exception 'Names longer than 32 characters must be rejected';
  exception when string_data_right_truncation then null;
  end;

  begin
    update public.profiles set display_name = null
      where id = '00000000-0000-0000-0000-000000000001';
    raise exception 'Null names must be rejected';
  exception when not_null_violation then null;
  end;

  begin
    insert into public.profiles (id, display_name)
      values ('00000000-0000-0000-0000-000000000001', 'Duplicate');
    raise exception 'Duplicate user IDs must be rejected';
  exception when unique_violation then null;
  end;

  begin
    insert into public.profiles (id, display_name)
      values ('00000000-0000-0000-0000-000000000003', 'Unknown');
    raise exception 'Profiles must reference an existing auth user';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.profiles (display_name) values ('Missing ID');
    raise exception 'Profile IDs must be supplied, not generated';
  exception when not_null_violation then null;
  end;

  assert (select relrowsecurity from pg_class
    where oid = 'public.profiles'::regclass), 'Profiles must enable RLS';

  delete from auth.users where id = '00000000-0000-0000-0000-000000000001';
  assert not exists (select from public.profiles
    where id = '00000000-0000-0000-0000-000000000001'),
    'Deleting an auth user must delete its profile';
  assert exists (select from public.profiles
    where id = '00000000-0000-0000-0000-000000000002'),
    'Deleting an auth user must preserve other profiles';
end;
$$;

rollback;
