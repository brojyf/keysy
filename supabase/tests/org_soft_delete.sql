-- Run against a disposable database after applying migrations.
begin;

insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000001', 'soft-delete-owner@example.com'),
  ('40000000-0000-0000-0000-000000000002', 'soft-delete-admin@example.com'),
  ('40000000-0000-0000-0000-000000000003', 'soft-delete-developer@example.com'),
  ('40000000-0000-0000-0000-000000000004', 'soft-delete-outsider@example.com');

insert into public.orgs (id, name) values
  ('50000000-0000-0000-0000-000000000001', 'Delete target'),
  ('50000000-0000-0000-0000-000000000002', 'Other org');

insert into public.members (org_id, user_id, role) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'owner'),
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'admin'),
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'developer'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', 'owner');

do $$
declare
  caller uuid;
  affected integer;
  first_deleted_at timestamptz;
begin
  assert not exists (select from public.orgs where deleted_at is not null),
    'New orgs must have no deletion timestamp';

  -- Non-owners cannot delete the target, including an owner of another org.
  foreach caller in array array[
    '40000000-0000-0000-0000-000000000002'::uuid,
    '40000000-0000-0000-0000-000000000003'::uuid,
    '40000000-0000-0000-0000-000000000004'::uuid,
    '40000000-0000-0000-0000-000000000099'::uuid
  ] loop
    update public.orgs as orgs set deleted_at = current_timestamp
      where orgs.id = '50000000-0000-0000-0000-000000000001' and orgs.deleted_at is null
        and exists (select 1 from public.members as members
          where members.org_id = orgs.id and members.user_id = caller and members.role = 'owner');
    get diagnostics affected = row_count;
    assert affected = 0, 'Only an owner of the target org may delete it';
  end loop;

  -- Repeat the owner request to check that deletion cannot overwrite the timestamp.
  for attempt in 1..2 loop
    update public.orgs as orgs set deleted_at = current_timestamp
      where orgs.id = '50000000-0000-0000-0000-000000000001' and orgs.deleted_at is null
        and exists (select 1 from public.members as members
          where members.org_id = orgs.id
            and members.user_id = '40000000-0000-0000-0000-000000000001' and members.role = 'owner');
    get diagnostics affected = row_count;
    assert affected = case when attempt = 1 then 1 else 0 end,
      'Only the first owner request may change the org';
    if attempt = 1 then
      select deleted_at into first_deleted_at from public.orgs
        where id = '50000000-0000-0000-0000-000000000001';
    end if;
  end loop;

  assert first_deleted_at is not null, 'Deletion must set a timestamp';
  assert (select deleted_at = first_deleted_at from public.orgs
    where id = '50000000-0000-0000-0000-000000000001'),
    'Repeated deletion must preserve the first deletion timestamp';
  assert not exists (select from public.orgs as orgs join public.members as members on members.org_id = orgs.id
    where members.user_id = '40000000-0000-0000-0000-000000000001' and orgs.deleted_at is null),
    'Org lists must exclude deleted orgs';
  assert (select count(*) = 3 from public.members
    where org_id = '50000000-0000-0000-0000-000000000001'),
    'Soft deletion must preserve memberships';
  assert (select deleted_at is null from public.orgs
    where id = '50000000-0000-0000-0000-000000000002'),
    'Soft deletion must preserve other orgs';
  assert (select count(*) = 4 from auth.users where id::text like '40000000-%'),
    'Soft deletion must preserve Auth users';
  assert (select count(*) = 4 from public.profiles where id::text like '40000000-%'),
    'Soft deletion must preserve profiles';
end;
$$;

rollback;
