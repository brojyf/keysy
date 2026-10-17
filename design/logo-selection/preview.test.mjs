import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('index.html');
const data = JSON.parse(html.slice(html.indexOf('const data = ') + 13, html.indexOf(';\nconst {palettes')));
const paletteSource = [read('../palettes/palettes.js'), read('../palettes/palettes-extra.js')].join('\n');
const shared = JSON.parse(vm.runInNewContext(`${paletteSource}\nJSON.stringify([...keysyPalettes, ...keysyExtraPalettes])`));

test('retained candidates keep their source artwork and removed candidates are absent', () => {
  assert.deepEqual(data.logos.map(logo => logo.id),
    ['02', '04', '05', '06', '07', '08', '10', '11', '12', '13', '14', '15', '17', '18', '19',
      '20', '21', '22', '27', '28', '30', '31', '32', '35', '36']);
  assert.deepEqual(data.studies.map(study => study.id), ['B', 'C']);
  assert.deepEqual(data.icons.map(icon => icon.id), ['B', 'C', 'D']);
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
  assert.equal((grid.match(/class="theme-pair"/g) || []).length, 30);
  for (const id of ['logo-02', 'logo-22', 'logo-28', 'logo-36', 'study-B', 'study-C', 'icon-B', 'icon-D', 'generated-37', 'generated-38', 'generated-39', 'generated-40', 'generated-41', 'generated-42', 'generated-43', 'generated-44', 'generated-45', 'generated-46', 'generated-47', 'generated-48', 'generated-49', 'generated-50', 'generated-51']) {
    assert.ok(grid.includes(`id="${id}"`), id);
  }
  assert.equal((grid.match(/class="logo-art"/g) || []).length, 54);
  assert.equal((grid.match(/class="icon-art"/g) || []).length, 6);
  for (const id of ['logo-01', 'logo-03', 'logo-09', 'logo-16', 'logo-33', 'logo-34', 'study-A', 'icon-A']) {
    assert.ok(!grid.includes(`id="${id}"`), id);
  }
  const candidateNumbers = [...grid.matchAll(/<header class="option-heading"><span>([^<]+)<\/span>/g)].map(([, number]) => number);
  assert.deepEqual(candidateNumbers, Array.from({ length: 45 }, (_, index) => String(index + 1)));
  const generatedImages = [...grid.matchAll(/<img class="generated-art" src="([^"]+)"/g)];
  assert.equal(generatedImages.length, 15);
  for (const [, path] of generatedImages) {
    assert.deepEqual([...readFileSync(new URL(path, import.meta.url)).subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
});

test('the local preview needs no network, build step, or removed source files', () => {
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\/[^"]+\.(?:js|css|svg|png)/);
  assert.doesNotMatch(html, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
  for (const [, path] of html.matchAll(/href="([^"#:]+\.(?:txt|css|js|html))"/g)) assert.ok(existsSync(new URL(path, import.meta.url)), path);
  assert.match(html, /lang="en"/);
});
