import { defineConfig, markdown } from 'sourcey';

export default defineConfig({
  name: 'Keysy',
  siteUrl: 'https://docs.keysy.net',
  logo: { light: './logo/light.svg', dark: './logo/dark.svg' },
  favicon: './favicon.svg',
  publicDir: './public',
  prettyUrls: 'strip',
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
          groups: [{ group: 'General', pages: ['index', 'prd', 'tech-stack', 'system-design'] }],
        }),
      },
      {
        tab: 'API',
        slug: 'api',
        source: markdown({
          root: './api',
          slugs: 'file',
          groups: [
            { group: 'General', pages: ['overview'] },
            { group: 'API endpoints', pages: ['endpoints'] },
          ],
        }),
      },
      {
        tab: 'Auth',
        slug: 'auth',
        source: markdown({
          root: './auth',
          slugs: 'file',
          groups: [
            { group: 'General', pages: ['overview'] },
            { group: 'API endpoints', pages: ['endpoints'] },
          ],
        }),
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
