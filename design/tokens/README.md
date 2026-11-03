# Keysy tokens

Tokens are the design variables. The theme is their light and dark values. Figma "Keysy — Secret management" is the source: the `Keysy · Dashboard` and `Keysy · Dashboard · Dark` collections and the `Keysy/*` and `Keysy Dark/*` text styles. [tokens.css](tokens.css) holds the values.

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
| Table header background | `table-header` | `#fcfcfc` | `#1e1e1e` |
| Success text and icons | `success` | `#137333` | `#80c9a2` |
| Success background | `success-bg` | `#e6f4ea` | `#1b3027` |
| Destructive text, icons, and buttons | `danger` | `#b3261e` | `#ef9a9a` |
| Destructive background | `danger-bg` | `#fce8e6` | `#392424` |

| Style | Font | Size / line height | Letter spacing | Weight light | Weight dark |
| --- | --- | --- | --- | --- | --- |
| Title | Geist | 22px / 28px | -0.015em | 600 | 560 |
| Section heading | Geist | 18px / 26px | 0 | 600 | 560 |
| Page path | Geist | 18px / 26px | 0 | 500 | 460 |
| Heading | Geist | 16px / 24px | 0 | 600 | 560 |
| Body | Geist | 13px / 20px | 0 | 400 | 360 |
| Label | Geist | 13px / 20px | 0 | 500 | 460 |
| Section label | Geist | 13px / 20px | 0 | 600 | 560 |
| Caption | Geist | 12px / 16px | 0 | 400 | 360 |
| Button | Geist | 12px / 16px | 0 | 500 | 460 |
| Navigation group | Geist | 12px / 18px | 0 | 700 | 660 |
| Badge | Geist | 11px / 16px | 0 | 500 | 460 |
| Code | Geist Mono | 13px / 20px | 0 | 400 | 360 |
| Code small | Geist Mono | 12px / 18px | 0 | 400 | 360 |
| Inline code | Geist Mono | 12px / 18px | 0 | 600 | 560 |
| Display code | Geist Mono | 28px / 36px | 0.12em | 500 | 460 |

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

In dark mode, every font weight is 40 lower: 400 becomes 360, 500 becomes 460,
600 becomes 560, and 700 becomes 660. Geist and Geist Mono are variable fonts,
so these weights render exactly.
