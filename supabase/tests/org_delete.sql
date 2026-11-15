-- Run against a disposable database after applying migrations.
begin;

insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000001', 'delete-owner@example.com'),
  ('40000000-0000-0000-0000-000000000002', 'delete-admin@example.com'),
  ('40000000-0000-0000-0000-000000000003', 'delete-developer@example.com'),
  ('40000000-0000-0000-0000-000000000004', 'delete-other-owner@example.com');

insert into public.orgs (id, name) values
  ('50000000-0000-0000-0000-000000000001', 'Delete target'),
  ('50000000-0000-0000-0000-000000000002', 'Other org');

insert into public.members (org_id, user_id, role) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'owner'),
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'admin'),
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'developer'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', 'owner');

-- Match the API role's access to these tables. Cascades need no member DELETE grant.
create role org_delete_test nologin bypassrls;
grant usage on schema public to org_delete_test;
grant select, delete on public.orgs to org_delete_test;
grant select on public.members to org_delete_test;
set local role org_delete_test;

do $$
declare
  caller uuid;
  affected integer;
begin
  assert not has_table_privilege(current_user, 'public.members', 'delete'),
    'The API role must not need DELETE on members';
  foreach caller in array array[
    '40000000-0000-0000-0000-000000000002'::uuid,
    '40000000-0000-0000-0000-000000000003'::uuid,
    '40000000-0000-0000-0000-000000000004'::uuid
  ] loop
    delete from public.orgs as orgs where orgs.id = '50000000-0000-0000-0000-000000000001'
      and exists (select 1 from public.members as members where members.org_id = orgs.id
        and members.user_id = caller and members.role = 'owner');
    get diagnostics affected = row_count;
    assert affected = 0, 'Only an owner of the target org may delete it';
  end loop;
  for attempt in 1..2 loop
    delete from public.orgs as orgs where orgs.id = '50000000-0000-0000-0000-000000000001'
      and exists (select 1 from public.members as members where members.org_id = orgs.id
        and members.user_id = '40000000-0000-0000-0000-000000000001' and members.role = 'owner');
    get diagnostics affected = row_count;
    assert affected = case when attempt = 1 then 1 else 0 end, 'Only the first owner request deletes the org';
  end loop;
end;
$$;
reset role;

do $$
begin
  assert not exists (select from public.orgs where id = '50000000-0000-0000-0000-000000000001'),
    'The target org must be deleted';
  assert not exists (select from public.members where org_id = '50000000-0000-0000-0000-000000000001'),
    'The target memberships must be deleted';
  assert exists (select from public.orgs where id = '50000000-0000-0000-0000-000000000002'),
    'The other org must remain';
  assert (select count(*) = 1 from public.members where org_id = '50000000-0000-0000-0000-000000000002'),
    'The other org memberships must remain';
  assert (select count(*) = 4 from auth.users where id::text like '40000000-%'),
    'Auth users must remain';
  assert (select count(*) = 4 from public.profiles where id::text like '40000000-%'),
    'Profiles must remain';
end;
$$;

rollback;
