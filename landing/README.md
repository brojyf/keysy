# Keysy Landing

Static Astro + React + TypeScript site implementing the current landing v4 design,
with Privacy Policy and Terms of Use placeholder pages.

Design source: [desktop v4](https://www.figma.com/design/SnKNkphMQKvrj8RmPigzao?node-id=64-35999),
[mobile v4](https://www.figma.com/design/SnKNkphMQKvrj8RmPigzao?node-id=64-36935),
and the [design branch](https://github.com/brojyf/keysy/tree/design/theme-and-logo/design/landing).

## Requirements

- Bun 1.4.3 or later
- Node.js 22.23.4 or later (Node.js 24 is used in CI)

## Development

Run from `landing/`:

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

The page is rendered as static HTML. Only the SDK tabs, product demos, and dot
backgrounds hydrate when visible. Geist and Geist Mono are served locally.

Unreleased account, documentation, extension, support, and status destinations
are marked **Coming soon**. Legal pages contain no operative policy or terms.
Dashboard/SDK links in the footer point to homepage sections; GitHub opens the repository.

Product windows, commands, SDK package names, and availability diagrams reproduce
illustrative design content. They do not connect to live APIs or measure service uptime.
The hero animation can be paused. Reduced-motion preferences show its completed
state and a static dot texture; the texture also works without WebGL or JavaScript.
SDK tabs support arrow keys, Home, and End.

`bun run test` validates generated links, local assets, legal-page metadata,
SDK selection/keyboard navigation, and demo state. Visual layout and WebGL
behavior require a separate browser review.

`astro check` currently does not support TypeScript 7.0. The `check` command
checks `.ts` and `.tsx` files with TypeScript 7.0.2; `.astro` templates are
compiled by `build` but do not receive full semantic type checking.
