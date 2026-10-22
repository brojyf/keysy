# Keysy documentation

Mintlify documentation for the Keysy monorepo. Site configuration lives in
`docs.json`; pages are MDX files.

## Branding

The site uses blue accents with neutral backgrounds, the Namespace logo, and
Geist / Geist Mono fonts. Light mode uses white and light gray backgrounds; dark
mode uses black and dark gray backgrounds. The color values and logo geometry
come from design commit `f1b451e79d487f9a3eb38dfb5e44cf08767bfe6d`.
Mintlify's native configuration supplies the accent colors, page backgrounds,
interface font, and logo variants. `style.css` supplies the remaining neutral
colors and code font while preserving Mintlify's layout and semantic colors.

Geist loads through Mintlify's Google Fonts support; Geist Mono loads through
the Google Fonts stylesheet in `style.css`. System fonts remain as fallbacks.
The SVGs retain the finalized logo paths with explicit blue fills so they work
as standalone images. A root `favicon.ico` provides the same symbol at 16, 32,
and 48 px for browsers that request the conventional fallback URL.

Navigation group labels, page section labels, and inline code use the blue
accent at font weight 600, including General and repository directory names.
Code blocks retain their syntax colors.

## Local preview

Install Node.js 20.17.0 or later and the [Mintlify CLI](https://www.mintlify.com/docs/cli/install):

```bash
npm install -g mint
```

From this directory, run:

```bash
mint dev
```

Open `http://localhost:3000`.

## Validate changes

```bash
bun test tests/
mint validate
mint broken-links --check-anchors
```

## Publishing

To configure Git-connected publishing, select the `brojyf/keysy` repository,
`main` branch, and `docs/` directory in the Mintlify dashboard. Merge reviewed
changes through pull requests.

Hosting and custom domains require separate deployment configuration; these
files alone do not publish the site.
