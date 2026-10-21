# Keysy design studies

Design studies are maintained on `design/theme-and-logo`. These are visual previews, not changes to the production architecture.

- [`figma/`](figma/README.md): Figma boards and related design references.
- [`refs/`](refs/README.md): infrastructure company logos, brand elements, and official research sources.
- [`scratch/`](scratch/README.md): a unified React + Vite Design Studio running on Bun, with Logo / Theme / CSS tabs and native HMR.
  - [`logo/`](scratch/logo/): 19 candidates numbered 0–18, recolored by 7 light/dark palettes. The retained [reference studies](scratch/logo/reference-studies.md) are numbered 13, 17, and 18. Reusable SVG files are in `logo/vectors/`; original bitmap references remain in `logo/images/`.
  - [`theme/`](scratch/theme/): shared palette values, research, and Dashboard/documentation previews. The seven palettes keep review numbers 1, 2, 5, 6, 7, 9, and 10; the logo preview imports the same values.

  - [`css/`](scratch/css/README.md): nine real component/token integrations with isolated preview documents, shared palettes, interactive fictional secrets, and a clearly labeled Geist specification reference.

Removed rounds, source artwork, and earlier preview pages stay in Git history. Production `web/` and `docs/` remain independent of the scratch app.

## Run and verify

```sh
cd design/scratch
bun install --frozen-lockfile
bun run dev
# Open / on the local Vite server; /logo/, /theme/, and /css/ also work.
bun run lint
bun test
bun run build
```

See [scratch setup](scratch/README.md) for built-preview instructions.
