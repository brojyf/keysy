# Keysy design studies

Design references and studies are maintained on `design/theme-and-logo`. Selection documents guide future implementation; previews do not modify the production application.

Use Ink as the Keysy color system. The [theme specification](theme/README.md) lists its light/dark colors; the shared [palette values](theme/palettes.js) are the source of truth.

- [`figma/`](figma/README.md): Figma boards and related design references.
- [`refs/`](refs/README.md): infrastructure company logos, brand elements, and official research sources.
- [`theme/`](theme/README.md): Ink light/dark colors, usage rules, semantic token mapping, and palette tests.
- [`css/`](css/README.md): the required shadcn/ui (Radix) + tweakcn + Geist stack and official references.
- [`scratch/`](scratch/README.md): a React + Vite logo workbench running on Bun, with native HMR.
  - [`logo/`](scratch/logo/): 4 candidates numbered 0–3 in one flat grid, recolored by the shared light/dark palettes. The [reference studies](scratch/logo/reference-studies.md) are archived. Reusable SVG files are in `logo/vectors/`; original bitmap references remain in `logo/images/`.

Removed rounds, source artwork, and earlier preview pages stay in Git history. Production `web/` and `docs/` remain independent of the scratch app.

## Run and verify

```sh
cd design/scratch
bun install --frozen-lockfile
bun run dev
# Open / or /logo/ on the local Vite server.
bun run lint
bun run test
bun run build
```

See [scratch setup](scratch/README.md) for built-preview instructions.
