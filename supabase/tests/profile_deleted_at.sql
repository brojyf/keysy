-- Run against a disposable database after applying migrations.
begin;

insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-000000000001', 'profile-deletion@example.com'),
  ('30000000-0000-0000-0000-000000000002', 'other-profile@example.com');

do $$
begin
  assert (select deleted_at is null from public.profiles
    where id = '30000000-0000-0000-0000-000000000001'),
    'New profiles must have no deletion timestamp';

  update public.profiles set deleted_at = '2026-11-06 12:00:00+08'
    where id = '30000000-0000-0000-0000-000000000001';
  assert (select deleted_at = '2026-11-06 04:00:00+00'::timestamptz from public.profiles
    where id = '30000000-0000-0000-0000-000000000001'),
    'Deletion timestamps must preserve the instant across time zones';
  assert exists (select from auth.users
    where id = '30000000-0000-0000-0000-000000000001'),
    'Setting a profile deletion timestamp must preserve the Auth user';
  assert (select deleted_at is null from public.profiles
    where id = '30000000-0000-0000-0000-000000000002'),
    'Setting a profile deletion timestamp must preserve other profiles';
end;
$$;

rollback;
