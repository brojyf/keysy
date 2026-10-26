import { expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import config from '../sourcey.config';

const output = new URL('../dist/', import.meta.url);
const stylesheet = await Bun.file(new URL('../style.css', import.meta.url)).text();
const routes = [
  ['index', 'Introduction'],
  ['prd', 'PRD'],
  ['tech-stack', 'Tech stack'],
  ['system-design', 'System design'],
  ['database-schema', 'Database schema'],
  ['project-management-plan', 'Project management plan'],
  ['references', 'References'],
  ['api', 'Keysy API'],
  ['auth', 'Keysy Auth API'],
  ...['notify', 'cli', 'web'].flatMap((section) => [
    [`${section}/overview`, 'Introduction'],
    [`${section}/endpoints`, 'Endpoint overview'],
  ]),
];

async function matches(html: string, selector: string) {
  const attributes: Record<string, string>[] = [];
  await new HTMLRewriter().on(selector, {
    element(element) { attributes.push(Object.fromEntries(element.attributes)); },
  }).transform(new Response(html)).text();
  return attributes;
}

test('navigation preserves the six original sections and includes references under Overview', async () => {
  expect(config.navigation.tabs.map((tab) => tab.tab)).toEqual(['Overview', 'API', 'Auth', 'Notify', 'CLI', 'Web']);
  expect(config.prettyUrls).toBe('strip');
  const html = await Bun.file(new URL('index.html', output)).text();
  expect((await matches(html, '#sidebar nav[aria-label="Overview"] a')).map(({ href }) => href)).toEqual([
    '/', '/prd', '/tech-stack', '/system-design', '/database-schema', '/project-management-plan', '/references',
  ]);
});

test('the public origin is the confirmed documentation domain', () => {
  expect(config.siteUrl).toBe('https://wiki.keysy.net');
});

test('the sitemap uses absolute URLs on the documentation domain', async () => {
  const sitemap = await Bun.file(new URL('sitemap.xml', output)).text();
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect(locations).toEqual(routes.map(([route]) => `https://wiki.keysy.net/${route === 'index' ? '' : route}`));
});

test('only documentation pages, the architecture viewer and the native 404 are published as HTML', async () => {
  const files = await readdir(output, { recursive: true });
  expect(files.filter((file) => file.endsWith('.html')).sort()).toEqual([
    ...routes.map(([route]) => `${route}.html`),
    'architecture/system-architecture.html', 'architecture/system-architecture-vertical.html', '404.html',
  ].sort());
});

test('system design embeds the interactive architecture and preserves its public assets', async () => {
  const html = await Bun.file(new URL('system-design.html', output)).text();
  const [viewer] = await matches(html, '#content-area iframe');
  expect(viewer?.src).toBe('/architecture/system-architecture.html?present=1');
  expect(viewer?.title).toBe('Keysy system architecture');
  const [component] = await matches(html, '#content-area [data-sourcey-module]');
  expect(component?.['data-sourcey-module']).toBeDefined();
  expect(await matches(html, '#content-area a[href="/architecture/system-architecture.html"]')).toHaveLength(0);
  expect(await matches(html, '#content-area a[href="/architecture/system-architecture.json"]')).toHaveLength(0);
  for (const filename of [
    'system-architecture.html', 'system-architecture.json',
    'system-architecture-vertical.html', 'system-architecture-vertical.json',
  ]) {
    const path = `architecture/${filename}`;
    expect(await Bun.file(new URL(path, output)).arrayBuffer()).toEqual(
      await Bun.file(new URL(`../public/${path}`, import.meta.url)).arrayBuffer(),
    );
  }
  const source = await Bun.file(new URL('architecture/system-architecture.json', output)).json();
  expect(source.meta.title).toBe('Keysy System Architecture');
  expect(source.components.length).toBeGreaterThan(0);
});

test('the architecture reads left to right, then email delivery turns back beneath it', async () => {
  const source = await Bun.file(new URL('../public/architecture/system-architecture.json', import.meta.url)).json();
  const nodes = new Map<string, { pos: number[]; size: number[] }>(source.components.map((node: { id: string }) => [node.id, node]));
  const mainPath = ['clients', 'api', 'supabase', 'relay', 'kafka', 'notify'];
  for (let index = 1; index < mainPath.length; index++) {
    const previous = nodes.get(mainPath[index - 1]!)!;
    const next = nodes.get(mainPath[index]!)!;
    expect(next.pos[0]!).toBeGreaterThan(previous.pos[0]! + previous.size[0]!);
  }
  for (const [upper, lower] of [['notify', 'cfqueue'], ['worker', 'emaildlq']]) {
    expect(nodes.get(lower!)!.pos[0]).toBe(nodes.get(upper!)!.pos[0]);
    expect(nodes.get(lower!)!.pos[1]!).toBeGreaterThan(nodes.get(upper!)!.pos[1]! + nodes.get(upper!)!.size[1]!);
  }
  for (const [right, left] of [['cfqueue', 'worker'], ['worker', 'resend']]) {
    expect(nodes.get(left!)!.pos[0]! + nodes.get(left!)!.size[0]!).toBeLessThan(nodes.get(right!)!.pos[0]!);
    expect(nodes.get(left!)!.pos[1]).toBe(nodes.get(right!)!.pos[1]);
  }
});

test('the horizontal chart stays within five compact rows', async () => {
  const source = await Bun.file(new URL('../public/architecture/system-architecture.json', import.meta.url)).json();
  const rows = new Set(source.components.map((node: { pos: number[] }) => node.pos[1]));
  expect(rows.size).toBeLessThanOrEqual(5);
  expect(Math.max(...source.components.map((node: { pos: number[]; size: number[] }) => node.pos[1]! + node.size[1]!))).toBeLessThanOrEqual(520);
});

test('the horizontal api keeps the default node size', async () => {
  const source = await Bun.file(new URL('../public/architecture/system-architecture.json', import.meta.url)).json();
  const api = source.components.find((node: { id: string }) => node.id === 'api');
  expect(api.size).toEqual([140, 60]);
});

test('the vertical chart starts near the left edge instead of reserving the old Resend column', async () => {
  const source = await Bun.file(new URL('../public/architecture/system-architecture-vertical.json', import.meta.url)).json();
  const leftmostNode = Math.min(...source.components.map((node: { pos: number[] }) => node.pos[0]!));
  expect(leftmostNode).toBeGreaterThanOrEqual(30);
  expect(leftmostNode).toBeLessThanOrEqual(40);
});

test('the vertical api matches the standard node width', async () => {
  const source = await Bun.file(new URL('../public/architecture/system-architecture-vertical.json', import.meta.url)).json();
  const api = source.components.find((node: { id: string }) => node.id === 'api');
  expect(api.size[0]).toBe(140);
});

test('the restored vertical layout preserves the same architecture content and downward main path', async () => {
  const horizontal = await Bun.file(new URL('../public/architecture/system-architecture.json', import.meta.url)).json();
  const vertical = await Bun.file(new URL('../public/architecture/system-architecture-vertical.json', import.meta.url)).json();
  const semanticNodes = (source: typeof horizontal) => source.components.map(({ pos, size, ...node }: Record<string, unknown>) => node);
  const semanticEdges = (source: typeof horizontal) => source.connections.map((edge: Record<string, unknown>) => ({
    id: edge.id, from: edge.from, to: edge.to, label: edge.label, variant: edge.variant,
  }));
  expect(semanticNodes(vertical)).toEqual(semanticNodes(horizontal));
  expect(semanticEdges(vertical)).toEqual(semanticEdges(horizontal));
  expect(vertical.boundaries).toEqual(horizontal.boundaries);
  expect(vertical.cards).toEqual(horizontal.cards);
  const nodes = new Map<string, { pos: number[]; size: number[] }>(vertical.components.map((node: { id: string }) => [node.id, node]));
  const worker = nodes.get('worker')!;
  const resend = nodes.get('resend')!;
  expect(resend.pos[0]!).toBeGreaterThan(worker.pos[0]! + worker.size[0]!);
  expect(resend.pos[1]).toBe(worker.pos[1]);
  const mainPath = ['clients', 'api', 'supabase', 'relay', 'kafka', 'notify', 'cfqueue', 'worker', 'emaildlq'];
  for (let index = 1; index < mainPath.length; index++) {
    expect(nodes.get(mainPath[index]!)!.pos[1]!).toBeGreaterThan(nodes.get(mainPath[index - 1]!)!.pos[1]!);
  }
});

for (const [route, title] of routes) {
  test(`${route} retains its route, title and native accessible controls`, async () => {
    const html = await Bun.file(new URL(`${route}.html`, output)).text();
    expect(html).toContain(`<h1`);
    expect(html).toContain(`${title}</h1>`);
    const publicUrl = `https://wiki.keysy.net/${route === 'index' ? '' : route}`;
    const [canonical] = await matches(html, 'link[rel="canonical"]');
    const [languageLink] = await matches(html, 'link[rel="alternate"][hreflang="en"]');
    expect(canonical?.href).toBe(publicUrl);
    expect(languageLink?.href).toBe(publicUrl);
    expect(await matches(html, '.sourcey-section-tabs > a')).toHaveLength(6);
    const [activeTab] = await matches(html, '.sourcey-section-tabs > a[aria-current="page"]');
    const activeTabHref = ['api', 'auth'].includes(route!) ? `/${route}` : route!.includes('/') ? `/${route!.split('/')[0]}/overview` : '/';
    expect(activeTab?.href).toBe(activeTabHref);
    expect(await matches(html, '.sourcey-section-tabs > a[aria-current="page"] > div')).toHaveLength(1);
    expect(await matches(html, '#navbar a[aria-label="GitHub"] svg')).toHaveLength(1);
    expect(await matches(html, '#search-open-mobile')).toHaveLength(1);
    expect(await matches(html, '#theme-toggle')).toHaveLength(1);
    expect(await matches(html, '#navbar [data-drawer-slide]')).toHaveLength(1);
    expect(await matches(html, 'dialog#mobile-nav')).toHaveLength(1);
    expect(await matches(html, '#mobile-nav .sourcey-logo')).toHaveLength(1);
    expect(await matches(html, '#search-open svg, #search-open-mobile svg, #theme-toggle svg')).toHaveLength(4);
    expect(await matches(html, '#theme-toggle svg g')).toHaveLength(1);
    if (!['api', 'auth'].includes(route!)) {
      expect(await matches(html, '#content-area > header .h-5')).toHaveLength(1);
      const [pagination] = await matches(html, '#content-area > nav');
      expect(pagination?.['aria-label']).toBe('Previous and next page');
      expect(stylesheet).toContain(`#sourcey #content-area > nav[aria-label='${pagination!['aria-label']}']`);
      expect(await matches(html, '#content-area > div a[href="https://sourcey.com/docs"]')).toHaveLength(1);
    }
    expect(html).not.toContain('mobile-navigation.js');
    expect(html).toContain('@view-transition');
    expect(html).toContain('keysy-nav-slide-out');
    const markdown = await Bun.file(new URL(`${route}.md`, output)).text();
    expect(markdown).toContain(title!);
  });
}

test('tech stack names the frontend, backend, data, messaging, email and DevOps choices', async () => {
  const html = await Bun.file(new URL('tech-stack.html', output)).text();
  for (const choice of [
    'TypeScript', 'React', 'Go', 'Gin', 'GORM', 'Supabase', 'Dragonfly', 'Aiven', 'Kafka', 'PostgreSQL',
    'Cloudflare Queues', 'Cloudflare Workers', 'Resend', 'Grafana', 'OpenTelemetry', 'GitHub Actions', 'Fly.io', 'Grafana k6',
  ]) expect(html).toContain(choice);
});

test('both architecture layouts name Dragonfly as the Redis-compatible cache', async () => {
  for (const filename of ['system-architecture.json', 'system-architecture-vertical.json']) {
    const source = await Bun.file(new URL(`../public/architecture/${filename}`, import.meta.url)).json();
    const cache = source.components.find((node: { id: string }) => node.id === 'redis');
    expect(cache.label).toBe('Dragonfly');
    expect(cache.sublabel).toBe('Redis-compatible cache');
  }
});

test('the introduction lists every top-level repository directory', async () => {
  const html = await Bun.file(new URL('index.html', output)).text();
  const table = html.match(/<table[\s\S]*?<\/table>/)![0];
  const listed = [...table.matchAll(/<tr><td><code>([^<]+)<\/code><\/td>/g)].map((match) => match[1]!);
  const tracked = Bun.spawnSync(['git', 'ls-tree', '-d', '--name-only', 'HEAD'], { cwd: new URL('../..', import.meta.url).pathname });
  const directories = tracked.stdout.toString().trim().split('\n');
  expect(directories.length).toBeGreaterThan(0);
  expect(listed.sort()).toEqual(directories.map((directory) => `${directory}/`).sort());
});

test('the published client includes the patched drawer lifecycle and appearance handlers', async () => {
  const html = await Bun.file(new URL('index.html', output)).text();
  const scripts = await matches(html, 'script[src]');
  const client = (await Promise.all(scripts.map(({ src }) => {
    const path = new URL(src!, 'https://docs.invalid').pathname.slice(1);
    return Bun.file(new URL(path, output)).text();
  }))).join('\n');
  expect(client).toContain('CSSViewTransitionRule');
  expect(client).toContain('(width < 64rem) and (prefers-reduced-motion: no-preference)');
  expect(client).toContain('pageshow');
  expect(client).toContain('getAnimations');
  expect(client).toContain('keysy-theme-transition');
});

test('PRD requirements and endpoint callout content are published', async () => {
  const prd = await Bun.file(new URL('prd.html', output)).text();
  expect(await matches(prd, '#content-area h2')).toHaveLength(10);
  expect(prd).toContain('Only Admins can create or modify secrets.');
  expect(prd).toContain('Secret values are never recorded in audit logs.');
  expect(prd).toContain('100% of concurrent read/write tests return a complete');
  expect(prd).not.toContain('Product requirements have not been documented yet.');
  expect(prd).toContain('Notion is the source of truth for this PRD.');
});

test('API and Auth tabs render their OpenAPI contracts as the source of truth', async () => {
  const api = await Bun.file(new URL('api.html', output)).text();
  expect(api).toContain('the source of truth for the application API.');
  for (const operation of ['Create a secret', 'Retrieve current values under a path prefix', 'Propose an AI reorganization', 'List audit logs']) {
    expect(api).toContain(operation);
  }
  const auth = await Bun.file(new URL('auth.html', output)).text();
  expect(auth).toContain('the source of truth for the authentication API.');
  expect(auth).toContain('Exchange the sign-in code for a session');
});

test('API and Auth sidebars list every endpoint by path under API endpoints, with cURL samples only', async () => {
  for (const [route, firstPath] of [['api', '/v1/me'], ['auth', '/v1/auth/google']]) {
    const html = await Bun.file(new URL(`${route}.html`, output)).text();
    const sidebar = html.match(new RegExp(`<nav[^>]*aria-label="${route === 'api' ? 'API' : 'Auth'}"[^>]*>[\\s\\S]*?</nav>`))![0];
    const labels = [...sidebar.matchAll(/>([^<>]+)</g)].map((match) => match[1]!.trim()).filter(Boolean);
    const operationCount = (await matches(html, '.sourcey-endpoint')).length;
    expect(labels[0]).toBe('API endpoints');
    expect(labels[2]).toBe(firstPath);
    expect(labels.filter((label) => label.startsWith('/v1/'))).toHaveLength(operationCount);
    expect(html).not.toContain('tryit-trigger');
    expect(html).not.toContain('>JavaScript<');
    expect(html).not.toContain('>Python<');
  }
});

test('database schema renders the Supabase ERD and the Aiven audit table', async () => {
  const html = await Bun.file(new URL('database-schema.html', output)).text();
  expect(await matches(html, '#content-area svg')).not.toHaveLength(0);
  for (const table of ['orgs', 'members', 'secrets', 'secret_versions', 'secret_retrievals', 'policies', 'services', 'service_tokens', 'reorganizations', 'outbox', 'audit_logs']) {
    expect(html).toContain(`<code>${table}</code>`);
  }
});

test('references lists tool and guideline links without project-specific design links', async () => {
  const html = await Bun.file(new URL('references.html', output)).text();
  const links = (await matches(html, '#content-area a[href]')).map(({ href }) => href);
  expect(links).toEqual(expect.arrayContaining([
    'https://github.com/tt-a1i/archify',
    'https://github.com/southleft/figma-console-mcp',
    'https://github.com/multica-ai/andrej-karpathy-skills',
    'https://github.com/cloudflare/security-audit-skill',
  ]));
  expect(links).not.toContain('https://www.figma.com/design/SnKNkphMQKvrj8RmPigzao');
  expect(await Bun.file(new URL('development-tools.html', output)).exists()).toBe(false);
  const readme = await Bun.file(new URL('../../README.md', import.meta.url)).text();
  expect(readme).not.toContain('## References');
  expect(readme).not.toContain('https://github.com/multica-ai/andrej-karpathy-skills');
});

test('public favicon bytes are preserved and native search exports are generated', async () => {
  expect(await Bun.file(new URL('favicon.ico', output)).arrayBuffer()).toEqual(
    await Bun.file(new URL('../public/favicon.ico', import.meta.url)).arrayBuffer(),
  );
  for (const file of ['documents.json', 'llms.txt']) {
    expect(await Bun.file(new URL(file, output)).exists()).toBe(true);
  }
  const html = await Bun.file(new URL('index.html', output)).text();
  const [metadata] = await matches(html, 'meta[name="sourcey-search-indexes"]');
  const indexes = JSON.parse(metadata!.content!.replaceAll('&quot;', '"')) as string[];
  expect(indexes.length).toBeGreaterThan(0);
  for (const path of indexes) {
    const context = await Bun.file(new URL(`.${path}`, output)).json();
    expect(await Bun.file(new URL(context.index, new URL(`.${path}`, output))).exists()).toBe(true);
  }
});

test('all local page links, fragments and resource URLs resolve in the static output', async () => {
  for (const [route] of routes) {
    const html = await Bun.file(new URL(`${route}.html`, output)).text();
    const pageUrl = new URL(route === 'index' ? '/' : `/${route}`, config.siteUrl);
    for (const element of await matches(html, '[href], [src]')) {
      const target = new URL(element.href ?? element.src!, pageUrl);
      if (target.origin !== pageUrl.origin) continue;
      const path = decodeURIComponent(target.pathname.slice(1)) || 'index.html';
      const candidates = [path, `${path}.html`, `${path}/index.html`];
      const file = (await Promise.all(candidates.map(async (candidate) =>
        await Bun.file(new URL(candidate, output)).exists() ? candidate : undefined,
      ))).find(Boolean);
      expect(file, `${route}: ${target.pathname}`).toBeDefined();
      if (target.hash && file?.endsWith('.html')) {
        const destination = await Bun.file(new URL(file, output)).text();
        const ids = (await matches(destination, '[id]')).map((element) => element.id);
        expect(ids).toContain(decodeURIComponent(target.hash.slice(1)));
      }
    }
  }
});
