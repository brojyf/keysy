import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const assets = {
  'a-logo': 'a-key-k.svg',
  'a-symbol': 'a-symbol.svg',
  'b-logo': 'b-keyhole.svg',
  'b-symbol': 'b-symbol.svg',
  'c-logo': 'c-wordmark.svg',
  'c-symbol': 'c-symbol.svg',
};

for (const [id, filename] of Object.entries(assets)) {
  test(`${filename}: accessible, scalable, self-contained vector artwork`, () => {
    const svg = read(filename);
    assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /viewBox="0 0 \d+ \d+"/);
    assert.match(svg, /role="img" aria-label="[^"]+"/);
    assert.match(svg, /<title>[^<]+<\/title>/);
    assert.match(svg, /currentColor/);
    assert.doesNotMatch(svg, /<(?:text|image|use|script)\b|(?:href|src)=|@font-face|var\(/);
    if (id.endsWith('-logo')) assert.match(svg, /data-accent=""/);
  });
}

test('offline preview embeds exactly the supplied vector artwork', () => {
  const html = read('preview.html');
  const embedded = [...html.matchAll(/<template id="([^"]+)">([\s\S]*?)<\/template>/g)];
  assert.equal(embedded.length, Object.keys(assets).length);
  for (const [id, filename] of Object.entries(assets)) {
    assert.equal(embedded.find(([, templateId]) => templateId === id)?.[2], read(filename).trim());
  }
});

test('preview loads its resources locally without a build or external fonts', () => {
  const html = read('preview.html');
  const resources = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)];
  assert.equal(resources.length, 2);
  for (const [, path] of resources) {
    assert.ok(!path.includes(':'), `external dependency: ${path}`);
    assert.ok(existsSync(new URL(path, import.meta.url)), `missing resource: ${path}`);
  }
  assert.doesNotMatch(read('preview.css'), /@import|@font-face|url\(/);
  assert.doesNotMatch(read('preview.js'), /\bfetch\s*\(|XMLHttpRequest/);
});

test('font copyright and redistribution notices accompany the outlines', () => {
  for (const font of ['manrope', 'outfit']) {
    const license = read(`licenses/${font}-OFL.txt`);
    assert.match(license, /Copyright/i);
    assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  }
});
