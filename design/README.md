# Keysy design studies

Design studies are maintained on `design/theme-and-logo`. These are visual previews, not changes to the production architecture.

- [`figma/`](figma/README.md): Figma boards and related design references.
- [`scratch/`](scratch/README.md): a unified React + Vite Design Studio running on Bun, with Logo / Theme tabs and native HMR.
  - [`logo/`](scratch/logo/): 31 candidates numbered 0–30, recolored by 11 light/dark palettes. The [new reference studies](scratch/logo/reference-studies.md) are numbered 27–30. Reusable SVG files are in `logo/vectors/`; original bitmap references remain in `logo/images/`.
  - [`theme/`](scratch/theme/): shared palette values, research, and Dashboard/documentation previews. Palettes are numbered 1–11; the logo preview imports the same values.

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
