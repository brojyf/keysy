import { expect, test } from 'bun:test';

const schema = await Bun.file(new URL('../database-schema.mdx', import.meta.url)).text();

const orgColumns = schema.match(/^  orgs \{\n([\s\S]*?)^  \}/m)?.[1]?.trim().split('\n').map((line) => line.trim());
const memberColumns = schema.match(/^  members \{\n([\s\S]*?)^  \}/m)?.[1]?.trim().split('\n').map((line) => line.trim());

test('the org schema documents only a UUID and a 32-character name', () => {
  expect(orgColumns).toEqual(['uuid id PK', 'varchar(32) name']);
  expect(schema).toContain('`gen_random_uuid()`');
  expect(schema).toContain('Names must contain at least one non-whitespace character. Different orgs can use the same name.');
});

test('the membership schema uses existing auth users and a composite primary key', () => {
  expect(memberColumns).toEqual(['uuid org_id PK, FK', 'uuid user_id PK, FK', 'text role']);
  expect(schema).toContain('auth_users ||--o{ members');
  expect(schema).toContain('`auth.users.id`');
  expect(schema).toContain('`(org_id, user_id)`');
  expect(schema).not.toContain('`user_id` stays null');
});

test('the schema documents the agreed roles without inventing permission or owner-count rules', () => {
  expect(schema).toContain('`owner`, `admin`, or `developer`');
  expect(schema).not.toContain('`super_admin`');
  expect(schema).toContain('The migration does not define role permissions or restrict the number of owners.');
  expect(schema).toContain('There is no default role.');
});

test('the schema separates the minimal tables from proposed features and documents RLS', () => {
  expect(schema).toContain('### Organizations and memberships');
  expect(schema).toContain('### Domain model');
  expect(schema).toContain('All other domain tables in this diagram are proposals, not implemented tables.');
  expect(schema).toContain('Both tables enable row level security (RLS), with no policies for direct client access.');
  expect(schema).toContain('The foreign keys do not cascade deletes.');
});
