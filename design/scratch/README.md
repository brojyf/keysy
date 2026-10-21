# Keysy design scratch

An independent React + Vite workbench. Bun is the runtime, package manager, and test runner. Use Bun 1.4.3, matching CI.

## Development

```sh
cd design/scratch
bun install --frozen-lockfile
bun run dev
```

Open `/` for Design Studio and switch between the **Logo**, **Theme**, and **CSS** tabs. The `/logo/`, `/theme/`, and `/css/` URLs (including `index.html`) open the same studio with the matching tab selected. Studio entries share one React root; CSS integrations render in a separate iframe document. No router or production app dependency is needed.

Logo uses a swatch-based palette picker. Theme starts directly with an untitled preview and layout/appearance selectors on the left; independently scrollable swatches and interface thumbnails fill the right rail below the navigation. CSS compares real component and token integrations, with library and palette choices on the right. Narrow or short screens stack these panes vertically. All three tabs share the same palette definitions. Inactive panels stay mounted but hidden, retaining their selections and excluding hidden controls from keyboard navigation; the CSS iframe unloads while inactive. Tabs support Left/Right arrows, Home, and End. Only active Theme/CSS panels write their own URL parameters.

- `logo/`: 11 logo, symbol, and icon candidates are numbered consecutively 0–10 in display order across five visual groups: Wordmarks; Brackets & asterisks; Keys & keyholes; Rings & links; K & geometric blocks. Each candidate keeps its light/dark panels and all 5 palette controls. The retained [reference study](logo/reference-studies.md), numbered 10, includes standalone symbols at 16/24/32px. Source-controlled SVG artwork is rendered verbatim to preserve its outlines. Bitmap references, SVG exports, and font licenses stay alongside the preview.
- `theme/`: 5 shared light/dark palette definitions plus Dashboard and documentation preview components. Palettes are numbered consecutively: 1 Ink, 2 Mono, 3 Ink / Iris, 4 Orchid, and 5 Evergreen. Cocoa / Ice and Terminal have been removed; Evergreen uses slightly desaturated Terminal greens for its buttons. Palette values are ES module imports shared with `logo/`, not duplicated or installed on globals. Includes research notes and the unchanged historical documentation copy.
- [`css/`](css/README.md): nine actual component/token integrations using the same interactive fictional secrets screen, isolated stylesheets, shared palettes, and light/dark switching. Geist is explicitly a specification reference, not an official component package. New integration code uses TypeScript 7.
- `../figma/`: Figma references and exports, separate from runnable experiments.

The studio preserves shareable URLs, for example `/?tab=theme&layout=mintlify&palette=evergreen&mode=dark`. An explicit `tab` parameter overrides the legacy entry path. Theme parameters, unrelated query parameters, and hashes are preserved. Product controls inside the Logo/Theme mock screens remain non-interactive visual samples; CSS preview controls implement local search, selection, value reveal, and fictional secret creation. There is no product API connection or runtime CDN dependency. Dependencies must be installed before running or building; opening the source HTML directly is not supported.

## Hot module replacement

`bun run dev` enables Vite's native HMR and React Fast Refresh through `@vitejs/plugin-react`. CSS edits update immediately without reloading the page; compatible component edits preserve React state, including the current tab and preview selections. Changes to hook signatures or other non-refreshable modules may reset state or require a reload, as with normal Fast Refresh.

HMR is development-only: `bun run preview` serves the production build and does not watch source files.

## Verification and build

```sh
bun run lint
bun test
bun run build
bun run preview
# Optional local browser setup; required for test:browser:
bunx playwright install chromium
bun run test:browser
```

Tests use Bun's native test runner with Happy DOM and React Testing Library. They cover tab accessibility and keyboard navigation, selection retention across tabs, legacy links and tab URL restoration, retained artwork and numbering, complete and non-duplicated visual groups, all 20 layout/palette/mode combinations, shared palette recoloring, URL fallback, the split Theme workspace and keyboard-selectable thumbnails, viewport scaling/observer cleanup, documentation consistency, and contrast requirements.

Vite builds the root, three studio entry aliases, and `css/frame.html` into `dist/`. Studio entries share one bundle; iframe integrations lazy-load their own dependencies and styles. `build` also runs the CSS workspace's TypeScript check. Playwright builds and serves the output itself, checking all 90 library/palette/mode combinations, local interactions, style isolation, mobile overflow, and Theme rail placement. Serve `dist/` over HTTP with `bun run preview` or a static server. Keeping selection panels mounted avoids extra state/storage abstractions. The bundle retains the existing inline SVG/bitmap artwork, so Vite reports its chunk-size warning; no artwork is discarded or fetched remotely to avoid it.
