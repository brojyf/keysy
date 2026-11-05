# Keysy tokens

Tokens are the design variables. The theme is their light and dark values. Figma file keysy-dashboard is the source: the `Keysy · Dashboard` and `Keysy · Dashboard · Dark` collections and the `Keysy/*` and `Keysy Dark/*` text styles. [tokens.css](tokens.css) is the shared file that dashboard and web import. [web.css](web.css) holds only landing page values from the `Keysy / Web` collection in Figma file keysy-web. The wiki cannot import them, so its tests read `tokens.css`.

| Role | Token | Light | Dark |
| --- | --- | --- | --- |
| Page background | `bg` | `#fafafa` | `#141414` |
| Panel background | `surface` | `#ffffff` | `#1b1b1b` |
| Menu, popover, and dialog background | `raised` | `#ffffff` | `#222222` |
| Primary text | `text` | `#1b1c1e` | `#ededee` |
| Secondary text | `muted` | `#64666b` | `#acadb1` |
| Accent text, icons, landing page eyebrow labels, and inline code | `accent` | `#1d4ed8` | `#7aa2ff` |
| Primary button and logo | `button` | `#2f5aba` | `#638ce5` |
| Primary button text | `on-button` | `#ffffff` | `#0e1b34` |
| Selected or subtle background | `soft` | `#f0f1f3` | `#292929` |
| Decorative divider | `line` | `#e3e4e6` | `#2e2e2e` |
| Input border and path separator | `line-strong` | `#e3e4e6` | `#6c6c6c` |
| Table row hover background | `hover` | `#f7f7fa` | `#222222` |
| Table header background | `table-header` | `#fcfcfc` | `#1e1e1e` |
| Destructive text, icons, and buttons | `danger` | `#b3261e` | `#ef9a9a` |
| Destructive background | `danger-bg` | `#fce8e6` | `#392424` |
| Avatar background | `avatar-bg` | `#dce6ff` | `#dce6ff` |
| Avatar text | `avatar-text` | `#2f4aa8` | `#2f4aa8` |
| Glow | `glow` | `#a5b8ff2e` | `#a5b8ff2e` |

| Web token | Value |
| --- | --- |
| `--color-dark` | `#101b30` |
| `--color-dark-text` | `#aab8d0` |
| `--color-tint` | `#e8eefc` |
| `--color-amber` | `#b45309` |

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

Text input borders and `/` separators use `line-strong`. Card and table dividers
use `line`.

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

Figma has no radius, shadow, or motion variables. `tokens.css` holds these values.

| Radius token | Value |
| --- | --- |
| `--radius-sm` | `8px` |
| `--radius-md` | `14px` |
| `--radius-lg` | `20px` |
| `--radius-full` | `9999px` |

| Shadow | Value |
| --- | --- |
| `--shadow-md` light | `0 1px 2px #0000000a, 0 8px 24px #0f121a1f` |
| `--shadow-md` dark | `0 1px 2px #0f121a1f, 0 8px 24px #0f121a5c` |
| `--shadow-knob` light | `0 1px 2px #00000026` |
| `--shadow-knob` dark | `0 1px 2px #0f121a73` |
| `--shadow-bar` light | `0 4px 16px #00000014` |
| `--shadow-bar` dark | `0 4px 16px #0f121a3d` |
| `--shadow-card` light | `0 1px 2px #101b300a, 0 12px 32px -8px #101b300f` |
| `--shadow-card` dark | `0 1px 2px #0f121a1f, 0 8px 24px #0f121a5c` |

| Motion token | Value |
| --- | --- |
| `--ease-spring` | `linear(0, 0.06, 0.186, 0.329, 0.466, 0.584, 0.682, 0.76, 0.821, 0.868, 0.903, 0.929, 0.949, 0.963, 0.973, 0.981, 0.986, 0.99, 0.993, 0.995, 0.997, 0.998, 0.998, 0.999, 1)` |
| `--duration-spring` | `600ms` |
