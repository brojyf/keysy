import { expect, test } from 'bun:test';

for (const service of ['api', 'auth']) {
  test(`${service} documents its unauthenticated liveness probe`, async () => {
    const spec = Bun.YAML.parse(await Bun.file(new URL(`../../openapi/${service}.yaml`, import.meta.url)).text());
    expect(spec).toMatchObject({
      paths: {
        '/health': {
          get: {
            security: [],
            responses: {
              '200': {
                headers: {
                  'Cache-Control': { $ref: `#/components/headers/${service === 'api' ? 'NoStore' : 'CacheControl'}` },
                },
                content: {
                  'text/plain': { schema: { type: 'string', enum: ['ok'] } },
                },
              },
            },
          },
        },
      },
    });
  });
}

test('member role changes allow Admins to promote Developers but not change existing Admins', async () => {
  const spec = Bun.YAML.parse(await Bun.file(new URL('../../openapi/api.yaml', import.meta.url)).text());
  const operation = 'paths./v0/orgs/{orgId}/members/{userId}.patch';
  expect(spec).toHaveProperty(`${operation}.description`, expect.stringContaining('The Owner can change a member between Admin and Developer.'));
  expect(spec).toHaveProperty(`${operation}.description`, expect.stringContaining('An Admin can promote a Developer to Admin but cannot change an existing Admin.'));
  expect(spec).toHaveProperty(`${operation}.description`, expect.stringContaining("The Owner's role cannot be changed here."));
  expect(spec).toHaveProperty(`${operation}.requestBody.content.application/json.schema.properties.role.enum`, ['admin', 'developer']);
});

test('member removal allows Admins to remove Developers only', async () => {
  const spec = Bun.YAML.parse(await Bun.file(new URL('../../openapi/api.yaml', import.meta.url)).text());
  const description = 'paths./v0/orgs/{orgId}/members/{userId}.delete.description';
  expect(spec).toHaveProperty(description, expect.stringContaining('The Owner can remove an Admin or a Developer.'));
  expect(spec).toHaveProperty(description, expect.stringContaining('An Admin can remove only a Developer.'));
  expect(spec).toHaveProperty(description, expect.stringContaining('The Owner cannot be removed.'));
});

test('logout documents rotated session cookies when revocation fails', async () => {
  const spec = Bun.YAML.parse(await Bun.file(new URL('../../openapi/auth.yaml', import.meta.url)).text());
  expect(spec).toMatchObject({
    paths: {
      '/v0/auth/logout': {
        post: {
          description: expect.stringContaining('rotated access and refresh cookies'),
          responses: {
            '503': {
              description: expect.stringContaining('rotated access and refresh cookies'),
              headers: {
                'Set-Cookie': {
                  description: expect.stringContaining('If the service refreshed the session before revocation failed'),
                  schema: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  });
});
