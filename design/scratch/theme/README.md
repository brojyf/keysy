# Keysy color applications

Run `bun run dev` from `design/scratch/` and open `/theme/`. The Theme tab is part of the unified Design Studio; switching to Logo preserves the current selections. This React preview includes the shared palette definitions used by both previews. Use the swatch cards and toolbar to switch between **Supabase Dashboard / Mintlify docs**, 9 palettes, and light/dark modes. The comparison section always pairs both modes for every palette in the selected layout. Click **Expand** to return to the full preview.

- Two layouts × 9 palettes × two modes: **36 combinations**. Cobalt (3) has been removed; the other palettes keep their numbers (1, 2, and 4–10). All nine use near-neutral backgrounds, panels, selections, and dividers in both modes.
- The [research notes](palette-research.md) explain Terminal, Ember, Orchid, and Evergreen. Evergreen dark mode uses near-black `#111312`, neutral gray-green panels `#1b1e1c`, and a restrained selection fill `#272b28`; green is concentrated in the accent.
- Uses the shared [palettes](palettes.js) values and Logo 33. Layout, copy, and artwork stay fixed; only colors change.
- The 1200 × 800 desktop mock scales proportionally to its container. On small screens, paired modes stack vertically.
- Supports URL parameters such as `/?tab=theme&layout=mintlify&palette=slate&mode=dark`; the legacy `/theme/` URL remains supported. Preview controls work; product controls are static visual samples.
- Runs on Bun with Vite; requires dependency installation for development and a build for static hosting. No runtime CDN dependency, product SDK installation, or connection to a real project.
- [Color accessibility](color-accessibility.md) records the WCAG sources, pairing requirements, tested minimum ratios, and the distinction between decorative dividers and meaningful state indicators.

## Supabase reference

The [official Supabase Studio update](https://supabase.com/blog/tabs-dashboard-updates) and its [table editor screenshot](https://supabase.com/images/blog/lw14-tabs-dashboard-updates/table-editor-tabs.jpg) inform the organization/project navigation, narrow icon rail, resource list, tabs, toolbar, and compact table. The Keysy mock adds a secret details sidebar with fictional API key and `.p8` records. It is not a pixel-perfect Supabase replica or a claim that Keysy implements these features.

## Mintlify copy

`mintlify-copy/` is an unchanged copy of 20 files from `docs/` at the start of this study. Production `docs/` is unchanged.

The [Mintlify theme documentation](https://www.mintlify.com/docs/customize/themes) and the copy's `theme: mint` inform the top search, module tabs, left navigation, body, and right table of contents. The mock's title, description, directory table, and module tabs come from that copy; no product API documentation was invented. This is a local HTML appearance mock, not a Mintlify-rendered site. The copied theme configuration is unchanged; no documentation site was started or deployed.

## Palette observations

- **14 Slate**: quiet in tables and documentation, with clear text, selection, and background separation; less distinctive branding.
- **16 Cocoa / Ice**: stronger warm/cool contrast in the dark Dashboard and some warmth in long documentation tables; swapping primary colors between modes needs consistent brand treatment.
- **04 Mono**: closest to a neutral tool interface, but lacks the recognition advantage of colored feedback.
- **6 Ink / Iris**: more prominent buttons and navigation accents; dense inline code increases the colored area in documentation.

These are palette trade-offs, not a final theme selection. The simpler final approach is one light/dark system shared by the Dashboard and documentation.

## Verification

```sh
cd design/scratch
bun test theme/
```

Checks cover 36 layout/palette/mode combinations, palette and layout switching, URL restoration, expanding comparisons, consistency with the documentation copy, no network dependency, and existing text/button contrast requirements.
