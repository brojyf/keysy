-- Run as a superuser against a disposable database after applying migrations.
-- All fixtures and assertions are rolled back.
begin;

insert into public.orgs (id, name) values
  ('60000000-0000-0000-0000-000000000001', 'Invite org'),
  ('60000000-0000-0000-0000-000000000002', 'Other org');

insert into public.invitations (org_id, email, role, started_at, invited_by_email) values
  ('60000000-0000-0000-0000-000000000001', 'fresh@example.com', 'developer', now(), 'owner@example.com'),
  ('60000000-0000-0000-0000-000000000001', 'old@example.com', 'admin', now() - interval '38 days', 'owner@example.com'),
  ('60000000-0000-0000-0000-000000000001', 'expired@example.com', 'developer', now() - interval '8 days', 'owner@example.com'),
  ('60000000-0000-0000-0000-000000000001', 'before-cutoff@example.com', 'developer', now() - interval '37 days' + interval '1 second', 'owner@example.com'),
  ('60000000-0000-0000-0000-000000000001', 'at-cutoff@example.com', 'developer', now() - interval '37 days', 'owner@example.com'),
  ('60000000-0000-0000-0000-000000000001', 'after-cutoff@example.com', 'developer', now() - interval '37 days' - interval '1 second', 'owner@example.com'),
  ('60000000-0000-0000-0000-000000000002', 'fresh@example.com', 'admin', now(), 'owner@example.com');

do $$
begin
  assert (select relrowsecurity from pg_class where oid = 'public.invitations'::regclass),
    'Invitations must enable RLS';
  assert (select bool_and(last_sent_at is not null) from public.invitations),
    'The first send must set last_sent_at';
  assert (select invitation_window_sends = 0 and invitation_window_started_at is null
    from public.orgs where id = '60000000-0000-0000-0000-000000000001'),
    'A new org must start without an invitation window';

  begin
    insert into public.invitations (org_id, email, role, invited_by_email)
    values ('60000000-0000-0000-0000-000000000001', 'fresh@example.com', 'admin', 'owner@example.com');
    raise exception 'A second invitation for the same email and org must fail';
  exception when unique_violation then null;
  end;

  begin
    insert into public.invitations (org_id, email, role, invited_by_email)
    values ('60000000-0000-0000-0000-000000000001', 'Mixed@example.com', 'admin', 'owner@example.com');
    raise exception 'An email with uppercase letters must fail';
  exception when check_violation then null;
  end;

  begin
    insert into public.invitations (org_id, email, role, invited_by_email)
    values ('60000000-0000-0000-0000-000000000001', 'owner@example.com', 'owner', 'owner@example.com');
    raise exception 'An owner invitation must fail';
  exception when check_violation then null;
  end;

  begin
    insert into public.invitations (org_id, email, role)
    values ('60000000-0000-0000-0000-000000000001', 'no-inviter@example.com', 'developer');
    raise exception 'An invitation without the inviter email must fail';
  exception when not_null_violation then null;
  end;
end;
$$;

-- RLS must deny direct reads even when API roles have table privileges.
grant select on public.invitations to anon, authenticated;

set local role anon;
do $$
begin
  assert not exists (select from public.invitations),
    'Anonymous users must not read invitations';
end;
$$;

set local role authenticated;
do $$
begin
  assert not exists (select from public.invitations),
    'Authenticated users must not read invitations directly';
end;
$$;

reset role;

-- Run the scheduled command itself.
do $$
begin
  assert (select schedule = '0 5 * * *' from cron.job where jobname = 'delete-old-invitations'),
    'Invitation cleanup must run daily at 05:00 UTC';
  execute (select command from cron.job where jobname = 'delete-old-invitations');
  assert not exists (select from public.invitations where email = 'old@example.com'),
    'Invitations older than 37 days must be deleted';
  assert (select count(*) = 2 from public.invitations where email = 'fresh@example.com'),
    'Recent invitations must remain';
  assert exists (select from public.invitations where email = 'expired@example.com'),
    'Expired invitations younger than 37 days must remain';
  assert exists (select from public.invitations where email = 'before-cutoff@example.com'),
    'Invitations one second younger than 37 days must remain';
  assert exists (select from public.invitations where email = 'at-cutoff@example.com'),
    'Invitations exactly 37 days old must remain';
  assert not exists (select from public.invitations where email = 'after-cutoff@example.com'),
    'Invitations one second older than 37 days must be deleted';
end;
$$;

delete from public.orgs where id = '60000000-0000-0000-0000-000000000001';

do $$
begin
  assert not exists (select from public.invitations
    where org_id = '60000000-0000-0000-0000-000000000001'),
    'Deleting an org must delete its invitations';
  assert exists (select from public.invitations
    where org_id = '60000000-0000-0000-0000-000000000002'),
    'Other orgs must keep their invitations';
end;
$$;

rollback;
