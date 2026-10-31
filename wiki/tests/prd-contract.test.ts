import { expect, test } from 'bun:test';

const api = Bun.YAML.parse(await Bun.file(new URL('../../openapi/api.yaml', import.meta.url)).text()) as any;
const auth = Bun.YAML.parse(await Bun.file(new URL('../../openapi/auth.yaml', import.meta.url)).text()) as any;
const schema = await Bun.file(new URL('../database-schema.mdx', import.meta.url)).text();
const operations = Object.values(api.paths).flatMap((path: any) =>
  Object.values(path).filter((operation: any) => operation?.operationId),
) as any[];
const operation = (id: string) => operations.find((item) => item.operationId === id);

test('members have the two PRD roles and ownership transfers instead of granting extra Admins', () => {
  expect(api.components.schemas.Role.enum).toEqual(['admin', 'developer']);
  expect(operation('transferAdmin').description).toContain('exactly one Admin');
  expect(operation('transferAdmin').description).toContain('every path');
  expect(operation('updateMemberRole')).toBeUndefined();
  expect(operation('deleteAccount').responses['409']).toBeDefined();
});

test('member scope, permission sets and policy requests have complete contracts', () => {
  for (const id of ['getMemberScope', 'updateMemberScope', 'listPermissionSets', 'createPermissionSet',
    'updatePermissionSet', 'deletePermissionSet', 'listAccessRequests', 'createAccessRequest', 'reviewAccessRequest']) {
    expect(operation(id), id).toBeDefined();
  }
  expect(api.components.schemas.MemberScope.properties.policyIds).toBeDefined();
  expect(api.components.schemas.MemberScope.properties.permissionSetIds).toBeDefined();
  expect(operation('listPolicies').description).toContain('paths');
  expect(api.components.schemas.Policy.required).toContain('serviceId');
  expect(api.components.schemas.Policy.properties.assignees).toBeUndefined();
  expect(api.components.schemas.PathPattern.description).toContain('folder');
});

test('service creation creates its one policy and checks the scope before changes', () => {
  expect(api.components.schemas.ServiceCreate.required).toEqual(['name', 'policy']);
  expect(api.components.schemas.Service.required).toContain('policyId');
  expect(operation('createPolicy')).toBeUndefined();
  expect(operation('deletePolicy')).toBeUndefined();
  expect(operation('updatePolicy').description).toContain('before and after');
  expect(operation('updatePolicy').description).toContain('before the change');
  expect(operation('deleteService').description).toContain('policy');
});

test('notification settings belong to the member and sessions can be revoked individually', () => {
  expect(api.paths['/v0/orgs/{orgId}/me/notification-preferences'].patch).toBeDefined();
  expect(api.paths['/v0/orgs/{orgId}/settings']).toBeUndefined();
  const preferences = api.components.schemas.NotificationPreferences.properties;
  for (const name of ['expirationReminders', 'secretUpdateEmails', 'reminderDays']) expect(preferences[name]).toBeDefined();
  expect(auth.paths['/v0/auth/sessions'].get).toBeDefined();
  expect(auth.paths['/v0/auth/sessions/{sessionId}'].delete.responses['409']).toBeDefined();
});

test('schema represents scopes, requests, preferences, sessions and a one-to-one service policy', () => {
  for (const table of ['permission_sets', 'permission_set_policies', 'member_permission_sets', 'access_requests',
    'member_notification_preferences', 'sessions']) expect(schema).toContain(`\`${table}\``);
  expect(schema).toContain('uuid service_id FK, UK');
  expect(schema).toContain('exactly one Admin');
  expect(schema).not.toMatch(/super_admin|policy_services|expiration_reminder_days/);
});

test('all OpenAPI references resolve and operation IDs and path parameters remain unique and complete', () => {
  for (const spec of [api, auth]) {
    const ids = new Set<string>();
    const visit = (value: any) => {
      if (!value || typeof value !== 'object') return;
      if (value.$ref) {
        const target = value.$ref.split('/').slice(1).reduce((node: any, key: string) => node?.[key], spec);
        expect(target, value.$ref).toBeDefined();
      }
      for (const child of Object.values(value)) visit(child);
    };
    visit(spec);
    for (const [path, item] of Object.entries(spec.paths) as [string, any][]) {
      for (const key of Object.keys(item)) {
        expect(['summary', 'description', 'servers', 'parameters', 'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'], `${path}: ${key}`).toContain(key);
      }
      for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        const entry = item[method];
        if (!entry) continue;
        expect(ids.has(entry.operationId), entry.operationId).toBe(false);
        ids.add(entry.operationId);
        const parameters = [...(item.parameters ?? []), ...(entry.parameters ?? [])].map((parameter: any) =>
          parameter.$ref ? spec.components.parameters[parameter.$ref.split('/').at(-1)] : parameter,
        );
        for (const [, name] of path.matchAll(/\{([^}]+)\}/g)) {
          expect(parameters.some((parameter: any) => parameter.in === 'path' && parameter.name === name && parameter.required), `${method} ${path}: ${name}`).toBe(true);
        }
      }
    }
  }
});
