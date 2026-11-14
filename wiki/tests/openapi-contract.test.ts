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

for (const [service, routeFiles] of [
  ['api', ['api/internal/router/router.go']],
  ['auth', ['auth/main.go', 'auth/internal/login/login.go']],
] as const) {
  test(`${service} documents exactly its implemented routes`, async () => {
    const spec = Bun.YAML.parse(await Bun.file(new URL(`../../openapi/${service}.yaml`, import.meta.url)).text());
    const implemented: string[] = [];
    for (const file of routeFiles) {
      const source = await Bun.file(new URL(`../../${file}`, import.meta.url)).text();
      for (const [, receiver, method, path] of source.matchAll(/\b(router|v0)\.(GET|POST|PATCH|DELETE|OPTIONS)\("([^"\n]+)"/g)) {
        const normalized = `${receiver === 'v0' ? '/v0' : ''}${path}`.replace(/:([A-Za-z]+)/g, '{$1}');
        implemented.push(`${method} ${normalized}`);
      }
    }
    expect(implemented.length).toBeGreaterThan(0);
    const { paths } = spec as { paths: Record<string, Record<string, unknown>> };
    const documented = Object.entries(paths).flatMap(([path, item]) =>
      Object.keys(item)
        .filter((method) => /^(get|post|put|patch|delete|options|head|trace)$/.test(method))
        .map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect(documented.sort()).toEqual(implemented.sort());
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
