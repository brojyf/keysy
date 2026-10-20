# Keysy palette candidates

Updated: 2026-10-17. [Logo selection](../logo/index.html) · [Figma palette board](https://www.figma.com/design/3QD7tbVmZnKZoLEUOD0yRl?node-id=21-2). Retained candidates are numbered 1–6 in review order.

Excluded (original numbers): 01 Jade, 03 Sand, 05 Clay, 06 Oxblood, 07 Olive, 08 Petrol, 09 Ochre, 11 Vermilion, 12 Sulfur, 13 Plum, 15 Navy / Rose, 17 Pine / Chalk, and 18 Aubergine / Celadon.
Retained: 1 Ink, 2 Mono, 3 Cobalt, 4 Slate, 5 Cocoa / Ice, and 6 Ink / Iris.

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

`palettes.js` and `palettes-extra.js` contain 6 complete light/dark palettes. Each has a consecutive display number, an unchanged internal ID, and nine roles: background, surface, text, muted text, accent, button, button text, selection background, and decorative border. The React [theme preview](index.html) and [logo selection](../logo/index.html) import the same values as ES modules, with no runtime CDN dependency.

`bun test theme/palettes.test.mjs` (from `design/scratch/`) checks each mode: text, muted text, and accent against background/surface/selection ≥ 4.5:1; button text ≥ 4.5:1; button against adjacent surfaces ≥ 3:1. The 6 palettes cover 144 combinations. Borders are decorative, not focus rings or interactive boundaries.
