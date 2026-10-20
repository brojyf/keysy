# Keysy palette candidates

Updated: 2026-10-20. [Logo selection](../logo/index.html) · [Historical Figma palette board](https://www.figma.com/design/3QD7tbVmZnKZoLEUOD0yRl?node-id=21-2). The nine current candidates keep their review numbers (1, 2, and 4–10); Cobalt (3) has been removed. The new studies are available in Design Studio.

Excluded (original numbers): 01 Jade, 03 Sand, 05 Clay, 06 Oxblood, 07 Olive, 08 Petrol, 09 Ochre, 11 Vermilion, 12 Sulfur, 13 Plum, 15 Navy / Rose, 17 Pine / Chalk, and 18 Aubergine / Celadon.
Retained: 1 Ink, 2 Mono, 4 Slate, 5 Cocoa / Ice, and 6 Ink / Iris.

## Infrastructure reference studies: 7–10

These studies translate the official brand references collected for this project into restrained interface colors. HEX values are composed for Keysy, not sampled or presented as the companies' design tokens. Retained palettes 1, 2, and 4–6 keep their identities and numbering; the near-neutral surface rule applies to all nine palettes in both modes.

| Number | Reference and interpretation | Pros / cons |
| --- | --- | --- |
| 7 Terminal | [Neon's green and neutral palette](https://neon.com/brand), with [Supabase's separation of readable accents and button colors](https://supabase.com/design-system/docs/color-usage). Cool neutral surfaces and a softened mint accent in dark mode. | Clear technical character; green is common among infrastructure products. |
| 8 Ember | The orange emphasis of [Cloudflare](https://www.cloudflare.com/), interpreted as a deeper copper accent with warm grays. [Cloudflare's color-system article](https://blog.cloudflare.com/thinking-about-color/) informs the role-based approach. | Warm but restrained; saturated orange is deliberately reduced for dense operational screens. |
| 9 Orchid | Pink-purple details in the archived Doppler artwork and its [Fuzzco rebrand](https://www.doppler.com/blog/rebrand-of-doppler). Muted orchid accents sit on near-neutral charcoal, without gradients or texture. | Softer and warmer than Ink / Iris; still belongs to the familiar purple software family. |
| 10 Evergreen | [OpenBao's greens and warm neutrals](https://openbao.org/community/policies/brand/), adapted to a subtle gray-green white in light mode and nearly neutral black in dark mode. | Quiet and grounded; less immediate brand impact than Terminal. |

All nine palettes use near-white/light-gray surfaces in light mode and near-black/dark-gray surfaces in dark mode, allowing only slight hue shifts. Background, surface, selection, and divider channels differ by at most 8/255. This is Keysy's design constraint, not a WCAG requirement. Evergreen uses background `#111312`, surface `#1b1e1c`, selected surface `#272b28`, and decorative border `#343a35` in dark mode. Its pale green accent `#b3cbb8` is reserved for foreground emphasis and primary actions.

The simplest final application is one selected light/dark pair. These four additions are comparison candidates, not four new product themes.

The historical research below uses original palette and logo numbers, matching the linked Figma boards. Some candidates were subsequently removed.

## Previous round: 13–15

| Number | Color relationship | Source and interpretation | Trade-off |
| --- | --- | --- | --- |
| 13 Plum | Deep plum, pinkish off-white, pale gray-purple | [Liberty / Harry Pearce, Pentagram](https://www.pentagram.com/work/liberty): purple alongside black and white. Keysy desaturates the purple and defines separate light/dark UI values. | More recognizable and expressive than blue-gray. |
| 14 Slate | Blue-gray, cool white, pale steel blue | [Plenaire / Jody Hudson-Powell and Luke Powell, Pentagram](https://www.pentagram.com/work/plenaire): negative space and lightweight accents. Blue-gray is Keysy's choice, not a claimed original brand color. | Comfortable for long sessions; less brand impact. |
| 15 Navy / Rose | Navy structure, gray-pink selection, pale rose dark-mode buttons | [The Wing / Emily Oberman, Pentagram](https://www.pentagram.com/work/the-wing): stationery-like pale colors paired with deep navy. | Richer hierarchy; the two-color relationship needs consistency. |

These are real, credited studio projects. The studies borrow color relationships and usage principles; all HEX values were composed separately for Keysy. Official links show the complete identities. Some official images could not be downloaded with the tools available in this round, so sampled image colors were not used as evidence for the values.

Start with 14 Slate, then 13 Plum. These are comparison candidates, not a requirement to ship every theme.

## New studies: 16–19

[New palettes](index.html) · [Figma light/dark palettes](https://www.figma.com/design/3QD7tbVmZnKZoLEUOD0yRl?node-id=25-2). The research record below is retained; 17 and 18 have been removed from previews.

| Number | Color relationship | Credited design source and Keysy interpretation | Pros / cons |
| --- | --- | --- | --- |
| 16 Cocoa / Ice | Deep cocoa structure, ice-blue selection and dark-mode accent | [deZaan / Angus Hyland's team, Pentagram](https://www.pentagram.com/work/dezaan) describes blue, black/white, and copper. This proposal borrows warm/cool pairing; brown and ice blue were chosen separately for Keysy. | Warm and memorable; the primary color swaps between modes. |
| 17 Pine / Chalk | Near-black pine, desaturated gray-green, cool white | [ERM / Marina Willer's team, Pentagram](https://www.pentagram.com/work/erm): green and neutral layers. Keysy reduces this to dark green structure and chalk-like accents. | Stable reading; may suggest nature or environmental branding. |
| 18 Aubergine / Celadon | Deep aubergine, pale celadon selection and dark-mode accent | [Cohere / Jody Hudson-Powell and Luke Powell's team, Pentagram](https://www.pentagram.com/work/cohere): natural and artificial colors together. Aubergine and celadon are Keysy's interpretation, not its brand standards. | Distinct warm/cool tension; color roles need consistency between modes. |
| 19 Ink / Iris | Ink-black foundation, saturated iris, pale purple reverse | [Shop / PORTO ROCHA](https://www.portorocha.com/shop), creative directors Felipe Rocha and Leo Porto; design by Nathan Fyock, Rachel Quan, and Luis Alejandro. Borrows purple supported by warm black and gray-white. | Stronger accents; purple is common in software branding. |

Start with 16 × Logo 33; 19 offers a stronger solid accent. These are design judgments, not a user-approved selection.

All sources are publicly credited studio projects, not generated reference images. HEX values were adjusted for UI contrast, not claimed as samples from the original work.

## Values and checks

`palettes.js` and `palettes-extra.js` contain 9 complete light/dark palettes. Each has a stable display number, an unchanged internal ID, and nine roles: background, surface, text, muted text, accent, button, button text, selection background, and decorative border. The React [theme preview](index.html) and [logo selection](../logo/index.html) import the same values as ES modules, with no runtime CDN dependency.

`bun test theme/palettes.test.mjs` (from `design/scratch/`) checks 234 palette pairings: primary text against background/surface/selection ≥ 7:1; muted text and accents against those surfaces ≥ 4.5:1; button text ≥ 4.5:1; button fill against adjacent surfaces ≥ 3:1. It also checks neutral surfaces and the studio's small text, selection outlines, and keyboard focus. The [accessibility record](color-accessibility.md) includes measured minima and official requirements. The `line` token remains decorative; selected borders, checkboxes, and state markers use stronger colors.
