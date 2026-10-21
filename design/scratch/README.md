# Keysy design scratch

An independent React + Vite workbench. Bun is the runtime, package manager, and test runner. Use Bun 1.4.3, matching CI.

## Development

```sh
cd design/scratch
bun install --frozen-lockfile
bun run dev
```

Open `/` for Design Studio and switch between the **Logo** and **CSS** tabs. The `/logo/` and `/css/` URLs (including `index.html`) open the same studio with the matching tab selected. Studio entries share one React root; CSS integrations render in a separate iframe document. No router or production app dependency is needed.

Logo shows every mark in light and dark. CSS compares real component and token integrations, with library choices on the right and Light/Dark controls above the preview. Narrow or short screens stack these panes vertically. Both tabs use the fixed Ink palette from [`../theme/`](../theme/README.md), with no color-system selector. Inactive panels stay mounted but hidden, retaining their selections and excluding hidden controls from keyboard navigation; the CSS iframe unloads while inactive. Tabs support Left/Right arrows, Home, and End. Only the active CSS panel writes its own URL parameters.

- `logo/`: 4 logo, symbol, and icon candidates are numbered consecutively 0–3 in one flat grid: Sealed, Access, Namespace, and Terminal. Each candidate has light/dark panels using Ink. The [reference studies](logo/reference-studies.md) are archived; their source SVGs remain. Source-controlled SVG artwork is rendered verbatim to preserve its outlines. Bitmap references, SVG exports, and font licenses stay alongside the preview.
- [`../theme/`](../theme/README.md): the shared Ink light/dark palette, usage guidance, contrast checks, and historical research. The Theme comparison page and documentation copy have been removed from scratch.
- [`css/`](css/README.md): nine actual component/token integrations using the same interactive fictional secrets screen, isolated stylesheets, shared palettes, and light/dark switching. Geist is explicitly a specification reference, not an official component package. New integration code uses TypeScript 7.
- `../figma/`: Figma references and exports, separate from runnable experiments.

The studio preserves shareable URLs, for example `/?tab=css&library=intent&cssPalette=blue&cssMode=dark`. An explicit `tab` parameter overrides the entry path. Unrelated query parameters and hashes are preserved. An old `tab=theme` selection falls back to Logo. CSS preview controls implement local search, selection, value reveal, and fictional secret creation. There is no product API connection or runtime CDN dependency. Dependencies must be installed before running or building; opening the source HTML directly is not supported.

## Hot module replacement

`bun run dev` enables Vite's native HMR and React Fast Refresh through `@vitejs/plugin-react`. CSS edits update immediately without reloading the page; compatible component edits preserve React state, including the current tab and preview selections. Changes to hook signatures or other non-refreshable modules may reset state or require a reload, as with normal Fast Refresh.

HMR is development-only: `bun run preview` serves the production build and does not watch source files.

## Verification and build

```sh
bun run lint
bun run test
bun run build
bun run preview
# Optional local browser setup; required for test:browser:
bunx playwright install chromium
bun run test:browser
```

Tests use Bun's native test runner with Happy DOM and React Testing Library. They cover the two retained tabs, keyboard navigation, selection retention, entry links and URL restoration, retained artwork and numbering, flat collection order, shared palette recoloring, and URL fallback. `bun run test` also includes the palette checks in `../theme/` and studio contrast requirements.

Vite builds the root, two studio entry aliases, and `css/frame.html` into `dist/`. Studio entries share one bundle; iframe integrations lazy-load their own dependencies and styles. `build` also runs the CSS workspace's TypeScript check. Playwright builds and serves the output itself, checking all 18 library/palette/mode combinations, local interactions, style isolation, and mobile overflow. Serve `dist/` over HTTP with `bun run preview` or a static server. Keeping selection panels mounted avoids extra state/storage abstractions. The bundle retains the existing inline SVG/bitmap artwork, so Vite reports its chunk-size warning; no artwork is discarded or fetched remotely to avoid it.
