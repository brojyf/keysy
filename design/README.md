# Keysy design studies

Design studies are maintained on `design/theme-and-logo`. These are visual previews, not changes to the production architecture.

Ink was selected as the Keysy color system on October 21, 2026. The [theme specification](theme/README.md) lists its light/dark colors; the shared [palette values](theme/palettes.js) are the source of truth.

- [`figma/`](figma/README.md): Figma boards and related design references.
- [`refs/`](refs/README.md): infrastructure company logos, brand elements, and official research sources.
- [`theme/`](theme/README.md): the selected Ink palette, usage guidance, contrast checks, and historical research.
- [`scratch/`](scratch/README.md): a unified React + Vite Design Studio running on Bun, with Logo / CSS tabs and native HMR.
  - [`logo/`](scratch/logo/): 4 candidates numbered 0–3 in one flat grid, recolored by the shared light/dark palettes. The [reference studies](scratch/logo/reference-studies.md) are archived. Reusable SVG files are in `logo/vectors/`; original bitmap references remain in `logo/images/`.
  - [`css/`](scratch/css/README.md): nine real component/token integrations with isolated preview documents, shared palettes, interactive fictional secrets, and a clearly labeled Geist specification reference.

Removed rounds, source artwork, and earlier preview pages stay in Git history. Production `web/` and `docs/` remain independent of the scratch app.

## Run and verify

```sh
cd design/scratch
bun install --frozen-lockfile
bun run dev
# Open / on the local Vite server; /logo/ and /css/ also work.
bun run lint
bun run test
bun run build
```

See [scratch setup](scratch/README.md) for built-preview instructions.
