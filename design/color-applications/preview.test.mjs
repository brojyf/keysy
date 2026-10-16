import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = [read('../palettes/palettes.js'), read('../palettes/palettes-extra.js'), read('preview.js')].join('\n');

function loadPreview(search = '') {
  const nodes = new Map();
  const makeNode = (dataset = {}) => ({
    dataset, innerHTML: '', textContent: '', value: '', attributes: {}, handlers: {}, scrolled: false,
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.handlers[name] = handler; },
    scrollIntoView() { this.scrolled = true; },
  });
  const layoutButtons = ['supabase', 'mintlify'].map(layout => makeNode({layout}));
  const modeButtons = ['light', 'dark'].map(mode => makeNode({mode}));
  const document = {
    querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, makeNode()); return nodes.get(selector); },
    querySelectorAll(selector) { return selector === '[data-layout]' ? layoutButtons : selector === 'button[data-mode]' ? modeButtons : []; },
  };
  let address;
  const context = vm.createContext({document, URL, URLSearchParams,
    location: {search, href: `file:///design/color-applications/index.html${search}`},
    history: {replaceState(_state, _unused, url) { address = url; }},
    ResizeObserver: class { observe() {} disconnect() {} },
  });
  vm.runInContext(source, context);
  return {context, nodes, layoutButtons, modeButtons, address: () => address};
}

test('both layouts render every retained palette in both modes, with matching tokens', () => {
  const {context, nodes, layoutButtons} = loadPreview();
  for (const button of layoutButtons) {
    button.handlers.click();
    const gallery = nodes.get('#palette-gallery').innerHTML;
    assert.equal((gallery.match(/class="palette-pair"/g) || []).length, 8);
    assert.equal((gallery.match(/class="mock-screen /g) || []).length, 16);
    for (const palette of vm.runInContext('palettes', context)) for (const mode of ['light','dark']) {
      assert.ok(gallery.includes(`data-palette="${palette.id}" data-mode="${mode}"`));
      for (const [role, color] of Object.entries(palette[mode])) assert.ok(gallery.includes(`--${role}:${color}`));
    }
  }
});

test('palette, mode, and layout controls update the focused preview and shareable address', () => {
  const {nodes, layoutButtons, modeButtons, address} = loadPreview();
  nodes.get('#palette-select').handlers.change({target:{value:'cocoaice'}});
  modeButtons[1].handlers.click();
  layoutButtons[1].handlers.click();
  assert.match(nodes.get('#focus-preview').innerHTML, /mock-screen mintlify/);
  assert.match(nodes.get('#focus-preview').innerHTML, /data-palette="cocoaice" data-mode="dark"/);
  assert.equal(modeButtons[1].attributes['aria-pressed'], 'true');
  assert.equal(layoutButtons[1].attributes['aria-pressed'], 'true');
  assert.equal(address().searchParams.get('palette'), 'cocoaice');
  assert.equal(address().searchParams.get('layout'), 'mintlify');
  assert.equal(address().searchParams.get('mode'), 'dark');
});

test('opening a comparison selects its exact palette and mode', () => {
  const {nodes} = loadPreview();
  nodes.get('#palette-gallery').handlers.click({target:{closest: () => ({dataset:{open:'inkiris',openMode:'dark'}})}});
  assert.match(nodes.get('#focus-title').textContent, /19 Ink \/ Iris/);
  assert.match(nodes.get('#focus-preview').innerHTML, /data-palette="inkiris" data-mode="dark"/);
  assert.equal(nodes.get('#focus').scrolled, true);
});

test('removed palettes stay out of controls and comparisons and old URLs fall back', () => {
  const {context, nodes} = loadPreview();
  assert.deepEqual(Array.from(vm.runInContext('palettes', context), p => p.number),
    ['02', '04', '10', '13', '14', '15', '16', '19']);
  for (const id of ['olive', 'ochre', 'pinechalk', 'aubergineceladon', 'oxblood', 'petrol']) {
    assert.ok(!nodes.get('#palette-select').innerHTML.includes(`value="${id}"`));
    assert.ok(!nodes.get('#palette-gallery').innerHTML.includes(`data-palette="${id}"`));
    const old = loadPreview(`?layout=supabase&palette=${id}&mode=dark`);
    assert.match(old.nodes.get('#focus-preview').innerHTML, /data-palette="blue" data-mode="dark"/);
  }
});

test('valid URLs restore the comparison; invalid choices fall back safely', () => {
  const valid = loadPreview('?layout=mintlify&palette=slate&mode=dark');
  assert.match(valid.nodes.get('#focus-preview').innerHTML, /data-palette="slate" data-mode="dark"/);
  const invalid = loadPreview('?layout=invalid&palette=missing&mode=invalid');
  assert.match(invalid.nodes.get('#focus-preview').innerHTML, /mock-screen supabase/);
  assert.match(invalid.nodes.get('#focus-preview').innerHTML, /data-palette="blue" data-mode="light"/);
});

test('Mintlify preview uses the copied documentation table and navigation', () => {
  const {context} = loadPreview();
  const mdx = read('mintlify-copy/index.mdx');
  const rows = Array.from(mdx.matchAll(/^\| `([^`]+)` \| (.+) \|$/gm), m => [m[1], m[2]]);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(directoryRows)', context)), rows);
  const html = vm.runInContext('mintlifyScreen()', context);
  const config = JSON.parse(read('mintlify-copy/docs.json'));
  for (const {tab} of config.navigation.tabs) assert.ok(html.includes(`>${tab}</span>`));
  assert.ok(html.includes("Understand Keysy's monorepo and find the code you need."));
  assert.equal((html.match(/<tr>/g) || []).length, rows.length + 1);
});

test('Supabase mock includes table, selected row, masked value, and credential detail context', () => {
  const {context} = loadPreview();
  const html = vm.runInContext('supabaseScreen()', context);
  assert.equal((html.match(/<tr(?: class="selected-row")?>/g) || []).length, 7);
  for (const text of ['STRIPE_SECRET_KEY','AuthKey_Q7X9.p8','production-readonly','Secret details','••••••••••••••••']) assert.ok(html.includes(text));
  assert.doesNotMatch(html, /<(button|input|form)\b/);
});

test('the local preview has no runtime network dependency or production mutations', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\/[^\"]+\.(?:js|css)/);
  assert.doesNotMatch(read('preview.js'), /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
  for (const [, path] of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)) assert.ok(read(path));
});
