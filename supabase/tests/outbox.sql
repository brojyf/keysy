-- Run as a superuser against a disposable database after applying migrations.
-- All fixtures and assertions are rolled back.
begin;

do $$
declare
  audit_event public.outbox;
begin
  assert (select array_agg(attname::text order by attnum)
      = array['event_id', 'type', 'payload', 'created_at']
    from pg_attribute where attrelid = 'public.outbox'::regclass and attnum > 0 and not attisdropped),
    'The outbox must contain only event_id, type, payload, and created_at';
  assert (select relrowsecurity from pg_class where oid = 'public.outbox'::regclass),
    'The outbox must enable RLS';

  insert into public.outbox (type, payload)
  values ('audit', '{"action": "joined"}')
  returning * into audit_event;
  assert audit_event.event_id is not null, 'The database must generate event_id';
  assert audit_event.created_at is not null, 'The database must set created_at';

  insert into public.outbox (type, payload)
  values ('email', '{"template": "invitation"}');

  begin
    insert into public.outbox (type, payload) values ('webhook', '{}');
    raise exception 'An unknown type must fail';
  exception when check_violation then null;
  end;

  begin
    insert into public.outbox (type) values ('audit');
    raise exception 'A missing payload must fail';
  exception when not_null_violation then null;
  end;

  begin
    insert into public.outbox (type, payload) values ('audit', '{"action": ');
    raise exception 'Invalid JSON must fail';
  exception when invalid_text_representation then null;
  end;
end;
$$;

-- RLS must deny direct reads even when API roles have table privileges.
grant select on public.outbox to anon, authenticated;

set local role anon;
do $$
begin
  assert not exists (select from public.outbox),
    'Anonymous users must not read the outbox';
end;
$$;

set local role authenticated;
do $$
begin
  assert not exists (select from public.outbox),
    'Authenticated users must not read the outbox directly';
end;
$$;

reset role;

-- Like keysy_api, the api role has BYPASSRLS and the grant from the rollout note.
-- The Outbox Relay needs all four privileges: FOR UPDATE requires UPDATE.
create role outbox_test_api nologin bypassrls;
grant select, insert, update, delete on public.outbox to outbox_test_api;

set local role outbox_test_api;
do $$
begin
  insert into public.outbox (type, payload) values ('audit', '{"action": "relay"}');
  assert (select count(*) = 1
    from (select 1 from public.outbox where payload = '{"action": "relay"}' for update skip locked) locked),
    'The api role must lock outbox rows with FOR UPDATE SKIP LOCKED';
  delete from public.outbox where payload = '{"action": "relay"}';
  assert not exists (select from public.outbox where payload = '{"action": "relay"}'),
    'The api role must delete published outbox rows';
end;
$$;

reset role;

-- Without UPDATE, the relay cannot lock rows.
revoke update on public.outbox from outbox_test_api;

set local role outbox_test_api;
do $$
begin
  begin
    perform 1 from public.outbox for update skip locked;
    raise exception 'A role without UPDATE must not lock outbox rows';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;

rollback;
