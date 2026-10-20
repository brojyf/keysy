# UI color, contrast, and background requirements

Researched online: 2026-10-20. Scope: evaluating Keysy theme candidates for readable dashboards and documentation, in light and dark modes. This is a research and review guide, not a final palette selection or a production accessibility certification.

## 1. How to read this document

- **WCAG requirement** means a success criterion in [WCAG 2.2][wcag]. Level A and AA requirements are relevant to an AA conformance target; AAA requirements are identified separately. W3C Understanding pages explain the criteria but are informative, not the normative standard.
- **Design-system practice** means guidance from IBM Carbon, Atlassian, or Supabase. It is useful precedent, not a universal accessibility rule.
- **Keysy constraint** means a rule already present in the local theme study. It does not become a WCAG requirement just because a test enforces it.
- **Recommendation** means a proposed review practice, not an approved architecture or a request to change the implementation.

The existing [color accessibility record](color-accessibility.md) documents local measured results. This document explains the external requirements and their limits; it does not re-certify those results.

## 2. Measurable accessibility requirements

| Concern | Threshold or rule | Source and level |
| --- | --- | --- |
| Normal text, including secondary text, placeholders, and button labels | At least **4.5:1** against the actual background. Making text secondary does not exempt it. | [SC 1.4.3][text], AA |
| Large text | At least **3:1**. Large means at least 18pt regular (24 CSS px), or 14pt bold (approximately 18.67 CSS px), including equivalent sizes for CJK fonts. Use 4.5:1 when uncertain about size or weight. | [SC 1.4.3][text], AA |
| Enhanced text contrast | At least **7:1** for normal text and **4.5:1** for large text. These are AAA thresholds, not the AA minimum. | [SC 1.4.6][enhanced], AAA |
| Essential control and state information | At least **3:1** against adjacent colors for visual information needed to identify controls and their states. | [SC 1.4.11][nontext], AA |
| Meaningful graphics | Parts needed to understand an icon, chart, or diagram need at least **3:1** against adjacent colors, subject to the criterion's exceptions. | [SC 1.4.11][nontext], AA |
| Meaning conveyed by color | Do not rely on hue alone to communicate an action, error, selection, or other information. Provide a visible distinction such as text, a checkmark, an underline, or a shape. | [SC 1.4.1][color], A |
| Keyboard focus | Keyboard-operable interfaces need a visible focus indicator. Author-styled indicators also need the applicable non-text contrast against adjacent colors. | [SC 2.4.7][focus-visible], AA; [SC 1.4.11][nontext], AA |
| Enhanced focus appearance | An indicator area at least as large as a 2 CSS px thick perimeter, with at least **3:1 between the same pixels in focused and unfocused states**, subject to stated exceptions. This is not merely a ring/background test. | [SC 2.4.13][focus-appearance], AAA |

### Important boundaries

- **Do not round a failing ratio into a pass.** `4.499:1` fails a `4.5:1` threshold. Display rounded values if useful, but decide pass/fail using full precision.
- **Disabled is not the same as muted.** Inactive controls are exempt from the cited text/control contrast requirements; helper text and less prominent but active content are not. Keep disabled content understandable where practical.
- **Decorative borders are not automatically subject to 3:1.** If an input boundary is the information needed to locate the control, it needs sufficient contrast. If a button is identifiable from its contrasting label, its entire fill or decorative border does not necessarily need 3:1 against the page.
- **Not every pair of palette colors needs contrast testing.** Test colors that are actually paired or adjacent and carry information. Two decorative surfaces do not automatically need 3:1 against each other.
- **Default and hover fills do not need 3:1 against each other merely because the state changes.** Required text, control identification, and state cues must remain sufficiently contrasted in each state. The AAA focus criterion has a separate before/after comparison.
- **Brand colors are not a blanket exemption.** Logotype text has a specific exception; ordinary brand-colored links, labels, and buttons do not inherit it.

## 3. Readability is more than a passing ratio

