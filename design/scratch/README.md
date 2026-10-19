# Keysy design scratch

An independent React + Vite workbench. Bun is the runtime, package manager, and test runner. Use Bun 1.4.3, matching CI.

## Development

```sh
cd design/scratch
bun install --frozen-lockfile
bun run dev
```

Open the local server's `/logo/` or `/theme/` page. Both are React entry points; no router or production app dependency is needed.

- `logo/`: 33 retained logo, symbol, and icon candidates numbered 0–32, with light/dark panels and 8 palette controls. Source-controlled SVG artwork is rendered verbatim to preserve its outlines. Bitmap references, SVG exports, and font licenses stay alongside the preview.
- `theme/`: 8 shared light/dark palette definitions plus Dashboard and documentation preview components. Palette values are ES module imports shared with `logo/`, not duplicated or installed on globals. Includes research notes and the unchanged historical documentation copy.
- `../figma/`: Figma references and exports, separate from runnable experiments.

The theme page preserves shareable URLs, for example `/theme/?layout=mintlify&palette=slate&mode=dark`. Product controls inside the mock screens remain non-interactive visual samples. There is no product API connection or runtime CDN dependency. Dependencies must be installed before running or building; opening the source HTML directly is not supported.

## Verification and build

```sh
bun run lint
bun test
bun run build
bun run preview
```

Tests use Bun's native test runner with Happy DOM and React Testing Library. They cover retained artwork and numbering, all 32 layout/palette/mode combinations, shared palette recoloring, URL restoration and fallback, expanding comparisons, viewport scaling/observer cleanup, documentation consistency, and contrast requirements.

Vite builds both entry points into `dist/`. Serve that directory over HTTP with `bun run preview` or a static server. The logo bundle retains the existing inline SVG/bitmap artwork, so Vite may report its chunk-size warning; no artwork is discarded or fetched remotely to avoid it.
