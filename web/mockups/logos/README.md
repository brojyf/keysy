# Keysy logo directions

Latest: [four access and lifecycle directions, 33–36](round-9/README.md).
[Previous directions, 30–32](round-8/README.md) remain unchanged. Open
[`../review.html`](../review.html#logos) for the current combined review.
01 and 03 were removed from that review at the user's request; this document
describes the archived first exploration.

Editable source: [Figma design board](https://www.figma.com/design/3QD7tbVmZnKZoLEUOD0yRl?node-id=2-4).
Open `preview.html` for the same four proposals with live recoloring.

| Direction | Construction | Strength | Tradeoff |
| --- | --- | --- | --- |
| 01 | Key-k symbol + lowercase keysy; Manrope Bold | Clear name, calm tool identity, independent favicon | More conventional |
| 02 | Keyhole symbol + uppercase KEYSY; Nunito ExtraBold | Rounded and friendly; closest structural reference to Kira | More playful; keyhole less distinctive |
| 03 | Key-k becomes the first letter, followed by eysy; Manrope Bold | Compact, distinctive integration | Smallest sizes can read as symbol + eysy |
| 04 | Lowercase wordmark only; Outfit SemiBold | Simplest and quietest | Less distinctive; favicon relies on the initial |

02 and 04 remain in the combined review as earlier alternatives. The initial
recommendation of 01 is superseded by the user's rejection of that direction.
These are proposals, not a selected production identity.

## Research and design decisions

Reviewed on 2026-10-15:

- [Kira](https://kira.art/): observed the top-left logo in the live website.
  It pairs a rounded abstract symbol with an uppercase rounded wordmark, using
  similar visual weight and a single color. This informs the relationship
  between shape and type, not a copy of its symbol or letterforms.
- [Linear brand](https://linear.app/brand): prefer the wordmark when space
  permits and keep clear space; standalone symbols serve tighter placements.
- [Supabase brand assets](https://supabase.com/brand-assets): maintains explicit
  light/dark logo assets and a controlled wordmark color.
- [IBM logo guidance](https://www.ibm.com/design/language/ibm-logos/8-bar/):
  optical alignment, consistent proportions, clear space and positive/reverse
  rendering need deliberate inspection. IBM's numeric spacing rules are
  specific to IBM and have not been presented as universal Keysy requirements.

The board compares shape in black/white first, shows both light and dark
backgrounds, and includes 28px-high lockups plus 16/24/32px standalone symbols.
The display checks are visual, not a user-recognition study.

## Assets and recoloring

All six SVGs are genuine vector paths: no raster images, external fonts,
gradients or background tiles. Type remains editable in Figma; exported type
is outlined so the SVG does not depend on installed fonts. The symbols were
redrawn as editable vectors for these logo proposals; earlier PNG concepts
remain unchanged in `../icons/`.

- `01-symbol-lowercase.svg`
- `02-rounded-uppercase.svg`
- `03-integrated-key.svg`
- `04-wordmark.svg`
- `key-k-symbol.svg`
- `keyhole-symbol.svg`

Each visible fill is `currentColor`. Inline the SVG and change CSS `color`, or
use the same SVG as an alpha mask with `background: currentColor`. A plain
`<img>` element does not inherit the parent element's color into its SVG.
No separate image generation is needed for a different palette.

Figma uses two shared paint styles, `Keysy / Logo ink / Light` and
`Keysy / Logo ink / Dark`, to keep recoloring consistent across the board.