1. **Preserve readable secondary text.** Use layout, weight, spacing, and wording to establish hierarchy rather than pushing captions or metadata below 4.5:1.
2. **Leave margin above the minimum.** Very thin type and fine strokes can look fainter because of antialiasing even when their declared colors technically pass. Stronger text or a less fragile font weight is safer than targeting exactly 4.5:1. [SC 1.4.3][text] explicitly discusses this limitation.
3. **Review at the actual rendered size.** A palette swatch cannot demonstrate the readability of a dense table, code block, timestamp, tooltip, or placeholder. Review the expanded preview, not only scaled thumbnails.
4. **Keep inline links identifiable.** A persistent underline is the simplest default for links inside prose. If links rely on color and lightness instead, [technique G183][links] uses at least 3:1 between link and surrounding text, while both still need their own text/background contrast. This technique is an option, not a requirement to remove underlines.
5. **Do not mistake contrast for full reading accessibility.** Font size, line length, spacing, zoom, and reflow need separate review. [SC 1.4.8][visual] is an AAA criterion about mechanisms to adjust text presentation, including foreground/background colors; it is not a mandatory default palette or a requirement to build a custom color picker.

A 7:1 target for primary reading text provides additional contrast margin. It does not establish full AAA conformance, nor prove that the resulting page is comfortable for every user.

## 4. Background requirements and recommendations

### 4.1 What WCAG does and does not require

WCAG evaluates the foreground/background relationship. It does **not** prescribe:

- A particular background HEX value, hue, or saturation.
- A universal ban on pure white, pure black, or tinted surfaces.
- A mandatory 3:1 ratio between every card and its page background.
- A universal maximum contrast ratio for comfort.
- A fixed neutral/accent percentage such as 60/30/10.

Therefore, claims such as “white backgrounds fail accessibility” or “all surfaces must differ by 3:1” are not justified by the cited criteria. Comfort and preference still warrant visual review and, where available, user-controlled themes.

### 4.2 Use quiet surfaces to support dense content

**Design-system practice:** [IBM Carbon][carbon] uses a dominant neutral-gray family, subtle value shifts for content zones, a primary action color, and additional colors sparingly. [Atlassian][atlassian] similarly uses neutrals for most backgrounds, text, and shapes, and assigns explicit roles to semantic colors.

**Recommendation for Keysy:** keep large dashboard and documentation surfaces near-neutral, and concentrate chromatic emphasis on actions, links, selection indicators, and meaningful status. This follows the existing local study direction; it is not an accessibility mandate.

- **Pros:** less visual competition in dense tables and prose; easier reuse of readable text across surfaces.
- **Cons:** weaker brand expression; surfaces may merge if spacing, structure, and necessary boundaries are too subtle.
- **Why this approach:** it matches the current dashboard/documentation study and established enterprise UI practice without requiring additional themes or a new token system.
- **Simpler alternative:** use one page background and one panel surface where extra layers add no useful meaning. Do not introduce an elevation ramp just to imitate a design system.

### 4.3 Light mode

- Use a light page background with dark text, and test every reading surface independently.
- White or slightly off-white surfaces are both valid. Carbon's documented light-theme base backgrounds include `#ffffff` and `#f4f4f4`; these are examples, not Keysy requirements.
- Establish hierarchy with spacing and grouping before adding more background tints.
- A subtle divider can remain subtle if decorative. Strengthen it when it is the necessary cue for a field boundary, selection, or other meaningful information.

### 4.4 Dark mode

- Use dark surfaces with light text, but validate dark mode independently instead of mechanically inverting the light palette.
- Carbon's dark-theme base backgrounds include `#161616` and `#262626`; its raised layers become progressively lighter. This is one coherent layering model, not a WCAG rule.
- A near-black gray is a reasonable starting point for surface separation; pure black is not forbidden. Check real text and controls rather than rejecting a color by name.
- Do not assume dark mode is more readable or comfortable for everyone. Carbon encourages respecting user preferences; mode preference is not a substitute for measured contrast.
- Recheck brand accents. A hue suitable for a button plate may be unsuitable for small text, or vice versa. [Supabase][supabase] explicitly separates readable primary ink, solid button fill, and brighter interactive chrome, particularly in dark mode.

