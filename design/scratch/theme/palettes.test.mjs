import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'bun:test';
import { palettes } from './palettes.js';

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

function contrast(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

function cssHex(file, selector, property) {
  const css = readFileSync(new URL(file, import.meta.url), 'utf8');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declarations = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]+)\\}`))?.[1];
  const hex = declarations?.match(new RegExp(`(?:^|;)\\s*${property}:[^;#]*(#[a-f0-9]{3,6})\\s*;`))?.[1];
  assert.ok(hex, `${file}: ${selector} ${property} must have an explicit color`);
  return hex.length === 4 ? '#' + Array.from(hex.slice(1), channel => channel.repeat(2)).join('') : hex;
}

test('retained and reference-inspired palettes use consecutive numbers and complete light and dark roles', () => {
  assert.equal(palettes.length, 5);
  assert.deepEqual(Array.from(palettes, palette => palette.number), ['1', '2', '3', '4', '5']);
  assert.deepEqual(palettes.map(palette => palette.id), ['blue', 'graphite', 'inkiris', 'orchid', 'evergreen']);
  assert.equal(new Set(palettes.map(palette => palette.id)).size, 5);
  for (const id of ['cocoaice', 'terminal', 'slate', 'ember', 'cobalt', 'citron', 'jade', 'sand', 'clay', 'vermilion', 'sulfur', 'oxblood', 'olive', 'petrol', 'ochre', 'pinechalk', 'aubergineceladon']) {
    assert.ok(!palettes.some(palette => palette.id === id));
  }
  const roles = ['bg', 'surface', 'text', 'muted', 'accent', 'button', 'on-button', 'soft', 'line'];
  for (const palette of palettes) {
    for (const role of roles) {
      assert.match(palette.light[role], /^#[0-9a-f]{6}$/);
      assert.match(palette.dark[role], /^#[0-9a-f]{6}$/);
    }
    assert.ok(luminance(palette.light.bg) > luminance(palette.light.text));
    assert.ok(luminance(palette.dark.bg) < luminance(palette.dark.text));
  }
});

test('every palette keeps page, panel, selection, and divider colors close to neutral', () => {
  for (const palette of palettes) for (const mode of ['light', 'dark']) {
    for (const role of ['bg', 'surface', 'soft', 'line']) {
      const channels = palette[mode][role].slice(1).match(/../g).map(channel => parseInt(channel, 16));
      assert.ok(Math.max(...channels) - Math.min(...channels) <= 8, `${palette.name} ${mode} ${role} is too colorful`);
      if (role === 'line') continue;
      assert.ok(mode === 'light' ? Math.min(...channels) >= 235 : Math.max(...channels) <= 52,
        `${palette.name} ${mode} ${role} must stay near white or black`);
    }
  }
});

for (const palette of palettes) {
  test(`${palette.english} dark: all structural surfaces use achromatic black or gray`, () => {
    for (const role of ['bg', 'surface', 'soft', 'line']) {
      const [red, green, blue] = palette.dark[role].slice(1).match(/../g);
      assert.ok(red === green && green === blue, `${role}: ${palette.dark[role]} must have equal RGB channels`);
    }
  });
}

for (const id of ['evergreen']) {
  test(`${id} dark: panels, selected fills, and dividers remain distinguishable from the canvas`, () => {
    const colors = palettes.find(palette => palette.id === id).dark;
    assert.ok(luminance(colors.bg) < luminance(colors.surface));
    assert.ok(luminance(colors.surface) < luminance(colors.soft));
    for (const [foreground, background, minimum] of [
      ['surface', 'bg', 1.25], ['soft', 'bg', 1.45], ['line', 'surface', 1.8],
    ]) {
      const ratio = contrast(colors[foreground], colors[background]);
      assert.ok(ratio >= minimum, `${foreground}/${background}: ${ratio.toFixed(3)}:1; expected ${minimum}:1`);
    }
  });
}

test('studio instructions, candidate labels, and selection outlines remain visible on their actual surfaces', () => {
  const canvas = cssHex('../studio.css', ':root', 'background');
  const card = cssHex('../studio.css', '.preview-controls', 'background');
  const header = cssHex('../studio.css', '.design-header', 'background');
  const picker = cssHex('../studio.css', '.palette-option', 'background');
  const choices = cssHex('preview.css', '.theme-color-choice', 'background');
  const pairs = [
    ['../studio.css', '.design-meta', header],
    ...['.preview-eyebrow', '.preview-description', '.preview-count', '.collection-heading h2 > span',
      '.preview-footnote', '.design-footer'].map(selector => ['../studio.css', selector, canvas]),
    ['../studio.css', '.control-heading > span:last-child', card],
    ['../studio.css', '.palette-option-label > small', picker],
    ['../logo/preview.css', '.option-heading > span', card],
    ['../logo/preview.css', '.concept-note', card],
    ...['.layout-note', '.theme-palette-heading > span']
      .map(selector => ['preview.css', selector, canvas]),
    ['preview.css', '.theme-color-select', choices],
    ['../studio.css', '.palette-option-label > small', choices],
  ];
  for (const [file, selector, background] of pairs) {
    const ratio = contrast(cssHex(file, selector, 'color'), background);
    assert.ok(ratio >= 4.5, `${selector}: ${ratio.toFixed(3)}:1`);
  }
  for (const selector of ['.design-tabs button[aria-selected="true"]', '.segmented button[aria-pressed="true"]']) {
    assert.ok(contrast(cssHex('../studio.css', selector, 'border-color'), '#ffffff') >= 3, selector);
  }
  assert.ok(contrast(cssHex('preview.css', '.theme-color-choice:has(button[aria-pressed="true"])', 'border-color'), choices) >= 3);
  const focus = cssHex('../studio.css', 'button:focus-visible, a:focus-visible, [role="tabpanel"]:focus-visible', 'outline');
  assert.equal(cssHex('preview.css', '.theme-color-select:focus-visible::after', 'outline'), focus);
  assert.equal(cssHex('preview.css', '.theme-palette-scroll:focus-visible', 'outline'), focus);
  for (const background of [canvas, card, header, picker, choices, cssHex('../studio.css', '.segmented', 'background')]) {
    assert.ok(contrast(focus, background) >= 3, 'keyboard focus must contrast with its adjacent surface');
  }
});

for (const palette of palettes) {
  for (const mode of ['light', 'dark']) {
    test(`${palette.english} ${mode}: text, selected states, and controls meet contrast targets`, () => {
      const colors = palette[mode];
      for (const [foreground, background] of [
        ['text', 'bg'], ['text', 'surface'], ['text', 'soft'],
        ['muted', 'bg'], ['muted', 'surface'], ['muted', 'soft'],
        ['accent', 'bg'], ['accent', 'surface'], ['accent', 'soft'],
        ['on-button', 'button'],
      ]) {
        const ratio = contrast(colors[foreground], colors[background]);
        const minimum = foreground === 'text' ? 7 : 4.5;
        assert.ok(ratio >= minimum, `${foreground}/${background}: ${ratio.toFixed(3)}:1; expected ${minimum}:1`);
      }
      for (const background of ['bg', 'surface', 'soft']) {
        assert.ok(contrast(colors.button, colors[background]) >= 3, `primary/${background}`);
      }
    });
  }
}

test('Evergreen buttons retain Terminal greens with a small reduction in saturation', () => {
  const evergreen = palettes.find(palette => palette.id === 'evergreen');
  for (const [mode, original] of [['light', '#087443'], ['dark', '#7aceaa']]) {
    const channels = hex => hex.slice(1).match(/../g).map(channel => parseInt(channel, 16));
    const before = channels(original);
    const after = channels(evergreen[mode].button);
    assert.notEqual(evergreen[mode].button, original);
    assert.ok(after.every((channel, index) => Math.abs(channel - before[index]) <= 16));
    assert.ok(Math.max(...after) - Math.min(...after) < Math.max(...before) - Math.min(...before));
  }
});
