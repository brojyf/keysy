# Keysy color applications

Open [index.html](index.html) directly. Use the toolbar to switch between **Supabase Dashboard / Mintlify docs**, 8 palettes, and light/dark modes. The comparison section always pairs both modes for every palette in the selected layout. Click **Expand** to return to the full preview.

- Two layouts × 8 palettes × two modes: **32 combinations**. Options 06, 07, 08, 09, 17, and 18 are removed; other numbers stay unchanged.
- Uses the shared [palettes](../palettes/palettes.js) values and Logo 33. Layout, copy, and artwork stay fixed; only colors change.
- The 1200 × 800 desktop mock scales proportionally to its container. On small screens, paired modes stack vertically.
- Supports URL parameters such as `?layout=mintlify&palette=slate&mode=dark`. Preview controls work; product controls are static visual samples.
- No build or network dependency, SDK installation, or connection to a real project.

## Supabase reference

The [official Supabase Studio update](https://supabase.com/blog/tabs-dashboard-updates) and its [table editor screenshot](https://supabase.com/images/blog/lw14-tabs-dashboard-updates/table-editor-tabs.jpg) inform the organization/project navigation, narrow icon rail, resource list, tabs, toolbar, and compact table. The Keysy mock adds a secret details sidebar with fictional API key and `.p8` records. It is not a pixel-perfect Supabase replica or a claim that Keysy implements these features.

## Mintlify copy

`mintlify-copy/` is an unchanged copy of 20 files from `docs/` at the start of this study. Production `docs/` is unchanged.

The [Mintlify theme documentation](https://www.mintlify.com/docs/customize/themes) and the copy's `theme: mint` inform the top search, module tabs, left navigation, body, and right table of contents. The mock's title, description, directory table, and module tabs come from that copy; no product API documentation was invented. This is a local HTML appearance mock, not a Mintlify-rendered site. The copied theme configuration is unchanged; no documentation site was started or deployed.

## Palette observations

- **14 Slate**: quiet in tables and documentation, with clear text, selection, and background separation; less distinctive branding.
- **16 Cocoa / Ice**: stronger warm/cool contrast in the dark Dashboard and some warmth in long documentation tables; swapping primary colors between modes needs consistent brand treatment.
- **04 Mono**: closest to a neutral tool interface, but lacks the recognition advantage of colored feedback.
- **10 Cobalt and 19 Ink / Iris**: more prominent buttons and navigation accents; dense inline code increases the colored area in documentation.

These are palette trade-offs, not a final theme selection. The simpler final approach is one light/dark system shared by the Dashboard and documentation.

## Verification

```sh
node --test design/color-applications/preview.test.mjs design/palettes/palettes.test.mjs
```

Checks cover 32 layout/palette/mode combinations, palette and layout switching, URL restoration, expanding comparisons, consistency with the documentation copy, no network dependency, and existing text/button contrast requirements.
