import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const target = { innerHTML: '' };
const source = ['palettes.js', 'palettes-extra.js', 'dashboard.js'].map(file => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
const palettes = runInNewContext(`${source}\n;palettes`, {
  document: { querySelector: () => target },
});

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

test('all ten palettes have complete light and dark roles', () => {
  assert.equal(palettes.length, 10);
  assert.equal(new Set(palettes.map(palette => palette.id)).size, 10);
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

test('renders ten paired previews with stable numbers and labeled hex swatches', () => {
  const html = target.innerHTML;
  assert.equal((html.match(/class="palette"/g) || []).length, 10);
  assert.equal((html.match(/data-mode="light"/g) || []).length, 10);
  assert.equal((html.match(/data-mode="dark"/g) || []).length, 10);
  assert.equal((html.match(/class="swatch-hex"/g) || []).length, 120);
  assert.equal((html.match(/✓ Selected/g) || []).length, 20);
  for (const number of ['02','04','06','08','10','13','14','15','16','19']) assert.ok(html.includes(`class="palette-number">${number}</span>`));
  assert.doesNotMatch(html, /<(button|input|dialog|form)\b/);
  assert.doesNotMatch(html, /violet|midnight|\u9e22\u5c3e|\u6f6e\u6c50/);
});
