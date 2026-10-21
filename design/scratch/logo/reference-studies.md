# Infrastructure reference studies

Four original Keysy marks, added on October 20, 2026. They extend the existing review collection with simple geometry, open negative space, and one-color silhouettes. Two remain in the preview after removing Notch K and Relay; these are proposals, and no direction is selected for production.

| Display number | Mark | Reference principle | Pros / cons |
| --- | --- | --- | --- |
| 10 | Node K | [Tailscale](https://tailscale.com/): repeated circular units. Six equal nodes make a K-shaped arrangement instead of a square matrix. | Modular and compact; the letter is more abstract at 16px. |
| Removed (formerly 28) | Notch K | [Neon](https://neon.com/brand): angular letter construction. Three solid blocks form a K with two clear cuts. | Strong silhouette and minimal detail; the monogram is less explicit about secrets. |
| Removed (formerly 13) | Relay | [Infisical](https://infisical.com/): visual continuity. Two open, offset links suggest a controlled handoff. | Softer geometry with a consistent stroke; may read as an abstract S before the name is learned. |
| 11 | Secret cell | [Doppler / Fuzzco](https://www.doppler.com/blog/rebrand-of-doppler): defined private boundaries, alongside the square cutouts in Infisical's archived artwork. Three solid cells leave a branching channel between them. | Distinct negative space; denser than the other options at favicon size. |

These are design interpretations of the reference principles. No third-party logo paths are reused. All four lockups reuse the existing Keysy Outfit letter outlines, keeping type constant while comparing symbols; the [SIL OFL license](licenses/outfit-OFL.txt) is retained.

The previous Notch K recommendation no longer applies because that candidate was removed. No replacement direction is selected. The round intentionally avoids mascots, gradients, shadows, and decorative textures.

## Assets and review

- Current display numbers 10 and 11 map to stable source IDs 52 and 55, respectively.
- Each `vectors/52-*` through `vectors/55-*` pair contains a full lockup and a `-symbol.svg` export.
- All artwork uses `currentColor`, transparent negative space, and outlined typography. It works without fonts or remote assets.
- Both modes show the full lockup, a 28px lockup, and standalone symbols at 16/24/32px.
- Cipher / Plain (formerly 26, source ID 51) and Notch K (formerly 28, source ID 53) are removed from the preview; their source SVG files remain. Mask, Variable, Scope, Ring key, Hex key, Dial, and Keyhole (source IDs 12, 15, 30, 40, 48, 49, and B) are also removed. Wordmark, Asterisk, Relay, and Storage box (formerly 1, 2, 13, and 15; source IDs 45, 19, 54, and D) are removed from the preview. Secret, Store, and App icon (formerly 3, 4, and 7; source IDs 22, 32, and 47) are also removed. All 12 retained candidates are numbered 0–11 in grouped display order, keep their artwork unchanged, and use the same palette definitions.
- Run `bun test logo/preview.test.jsx` in `design/scratch/` to check source consistency, numbering, symbol sizes, and palette switching. Browser inspection remains necessary for visual judgment.
