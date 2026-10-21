# Color and readability

Checked on October 21, 2026. Applies to the retained Ink palette in both modes, the Logo and CSS studies, and the Design Studio controls.

## Requirements and design choices

| Concern | Requirement | Keysy application |
| --- | --- | --- |
| Text | [WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): ordinary text needs 4.5:1; sufficiently large text may use 3:1. | All text colors target at least 4.5:1. Primary text uses a stronger 7:1 design target on the page, panel, and selected surface. |
| Controls and states | [SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): essential control/state graphics need 3:1 against adjacent colors. Decorative separators do not automatically need 3:1. | Primary button fills, selection outlines, checkbox marks, and active navigation indicators use strong colors. The subtle `line` token is reserved for decorative grouping. |
| Color-independent meaning | [SC 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html): meaning must have a visual cue beyond hue alone. | Selected swatches and rows have checkmarks. Active navigation has a visible edge. Tabs have contrasting outlines. Save and policy status include text, not only dots or color. |
| Keyboard focus | [SC 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html): keyboard focus must remain visible. | Studio controls retain a 2px outline, tested against their adjacent surfaces. Tab keyboard navigation and selected state are covered by component tests. |
| Neutral surfaces | This is the requested Keysy direction, not an accessibility standard. | Light-mode `bg`, `surface`, `soft`, and `line` have at most 8/255 separation between RGB channels. Dark-mode structural colors are achromatic (`R = G = B`). Light `bg`, `surface`, and `soft` channels stay at least 235/255; their dark counterparts stay at most 52/255. Decorative dividers may be lighter. Accents and primary buttons are exempt from this surface constraint. |

Contrast is calculated from sRGB relative luminance, using the exact ratio without rounding to decide pass/fail. Palette tests use the declared opaque HEX tokens. CSS integrations also use derived colors and require browser checks for their rendered states. Decorative shadows and swatch edges do not attenuate text.

## Measured minima

Each number is the minimum across both modes and all applicable page, panel, and selected surfaces. Values below are truncated to two decimals; tests compare full precision.

| Palette | Primary text | Muted text | Accent text | Button text | Button fill |
| --- | ---: | ---: | ---: | ---: | ---: |
| Target | 7.00 | 4.50 | 4.50 | 4.50 | 3.00 |
| 1 Ink | 12.26 | 5.08 | 5.64 | 5.23 | 4.38 |

The expanded tests cover 26 palette pairings, plus studio label, selected-outline, and focus colors. Ink dark mode uses brighter blue accents and buttons with dark button text to preserve readability. Previously faint studio captions and candidate numbers were darkened.

## Verification and limits

```sh
cd design/scratch
bun run test
bun run lint
bun run build
```

The component suite checks shared tokens, selection controls, URL restoration, and all logo recoloring. Palette tests live in `design/theme/`; studio contrast checks live in `design/scratch/accessibility.test.mjs`. The background constraint prevents visibly colored structural surfaces.

These results verify the covered color pairings, not full WCAG conformance of a production application. The former Dashboard and documentation Theme mocks have been removed. CSS integrations remain local design experiments; their hover colors and interactions are checked by `bun run test:browser` from `design/scratch/`. Production forms, error states, zoom/reflow, and assistive-technology behavior require verification when those interfaces are implemented.
