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
