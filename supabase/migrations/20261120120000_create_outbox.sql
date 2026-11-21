-- Transactional outbox. api inserts a row in the same transaction as the
-- business change. The Outbox Relay in api publishes rows to Kafka and then
-- deletes them, so the table holds only unpublished events. If the relay stops
-- before the delete, it publishes the row again with the same event_id, and
-- consumers deduplicate by event_id.
create table public.outbox (
  event_id uuid primary key default gen_random_uuid(),
  -- audit rows go to the audit service; email rows go to notify. The payload
  -- holds the details, such as the audit action or the email template.
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint outbox_type_valid
    check (type in ('audit', 'email'))
);

alter table public.outbox enable row level security;
