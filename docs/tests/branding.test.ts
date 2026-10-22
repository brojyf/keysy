import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const docs = new URL('../', import.meta.url);
const config = await Bun.file(new URL('docs.json', docs)).json();

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

for (const mode of ['light', 'dark'] as const) {
  test(`${mode} accent text meets WCAG AA on the page background`, () => {
    const accent = mode === 'light' ? config.colors.primary : config.colors.light;
    expect(contrast(accent, config.background.color[mode])).toBeGreaterThanOrEqual(4.5);
  });

  test(`${mode} logo resolves to a visible standalone SVG`, async () => {
    const svg = await readFile(new URL(`.${config.logo[mode]}`, docs), 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).toMatch(/viewBox="[\d. ]+"/);
    expect(svg).not.toContain('currentColor');
    const fills = [...svg.matchAll(/fill="(#[\da-f]{6})"/gi)];
    expect(fills.length).toBeGreaterThan(0);
    for (const [, fill] of fills) {
      expect(contrast(fill!, config.background.color[mode])).toBeGreaterThanOrEqual(3);
    }
  });

  test(`${mode} favicon is a visible standalone symbol`, async () => {
    const svg = await readFile(new URL(`.${config.favicon[mode]}`, docs), 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('currentColor');
    expect(svg).not.toContain('<text');
    const fills = [...svg.matchAll(/fill="(#[\da-f]{6})"/gi)];
    expect(fills.length).toBeGreaterThan(0);
    for (const [, fill] of fills) {
      const background = mode === 'light' ? '#ffffff' : '#121212';
      expect(contrast(fill!, background)).toBeGreaterThanOrEqual(3);
    }
  });
}
