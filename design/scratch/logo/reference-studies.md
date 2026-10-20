# Infrastructure reference studies

Four original Keysy marks, added on October 20, 2026. They extend the existing review collection with simple geometry, open negative space, and one-color silhouettes. Three remain in the preview after removing Notch K; these are proposals, and no direction is selected for production.

| Display number | Mark | Reference principle | Pros / cons |
| --- | --- | --- | --- |
| 26 | Node K | [Tailscale](https://tailscale.com/): repeated circular units. Six equal nodes make a K-shaped arrangement instead of a square matrix. | Modular and compact; the letter is more abstract at 16px. |
| Removed (formerly 28) | Notch K | [Neon](https://neon.com/brand): angular letter construction. Three solid blocks form a K with two clear cuts. | Strong silhouette and minimal detail; the monogram is less explicit about secrets. |
| 27 | Relay | [Infisical](https://infisical.com/): visual continuity. Two open, offset links suggest a controlled handoff. | Softer geometry with a consistent stroke; may read as an abstract S before the name is learned. |
| 28 | Secret cell | [Doppler / Fuzzco](https://www.doppler.com/blog/rebrand-of-doppler): defined private boundaries, alongside the square cutouts in Infisical's archived artwork. Three solid cells leave a branching channel between them. | Distinct negative space; denser than the other options at favicon size. |

These are design interpretations of the reference principles. No third-party logo paths are reused. All four lockups reuse the existing Keysy Outfit letter outlines, keeping type constant while comparing symbols; the [SIL OFL license](licenses/outfit-OFL.txt) is retained.

The previous Notch K recommendation no longer applies because that candidate was removed. No replacement direction is selected. The round intentionally avoids mascots, gradients, shadows, and decorative textures.

## Assets and review

- Current display numbers 26, 27, and 28 map to stable source IDs 52, 54, and 55, respectively.
- Each `vectors/52-*` through `vectors/55-*` pair contains a full lockup and a `-symbol.svg` export.
- All artwork uses `currentColor`, transparent negative space, and outlined typography. It works without fonts or remote assets.
- Both modes show the full lockup, a 28px lockup, and standalone symbols at 16/24/32px.
- Cipher / Plain (formerly 26, source ID 51) and Notch K (formerly 28, source ID 53) are removed from the preview; their source SVG files remain. The first 26 candidates and their artwork remain unchanged. All 29 retained candidates use the same 9 palette definitions.
- Run `bun test logo/preview.test.jsx` in `design/scratch/` to check source consistency, numbering, symbol sizes, and palette switching. Browser inspection remains necessary for visual judgment.
