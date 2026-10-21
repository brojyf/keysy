import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test } from 'bun:test';
import LogoPreview from './LogoPreview.jsx';
import candidates from './candidates.json';
import { palettes } from '../theme/palettes.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const expectedGroups = [
  ['Wordmarks', ['logo-10']],
  ['Brackets & asterisks', ['logo-20', 'logo-21', 'logo-22']],
  ['Keys & keyholes', ['logo-32', 'logo-11', 'generated-42']],
  ['Rings & links', ['generated-47', 'logo-13', 'logo-31', 'generated-43']],
  ['K & geometric blocks', ['logo-36', 'generated-46', 'reference-52', 'reference-55']],
];

test('retained candidates keep their source artwork and removed candidates are absent', () => {
  assert.deepEqual(candidates.filter(entry => entry.kind === 'logo').map(entry => entry.id),
    ['10', '20', '21', '22', '32', '11', '13', '31', '36']);
  assert.deepEqual(candidates.filter(entry => entry.kind === 'study').map(entry => entry.id), []);
  assert.deepEqual(candidates.filter(entry => entry.kind === 'icon').map(entry => entry.id), []);
  assert.deepEqual(candidates.filter(entry => entry.kind === 'generated').map(entry => entry.id),
    ['42', '47', '43', '46']);
  assert.deepEqual(candidates.filter(entry => entry.kind === 'reference').map(entry => entry.id),
    ['52', '55']);
  for (const entry of candidates) {
    for (const artwork of [entry.svg, entry.symbol].filter(Boolean)) {
      assert.match(artwork, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      assert.match(artwork, /currentColor/);
      assert.doesNotMatch(artwork, /<(?:text|image|script)\b|href=|\bvar\(/);
      assert.doesNotMatch(artwork, /\b(?:style|color|fill|stroke)="[^"]*#[0-9a-f]{3,8}\b/i);
    }
    if (entry.image) assert.match(entry.image, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
    if (entry.source) assert.equal(entry.svg.replace(/\r\n/g, '\n'), read(entry.source));
    if (entry.symbolSource) assert.equal(entry.symbol.replace(/\r\n/g, '\n'), read(entry.symbolSource));
  }
});

test('the React grid shows every retained candidate with consecutive display numbers and both modes', () => {
  const { container } = render(<LogoPreview />);
  assert.equal(container.querySelectorAll('article').length, candidates.length);
  assert.equal(container.querySelector('.preview-description').textContent, `${candidates.length} directions. One color system. See what feels like Keysy.`);
  assert.equal(container.querySelector('.preview-count').textContent, `${candidates.length} candidates · 0–${candidates.length - 1}`);
  assert.equal(container.querySelector('.collection-heading h2 span').textContent, String(candidates.length));
  assert.deepEqual([...container.querySelectorAll('.option-heading > span')].map(node => Number(node.textContent)),
    Array.from({ length: candidates.length }, (_, index) => index));
  assert.equal(container.querySelector('#logo-08, #logo-07, #logo-18, #logo-12, #logo-15, #logo-30, #generated-40, #generated-48, #generated-51, #reference-53, #study-B, #generated-49, #generated-45, #logo-19, #reference-54, #icon-D'), null);
  assert.equal(screen.queryByRole('heading', { name: 'Cipher / Plain', exact: true }), null);
  assert.equal(screen.queryByRole('heading', { name: 'Notch K', exact: true }), null);
  for (const entry of candidates) {
    const article = container.querySelector(`#${entry.kind}-${entry.id}`);
    assert.equal(article.querySelector('.option-heading > span').textContent, String(candidates.indexOf(entry)));
    assert.equal(article.querySelector('h3').textContent, entry.name);
    const panels = [...article.querySelectorAll('.theme-preview')];
    assert.deepEqual(panels.map(panel => panel.dataset.mode), ['light', 'dark']);
    for (const panel of panels) assert.ok(within(panel).getByRole('img', { name: entry.name, exact: true }));
    if (entry.svg) {
      assert.equal(article.querySelector('.logo-art').innerHTML, new DOMParser().parseFromString(entry.svg, 'text/html').body.innerHTML);
      assert.equal(article.querySelector('.small-logo').querySelectorAll(':scope > span').length, 1,
        'only the size label may inherit the muted span color, not the SVG wrapper');
    }
  }
});

test('similar logos appear in five labeled groups without changing their review numbers or source identities', () => {
  const { container } = render(<LogoPreview />);
  assert.equal(container.querySelectorAll('#comparisons > section').length, expectedGroups.length);
  for (const [name, identities] of expectedGroups) {
    const group = screen.getByRole('region', { name, exact: true });
    assert.equal(within(group).getByRole('heading', { level: 2, name, exact: true }).textContent, `${name}${identities.length}`);
    assert.deepEqual([...group.querySelectorAll('article')].map(article => article.id), identities);
  }
  const articles = [...container.querySelectorAll('#comparisons article')];
  assert.deepEqual(articles.map(article => article.id), expectedGroups.flatMap(([, identities]) => identities));
  assert.equal(new Set(articles.map(article => article.id)).size, candidates.length);
});

test('candidate groups survive reordering, removal, and insertion without losing or duplicating artwork', () => {
  const original = [...candidates];
  const inserted = { ...original[0], id: 'grouping-regression', group: 'keys-keyholes' };
  try {
    for (const entries of [
      [...original].reverse(),
      original.filter(entry => entry !== original[0] && entry !== original.at(-1)),
      [inserted, ...original],
    ]) {
      candidates.splice(0, candidates.length, ...entries);
      const { container, unmount } = render(<LogoPreview />);
      const articles = [...container.querySelectorAll('#comparisons article')];
      const identities = entries.map(entry => `${entry.kind}-${entry.id}`);
      assert.equal(articles.length, entries.length);
      assert.deepEqual(new Set(articles.map(article => article.id)), new Set(identities));
      for (const [name, members] of expectedGroups) {
        const expected = new Set(members);
        if (name === 'Keys & keyholes') expected.add(`${inserted.kind}-${inserted.id}`);
        const group = screen.getByRole('region', { name, exact: true });
        assert.deepEqual([...group.querySelectorAll('article')].map(article => article.id),
          identities.filter(id => expected.has(id)));
      }
      for (const article of articles) {
        assert.equal(article.querySelector('.option-heading > span').textContent, String(identities.indexOf(article.id)));
      }
      unmount();
    }
  } finally {
    candidates.splice(0, candidates.length, ...original);
  }
});

test('new reference studies include reusable lockups and symbols at all three review sizes', () => {
  const { container } = render(<LogoPreview />);
  const additions = candidates.filter(entry => entry.kind === 'reference');
  assert.deepEqual(additions.map(entry => entry.name), ['Node K', 'Secret cell']);
  assert.equal(new Set(additions.map(entry => entry.symbol)).size, additions.length);
  for (const entry of additions) {
    assert.ok(entry.meaning && entry.source && entry.symbolSource);
    const article = container.querySelector(`#reference-${entry.id}`);
    for (const panel of article.querySelectorAll('.identity-preview')) {
      assert.deepEqual([...panel.querySelectorAll('.symbol-sizes > span')]
        .map(node => node.style.getPropertyValue('--symbol-size')), ['16px', '24px', '32px']);
    }
  }
});

test('React palette controls recolor every logo panel with the shared theme tokens', async () => {
  const user = userEvent.setup();
  const { container } = render(<LogoPreview />);
  assert.equal(screen.getByRole('button', { name: '2 Mono' }).getAttribute('aria-pressed'), 'true');
  for (const palette of palettes) {
    await user.click(screen.getByRole('button', { name: `${palette.number} ${palette.name}`, exact: true }));
    assert.ok(screen.getByRole('status').textContent.includes(`${palette.number} ${palette.name}`));
    assert.equal(container.querySelectorAll('[aria-pressed="true"]').length, 1);
    for (const panel of container.querySelectorAll('.identity-preview')) {
      for (const [role, color] of Object.entries(palette[panel.dataset.mode])) assert.equal(panel.style.getPropertyValue(`--${role}`), color);
    }
  }
});

test('the React entry uses local assets and has no runtime network dependency', () => {
  assert.match(read('index.html'), /lang="en"/);
  assert.match(read('../main.jsx'), /createRoot/);
  assert.doesNotMatch(read('LogoPreview.jsx'), /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
  assert.doesNotMatch(read('index.html'), /(?:src|href)="https?:\/\//);
});
