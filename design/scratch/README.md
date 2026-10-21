# Keysy design scratch

An independent React + Vite logo workbench. Bun is the runtime, package manager, and test runner. Use Bun 1.4.3, matching CI.

## Development

```sh
cd design/scratch
bun install --frozen-lockfile
bun run dev
```

Open `/`, `/logo/`, or `/logo/index.html` for the same logo study. There are no experiment tabs or CSS comparison frames. CSS selection is documented in [`../css/`](../css/README.md), outside the runnable workbench.

- `logo/`: 4 logo, symbol, and icon candidates are numbered consecutively 0–3 in one flat grid: Sealed, Access, Namespace, and Terminal. Each candidate has light/dark panels using Ink. The [reference studies](logo/reference-studies.md) are archived; their source SVGs remain. Source-controlled SVG artwork is rendered verbatim to preserve its outlines. Bitmap references, SVG exports, and font licenses stay alongside the preview.
- [`../theme/`](../theme/README.md): Ink light/dark colors, usage rules, semantic token mapping, and palette tests.
- `../figma/`: Figma references and exports, separate from runnable experiments.

Old tab query parameters do not restore removed studies. The workbench does not write URL parameters or make product API requests. Dependencies must be installed before running or building; opening the source HTML directly is not supported.

## Hot module replacement

`bun run dev` enables Vite's native HMR and React Fast Refresh through `@vitejs/plugin-react`. CSS edits update immediately without reloading the page; compatible component edits preserve React state. Changes to hook signatures or other non-refreshable modules may reset state or require a reload, as with normal Fast Refresh.

HMR is development-only: `bun run preview` serves the production build and does not watch source files.

## Verification and build

```sh
bun run lint
bun run test
bun run build
bun run preview
```

Tests use Bun's native test runner with Happy DOM and React Testing Library. They cover the logo-only studio, retained artwork and numbering, flat collection order, shared palette recoloring, and removal of CSS experiments. `bun run test` also includes the palette checks in `../theme/` and studio contrast requirements. No browser verification runs by default.

Vite builds the root and logo entry alias into `dist/`, sharing one bundle. Serve `dist/` over HTTP with `bun run preview` or a static server. The inline SVG/bitmap artwork remains bundled locally; no artwork is discarded or fetched remotely.
