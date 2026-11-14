import { expect, test } from 'bun:test';

const schema = await Bun.file(new URL('../database-schema.mdx', import.meta.url)).text();

const diagram = await Bun.file(new URL('../public/architecture/implemented-schema.svg', import.meta.url)).text();

test('the implemented schema shows the diagram of the implemented tables', () => {
  expect(schema).toContain('![Implemented Supabase tables](/architecture/implemented-schema.svg)');
  for (const name of ['profiles', 'orgs', 'members', 'org_id', 'user_id', 'role', 'display_name', 'agent_auto_apply', 'deleted_at', 'auth.users.id']) {
    expect(diagram).toContain(`>${name}</text>`);
  }
});

test('the ERD section shows only the diagram', () => {
  expect(schema.slice(schema.indexOf('## ERD'))).toBe('## ERD\n\n![Entity relationship diagram](/architecture/erd.svg)\n');
});
