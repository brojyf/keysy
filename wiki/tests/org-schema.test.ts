import { expect, test } from 'bun:test';

const schema = await Bun.file(new URL('../database-schema.mdx', import.meta.url)).text();

const orgColumns = schema.match(/^  orgs \{\n([\s\S]*?)^  \}/m)?.[1]?.trim().split('\n').map((line) => line.trim());
const memberColumns = schema.match(/^  members \{\n([\s\S]*?)^  \}/m)?.[1]?.trim().split('\n').map((line) => line.trim());

test('the org schema documents its identity, name, and soft deletion timestamp', () => {
  expect(orgColumns).toEqual(['uuid id PK', 'varchar(32) name', 'timestamptz deleted_at']);
  expect(schema).toContain('`gen_random_uuid()`');
  expect(schema).toContain('`DELETE /v0/orgs/{orgId}`');
  expect(schema).toContain('excludes the org from `GET /v0/orgs`');
  expect(schema).toContain('Names must contain at least one non-whitespace character. Different orgs can use the same name.');
});

test('the membership schema uses existing auth users and a composite primary key', () => {
  expect(memberColumns).toEqual(['uuid org_id PK, FK', 'uuid user_id PK, FK', 'text role']);
  expect(schema).toContain('auth_users ||--o{ members');
  expect(schema).toContain('`auth.users.id`');
  expect(schema).toContain('`(org_id, user_id)`');
  expect(schema).not.toContain('`user_id` stays null');
});

test('the schema documents the agreed roles and the one-owner rule without inventing permission rules', () => {
  expect(schema).toContain('`owner`, `admin`, or `developer`');
  expect(schema).not.toContain('`super_admin`');
  expect(schema).toContain('A partial unique index allows at most one owner per org.');
  expect(schema).toContain('There is no default role.');
});

test('the schema separates the minimal tables from proposed features and documents RLS', () => {
  expect(schema).toContain('### Organizations and memberships');
  expect(schema).toContain('### Domain model');
  expect(schema).toContain('All other domain tables in this diagram are proposals, not implemented tables.');
  expect(schema).toContain('Both tables enable row level security (RLS), with no policies for direct client access.');
  expect(schema).toContain('Physically deleting an org cascades to its memberships and preserves Auth users, profiles, and memberships in other orgs.');
  expect(schema).toContain("The Auth user foreign key does not cascade deletes. Remove the user's memberships before deleting the Auth user.");
});
