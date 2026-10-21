# Keysy CSS and UI stack

Use **shadcn/ui + tweakcn + Geist** for the Keysy management UI.

| Responsibility | Use | Reference |
| --- | --- | --- |
| Components | shadcn/ui, using Radix primitives | [shadcn/ui](https://ui.shadcn.com/docs/components), [Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction) |
| Styling | Tailwind CSS | [Tailwind CSS](https://tailwindcss.com/docs) |
| Theme editing and export | tweakcn; commit exported CSS variables to the application | [tweakcn](https://tweakcn.com), [shadcn/ui theming](https://ui.shadcn.com/docs/theming) |
| Interface font | Geist Sans | [Geist fonts](https://vercel.com/font) |
| Code and identifier font | Geist Mono | [Geist fonts](https://vercel.com/font) |
| Design reference | Vercel Geist | [Geist design system](https://vercel.com/geist/introduction) |
| Colors | Ink, light and dark | [Theme specification](../theme/README.md), [palette values](../theme/palettes.js) |

Use Radix-based shadcn/ui components, not Radix Themes. Vercel Geist is a design reference, not an additional component library. tweakcn exports must use the Ink palette.
