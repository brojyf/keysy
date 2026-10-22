# Keysy documentation

Mintlify documentation for the Keysy monorepo. Site configuration lives in
`docs.json`; pages are MDX files.

## Branding

The site uses blue accents with neutral backgrounds, the Namespace logo, and
Geist / Geist Mono fonts. Light mode uses white and light gray backgrounds; dark
mode uses black and dark gray backgrounds. The color values and logo geometry
come from design commit `b3d0ed3d15ed5fa373e5c6e7c99386f38b4baf42`.
Mintlify's native configuration supplies the accent colors, page backgrounds,
interface font, and logo variants. `style.css` supplies the remaining neutral
colors and code font while preserving Mintlify's layout and semantic colors.

Geist loads through Mintlify's Google Fonts support; Geist Mono loads through
the Google Fonts stylesheet in `style.css`. System fonts remain as fallbacks.
The SVGs retain the finalized logo paths with explicit blue fills so they work
as standalone images. A root `favicon.ico` provides the same symbol at 16, 32,
and 48 px for browsers that request the conventional fallback URL.

Navigation group labels use the primary text color at font weight 700. Selected
sidebar items use the primary text color on a neutral gray background. Page
section labels and inline code, including repository directory names, use the
blue accent at font weight 600. Code blocks retain their syntax colors.

Footer previous/next page navigation is hidden site-wide.

Below 64 rem, the header shows GitHub, appearance, and search directly, with
appearance next to search and no overflow menu. The native controls and their
keyboard order are preserved.

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
