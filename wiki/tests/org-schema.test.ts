import { expect, test } from 'bun:test';

const schema = await Bun.file(new URL('../database-schema.mdx', import.meta.url)).text();

const diagrams = await Promise.all(['implemented-schema.svg', 'implemented-schema-dark.svg']
  .map((name) => Bun.file(new URL(`../public/architecture/${name}`, import.meta.url)).text()));

test('the implemented schema shows the diagram of the implemented tables', () => {
  expect(schema).toContain('<ThemedImage src="/architecture/implemented-schema.svg" darkSrc="/architecture/implemented-schema-dark.svg" alt="Implemented Supabase tables" />');
  for (const name of ['profiles', 'orgs', 'members', 'org_id', 'user_id', 'role', 'display_name', 'agent_auto_apply', 'deleted_at', 'auth.users.id',
    'invitations', 'started_at', 'last_sent_at', 'invited_by_email', 'invitation_window_started_at', 'invitation_window_sends',
    'outbox', 'event_id', 'type', 'payload', 'created_at']) {
    for (const diagram of diagrams) expect(diagram).toContain(`>${name}</text>`);
  }
});

test('the scheduled jobs document invitation cleanup and account purging', () => {
  expect(schema).toContain('| `delete-old-invitations` | Daily | Deletes invitations that expired more than 30 days ago. |');
  expect(schema).toContain('| `purge-deleted-accounts` | Daily | Permanently deletes accounts 30 days after their deletion was scheduled. |');
});

test('the API functions state their schema once before the table', () => {
  const functions = schema.slice(schema.indexOf('### Functions for the API'), schema.indexOf('## ERD'));
  expect(functions).toContain('All functions below are in the `public` schema.\n\n| Function | Action |');
  for (const signature of [
    'list_user_sessions(target_user_id)',
    'revoke_user_session(target_user_id, target_session_id)',
    'revoke_all_user_sessions(target_user_id)',
  ]) {
    expect(functions).toContain(`| \`${signature}\` |`);
    expect(functions).not.toContain(`public.${signature}`);
  }
});

test('the ERD section shows only the diagram', () => {
  expect(schema.slice(schema.indexOf('## ERD'))).toBe('## ERD\n\n<ThemedImage src="/architecture/erd.svg" darkSrc="/architecture/erd-dark.svg" alt="Entity relationship diagram" />\n');
});
