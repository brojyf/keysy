# Keysy color applications

Run `bun run dev` from `design/scratch/` and open `/theme/`. The Theme tab is part of the unified Design Studio; switching to Logo or CSS preserves the current selections. This React preview includes the shared palette definitions used by all three previews. The desktop workspace begins directly below the navigation, without a page or preview title. It places a large preview on the left, with **Supabase Dashboard / Mintlify docs** and **Light / Dark** selectors below it. The right panel fills the workspace from below the navigation to the bottom of the viewport and independently scrolls through 7 color choices, each with swatches and a thumbnail matching the current layout and appearance. Click anywhere on a choice to update the preview; there is no separate comparison gallery.

- Two layouts × 7 palettes × two modes: **28 combinations**. Cobalt (3), Slate (4), and Ember (8) have been removed; the retained palettes keep their numbers (1, 2, 5, 6, 7, 9, and 10). All seven use near-neutral light backgrounds and strictly neutral black/gray dark backgrounds, panels, selections, and dividers (`R = G = B`). Brand hues remain in accents, not structural dark surfaces.
- The [research notes](palette-research.md) explain Terminal, Ember, Orchid, and Evergreen. Terminal and Evergreen retain stronger dark layering after removing their green surface tint. Both use canvas `#131313`, panel `#292929`, and selection `#333333`; Evergreen's divider is `#545454`, and green is concentrated in the accent.
- Uses the shared [palettes](palettes.js) values and Logo 33. Layout, copy, and artwork stay fixed; only colors change.
- The 1200 × 800 desktop mock scales proportionally to fit the preview area. On narrow or short screens, the color choices move below the preview and retain their own scroll region.
- Supports URL parameters such as `/?tab=theme&layout=mintlify&palette=terminal&mode=dark`; the legacy `/theme/` URL remains supported. Preview controls work; product controls are static visual samples.
- Runs on Bun with Vite; requires dependency installation for development and a build for static hosting. No runtime CDN dependency, product SDK installation, or connection to a real project.
- [Color accessibility](color-accessibility.md) records the WCAG sources, pairing requirements, tested minimum ratios, and the distinction between decorative dividers and meaningful state indicators.

## Supabase reference

The [official Supabase Studio update](https://supabase.com/blog/tabs-dashboard-updates) and its [table editor screenshot](https://supabase.com/images/blog/lw14-tabs-dashboard-updates/table-editor-tabs.jpg) inform the organization/project navigation, narrow icon rail, resource list, tabs, toolbar, and compact table. The Keysy mock adds a secret details sidebar with fictional API key and `.p8` records. It is not a pixel-perfect Supabase replica or a claim that Keysy implements these features.

## Mintlify copy

`mintlify-copy/` is an unchanged copy of 20 files from `docs/` at the start of this study. Production `docs/` is unchanged.

The [Mintlify theme documentation](https://www.mintlify.com/docs/customize/themes) and the copy's `theme: mint` inform the top search, module tabs, left navigation, body, and right table of contents. The mock's title, description, directory table, and module tabs come from that copy; no product API documentation was invented. This is a local HTML appearance mock, not a Mintlify-rendered site. The copied theme configuration is unchanged; no documentation site was started or deployed.

## Palette observations

- **16 Cocoa / Ice**: stronger warm/cool contrast in the dark Dashboard and some warmth in long documentation tables; swapping primary colors between modes needs consistent brand treatment.
- **04 Mono**: closest to a neutral tool interface, but lacks the recognition advantage of colored feedback.
- **6 Ink / Iris**: more prominent buttons and navigation accents; dense inline code increases the colored area in documentation.

These are palette trade-offs, not a final theme selection. The simpler final approach is one light/dark system shared by the Dashboard and documentation.

## Verification

```sh
cd design/scratch
bun test theme/
```

Checks cover 28 layout/palette/mode combinations, preview/control placement, swatches and thumbnails, palette and layout switching, keyboard selection without page scrolling, URL restoration, consistency with the documentation copy, no network dependency, and existing text/button contrast requirements.
