# Keysy theme — Ink

Ink (internal ID `blue`) is the selected Keysy color system, finalized on October 21, 2026. It has one light palette and one dark palette. Blue is reserved for accents and primary actions; structural surfaces stay near-neutral in light mode and strictly black or gray in dark mode.

The shared [palette values](palettes.js) are the source of truth. The [Logo and CSS studies](../scratch/README.md) import these values directly.

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

Dark-mode accent text and button fills use different blues to keep their respective foreground/background pairs readable. Logo artwork uses `button` in both modes. Reserve `line` for decorative grouping; meaningful state and control boundaries need stronger contrast.

See the [color requirements](color-requirements.md), [accessibility record](color-accessibility.md), and [historical palette research](palette-research.md) for usage guidance and earlier references. The Theme comparison page and documentation copy have been removed from scratch; earlier previews remain in Git history.

## Verify

```sh
cd design/theme
bun test
```

The palette tests cover all nine roles, neutral surfaces, and 26 foreground/background pairings across both modes. Run `bun run test` from `design/scratch/` to include the Logo, CSS, and studio accessibility checks.
