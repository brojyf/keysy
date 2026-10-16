# Keysy logo studies

Open `preview.html` directly in a browser. No server, installation, network
requests, or font loading are needed. These are three visual candidates, not a
final identity or a change to the product UI.

## Directions

| Study | Approach | Strength | Trade-off |
| --- | --- | --- | --- |
| A — Key K | Original key-shaped K plus a lowercase Manrope wordmark | A recognizable standalone symbol with a quiet developer-tool wordmark; recommended starting point | A separate mark adds width to the lockup |
| B — Keyhole | Original rounded keyhole tile plus an Outfit wordmark | Friendlier, with a clear silhouette at small sizes | Keyholes are common in the security category and less distinctive |
| C — Wordmark | A key bow integrated into the lowercase k; no separate leading icon | The simplest silhouette; a distinctive detail belongs to the name itself | Recognition initially depends on showing the full name; the extracted k is narrower at small sizes |

All three include light/dark proofs, 16/24/32 px standalone symbols, and a
compact workspace-header proof. Start with black and white to compare shape
rather than color. The designs do not use shadows, gradients, or decorative
containers around the wordmarks.

## Research

Reviewed official sources on 2026-10-15:

- [Kira](https://kira.art/) and its actual
  [SVG wordmark](https://kira.art/kira-ui/logo-wordmark.svg): the inspected page
  uses a custom symbol and uppercase letterforms in a compact, white vector
  lockup. The useful lesson is that the lettering and symbol form one identity,
  rather than attaching arbitrary text to an app icon. Keysy uses original
  geometry and lowercase lettering; none of Kira's paths were reused.
- [Linear brand guidelines](https://linear.app/brand): prefer the wordmark when
  space allows, reserve the standalone mark for tight layouts, favor monochrome
  wordmarks, and give the mark room to breathe. These inform the neutral
  wordmarks, clear spacing, and compact-header proofs.
- [Supabase brand assets](https://supabase.com/brand-assets): supplies light and
  dark SVG variants and explicitly restricts wordmark colors. For Keysy the
  corresponding design choice is a black/white wordmark with color concentrated
  in the symbol. Supabase artwork is not reused.

These references inform composition and usage, not a claim of affiliation.

## Color and export

The presets retain the previous Keysy studies' accents:

| Preset | Light-background accent | Dark-background accent |
| --- | --- | --- |
| Mono | `#171717` | `#ededed` |
| Green | `#087f5b` | `#3ecf8e` |
| Ink | `#315fc4` | `#8daaf0` |
| Sand | `#865c36` | `#d0ae83` |

Only the symbol changes color. The wordmark stays `#171717` on white and
`#ededed` on `#141414`. Custom colors apply the same color on both backgrounds;
the preview explicitly warns that they are not automatically contrast-adjusted.

The two download buttons on each candidate export its currently displayed
light/dark SVG, including the selected accent. Exports have a transparent
background, explicit colors, and no external references. The dark-background
export has white lettering and needs a suitable dark background.

Standalone assets are also provided:

- `a-key-k.svg` / `a-symbol.svg`
- `b-keyhole.svg` / `b-symbol.svg`
- `c-wordmark.svg` / `c-symbol.svg`

The static assets default to black. Set the root SVG's `color` to recolor the
whole asset; set `color` on its `data-accent` group to recolor only the symbol.
For inline SVG, remove the default root `style` to inherit `currentColor` from
its container. A plain `<img>` does not inherit its parent element's color.

## Typography and licensing

Lettering is converted to vector outlines; no installed font is required.
A/C use Manrope at weight 650, with custom key-shaped k geometry in C. B uses
Outfit at weight 600. Both are distributed under the SIL Open Font License;
complete copyright and license notices are retained under `licenses/`.

Sources retrieved from Google Fonts on 2026-10-15:

- [Manrope variable font](https://github.com/google/fonts/tree/main/ofl/manrope)
- [Outfit variable font](https://github.com/google/fonts/tree/main/ofl/outfit)

The symbols are hand-drawn SVG geometry. The PNG icon studies from the earlier
session remain untouched and are not required by this preview.

## Verification

Run the dependency-free packaging checks from the repository root:

```sh
node --test web/mockups/logos/preview.test.mjs
```

They check that all six SVG assets are self-contained, that embedded preview
artwork matches the standalone assets, and that local page resources exist.

Also verified in Chromium using `file://`: all four preset pairs across all
three candidates, custom-color behavior, six recolored light/dark downloads,
keyboard activation, and no horizontal overflow at 320, 375, 720, 768, 960, and
1440 px. Desktop and mobile screenshots were visually inspected. Browser
verification does not imply Safari or physical-device testing.
