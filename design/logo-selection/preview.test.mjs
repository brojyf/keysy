import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('index.html');
const data = JSON.parse(html.slice(html.indexOf('const data = ') + 13, html.indexOf(';\nconst {palettes')));
const paletteSource = [read('../palettes/palettes.js'), read('../palettes/palettes-extra.js')].join('\n');
const shared = JSON.parse(vm.runInNewContext(`${paletteSource}\nJSON.stringify([...keysyPalettes, ...keysyExtraPalettes])`));

test('every candidate is listed once, from 01 to 36, with its source artwork', () => {
  assert.deepEqual(data.logos.map(logo => logo.id),
    ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19',
      '20', '21', '22', '27', '28', '30', '31', '32', '33', '34', '35', '36']);
  assert.deepEqual(data.studies.map(study => study.id), ['A', 'B', 'C']);
  assert.deepEqual(data.icons.map(icon => icon.id), ['A', 'B', 'C', 'D']);
  for (const logo of [...data.logos, ...data.studies]) {
    for (const artwork of [logo.svg, logo.symbol].filter(Boolean)) {
      assert.match(artwork, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      assert.match(artwork, /currentColor/);
      assert.doesNotMatch(artwork, /<(?:text|image|script)\b|href=|\bvar\(/);
    }
  }
  for (const icon of data.icons) assert.match(icon.image, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
  assert.doesNotMatch(html, /<h2|<details|class="review-section"|class="section-heading"/);
});

test('the single grid renders every candidate and recolors each preview', () => {
  assert.deepEqual(data.palettes, shared);
  assert.deepEqual(data.palettes.map(palette => palette.number), ['02', '04', '10', '13', '14', '15', '16', '19']);
  const panels = data.palettes.flatMap(() => ['light', 'dark'].map(mode => ({ dataset: { mode }, style: {} })));
  const buttons = [];
  const targets = new Map();
  const context = vm.createContext({
    document: {
      querySelector(selector) { if (!targets.has(selector)) targets.set(selector, { innerHTML: '', textContent: '', style: {} }); return targets.get(selector); },
      querySelectorAll(selector) { return selector === '.identity-preview' ? panels : buttons; },
    },
  });
  for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(script, context);
  const cocoa = data.palettes.find(palette => palette.id === 'cocoaice');
  vm.runInContext('setPalette("cocoaice")', context);
  for (const panel of panels) assert.ok(panel.style.cssText.includes(`--accent:${cocoa[panel.dataset.mode].accent}`));
  assert.match(targets.get('#palette-status').textContent, /16 Cocoa \/ Ice/);
  const grid = targets.get('#comparisons').innerHTML;
  assert.equal((grid.match(/class="theme-pair"/g) || []).length, 38);
  for (const id of ['logo-01', 'logo-22', 'logo-28', 'logo-36', 'study-A', 'study-C', 'icon-A', 'icon-D']) {
    assert.ok(grid.includes(`id="${id}"`), id);
  }
  assert.equal((grid.match(/class="logo-art"/g) || []).length, 68);
  assert.equal((grid.match(/class="icon-art"/g) || []).length, 8);
});

test('the local preview needs no network, build step, or removed source files', () => {
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\/[^"]+\.(?:js|css|svg|png)/);
  assert.doesNotMatch(html, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
  for (const [, path] of html.matchAll(/href="([^"#:]+\.(?:txt|css|js|html))"/g)) assert.ok(existsSync(new URL(path, import.meta.url)), path);
  assert.match(html, /lang="en"/);
});
