# Color and readability

Checked on October 20, 2026. Applies to all 5 retained palettes in both modes, the Dashboard and documentation mocks, and the Design Studio controls.

## Requirements and design choices

| Concern | Requirement | Keysy application |
| --- | --- | --- |
| Text | [WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): ordinary text needs 4.5:1; sufficiently large text may use 3:1. | All text colors target at least 4.5:1. Primary text uses a stronger 7:1 design target on the page, panel, and selected surface. |
| Controls and states | [SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): essential control/state graphics need 3:1 against adjacent colors. Decorative separators do not automatically need 3:1. | Primary button fills, selection outlines, checkbox marks, and active navigation indicators use strong colors. The subtle `line` token is reserved for decorative grouping. |
| Color-independent meaning | [SC 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html): meaning must have a visual cue beyond hue alone. | Selected swatches and rows have checkmarks. Active navigation has a visible edge. Tabs have contrasting outlines. Save and policy status include text, not only dots or color. |
| Keyboard focus | [SC 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html): keyboard focus must remain visible. | Studio controls retain a 2px outline, tested against their adjacent surfaces. Tab keyboard navigation and selected state are covered by component tests. |
| Neutral surfaces | This is the requested Keysy direction, not an accessibility standard. | Light-mode `bg`, `surface`, `soft`, and `line` have at most 8/255 separation between RGB channels. Dark-mode structural colors are achromatic (`R = G = B`). Light `bg`, `surface`, and `soft` channels stay at least 235/255; their dark counterparts stay at most 52/255. Decorative dividers may be lighter. Accents and primary buttons are exempt from this surface constraint. |

Contrast is calculated from sRGB relative luminance, using the exact ratio without rounding to decide pass/fail. The current mock text does not use opacity or color mixing, so its declared tokens determine the foreground/background pairings. Decorative shadows and swatch edges do not attenuate text.

Evergreen (#5) dark mode also enforces design-only separation targets: panel/canvas at least 1.25:1, selected fill/canvas at least 1.45:1, and decorative divider/panel at least 1.8:1. Panels remain lighter than the canvas, and selected fills remain lighter than panels. These targets improve layer visibility; they are not WCAG thresholds for decorative backgrounds or separators.

## Measured minima

Each number is the minimum across both modes and all applicable page, panel, and selected surfaces. Values below are truncated to two decimals; tests compare full precision.

| Palette | Primary text | Muted text | Accent text | Button text | Button fill |
| --- | ---: | ---: | ---: | ---: | ---: |
| Target | 7.00 | 4.50 | 4.50 | 4.50 | 3.00 |
| 1 Ink | 12.26 | 5.08 | 5.21 | 4.57 | 3.13 |
| 2 Mono | 12.92 | 5.03 | 12.92 | 16.91 | 12.92 |
| 3 Ink / Iris | 11.85 | 4.98 | 7.67 | 8.71 | 7.67 |
| 4 Orchid | 11.64 | 4.95 | 5.76 | 6.61 | 5.76 |
| 5 Evergreen | 10.41 | 4.85 | 5.84 | 5.84 | 5.09 |

The expanded tests cover 133 palette pairings, plus studio label, selected-outline, and focus colors. Ink's dark button was slightly brightened to retain separation from the selected surface. Previously faint studio captions and candidate numbers were darkened.

## Verification and limits

```sh
cd design/scratch
bun test
bun run lint
bun run build
```

The component suite renders all 20 layout/palette/mode combinations and checks shared tokens, selection controls, URL restoration, and all logo recoloring. The background constraint prevents a later palette from reintroducing visibly colored surface areas.

These results verify the covered color pairings, not full WCAG conformance of a production application. The Dashboard and documentation screens are static visual mocks, and color-choice thumbnails scale down their content. Select a choice to inspect it in the larger preview. Production forms, error states, zoom/reflow, and assistive-technology behavior require verification when those interfaces are implemented.
