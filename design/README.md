# Keysy design studies

UI, palette, and logo studies are maintained together on `design/ui-studies`. These are visual previews, not changes to the production architecture.

- [Logo selection](logo-selection/index.html): 45 candidates numbered 1–45, all recolored by the 8 retained light/dark palettes. The former bitmap concepts use single-color SVG outlines; reusable files are in `logo-selection/vectors/`. Original bitmap references remain in `logo-selection/images/`.
- [Dashboard and documentation palettes](color-applications/index.html): Supabase and Mintlify layouts with 8 light/dark palettes. Options 06, 07, 08, 09, 17, and 18 are excluded; other numbers stay unchanged.
- [Palette values and research](palettes/palette-research.md): stable numbers, sources, and measurements shared by both pages.

Removed rounds, source artwork, and earlier preview pages stay in git history.

Verify from the repository root:

```sh
npm --prefix web test
```
