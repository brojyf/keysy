# Keysy icon concepts

Open `preview.html` directly. Choose a palette or a custom color to compare all
four icons on light and dark backgrounds. Previews use each PNG alpha channel
as a CSS mask, so recoloring reuses the same source image and ignores its RGB.
The PNG downloads remain the original transparent, near-black artwork.

- A: `keysy-k-key.png` — a lowercase k combined with a key.
- B: `keysy-keyhole.png` — a rounded keyhole emblem.
- C: `keysy-keyring.png` — interlocking keyring loops.
- D: `keysy-vault.png` — a storage pocket with a negative-space k.

All four were generated with the built-in image_gen tool, at 1254 × 1254 with
an alpha channel. Exact prompts are in `prompts.json`. Originals are preserved;
no production favicon or app icon has been replaced. These are raster concepts,
not editable SVG paths.

The preview embeds the masks as data URLs so direct local-file loading works
without a server. A web app can use a same-origin image URL instead:

```css
.keysy-icon {
  display: inline-block;
  width: 32px;
  height: 32px;
  background: currentColor;
  mask: url('/icons/keysy-k-key.png') center / contain no-repeat;
  -webkit-mask: url('/icons/keysy-k-key.png') center / contain no-repeat;
}
```

Set the element color from the selected theme. Do not create separate colored
PNG files. Test the final chosen shape at the intended display size before use.
