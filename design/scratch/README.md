# Keysy design scratch

An independent React + Vite workbench. Bun is the runtime, package manager, and test runner. Use Bun 1.4.3, matching CI.

## Development

```sh
cd design/scratch
bun install --frozen-lockfile
bun run dev
```

Open `/` for Design Studio and switch between the **Logo** and **Theme** tabs. The legacy `/logo/` and `/theme/` URLs (including `index.html`) open the same studio with the matching tab selected. All entries share one React root; no router or production app dependency is needed.

Logo uses a swatch-based palette picker. Theme uses a split workspace: preview and layout/appearance selectors on the left, independently scrollable swatches and interface thumbnails on the right. Narrow or short screens stack these panes vertically. Both tabs share the same palette definitions. Inactive panels stay mounted but hidden, preserving each panel's palette, layout, and appearance choices while excluding hidden controls from keyboard navigation. Tabs support Left/Right arrows, Home, and End. Only the active theme panel writes theme parameters to the URL.

- `logo/`: 29 logo, symbol, and icon candidates retain review numbers 0–28 and are arranged in five visual groups: Wordmarks; Brackets & asterisks; Keys & keyholes; Rings & links; K & geometric blocks. Each candidate keeps its light/dark panels and all 9 palette controls. The three retained [reference studies](logo/reference-studies.md), numbered 26–28, include standalone symbols at 16/24/32px. Source-controlled SVG artwork is rendered verbatim to preserve its outlines. Bitmap references, SVG exports, and font licenses stay alongside the preview.
- `theme/`: 9 shared light/dark palette definitions plus Dashboard and documentation preview components. New palettes 7–10 explore Terminal, Ember, Orchid, and Evergreen. Palette values are ES module imports shared with `logo/`, not duplicated or installed on globals. Includes research notes and the unchanged historical documentation copy.
- `../figma/`: Figma references and exports, separate from runnable experiments.

The studio preserves shareable URLs, for example `/?tab=theme&layout=mintlify&palette=slate&mode=dark`. An explicit `tab` parameter overrides the legacy entry path. Theme parameters, unrelated query parameters, and hashes are preserved. Product controls inside the mock screens remain non-interactive visual samples. There is no product API connection or runtime CDN dependency. Dependencies must be installed before running or building; opening the source HTML directly is not supported.

## Hot module replacement

`bun run dev` enables Vite's native HMR and React Fast Refresh through `@vitejs/plugin-react`. CSS edits update immediately without reloading the page; compatible component edits preserve React state, including the current tab and preview selections. Changes to hook signatures or other non-refreshable modules may reset state or require a reload, as with normal Fast Refresh.

HMR is development-only: `bun run preview` serves the production build and does not watch source files.

## Verification and build

```sh
bun run lint
bun test
bun run build
bun run preview
```

Tests use Bun's native test runner with Happy DOM and React Testing Library. They cover tab accessibility and keyboard navigation, selection retention across tabs, legacy links and tab URL restoration, retained artwork and numbering, complete and non-duplicated visual groups, all 36 layout/palette/mode combinations, shared palette recoloring, URL fallback, the split Theme workspace and keyboard-selectable thumbnails, viewport scaling/observer cleanup, documentation consistency, and contrast requirements.

Vite builds the root and both legacy HTML entries into `dist/`, sharing a single studio bundle. Serve that directory over HTTP with `bun run preview` or a static server. Keeping both panels mounted avoids extra state/storage abstractions but loads both previews together. The bundle retains the existing inline SVG/bitmap artwork, so Vite reports its chunk-size warning; no artwork is discarded or fetched remotely to avoid it.
