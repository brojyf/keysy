# Keysy documentation

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
`test` builds the static site, then checks branding, all 12 documentation pages,
public assets, navigation, native controls and the drawer's runtime click handler.
`bun run build` writes `dist/`.

## Migration and branding

PR #29 now uses Sourcey instead of Mintlify, retaining the six navigation tabs,
page URLs, PRD placeholder, Namespace logo, blue accents, neutral light/dark
backgrounds, and Geist / Geist Mono fonts. Fonts load from Google Fonts with
system fallbacks. `style.css` adapts the native theme: neutral selected navigation,
blue inline code, hidden pagination/page group labels, a single mobile header,
and a bottom-aligned footer on short pages. Code blocks keep native syntax colors.

Sourcey's native search, appearance control and mobile drawer replace the
Mintlify-specific script. Search page titles use the UI font; method and path
results keep monospace. CSS provides a 250 ms drawer exit over the incoming page
using cross-document View Transitions, without delaying navigation. A Bun patch in
`patches/sourcey@3.8.3.patch` keeps the native drawer open until navigation captures
its snapshot and clears it on back-forward cache restoration. The patch also marks
the active desktop tab with `aria-current="page"`. Desktop tab underlines move
between pages with a 360 ms standard easing curve, starting and ending at rest.
Appearance clicks use a single 300 ms ease-in-out page cross-fade so background,
text and icons change together, without repeated transitions on inherited colors.
Both snapshots use the same timing and isolated additive blending to preserve
the intended cross-fade. New clicks interrupt the previous fade; initial
page load does not animate. Recheck this patch when upgrading Sourcey. Unsupported
browsers switch directly; reduced motion disables custom motion.
The underline uses [Material's standard easing](https://m2.material.io/develop/android/theming/motion);
snapshot blending follows [Chrome's View Transition guidance](https://developer.chrome.com/docs/web-platform/view-transitions/same-document).
Opening the drawer focuses the dialog, not the logo; Tab navigation still shows
the logo's neutral keyboard focus indicator.
Search and appearance icons have heavier strokes. The SVG favicon follows the browser
color scheme; `public/favicon.ico` preserves the 16, 32 and 48 px fallback. Sourcey is licensed
under [AGPL-3.0](https://github.com/sourcey/sourcey/blob/main/LICENSE); the existing
Mintlify template license notice is retained in `LICENSE`.

## Publishing

Publish `dist/` as static assets through Cloudflare Workers using `wrangler`,
not the Mintlify dashboard. `siteUrl` is set to `https://docs.keysy.net` for
canonical links and the sitemap. Before publishing, bind that domain to the host
and configure extensionless HTML paths and `404.html` with HTTP 404. This migration
does not configure hosting, DNS or custom domain bindings, or deploy the site.
