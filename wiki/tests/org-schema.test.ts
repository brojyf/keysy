import { expect, test } from 'bun:test';

const schema = await Bun.file(new URL('../database-schema.mdx', import.meta.url)).text();

const diagrams = await Promise.all(['implemented-schema.svg', 'implemented-schema-dark.svg']
  .map((name) => Bun.file(new URL(`../public/architecture/${name}`, import.meta.url)).text()));

test('the implemented schema shows the diagram of the implemented tables', () => {
  expect(schema).toContain('<ThemedImage src="/architecture/implemented-schema.svg" darkSrc="/architecture/implemented-schema-dark.svg" alt="Implemented Supabase tables" />');
  for (const name of ['profiles', 'orgs', 'members', 'org_id', 'user_id', 'role', 'display_name', 'agent_auto_apply', 'deleted_at', 'auth.users.id']) {
    for (const diagram of diagrams) expect(diagram).toContain(`>${name}</text>`);
  }
});

test('the ERD section shows only the diagram', () => {
  expect(schema.slice(schema.indexOf('## ERD'))).toBe('## ERD\n\n<ThemedImage src="/architecture/erd.svg" darkSrc="/architecture/erd-dark.svg" alt="Entity relationship diagram" />\n');
});
