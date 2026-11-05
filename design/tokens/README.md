# Keysy tokens

Tokens are the design variables. The theme is their light and dark values. Figma file keysy-dashboard is the source: the `Keysy · Dashboard` and `Keysy · Dashboard · Dark` collections and the `Keysy/*` and `Keysy Dark/*` text styles. [tokens.css](tokens.css) is the shared file that dashboard and web import, and the only code source for token values. [web.css](web.css) holds only landing page values from the `Keysy / Web` collection in Figma file keysy-web. The wiki cannot import them, so its tests read `tokens.css`.

| Role | Token |
| --- | --- |
| Page background | `bg` |
| Panel background | `surface` |
| Menu, popover, and dialog background | `raised` |
| Primary text | `text` |
| Secondary text | `muted` |
| Accent text, icons, landing page eyebrow labels, and inline code | `accent` |
| Primary button and logo | `button` |
| Primary button text | `on-button` |
| Selected or subtle background | `soft` |
| Decorative divider | `line` |
| Input border and path separator | `line-strong` |
| Table row hover background | `hover` |
| Table header background | `table-header` |
| Destructive text, icons, and buttons | `danger` |
| Destructive background | `danger-bg` |
| Avatar background | `avatar-bg` |
| Avatar text | `avatar-text` |
| Glow | `glow` |

Text input borders and `/` separators use `line-strong`. Card and table dividers
use `line`.

Menus, popovers, and dialogs use `raised` with a shadow. In dark mode, `raised`
is lighter than `surface`, so the layer reads above the page without the shadow.
Segmented controls have no track fill and a `line` border. The selected segment
uses `soft`, with no shadow.

Navigation group labels use `text`. Selected sidebar items use `text` on `soft`,
with no blue text or background tint. Dashboard section headings use `text`, so
blue marks only links, icons, and interactive states. Landing page eyebrow labels
and inline code such as directory names use `accent`. Keep code block syntax
colors unchanged.

In dark mode, every font weight is 40 lower. Geist and Geist Mono are variable
fonts, so these weights render exactly.

Figma has no radius, shadow, or motion variables. `tokens.css` holds these values.
