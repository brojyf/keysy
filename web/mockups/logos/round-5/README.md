# Keysy / asterisk studies

The user proposed `*` as the visual starting point for secrets management.
These four studies develop the masking character through glyph construction,
negative space, and typography. Open [`../../review.html`](../../review.html#logos).

[Editable Figma board](https://www.figma.com/design/3QD7tbVmZnKZoLEUOD0yRl?node-id=13-2).

| ID | Construction | Strength | Tradeoff |
| --- | --- | --- | --- |
| 19 Asterisk | Six equal flat-ended arms + Manrope Medium | Direct, legible, economical | Asterisk alone is a familiar, widely used shape |
| 20 Sealed | Six-arm asterisk cut out of a rounded square + DM Sans Medium | Strong independent icon; clear positive/reverse silhouette | More visual weight than a pure glyph |
| 21 keysy* | Rounded six-arm asterisk raised at the wordmark's right edge; Manrope Medium | Quiet typographic integration; minimal lockup | Can also read as a footnote marker |
| 22 Secret | A reduced asterisk inside variable braces + Outfit Medium | Explicit concealed-variable metaphor | More elements; the smallest rendition is denser |

21 is the preferred wordmark direction; 20 is the strongest contained icon.
These are aesthetic judgments, not final selection or recognition-study results.

## Design decisions

The semantic cue comes directly from the user's masking-character suggestion.
The asterisks are custom-built six-arm vector geometry. They retain an even
stroke and typographic rhythm. Differences include flat versus rounded ends,
positive versus reversed construction, and independent versus suffix placement.
The wordmarks use existing fonts; no custom alphabet is claimed.

The earlier [reference selection](../references.md) continues to inform the
approach: one product-related motif, clear lettering, and restrained spacing.
The symbol expresses concealed values. It is not a depiction of cryptographic
operations, an additional Keysy feature, or a claim about every secrets UI.

## Review and assets

The combined HTML foregrounds 19–22. The fourteen earlier options, including
11/12 and 15–18, remain available in a collapsed section. Rejected 01/03/13/14
remain absent. Colors are unchanged; the same artwork recolors in all four
light/dark palette pairs.

Eight SVG files contain the four lockups and four independent symbols. Exports
outline text and use `currentColor` for visible fills/strokes, without external
fonts or raster dependencies. Text remains editable in Figma.

The board and HTML show both background modes, 28px-high lockups, and standalone
symbols at 16/24/32px. Runtime checks cover the current/archive IDs and palette
switching across all previews. These checks do not establish trademark availability.
