import { createRoot } from 'react-dom/client';
import type { ComponentType } from 'react';
import { palettes } from '../../theme/palettes.js';
import { libraries, readSelection, type LibraryId } from './catalog';
import { themeVariables } from './theme';
import type { DemoProps } from './Workspace';
import './styles/frame.css';

const loaders: Record<LibraryId, () => Promise<{ default: ComponentType<DemoProps> }>> = {
  'radix-themes': () => import('./adapters/radix-themes'),
  shadcn: () => import('./adapters/shadcn'),
  daisyui: () => import('./adapters/daisyui'),
  'radix-colors': () => import('./adapters/radix-colors'),
  'open-props': () => import('./adapters/open-props'),
  basecoat: () => import('./adapters/basecoat'),
  coss: () => import('./adapters/coss'),
  intent: () => import('./adapters/intent'),
  geist: () => import('./adapters/geist'),
};

async function mount() {
  const selection = readSelection(location.search);
  const palette = palettes.find(palette => palette.id === selection.palette)!;
  const colors = palette[selection.mode];
  const html = document.documentElement;
  html.classList.toggle('dark', selection.mode === 'dark');
  html.dataset.theme = selection.mode;
  html.dataset.library = selection.library;
  html.dataset.palette = selection.palette;
  html.style.colorScheme = selection.mode;
  for (const [property, value] of Object.entries(themeVariables(colors, selection.library, selection.mode, selection.palette))) html.style.setProperty(property, value);
  document.title = `${libraries.find(library => library.id === selection.library)!.name} · ${palette.name} · ${selection.mode} — Keysy`;
  const { default: Demo } = await loaders[selection.library]();
  createRoot(document.getElementById('root')!).render(<Demo selection={selection} colors={colors} />);
}

mount().catch(error => {
  console.error(error);
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = 'The integration could not load. Check the console and reinstall the locked dependencies.';
  document.getElementById('root')!.replaceChildren(message);
});
