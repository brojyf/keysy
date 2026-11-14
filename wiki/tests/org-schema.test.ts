import { expect, test } from 'bun:test';

const schema = await Bun.file(new URL('../database-schema.mdx', import.meta.url)).text();

const orgColumns = schema.match(/^  orgs \{\n([\s\S]*?)^  \}/m)?.[1]?.trim().split('\n').map((line) => line.trim());
const memberColumns = schema.match(/^  members \{\n([\s\S]*?)^  \}/m)?.[1]?.trim().split('\n').map((line) => line.trim());

test('the org schema documents its identity, name, and soft deletion timestamp', () => {
  expect(orgColumns).toEqual(['uuid id PK', 'varchar(32) name', 'timestamptz deleted_at']);
});

test('the membership schema uses existing auth users and a composite primary key', () => {
  expect(memberColumns).toEqual(['uuid org_id PK, FK', 'uuid user_id PK, FK', 'text role']);
  expect(schema).toContain('auth_users ||--o{ members');
  expect(schema).toContain('`(org_id, user_id)`');
  expect(schema).not.toContain('`user_id` stays null');
});

test('the schema documents the agreed roles without inventing permission rules', () => {
  expect(schema).toContain('`owner`, `admin`, or `developer`');
  expect(schema).not.toContain('`super_admin`');
});

test('the schema marks the proposed domain tables as proposals', () => {
  expect(schema).toContain('### Domain model');
  expect(schema).toContain('All other domain tables in this diagram are proposals, not implemented tables.');
});
