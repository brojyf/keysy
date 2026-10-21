# Keysy theme — Ink

Use **Ink** for all Keysy interfaces, in light and dark mode. The [palette values](palettes.js) are the source of truth; the stable internal ID is `blue`. Use the [selected CSS stack](../css/README.md) for implementation.

## Colors

| Role | Token | Light | Dark |
| --- | --- | --- | --- |
| Page background | `bg` | `#fafafa` | `#121212` |
| Panel background | `surface` | `#ffffff` | `#1b1b1b` |
| Primary text | `text` | `#1b1c1e` | `#ededee` |
| Secondary text | `muted` | `#64666b` | `#a3a4a8` |
| Accent text and icons | `accent` | `#2f5aba` | `#9bbaff` |
| Primary button and logo | `button` | `#2f5aba` | `#638ce5` |
| Primary button text | `on-button` | `#ffffff` | `#0e1b34` |
| Selected or subtle background | `soft` | `#f0f1f3` | `#2a2a2a` |
| Decorative divider | `line` | `#e3e4e6` | `#2e2e2e` |

## Usage

- Keep light-mode structural surfaces near-neutral and dark-mode structural surfaces strictly black or gray. Reserve blue for accents and primary actions.
- Use `button` for logo artwork in both modes. Do not substitute `accent` for the dark-mode button fill.
- Use `line` for decorative dividers only. Meaningful control boundaries, selected states, and focus indicators must reach at least 3:1 against adjacent surfaces.
- Primary text must reach 7:1 against `bg`, `surface`, and `soft`; secondary and accent text must reach 4.5:1. Button labels must reach 4.5:1 against their fill; primary button fills must reach 3:1 against adjacent surfaces. These are Keysy targets, not a claim of full WCAG conformance.
- Do not communicate status or selection through hue alone. Verify rendered hover, focus, error, and disabled states when implemented.

## shadcn/ui mapping

Apply these roles separately for each mode.

| CSS variable | Ink token |
| --- | --- |
| `--background` | `bg` |
| `--foreground`, `--card-foreground`, `--popover-foreground` | `text` |
| `--card`, `--popover` | `surface` |
| `--primary` | `button` |
| `--primary-foreground` | `on-button` |
| `--secondary`, `--muted`, `--accent` | `soft` |
| `--secondary-foreground`, `--accent-foreground` | `text` |
| `--muted-foreground` | `muted` |
| `--ring` | `accent` |
| `--border` | `line`, for decorative separators only |

shadcn/ui's `--accent` is a subtle interaction background, not Ink's accent text color. Input and state boundaries need stronger colors than `line`. Status and chart colors are not defined by these nine roles; verify them when introduced.

## Verify

```sh
cd design/theme
bun test
```

The [palette tests](palettes.test.mjs) check both modes, neutral surfaces, and contrast targets. Rendered interfaces require their own accessibility verification.
