# Keysy Landing

Minimal Astro + React + TypeScript scaffold for the Keysy landing page.

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
bun run preview  # Preview the production build
```

## Structure

- `src/pages/index.astro`: page document and route.
- `src/components/Landing.tsx`: React-rendered homepage placeholder.
- `astro.config.mjs`: official React integration.
- `tsconfig.json`: Astro strict mode with React JSX and TypeScript 7.

The homepage is rendered as static HTML. Add Astro `client:*` directives to
React components when they need browser interaction.

`astro check` currently does not support TypeScript 7.0. The `check` command
checks `.ts` and `.tsx` files with TypeScript 7.0.2; `.astro` templates are
compiled by `build` but do not receive full semantic type checking.
