# Keysy internal wiki

Standalone [Sourcey](https://sourcey.com/docs) documentation for the Keysy monorepo.
Configuration lives in `sourcey.config.ts`; existing pages remain MDX files.

## Local development

Use Bun 1.4.3 and Node.js 22.19 or later (required by Sourcey).
From this directory:

```bash
bun install --frozen-lockfile
bun run dev
```

Open the URL printed by the development server.

## Validation

```bash
bun run check
bun run test
bun audit --audit-level=high
```

`check` runs TypeScript 7 and Sourcey's route, fragment and output checks.
`test` builds the static site, then checks branding, all documentation pages,
public assets, navigation, native controls and the drawer's runtime click handler.
`bun run build` writes `dist/`.

## Migration and branding

The wiki uses Sourcey instead of Mintlify, retaining the six navigation tabs,
Namespace logo, blue accents, neutral light/dark
backgrounds, and Geist / Geist Mono fonts. Fonts load from Google Fonts with
system fallbacks. The API and Auth tabs render their OpenAPI specs at `/api` and
`/auth` with one page per operation; the Mintlify pages `/api/overview`,
`/api/endpoints`, `/auth/overview` and `/auth/endpoints` no longer exist.
`style.css` adapts the native theme: neutral selected navigation,
blue inline code, hidden pagination/page group labels, a single mobile header,
and a bottom-aligned footer on short pages. Code blocks keep native syntax colors.

Sourcey's native search, appearance control and mobile drawer replace the
Mintlify-specific script. Search page titles use the UI font; method and path
results keep monospace. Search section headings use bold primary text in both
themes, and search method badges take the sidebar's method colors.

Motion timing and easing live in `style.css` tokens such as `--keysy-spring` and
`--keysy-indicator-*`. Reduced motion disables custom motion, and browsers without
View Transitions switch directly. A Bun patch in `patches/sourcey@3.8.3.patch`
changes Sourcey's built output to:

- keep the mobile drawer open until cross-document navigation captures it, close it
  on back-forward cache restoration, and focus the dialog instead of the logo on opening;
- mark the active desktop tab with `aria-current="page"`;
- hide the default `/` Base URL on OpenAPI pages, since the specs define no servers;
- title operation pages with the endpoint path, place examples after the fields and
  responses, and list each OpenAPI overview in search as **Introduction**;
- animate sidebar groups, response field disclosures, response status tabs and
  appearance changes.

Recheck this patch when upgrading Sourcey.
Search and appearance icons have heavier strokes. The SVG favicon follows the browser
color scheme; `public/favicon.ico` preserves the 16, 32 and 48 px fallback. Sourcey is licensed
under [AGPL-3.0](https://github.com/sourcey/sourcey/blob/main/LICENSE); the existing
Mintlify template license notice is retained in `LICENSE`.

The PRD page contains the requirements imported from Keysy's Notion Plan Tracker.
System design embeds the interactive Archify diagram. Its editable JSON sources
and generated HTML live in `public/architecture/`: a compact horizontal layout and
a vertical layout for narrow containers.
The Sourcey `ArchitectureDiagram` component adapts the same-origin viewer to the
page width and follows the wiki theme and computed page background without
reloading. It hides the viewer's duplicate title and both toolbars.
The embedded preview shows Archify's existing Node index beneath the diagram,
retaining its selection and highlight handlers. Its height follows both the
diagram width and the index's rendered height, including responsive wrapping.
The index uses at most four columns, reduces its column count on smaller screens,
and wraps node descriptions beneath their labels.

## Publishing

Deployments are configured in the Cloudflare dashboard. Cloudflare Workers serves
`dist/` as static assets; `wrangler.jsonc` binds the `wiki.keysy.net` custom domain,
serves extensionless HTML paths and returns `404.html` with HTTP 404. `siteUrl` is
set to `https://wiki.keysy.net` for canonical links and the sitemap.
