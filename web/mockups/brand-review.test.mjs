import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('review.html', import.meta.url), 'utf8');
const targets = new Map();
const panels = ['light', 'dark'].map(mode => ({ dataset: { mode }, style: {} }));
const buttons = [];
const context = vm.createContext({ document: {
  querySelector(selector) {
    if (!targets.has(selector)) targets.set(selector, { innerHTML: '', textContent: '' });
    return targets.get(selector);
  },
  querySelectorAll(selector) { return selector === '.identity-preview' ? panels : buttons; },
} });
for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(script, context);
const palettes = vm.runInContext('palettes', context);
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
test('ten retained palettes keep stable numbers and recolor both modes', () => {
  assert.equal(palettes.length, 10);
  assert.equal(new Set(palettes.map(p => p.id)).size, 10);
  assert.deepEqual(Array.from(palettes, p => p.number), ['02', '04', '06', '08', '10', '13', '14', '15', '16', '19']);
  for (const id of ['jade', 'sand', 'clay', 'vermilion', 'sulfur', 'olive', 'ochre', 'pinechalk', 'aubergineceladon']) assert.ok(!palettes.some(p => p.id === id));
  for (const p of palettes) {
    vm.runInContext(`setPalette(${JSON.stringify(p.id)})`, context);
    for (const panel of panels) assert.ok(panel.style.cssText.includes(`--accent:${p[panel.dataset.mode].accent}`));
    assert.ok(targets.get('#palette-options').innerHTML.includes(`data-palette="${p.id}"`));
  }
  assert.equal((targets.get('#color-comparisons').innerHTML.match(/class="theme-pair"/g) || []).length, 10);
});
for (const palette of palettes) for (const mode of ['light', 'dark']) {
  test(`${palette.id}/${mode}: text and button contrast`, () => {
    const c = palette[mode];
    for (const color of Object.values(c)) assert.match(color, /^#[0-9a-f]{6}$/);
    for (const fg of ['text', 'muted', 'accent']) for (const bg of ['bg', 'surface', 'soft']) {
      assert.ok(contrast(c[fg], c[bg]) >= 4.5, `${fg}/${bg}: ${contrast(c[fg], c[bg])}`);
    }
    assert.ok(contrast(c['on-button'], c.button) >= 4.5);
    for (const bg of ['bg', 'surface']) assert.ok(contrast(c.button, c[bg]) >= 3);
  });
}
test('new vector logos render while rejected directions stay excluded', () => {
  const current = vm.runInContext('logoOptions', context);
  const previous = vm.runInContext('previousLogoOptions', context);
  assert.deepEqual(Array.from(current, l => l.id), ['30', '31', '32', '33', '34', '35', '36']);
  assert.equal(previous.length, 20);
  for (const logo of [...current, ...previous]) assert.ok(!['01', '03', '13', '14', '26', '29'].includes(logo.id));
  for (const logo of current) for (const svg of [logo.svg, logo.symbol]) {
    assert.match(svg, /currentColor/);
    assert.doesNotMatch(svg, /<(?:text|image)\b/);
  }
  assert.equal((targets.get('#logo-comparisons').innerHTML.match(/class="identity-preview|class="theme-preview identity-preview/g) || []).length, 14);
});

test('standalone review embeds the shared palettes and exported logo assets exactly', () => {
  const source = ['palettes.js', 'palettes-extra.js'].map(file => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
  const shared = vm.runInNewContext(`${source}\nJSON.stringify([...keysyPalettes, ...keysyExtraPalettes])`);
  assert.equal(JSON.stringify(palettes), shared);
  for (const logo of vm.runInContext('logoOptions', context)) {
    const round = Number(logo.id) >= 33 ? 'round-9' : 'round-8';
    assert.equal(logo.svg.trim(), readFileSync(new URL(`logos/${round}/${logo.id}.svg`, import.meta.url), 'utf8').trim());
    assert.equal(logo.symbol.trim(), readFileSync(new URL(`logos/${round}/${logo.id}-symbol.svg`, import.meta.url), 'utf8').trim());
  }
});
