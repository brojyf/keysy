import { readFileSync } from 'node:fs';
import { defineConfig, markdown, openapi } from 'sourcey';
import { architectureDiagram } from './components/architecture-diagram';

// Lists each operation by its path, in spec order, from the `paths` block's fixed indentation.
function endpointNavigation(specPath: string) {
  const spec = readFileSync(new URL(specPath, import.meta.url), 'utf8');
  const operations: { operation: string; label: string }[] = [];
  let path = '';
  for (const line of spec.slice(spec.indexOf('\npaths:'), spec.indexOf('\ncomponents:')).split('\n')) {
    path = line.match(/^  (\/\S+):$/)?.[1] ?? path;
    const method = line.match(/^    (get|put|post|delete|patch):$/)?.[1];
    if (method) operations.push({ operation: `${method.toUpperCase()} ${path}`, label: path });
  }
  return [{ group: 'API endpoints', pages: operations }];
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
          groups: [{ group: 'General', pages: ['index', 'prd', 'tech-stack', 'system-design', 'database-schema', 'project-management-plan', 'references'] }],
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
