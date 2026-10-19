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

test('eight retained palettes use consecutive numbers and complete light and dark roles', () => {
  assert.equal(palettes.length, 8);
  assert.deepEqual(Array.from(palettes, palette => palette.number), ['1', '2', '3', '4', '5', '6', '7', '8']);
  assert.equal(new Set(palettes.map(palette => palette.id)).size, 8);
  for (const id of ['jade', 'sand', 'clay', 'vermilion', 'sulfur', 'oxblood', 'olive', 'petrol', 'ochre', 'pinechalk', 'aubergineceladon']) {
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

for (const palette of palettes) {
  for (const mode of ['light', 'dark']) {
    test(`${palette.english} ${mode}: all text pairings meet 4.5:1`, () => {
      const colors = palette[mode];
      for (const [foreground, background] of [
        ['text', 'bg'], ['text', 'surface'], ['muted', 'bg'], ['muted', 'surface'],
        ['on-button', 'button'], ['accent', 'soft'],
      ]) {
        const ratio = contrast(colors[foreground], colors[background]);
        assert.ok(ratio >= 4.5, `${foreground}/${background}: ${ratio.toFixed(3)}:1`);
      }
      for (const background of ['bg', 'surface']) {
        assert.ok(contrast(colors.button, colors[background]) >= 3, `primary/${background}`);
      }
    });
  }
}
