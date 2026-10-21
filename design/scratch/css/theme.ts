import * as radixColors from '@radix-ui/colors';
import type { LibraryId, Mode } from './catalog';

export type PaletteColors = Record<'bg' | 'surface' | 'text' | 'muted' | 'accent' | 'button' | 'on-button' | 'soft' | 'line', string>;

const hues: Record<string, string> = {
  blue: 'blue', graphite: 'gray', slate: 'slate',
  ember: 'bronze',
};

export function themeVariables(colors: PaletteColors, library: LibraryId, mode: Mode, paletteId = 'blue'): Record<string, string> {
  const dark = mode === 'dark';
  const tokens: Record<string, string> = {
    '--background': colors.bg, '--foreground': colors.text,
    '--card': colors.surface, '--card-foreground': colors.text,
    '--popover': colors.surface, '--popover-foreground': colors.text,
    '--overlay': colors.surface, '--overlay-foreground': colors.text,
    '--primary': colors.button, '--primary-foreground': colors['on-button'],
    '--primary-subtle': colors.soft, '--primary-subtle-foreground': colors.accent,
    '--secondary': colors.soft, '--secondary-foreground': colors.text,
    '--accent': colors.soft, '--accent-foreground': colors.text,
    '--muted': colors.soft, '--muted-foreground': colors.muted,
    '--border': colors.line, '--input': colors.line, '--ring': colors.accent,
    '--destructive': dark ? '#f87171' : '#b91c1c', '--destructive-foreground': '#ffffff',
    '--danger': dark ? '#f87171' : '#b91c1c', '--danger-foreground': '#ffffff',
    '--success': dark ? '#86efac' : '#166534', '--success-foreground': dark ? '#052e16' : '#ffffff',
    '--success-subtle': dark ? '#142b20' : '#f0fdf4', '--success-subtle-foreground': dark ? '#86efac' : '#166534',
    '--warning': dark ? '#fcd34d' : '#92400e', '--warning-foreground': dark ? '#451a03' : '#ffffff',
    '--color-base-100': colors.surface, '--color-base-200': colors.bg, '--color-base-300': colors.line,
    '--color-base-content': colors.text,
    '--color-primary': colors.button, '--color-primary-content': colors['on-button'],
    '--color-secondary': colors.soft, '--color-secondary-content': colors.text,
    '--color-accent': colors.accent, '--color-accent-content': colors.bg,
    '--color-neutral': colors.text, '--color-neutral-content': colors.bg,
    '--demo-status-text': dark ? '#86efac' : '#166534',
    '--demo-status-bg': dark ? '#142b20' : '#f0fdf4',
    '--demo-button-hover': `color-mix(in srgb, ${colors.button} 90%, ${colors['on-button'] === '#ffffff' ? '#000000' : '#ffffff'})`,
  };
  for (const [role, color] of Object.entries(colors)) tokens[`--demo-${role}`] = color;

  const hue = hues[paletteId] ?? 'blue';
  const scaleName = hue + (dark ? 'Dark' : '');
  const scale = (radixColors as unknown as Record<string, Record<string, string>>)[scaleName];
  for (let step = 1; step <= 12; step++) tokens[`--radix-${step}`] = scale[`${hue}${step}`];

  if (library === 'radix-themes') {
    const accent = [colors.bg, colors.surface, colors.soft, 'color-mix(in srgb, var(--demo-accent) 14%, var(--demo-surface))', colors.soft, colors.line, colors.line, colors.muted, colors.button, tokens['--demo-button-hover'], colors.accent, colors.text];
    const gray = [colors.bg, colors.surface, colors.soft, colors.soft, colors.soft, colors.line, colors.line, colors.muted, colors.muted, colors.muted, colors.muted, colors.text];
    accent.forEach((color, index) => { tokens[`--indigo-${index + 1}`] = color; });
    gray.forEach((color, index) => { tokens[`--gray-${index + 1}`] = color; });
    tokens['--indigo-contrast'] = colors['on-button'];
    tokens['--indigo-surface'] = colors.soft;
    tokens['--indigo-indicator'] = colors.accent;
    tokens['--indigo-track'] = colors.accent;
    tokens['--color-background'] = colors.bg;
    tokens['--color-panel-solid'] = colors.surface;
    tokens['--color-surface'] = colors.surface;
  }
  return tokens;
}
