# Keysy design studies

Design studies are maintained on `design/theme-and-logo`. These are visual previews, not changes to the production architecture.

- [`figma/`](figma/README.md): Figma boards and related design references.
- [`refs/`](refs/README.md): infrastructure company logos, brand elements, and official research sources.
- [`scratch/`](scratch/README.md): a unified React + Vite Design Studio running on Bun, with Logo / Theme tabs and native HMR.
  - [`logo/`](scratch/logo/): 29 candidates numbered 0–28, recolored by 9 light/dark palettes. The retained [reference studies](scratch/logo/reference-studies.md) are numbered 26–28. Reusable SVG files are in `logo/vectors/`; original bitmap references remain in `logo/images/`.
  - [`theme/`](scratch/theme/): shared palette values, research, and Dashboard/documentation previews. The nine palettes keep review numbers 1, 2, and 4–10; the logo preview imports the same values.

Removed rounds, source artwork, and earlier preview pages stay in Git history. Production `web/` and `docs/` remain independent of the scratch app.

## Run and verify

```sh
cd design/scratch
bun install --frozen-lockfile
bun run dev
# Open / on the local Vite server; /logo/ and /theme/ still work.
bun run lint
bun test
bun run build
```

See [scratch setup](scratch/README.md) for built-preview instructions.
