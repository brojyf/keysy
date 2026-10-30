# Landing page

Figma links and exports, motion prototypes, and the v4 motion page for the landing page.

## Figma

The landing page lives in [Keysy — Landing Page](https://www.figma.com/design/SnKNkphMQKvrj8RmPigzao).

- [Desktop, 1440 px (v4)](https://www.figma.com/design/SnKNkphMQKvrj8RmPigzao?node-id=64-35999) and
  [Mobile, 390 px (v4)](https://www.figma.com/design/SnKNkphMQKvrj8RmPigzao?node-id=64-36935) are the
  current design. A dot pattern sits behind the hero and the call-to-action card. An Availability
  section after Security states redundant services, a public status page, and a 99.9% monthly
  uptime commitment. Earlier versions were removed from the file; Figma's version history keeps
  them.
- [Hero story (v4)](https://www.figma.com/design/SnKNkphMQKvrj8RmPigzao?node-id=64-37937) shows key
  frames of the hero web window. The dots and the hero story play in the
  [v4 motion page](v4/README.md).
- The section also holds the components v4 uses: actions, grid marker, nav account, and SDK showcase.
- Colors come from the `Keysy / Landing` variables, which match [Theme](../theme/README.md).
- Typography: Geist and Geist Mono.
- Product previews use illustrative data. CLI commands, SDK code, and package names are
  illustrative until the CLI and SDKs define them.
- [Local snapshot](keysy-landing-page.fig) of the Figma file. Update it with File → Save local copy.

## Motion prototypes

Standalone HTML pages that animate parts of the landing page with Motion. They use the same
content as the Figma design.

- [Hero](motion/hero-motion.html): the AI assistant moves the Stripe and Resend keys into
  `production/shared`, with three entrance variants to compare. The call-to-action card
  tilts toward the pointer.
- [Update secret](motion/update-secret-motion.html): the Dashboard section updates
  `STRIPE_SECRET_KEY` with a new value and reminder, and the folder moves to a new version.
