# Keysy Landing

Static Astro + React + TypeScript site implementing the current landing v4 design,
with Privacy Policy and Terms of Use placeholder pages.

Design source: [desktop v4](https://www.figma.com/design/SnKNkphMQKvrj8RmPigzao?node-id=64-35999),
[mobile v4](https://www.figma.com/design/SnKNkphMQKvrj8RmPigzao?node-id=64-36935),
and the [design sources](../design/web/README.md).

## Requirements

- Bun 1.4.3 or later
- Node.js 22.23.4 or later (Node.js 24 is used in CI)

## Development

Run from `web/`:

```sh
bun install --frozen-lockfile
bun run dev
```

The development server runs at `http://localhost:4321`.

```sh
bun run check    # Generate Astro types and check TypeScript/React files
bun run build    # Generate the static site in dist/
bun run test     # Build, check generated routes/assets, and test interactions
bun run preview  # Preview the production build
```

## Structure

- `src/pages/index.astro`: responsive landing page.
- `src/pages/policy.astro`, `src/pages/terms.astro`: explicit, noindex legal placeholders.
- `src/layouts/Page.astro`: shared document, navigation, and footer.
- `src/components/`: content sections, SDK tabs, and illustrative product previews.
- `src/styles/`: shared layout, design tokens, and responsive styles.
- `public/design/`: local Figma SVG and dot-pattern exports, at their original proportions.
- `src/vendor/reactbits/`: DotGrid copied from the design branch, with its license.
- `tests/`: DOM interaction and generated-site checks; no browser automation.
- `astro.config.mjs`: official React integration.
- `tsconfig.json`: Astro strict mode with React JSX and TypeScript 7.

The page is rendered as static HTML. The Hero preview and its dot background
hydrate together on load. The SDK tabs, Dashboard, and CTA hydrate when visible.
Geist and Geist Mono are served locally.
Offscreen sections defer rendering with `content-visibility: auto`, reserving
space from the design's section heights. Below-the-fold images use native lazy
loading and asynchronous decoding; first-screen images load eagerly.

Unreleased account, documentation, extension, support, and status destinations
are disabled; the hero badge carries the single **Coming soon** notice. Legal pages contain no operative policy or terms.
Dashboard/SDK links in the footer point to homepage sections; GitHub opens the repository.

Product windows, commands, SDK package names, and availability diagrams reproduce
illustrative design content. They do not connect to live APIs or measure service uptime.
The hero uses **A · Spring flow** from
[`hero-motion.html`](../design/web/motion/hero-motion.html):
typing, three thinking states, animated path prefixes, and staggered results,
played at 2.5 times the prototype's speed.
The CTA uses the same demo's 3° tilt without a hover glow.
The Dashboard follows
[`update-secret-motion.html`](../design/web/motion/update-secret-motion.html):
slide in the panel, paste a masked value, choose the reminder, save, and update the folder version.
Motion spring parameters and the thinking-orbs indicator come from those demos.

The Hero starts typing on the dot grid's first animation frame. If WebGL
initialization fails, the story still starts with the static background.
Both stories run once without playback controls and remain on their completed
results. Returning to either preview does not replay it. Each preview stops
after at most 4.8 seconds of active playback and shows its completed result,
including when low frame rates delay the story.
Both stories pause transitions and hold times offscreen and while the document
is hidden. The dot grid also preserves its intro and shock-wave progress while paused.
Reduced-motion preferences show completed states and a static dot texture and disable CTA rotation;
the texture also works without WebGL or JavaScript.
SDK tabs support arrow keys, Home, and End.

`bun run test` validates generated links, local assets, legal-page metadata,
SDK selection/keyboard navigation, story order, single-play completion, synchronized startup,
WebGL fallback, lazy image attributes, pause/resume behavior, and CTA pointer behavior. Visual layout and WebGL
behavior require a separate browser review.

`astro check` currently does not support TypeScript 7.0. The `check` command
checks `.ts` and `.tsx` files with TypeScript 7.0.2; `.astro` templates are
compiled by `build` but do not receive full semantic type checking.
