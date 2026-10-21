import assert from 'node:assert/strict';
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

test('Ink is the only palette and defines complete light and dark roles', () => {
  assert.equal(palettes.length, 1);
  assert.deepEqual(Array.from(palettes, palette => palette.number), ['1']);
  assert.deepEqual(palettes.map(palette => palette.id), ['blue']);
  assert.equal(new Set(palettes.map(palette => palette.id)).size, 1);
  for (const id of ['graphite', 'evergreen', 'inkiris', 'orchid', 'cocoaice', 'terminal', 'slate', 'ember', 'cobalt', 'citron', 'jade', 'sand', 'clay', 'vermilion', 'sulfur', 'oxblood', 'olive', 'petrol', 'ochre', 'pinechalk', 'aubergineceladon']) {
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
