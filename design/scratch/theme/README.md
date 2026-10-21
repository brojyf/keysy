# Keysy color applications

Run `bun run dev` from `design/scratch/` and open `/theme/`. The Theme tab is part of the unified Design Studio; switching to Logo or CSS preserves the current selections. This React preview includes the shared palette definitions used by all three previews. The desktop workspace begins directly below the navigation, without a page or preview title. It places a large preview on the left, with **Supabase Dashboard / Mintlify docs** and **Light / Dark** selectors below it. The right panel fills the workspace from below the navigation to the bottom of the viewport and independently scrolls through 2 color choices, each with swatches and a thumbnail matching the current layout and appearance. Click anywhere on a choice to update the preview; there is no separate comparison gallery.

- Two layouts × 2 palettes × two modes: **8 combinations**. The retained palettes are numbered 1 Ink and 2 Mono. Cocoa / Ice, Terminal, Orchid, Ink / Iris, and Evergreen have been removed. Both use near-neutral light backgrounds and strictly neutral black/gray dark backgrounds, panels, selections, and dividers (`R = G = B`). Ink concentrates its blue in accents and buttons.
- The [research notes](palette-research.md) preserve the references behind earlier candidates; only Ink and Mono remain available.
- Uses the shared [palettes](palettes.js) values and Logo 33. Layout, copy, and artwork stay fixed; only colors change.
- The 1200 × 800 desktop mock scales proportionally to fit the preview area. On narrow or short screens, the color choices move below the preview and retain their own scroll region.
- Supports URL parameters such as `/?tab=theme&layout=mintlify&palette=blue&mode=dark`; the legacy `/theme/` URL remains supported. Preview controls work; product controls are static visual samples.
- Runs on Bun with Vite; requires dependency installation for development and a build for static hosting. No runtime CDN dependency, product SDK installation, or connection to a real project.
- [Color accessibility](color-accessibility.md) records the WCAG sources, pairing requirements, tested minimum ratios, and the distinction between decorative dividers and meaningful state indicators.

## Supabase reference

The [official Supabase Studio update](https://supabase.com/blog/tabs-dashboard-updates) and its [table editor screenshot](https://supabase.com/images/blog/lw14-tabs-dashboard-updates/table-editor-tabs.jpg) inform the organization/project navigation, narrow icon rail, resource list, tabs, toolbar, and compact table. The Keysy mock adds a secret details sidebar with fictional API key and `.p8` records. It is not a pixel-perfect Supabase replica or a claim that Keysy implements these features.

## Mintlify copy

`mintlify-copy/` is an unchanged copy of 20 files from `docs/` at the start of this study. Production `docs/` is unchanged.

The [Mintlify theme documentation](https://www.mintlify.com/docs/customize/themes) and the copy's `theme: mint` inform the top search, module tabs, left navigation, body, and right table of contents. The mock's title, description, directory table, and module tabs come from that copy; no product API documentation was invented. This is a local HTML appearance mock, not a Mintlify-rendered site. The copied theme configuration is unchanged; no documentation site was started or deployed.

## Selected palette

**1 Ink** (internal ID `blue`) was selected as the Keysy color system on October 21, 2026. Logo, Theme, and CSS previews all default to Ink. **2 Mono** remains available for comparison.

The shared [palette values](palettes.js) define the selected light/dark colors. Logo artwork uses the primary button color, including Ink's dark blue `#638ce5`.

## Verification

```sh
cd design/scratch
bun test theme/
```

Checks cover 8 layout/palette/mode combinations, preview/control placement, swatches and thumbnails, palette and layout switching, keyboard selection without page scrolling, URL restoration, consistency with the documentation copy, no network dependency, and existing text/button contrast requirements.
