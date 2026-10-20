# CSS integration comparison

Nine integrations share one fictional key-management screen and the existing nine Keysy light/dark palettes. This is a design experiment, not a production dependency decision.

## Run

```sh
cd design/scratch
bun install --frozen-lockfile
bun run dev
```

Open `/css/` or select **CSS** in Design Studio. For example:

- `/css/?library=coss&cssPalette=evergreen&cssMode=dark`
- `/?tab=css&library=shadcn&cssPalette=blue&cssMode=light`
- `/css/frame.html?library=intent&cssPalette=slate&cssMode=dark` for a standalone integration.

Select an integration and color system in the right rail; switch Light/Dark above the preview. Each iframe loads only its selected integration, keeping global resets, Tailwind utilities, and component styles out of the studio and other integrations. The documents are style-isolated, not a security sandbox; all code is trusted local source. All packages and fonts are bundled locally, with no runtime CDN or product API requests.

## What is real

| Integration | Actual dependency or source | Scope |
| --- | --- | --- |
| [Radix Themes](https://www.radix-ui.com/themes/docs/overview/getting-started) | `@radix-ui/themes` | Theme, Button, TextField, Badge; custom semantic palette mapping |
| [shadcn/ui](https://ui.shadcn.com/docs/theming) + [tweakcn](https://tweakcn.com) | Official New York button/input/badge registry source; exported Modern Minimal theme; Radix Slot and Tailwind | Copied components, not CSS approximations; Keysy replaces theme color roles |
| [daisyUI](https://daisyui.com/docs/themes/) | Installed daisyUI Tailwind plugin | Documented button, input, badge, table classes; Keysy theme variables |
| [Radix Colors](https://www.radix-ui.com/colors/docs/overview/usage) | `@radix-ui/colors` | Hue-matched light/dark 12-step scales for local badge, focus, and hover styling; not a component library |
| [Open Props](https://open-props.style/) | Installed `open-props/style` stylesheet | Real spacing, radius, shadow, and easing tokens in local native components |
| [Basecoat](https://basecoatui.com/installation/) | `basecoat-css`, compiled by Tailwind with its Vega defaults | Documented button/input/badge/table markup; no unused Basecoat JavaScript |
| [coss ui](https://coss.com/ui/docs) | Official registry button/input/badge/spinner/utils; `@base-ui/react` | Real Base UI components with Tailwind, not imitated markup |
| [Intent UI](https://intentui.com/docs/getting-started/introduction) | Official button/input/badge/primitive source and default theme; React Aria and its Tailwind plugin | Real React Aria controls with external label associations |
| [Geist reference](https://vercel.com/geist/introduction) | Local CSS following public guidance; Geist and Geist Mono fonts distributed by Fontsource | **Specification reference only**, not an official installable Geist component library |

`vendor/sources.json` records registry URLs, upstream hashes, and adaptations. Component hashes refer to original source text before import-path changes; theme entries explicitly hash the registry response. Component source is unchanged except relative imports. `vendor/shadcn/utils.ts` is a local `clsx`/`tailwind-merge` utility. Adapters, palette mappings, native controls, and the shared workspace are local code.

Copied component source retains adjacent MIT license notices for [shadcn](vendor/shadcn/LICENSE), [Intent UI](vendor/intent/LICENSE), and [coss](vendor/coss/LICENSE). The adapted tweakcn theme retains its [Apache-2.0 license](vendor/tweakcn/LICENSE) and an adaptation notice in its stylesheet. coss has a mixed-license repository: its official [licensing declaration](vendor/coss/LICENSING.md) explicitly designates `apps/ui/` and `apps/origin/` as MIT. The copied UI registry code comes from that scope; its MIT notice was obtained from `apps/origin/LICENSE.md`. Package licenses remain with installed dependencies. Geist font files use SIL OFL-1.1, included in their Fontsource packages.

## Comparison boundaries

- `Workspace.tsx` owns identical content, layout, and local interactions. Each adapter supplies actual button, input, and badge implementations. The table shares native markup; daisyUI and Basecoat additionally apply their table classes. The shell is intentionally shared, so this compares component styling and theming rather than nine unrelated dashboard layouts.
- The Add secret modal is a **shared native HTML dialog**, not nine vendor dialog implementations. Search, row selection, reveal/hide, required-field validation, duplicate-name checks, add, and cancel work locally. Never enter real credentials.
- Switching a library, palette, or mode reloads the iframe and resets demo edits. Leaving the CSS tab also unloads its iframe; library/palette/mode choices remain mounted and are retained. Nothing is persisted to storage.
- Palette definitions are imported from `../theme/palettes.js`, not copied. `theme.ts` maps their semantic roles to framework variables. Component-library defaults still determine geometry, borders, state treatment, and behavior. Radix's intermediate steps are an explicit Keysy adaptation, not output from its custom color generator. Success states use green independently of the brand accent.
- All nine systems support customization, but Radix Colors/Open Props require locally maintained components; copied-source systems require owning component updates; packaged components retain their APIs and global CSS. This playground does not choose a production winner.

## Verify

```sh
cd design/scratch
bun run lint
bun test
bun run build
bunx playwright install chromium
bun run test:browser
```

`build` includes a TypeScript 7 check for this workspace. Unit tests cover the catalog, token mappings, URL validation, iframe destinations, switching, tab retention, and inactive-panel behavior. Playwright builds and serves the production output on port 4189, then checks all **9 libraries × 9 palettes × 2 modes = 162 combinations**, real computed primary colors, native status colors, local interactions, validation, stylesheet isolation, URL restoration, mobile overflow, and the full-height Theme rail. Runtime errors and external HTTP requests fail integration tests. Browser artifacts go to ignored `test-results/`.

The studio's existing artwork bundle still produces Vite's large-chunk warning; library styles and implementation code are lazy-loaded inside the iframe. Production `web/`, `docs/`, and their dependencies are unchanged.