### 4.5 Transparency, gradients, images, and overlays

- Test against the **effective composited background**, not just the declared HEX value. Text opacity, translucent parents, scrims, and overlapping surfaces can change the pair.
- For gradients or background images, check the lowest-contrast area behind the text across relevant viewport sizes and states. A single sample or average background is insufficient.
- For reading-heavy areas, a solid surface behind text is the simplest reliable alternative to continuously testing variable imagery.
- Recheck modal, popover, tooltip, selected-row, and code-block backgrounds. Passing on the page background says nothing about these other surfaces.

### 4.6 Existing Keysy background constraints

The current [palette tests](palettes.test.mjs) enforce the following local rules:

- `bg`, `surface`, `soft`, and `line`: the largest RGB channel minus the smallest is at most `8` on the 0–255 scale.
- Light-mode `bg`, `surface`, and `soft`: every channel is at least `235`.
- Dark-mode `bg`, `surface`, and `soft`: every channel is at most `52`.
- `line` is decorative; it must not silently become the only meaningful control or state boundary.

These are near-neutral art-direction constraints, not perceptually uniform color measurements, evidence of comfort, or WCAG criteria. This research does not change them.

## 5. Relationships between colors and states

| Relationship | Review rule |
| --- | --- |
| Primary, muted, and accent text on each reading surface | Test each actual foreground/background pair. “Muted” and “accent” remain text. |
| Button label on button fill | Normal-size labels need 4.5:1, including hover and pressed states. Do not assume white labels work on every accent. |
| Button fill on surrounding surfaces | Evaluate whether the fill is essential to identifying the control. Keysy's existing tests use a stricter blanket 3:1 target for primary fills; do not describe that as universally required by WCAG. |
| Selected item and its surroundings | Preserve readable text and an identifiable state cue. Add a checkmark, underline, outline, or another visible distinction instead of relying only on a hue shift. |
| Selected and focused at the same time | Keep both cues. [Atlassian][atlassian] treats selection as persistent and focus as the current input location; neither should replace the other. |
| Success, warning, danger, and brand accents | Assign meaning consistently and add visible labels or icons. A red/green distinction alone is insufficient when users need to identify which status applies. |
| Chart series or categorical colors | Use labels, patterns, shapes, or line styles as needed; a color-vision simulation is a useful diagnostic, not proof of conformance. |

## 6. Calculation and concrete examples

For opaque sRGB pairs, use WCAG relative luminance, not RGB distance or perceived hue difference:

```text
For each 8-bit sRGB channel:
  c = channel / 255
  linear(c) = c / 12.92                       when c <= 0.04045
              ((c + 0.055) / 1.055) ^ 2.4    otherwise

L = 0.2126 * linear(R) + 0.7152 * linear(G) + 0.0722 * linear(B)
contrast = (max(L_foreground, L_background) + 0.05)
           / (min(L_foreground, L_background) + 0.05)
```

The [normative WCAG definitions][wcag] specify relative luminance and contrast ratio. Resolve transparency before applying the opaque-pair calculation. The existing palette tests use this formula for their opaque HEX tokens.

| Foreground / background | Ratio, displayed to four decimals | Interpretation |
| --- | ---: | --- |
| `#777777` / `#ffffff` | 4.4781:1 | Fails normal-text AA, despite looking close to 4.5. |
| `#767676` / `#ffffff` | 4.5422:1 | Passes normal-text AA with little margin. |
| `#999999` / `#ffffff` | 2.8490:1 | Fails even the 3:1 large-text threshold. |
| `#ffffff` / `#ffff00` | 1.0738:1 | A vivid background does not guarantee readable white text. |
| `#111111` / `#ffff00` | 17.5846:1 | Dark text fixes the contrast pairing; it does not make saturated yellow a good large-area background. |
| `#ffffff` / `#161616` | 18.0962:1 | High contrast is allowed; comfort still needs review. |

