import { palettes } from '../theme/palettes.js';

export const libraries = [
  { id: 'radix-themes', name: 'Radix Themes', kind: 'React component library', stack: '@radix-ui/themes', source: 'https://www.radix-ui.com/themes/docs/overview/getting-started', note: 'Real Theme, Button, TextField, and Badge components with custom palette tokens; the shared table uses native HTML.' },
  { id: 'shadcn', name: 'shadcn/ui + tweakcn', kind: 'Copied React components', stack: 'Radix Slot · Tailwind CSS', source: 'https://ui.shadcn.com/docs/theming', note: 'Official New York components and the exported tweakcn Modern Minimal theme. Keysy colors override its semantic color roles.' },
  { id: 'daisyui', name: 'daisyUI', kind: 'CSS component library', stack: 'daisyUI · Tailwind CSS', source: 'https://daisyui.com/docs/themes/', note: 'Real daisyUI button, input, badge, and table classes with custom Keysy colors. The shared dialog uses native HTML.' },
  { id: 'radix-colors', name: 'Radix Colors', kind: 'Color tokens', stack: '@radix-ui/colors · native HTML', source: 'https://www.radix-ui.com/colors/docs/overview/usage', note: 'Official hue-matched 12-step color scales plus Keysy semantic colors. Components are local CSS, not a Radix component library.' },
  { id: 'open-props', name: 'Open Props', kind: 'Design tokens', stack: 'open-props · native HTML', source: 'https://open-props.style/', note: 'Installed Open Props spacing, radius, shadows, and easing tokens. Components are local CSS using Keysy colors.' },
  { id: 'basecoat', name: 'Basecoat', kind: 'CSS component library', stack: 'basecoat-css · Vega style', source: 'https://basecoatui.com/installation/', note: 'The real compiled Vega stylesheet and documented semantic markup. The demo uses native dialog behavior; no unused Basecoat JavaScript is loaded.' },
  { id: 'coss', name: 'coss ui', kind: 'Copied React components', stack: 'Base UI · Tailwind CSS', source: 'https://coss.com/ui/docs', note: 'Official button, input, badge, and spinner source from the MIT-licensed apps/ui registry.' },
  { id: 'intent', name: 'Intent UI', kind: 'Copied React components', stack: 'React Aria · Tailwind CSS', source: 'https://intentui.com/docs/getting-started/introduction', note: 'Official Button, Input, and Badge source with React Aria behavior and its Tailwind state plugin.' },
  { id: 'geist', name: 'Geist reference', kind: 'Specification reference', stack: 'Local CSS · official Geist fonts', source: 'https://vercel.com/geist/introduction', note: 'A local interpretation of Vercel’s public color and component guidance, not an official installable Geist component package.' },
] as const;

export type LibraryId = typeof libraries[number]['id'];
export type Mode = 'light' | 'dark';
export type Selection = { library: LibraryId; palette: string; mode: Mode };

export function readSelection(search: string): Selection {
  const params = new URLSearchParams(search);
  return {
    library: libraries.find(library => library.id === params.get('library'))?.id ?? libraries[0].id,
    palette: palettes.find(palette => palette.id === params.get('cssPalette'))?.id ?? palettes[0].id,
    mode: params.get('cssMode') === 'dark' ? 'dark' : 'light',
  };
}

export function frameUrl(selection: Selection, pathname = '/'): string {
  const root = pathname.replace(/(?:logo|theme|css)\/(?:index\.html)?$/, '').replace(/index\.html$/, '');
  const params = new URLSearchParams({ library: selection.library, cssPalette: selection.palette, cssMode: selection.mode });
  return `${root}css/frame.html?${params}`;
}
