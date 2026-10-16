# Keysy design previews

Open [review.html](review.html) for 10 light/dark palettes, Logos 30–36 (including new options 33–36), 20 retained earlier logos, and credited design references. The self-contained page works offline; toolbar palette switching recolors every logo.

- Stable palette numbers: 02, 04, 06, 08, 10, 13, 14, 15, 16, and 19. Retained color values are unchanged.
- Removed 07 Olive, 09 Ochre, 17 Pine / Chalk, and 18 Aubergine / Celadon.
- This round adds 33 Fit, 34 Custody, 35 Rotate, and 36 Namespace, retaining all 23 earlier logos and their SVG files.
- Earlier exclusions: 01 Jade, 03 Sand, 05 Clay, 11 Vermilion, and 12 Sulfur.
- New logos explore hidden values, controlled access, and centralized custody in secrets management. Options 26 and 29 are removed; 27 and 28 remain among earlier candidates.
- Current recommendation: 16 Cocoa / Ice × 33 Fit.
- Earlier recommendation: 14 Slate × 30 Scope; compare 13 Plum × 32 Store for a standalone symbol.

[Palette sources and trade-offs](palette-research.md) · [New logo rationale](logos/round-9/README.md) · [Previous round](logos/round-8/README.md) · [Editable Figma](https://www.figma.com/design/3QD7tbVmZnKZoLEUOD0yRl?node-id=24-2)

Unified branch: `design/ui-studies`. See [color-applications](../../design/color-applications/index.html) for Dashboard/documentation palette applications. The three original interactive layouts are preserved in [dashboard-layouts](../../design/dashboard-layouts/dashboard.html).

`dashboard.html` compares colors only. `palettes.js` and `palettes-extra.js` are the color sources. `icons/preview.html` and `logos/preview.html` use the same available palettes. `logo-studies/` preserves the branch's initial independent logo studies, with English preview copy.

Run from the repository root:

```sh
npm --prefix web test
```

Checks cover stable numbers, exclusions, text/button contrast, palette switching, self-contained SVGs, and the repository's English-only copy policy. Figma was inspected in positive/negative color and at 16/24/32px symbol sizes. These are design proposals, not production UI or architecture changes.