These are illustrative pairs, not proposed additions to the palette. Calculations use full precision for pass/fail. [WebAIM Contrast Checker][checker] provides an independent manual check, including foreground alpha support.

## 7. Review and verification checklist

1. **Inventory actual pairings.** Record text, icon, control, selection, and focus colors with each actual background, separately for light and dark mode. Verify that no relevant surface or state is omitted.
2. **Run exact contrast checks.** Verify normal text at 4.5:1, required non-text information at 3:1, and any explicitly adopted stronger targets. Keep normative minimums separate from local design targets.
3. **Inspect real content.** Review dense tables, prose, code, helper text, tooltips, and controls at their intended size. Verify thin strokes and secondary text are still readable.
4. **Inspect interactions.** Check default, hovered, pressed, selected, focused, selected-plus-focused, error, and disabled states where implemented. Verify that selection survives hover and keyboard focus remains recognizable.
5. **Remove dependence on hue.** Verify errors, status, charts, and selection remain understandable through visible labels, shapes, or other cues. Use grayscale/color-vision simulations only as supplementary checks.
6. **Check variable backgrounds.** Verify effective opacity/compositing and the worst-case text region on gradients or images. Prefer a solid backing when that makes the result simpler and more reliable.
7. **Record scope and limitations.** Save failing pairs, measured ratios, and reviewed states. Do not convert passing palette tests into a claim of full application WCAG conformance.

Existing palette checks can be run without changing implementation:

```sh
cd design/scratch
bun test theme/palettes.test.mjs
```

These checks cover the pairs and static styles explicitly asserted in that file. They do not prove every runtime state, image background, browser setting, or production component is accessible. See the separate [accessibility record](color-accessibility.md) for the broader local verification commands and reported coverage.

## 8. Sources

The following pages were fetched and read during this research. W3C is the authority for WCAG requirements; company design systems supply implementation precedents, not additional WCAG mandates.

1. [WCAG 2.2, normative standard][wcag] — success criteria, conformance levels, and contrast/luminance definitions.
2. [W3C: Contrast (Minimum), SC 1.4.3][text] — text thresholds, large text, exceptions, rounding, and antialiasing caveats.
3. [W3C: Contrast (Enhanced), SC 1.4.6][enhanced] — AAA text thresholds.
4. [W3C: Non-text Contrast, SC 1.4.11][nontext] — essential controls, states, graphics, adjacent colors, and boundaries.
5. [W3C: Use of Color, SC 1.4.1][color] — visible alternatives to hue-only meaning.
6. [W3C: Focus Visible, SC 2.4.7][focus-visible] and [Focus Appearance, SC 2.4.13][focus-appearance] — distinguish AA visibility from AAA area and before/after contrast requirements.
7. [W3C: G183 inline-link technique][links] — link/surrounding-text contrast is distinct from text/background contrast.
8. [W3C: Visual Presentation, SC 1.4.8][visual] — user-adjustable text presentation at AAA.
9. [IBM Carbon: Color overview][carbon] and [Color guidelines][carbon-guidelines] — neutral dominance, semantic roles, surface layering, and mode preferences.
10. [Atlassian: Color][atlassian] — role-based color, interaction states, and separate selection/focus treatment.
11. [Supabase: Color usage][supabase] — separate readable accent ink, button fill, and focus/selection chrome.
12. [WebAIM: Contrast Checker][checker] — practical independent verification and threshold explanations.

[wcag]: https://www.w3.org/TR/WCAG22/
[text]: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
[enhanced]: https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html
[nontext]: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
[color]: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
[focus-visible]: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
[focus-appearance]: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
[links]: https://www.w3.org/WAI/WCAG22/Techniques/general/G183
[visual]: https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html
[carbon]: https://www.carbondesignsystem.com/building-blocks/foundations/color/overview
[carbon-guidelines]: https://www.carbondesignsystem.com/building-blocks/foundations/color/guidelines
[atlassian]: https://atlassian.design/foundations/color/
[supabase]: https://supabase.com/design-system/docs/color-usage
[checker]: https://webaim.org/resources/contrastchecker/
