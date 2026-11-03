# Keysy colors

Blue accents with white and light gray backgrounds in light mode, and black and
dark gray backgrounds in dark mode.

[Color values](palettes.js)

| Role | Token | Light | Dark |
| --- | --- | --- | --- |
| Page background | `bg` | `#fafafa` | `#121212` |
| Panel background | `surface` | `#ffffff` | `#1b1b1b` |
| Menu, popover, and dialog background | `raised` | `#ffffff` | `#222222` |
| Primary text | `text` | `#1b1c1e` | `#ededee` |
| Secondary text | `muted` | `#64666b` | `#a3a4a8` |
| Accent text, icons, landing page eyebrow labels, and inline code | `accent` | `#1d4ed8` | `#7aa2ff` |
| Primary button and logo | `button` | `#2f5aba` | `#638ce5` |
| Primary button text | `on-button` | `#ffffff` | `#0e1b34` |
| Selected or subtle background | `soft` | `#f0f1f3` | `#2a2a2a` |
| Decorative divider | `line` | `#e3e4e6` | `#2e2e2e` |

Menus, popovers, and dialogs use `raised` with a shadow. In dark mode, `raised`
is lighter than `surface`, so the layer reads above the page without the shadow.
Segmented controls have no track fill and a `line` border. The selected segment
uses `soft`, with no shadow.

Navigation group labels use `text` at font weight 700. Selected sidebar items
use `text` on `soft`, with no blue text or background tint. Dashboard section
headings use `text` at font weight 600, so blue marks only links, icons, and
interactive states. Landing page eyebrow labels and inline code such as
directory names use `accent` at font weight 600. Keep code block syntax colors
unchanged.
