# Keysy / Secrets management

Latest: [new concealed-value studies 15–18](../round-4/README.md).

The user confirmed the product category on 2026-10-15: a secrets-management
product similar to OpenBao. This revision translates that purpose into the
symbols, rather than selecting shapes only for appearance.

Open [`../../review.html`](../../review.html#logos). Current directions 11/12 appear first. Rejected 13/14 have been removed
from the review; their source assets remain archived. Eight earlier directions are collapsed; rejected 01/03 stay out.
All four light/dark palettes recolor the same vector artwork.

[Editable Figma source](https://www.figma.com/design/3QD7tbVmZnKZoLEUOD0yRl?node-id=7-2).

| ID | Product meaning | Visual decision | Tradeoff |
| --- | --- | --- | --- |
| 11 Vault | Protect stored secrets | A keyhole is cut out of a dense rounded enclosure | Most immediate security association; less distinctive |
| 12 Mask | Hide sensitive values | Three masking dots sit within a pair of protective brackets | Clear technical character; can resemble redacted code |
| 13 Access | Control access to secrets | A key and a container boundary share one compact silhouette | Strongest combination of product meaning and ownable shape; needs closer inspection |
| 14 Keybook | Keep many secrets together | Three key slots sit in one ordered container | Emphasizes organization; may also read as a key cabinet |

The earlier recommendation of 13 is superseded by the user rejecting 13/14.
11/12 remain candidates. See [selected inspiration sources](../references.md)
for the next design direction.
Every lockup uses DM Sans Medium, consistent tracking and comparable symbol
weight so differences come primarily from the product metaphor. There is one
symbol per direction, without decorative sparkles, gradients or extra badges.

## Functional research

[OpenBao's product overview](https://openbao.org/docs/what-is-openbao/) describes
centralized secret storage, restricted access, and authentication/authorization
before access. Those category-level ideas inform the visual metaphors here.
The mask in 12 is a visual convention for concealed values; it does not depict
an encryption algorithm or claim that masking equals encryption.

The user confirmed the category, not a complete Keysy feature specification.
These explanations express brand intent; they are not claims that every
OpenBao feature is already implemented in Keysy. The current local API and CLI
remain scaffolding. No production behavior or architecture was changed.

## Assets and verification

Each direction has a full outlined SVG and an independent `*-symbol.svg`.
All visible fills use `currentColor`; no external fonts or raster assets are
required. Text remains editable in Figma. The board and combined HTML compare
light/dark backgrounds, 28px-high lockups, and 16/24/32px standalone marks.
Visual checks do not establish trademark availability or user recognition.
