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
  ...['api', 'auth', 'notify', 'cli', 'web'].flatMap((section) => [
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

test('navigation preserves the six original sections and adds stubs under Overview', async () => {
  expect(config.navigation.tabs.map((tab) => tab.tab)).toEqual(['Overview', 'API', 'Auth', 'Notify', 'CLI', 'Web']);
  expect(config.prettyUrls).toBe('strip');
  const html = await Bun.file(new URL('index.html', output)).text();
  expect((await matches(html, '#sidebar nav[aria-label="Overview"] a')).map(({ href }) => href)).toEqual([
    '/', '/prd', '/tech-stack', '/system-design',
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

test('only documentation pages and the native 404 are published as HTML', async () => {
  const files = await readdir(output, { recursive: true });
  expect(files.filter((file) => file.endsWith('.html')).sort()).toEqual([
    ...routes.map(([route]) => `${route}.html`), '404.html',
  ].sort());
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
    expect(activeTab?.href).toBe(route!.includes('/') ? `/${route!.split('/')[0]}/overview` : '/');
    expect(await matches(html, '.sourcey-section-tabs > a[aria-current="page"] > div')).toHaveLength(1);
    expect(await matches(html, '#navbar a[aria-label="GitHub"] svg')).toHaveLength(1);
    expect(await matches(html, '#search-open-mobile')).toHaveLength(1);
    expect(await matches(html, '#theme-toggle')).toHaveLength(1);
    expect(await matches(html, '#navbar [data-drawer-slide]')).toHaveLength(1);
    expect(await matches(html, 'dialog#mobile-nav')).toHaveLength(1);
    expect(await matches(html, '#mobile-nav .sourcey-logo')).toHaveLength(1);
    expect(await matches(html, '#search-open svg, #search-open-mobile svg, #theme-toggle svg')).toHaveLength(4);
    expect(await matches(html, '#theme-toggle svg g')).toHaveLength(1);
    expect(await matches(html, '#content-area > header .h-5')).toHaveLength(1);
    const [pagination] = await matches(html, '#content-area > nav');
    expect(pagination?.['aria-label']).toBe('Previous and next page');
    expect(stylesheet).toContain(`#sourcey #content-area > nav[aria-label='${pagination!['aria-label']}']`);
    expect(await matches(html, '#content-area > div a[href="https://sourcey.com/docs"]')).toHaveLength(1);
    expect(html).not.toContain('mobile-navigation.js');
    expect(html).toContain('@view-transition');
    expect(html).toContain('keysy-nav-slide-out');
    const markdown = await Bun.file(new URL(`${route}.md`, output)).text();
    expect(markdown).toContain(title!);
  });
}

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
  expect(prd).toContain('This page is no longer maintained. Notion is the source of truth.');
  expect(await Bun.file(new URL('api/endpoints.html', output)).text()).toContain('There are no documented routes, request schemas, or response schemas yet.');
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
