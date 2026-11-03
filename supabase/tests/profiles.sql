-- Run against a disposable database after applying migrations.
-- All fixtures and assertions are rolled back.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', null, null),
  ('00000000-0000-0000-0000-000000000002', null, null),
  ('00000000-0000-0000-0000-000000000011', 'ada@example.com', '{"full_name": "  Ada Lovelace  "}'),
  ('00000000-0000-0000-0000-000000000012', 'long@example.com', jsonb_build_object('full_name', repeat('名', 40))),
  ('00000000-0000-0000-0000-000000000013', 'grace@example.com', jsonb_build_object('full_name', E' \t ')),
  ('00000000-0000-0000-0000-000000000014', repeat('g', 40) || '@example.com', '{}');

do $$
begin
  assert (select display_name = 'Ada Lovelace' from public.profiles
    where id = '00000000-0000-0000-0000-000000000011'),
    'New users must get their trimmed Google name';
  assert (select display_name = repeat('名', 32) from public.profiles
    where id = '00000000-0000-0000-0000-000000000012'),
    'Long Google names must be cut to 32 characters';
  assert (select display_name = 'grace' from public.profiles
    where id = '00000000-0000-0000-0000-000000000013'),
    'Blank Google names must fall back to the email local part';
  assert (select display_name = repeat('g', 32) from public.profiles
    where id = '00000000-0000-0000-0000-000000000014'),
    'Long email local parts must be cut to 32 characters';
  assert (select display_name = 'User' from public.profiles
    where id = '00000000-0000-0000-0000-000000000001'),
    'Users without a name or email must get the default name';

  update auth.users set raw_user_meta_data = '{"full_name": "Countess"}'
    where id = '00000000-0000-0000-0000-000000000011';
  assert (select display_name = 'Ada Lovelace' from public.profiles
    where id = '00000000-0000-0000-0000-000000000011'),
    'Later Google name changes must not overwrite the display name';

  assert not has_function_privilege('anon', 'public.initial_display_name(text, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.initial_display_name(text, text)', 'execute'),
    'API roles must not call the display name helper';
end;
$$;

do $$
declare
  invalid_name text;
begin
  update public.profiles set display_name = 'A'
    where id = '00000000-0000-0000-0000-000000000001';
  update public.profiles set display_name = repeat('名', 32)
    where id = '00000000-0000-0000-0000-000000000001';
  assert (select char_length(display_name) = 32 from public.profiles
    where id = '00000000-0000-0000-0000-000000000001'),
    'Names must accept 32 multibyte characters';

  update public.profiles set display_name = repeat('名', 32)
    where id = '00000000-0000-0000-0000-000000000002';

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
