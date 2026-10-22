import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import config from '../sourcey.config';

const docs = new URL('../', import.meta.url);
const stylesheet = await Bun.file(new URL('style.css', docs)).text();

function contrast(foreground: string, background: string) {
  function luminance(hex: string) {
    const rgb = hex.slice(1).match(/../g)!.map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
  }
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

test('navbar uses the native GitHub brand icon with an accessible label', () => {
  expect(config.navbar?.links).toContainEqual({
    type: 'github',
    label: 'GitHub',
    href: 'https://github.com/brojyf/keysy',
  });
});

test('native theme loads both Geist families and the brand stylesheet', () => {
  expect(config.theme?.fonts).toEqual({ sans: 'Geist', mono: 'Geist Mono' });
  expect(config.theme?.css).toEqual(['./style.css']);
  expect(stylesheet).not.toContain('mintlify');
  expect(stylesheet).not.toContain('view-transition');
});

test('root favicon fallback provides standard browser icon sizes', async () => {
  expect(config.publicDir).toBe('./public');
  const icon = Buffer.from(await Bun.file(new URL('public/favicon.ico', docs)).arrayBuffer());
  expect(icon.readUInt16LE(0)).toBe(0);
  expect(icon.readUInt16LE(2)).toBe(1);
  const sizes = Array.from({ length: icon.readUInt16LE(4) }, (_, index) =>
    icon.readUInt8(6 + index * 16),
  );
  for (const size of [16, 32, 48]) expect(sizes).toContain(size);
});

for (const mode of ['light', 'dark'] as const) {
  const background = mode === 'light' ? '#fafafa' : '#121212';

  test(`${mode} accent meets WCAG AA on the configured neutral background`, () => {
    const accent = mode === 'light' ? config.theme!.colors!.primary : config.theme!.colors!.light!;
    expect(accent).toBe(mode === 'light' ? '#1d4ed8' : '#7aa2ff');
    expect(contrast(accent, background)).toBeGreaterThanOrEqual(4.5);
    expect(stylesheet).toContain(`--color-background-${mode}: ${mode === 'light' ? '250 250 250' : '18 18 18'}`);
  });

  test(`${mode} logo resolves to a visible standalone SVG`, async () => {
    const logo = config.logo as { light: string; dark: string };
    const svg = await readFile(new URL(logo[mode], docs), 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).toMatch(/viewBox="[\d. ]+"/);
    expect(svg).not.toContain('currentColor');
    const fills = [...svg.matchAll(/fill="(#[\da-f]{6})"/gi)];
    expect(fills.length).toBeGreaterThan(0);
    for (const [, fill] of fills) {
      expect(contrast(fill!, background)).toBeGreaterThanOrEqual(3);
    }
  });
}

test('favicon adapts the Namespace symbol to the browser color scheme', async () => {
  const svg = await Bun.file(new URL(config.favicon!, docs)).text();
  expect(svg).toContain('prefers-color-scheme: dark');
  expect(svg).toContain('#638ce5');
  expect(svg).not.toContain('<text');
  for (const background of ['#ffffff', '#121212']) {
    expect(contrast(background === '#ffffff' ? '#2f5aba' : '#638ce5', background)).toBeGreaterThanOrEqual(3);
  }
});
