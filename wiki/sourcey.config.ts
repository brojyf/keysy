import { readFileSync } from 'node:fs';
import { defineConfig, markdown, openapi } from 'sourcey';
import { architectureDiagram } from './components/architecture-diagram';

// Lists each operation by its path, in spec order, from the `paths` block's fixed indentation.
// Specs with several tags get one collapsed group per tag.
function endpointNavigation(specPath: string) {
  const spec = readFileSync(new URL(specPath, import.meta.url), 'utf8');
  const tagGroups = new Map<string, { group: string; collapsed: boolean; pages: { operation: string; label: string }[] }>();
  let path = '';
  let operation = '';
  for (const line of spec.slice(spec.indexOf('\npaths:'), spec.indexOf('\ncomponents:')).split('\n')) {
    path = line.match(/^  (\/\S+):$/)?.[1] ?? path;
    const method = line.match(/^    (get|put|post|delete|patch):$/)?.[1];
    if (method) operation = `${method.toUpperCase()} ${path}`;
    const tag = line.match(/^      tags: \[(.+)\]$/)?.[1];
    if (!tag) continue;
    if (!tagGroups.has(tag)) tagGroups.set(tag, { group: tag, collapsed: true, pages: [] });
    tagGroups.get(tag)!.pages.push({ operation, label: path });
  }
  const groups = [...tagGroups.values()];
  return [
    { group: 'General', pages: [{ page: 'introduction', label: 'Introduction' }] },
    { group: 'API endpoints', pages: groups.length > 1 ? groups : groups.flatMap((group) => group.pages) },
  ];
}

export default defineConfig({
  name: 'Keysy',
  siteUrl: 'https://wiki.keysy.net',
  logo: { light: './logo/light.svg', dark: './logo/dark.svg' },
  favicon: './favicon.svg',
  codeSamples: ['curl'],
  publicDir: './public',
  prettyUrls: 'strip',
  components: { ArchitectureDiagram: architectureDiagram },
  theme: {
    name: 'default',
    colors: { primary: '#1d4ed8', light: '#7aa2ff', dark: '#2f5aba' },
    fonts: { sans: 'Geist', mono: 'Geist Mono' },
    css: ['./style.css'],
  },
  navbar: {
    links: [{ type: 'github', label: 'GitHub', href: 'https://github.com/brojyf/keysy' }],
  },
  navigation: {
    tabs: [
      {
        tab: 'Overview',
        slug: '',
        source: markdown({
          slugs: 'file',
          groups: [{ group: 'General', pages: ['index', 'prd', 'tech-stack', 'system-design', 'database-schema', 'design', 'project-management-plan', 'references'] }],
        }),
      },
      {
        tab: 'API',
        slug: 'api',
        source: openapi('../openapi/api.yaml'),
        navigation: endpointNavigation('../openapi/api.yaml'),
        tryIt: false,
      },
      {
        tab: 'Auth',
        slug: 'auth',
        source: openapi('../openapi/auth.yaml'),
        navigation: endpointNavigation('../openapi/auth.yaml'),
        tryIt: false,
      },
      {
        tab: 'Notify',
        slug: 'notify',
        source: markdown({
          root: './notify',
          slugs: 'file',
          groups: [
            { group: 'General', pages: ['overview'] },
            { group: 'API endpoints', pages: ['endpoints'] },
          ],
        }),
      },
      {
        tab: 'CLI',
        slug: 'cli',
        source: markdown({
          root: './cli',
          slugs: 'file',
          groups: [
            { group: 'General', pages: ['overview'] },
            { group: 'API endpoints', pages: ['endpoints'] },
          ],
        }),
      },
      {
        tab: 'Web',
        slug: 'web',
        source: markdown({
          root: './web',
          slugs: 'file',
          groups: [
            { group: 'General', pages: ['overview'] },
            { group: 'API endpoints', pages: ['endpoints'] },
          ],
        }),
      },
    ],
  },
});
