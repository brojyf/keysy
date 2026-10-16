# Keysy · secrets management

[Combined review](../../review.html#logos) · [Editable Figma board](https://www.figma.com/design/3QD7tbVmZnKZoLEUOD0yRl?node-id=19-2)

This round removes 26 and 29 and retains 27 and 28 among earlier candidates. Three new options share the same Manrope Medium wordmark so the symbols can be compared directly.

| Number | Functional meaning | Pros | Cons |
| --- | --- | --- | --- |
| 30 Scope | Brackets around an asterisk: a hidden value within a defined scope | Developer-friendly, simple geometry | Brackets are a common code motif |
| 31 Gate | A private value inside a boundary with a controlled entrance | Clear standalone silhouette, few small-size details | More abstract; may resemble a C |
| 32 Store | An asterisk cut out of a layered storage unit | Direct link between secrets and centralized custody | Denser detail at 16px |

Start with **14 Slate × 30 Scope** for clear product meaning and a quiet interface. For a standalone symbol, compare **13 Plum × 32 Store**. The simpler final approach is one symbol and one palette.

## Functional and design references

- [OpenBao overview](https://openbao.org/docs/what-is-openbao/): centralized secrets with authentication and authorization before access. This calibrates the product category; it does not imply that Keysy implements all OpenBao features.
- [PORTO ROCHA / Hiro](https://www.portorocha.com/hiro): symbols built from familiar developer characters. Option 30 combines masking and boundaries without reusing Hiro's artwork.
- [Order / Crux](https://order.design/project/crux): one silhouette for one clear concept. Options 31 and 32 emphasize controlled access and centralized custody respectively.

These are original agent-drawn Figma proposals, not work by the referenced designers. The asterisk is a visual symbol for a hidden value, not an encryption algorithm.

## Files and verification

- `30.svg`–`32.svg` are combined wordmarks; matching `*-symbol.svg` files are standalone symbols.
- Figma keeps editable text. SVGs use outlined paths and `currentColor`, without external fonts or bitmaps.
- Figma was inspected in positive/negative color, at 28px wordmark size, and at 16/24/32px symbol sizes.
- `node --test web/mockups/brand-review.test.mjs web/mockups/dashboard.test.mjs` checks palette switching, stable numbers, exclusions, and text/button contrast.
- Color and small-size checks do not replace user recognition testing.
