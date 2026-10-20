import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test } from 'bun:test';
import LogoPreview from './LogoPreview.jsx';
import candidates from './candidates.json';
import { palettes } from '../theme/palettes.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('retained candidates keep their source artwork and removed candidates are absent', () => {
  assert.deepEqual(candidates.filter(entry => entry.kind === 'logo').map(entry => entry.id),
    ['10', '11', '13', '19', '21', '31', '32']);
  assert.deepEqual(candidates.filter(entry => entry.kind === 'study').map(entry => entry.id), ['B']);
  assert.deepEqual(candidates.filter(entry => entry.kind === 'icon').map(entry => entry.id), ['D']);
  assert.deepEqual(candidates.filter(entry => entry.kind === 'generated').map(entry => entry.id),
    ['40', '42', '43', '45', '46', '47', '48', '49']);
  assert.deepEqual(candidates.filter(entry => entry.kind === 'reference').map(entry => entry.id),
    ['52', '54', '55']);
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

test('the React grid preserves all 20 candidates, consecutive numbering, and both modes', () => {
  const { container } = render(<LogoPreview />);
  assert.equal(container.querySelectorAll('article').length, 20);
  assert.equal(container.querySelector('.preview-description').textContent, '20 directions. One color system. See what feels like Keysy.');
  assert.equal(container.querySelector('.preview-count').textContent, '20 candidates · 0–19');
  assert.equal(container.querySelector('.collection-heading h2 span').textContent, '20');
  assert.equal(container.querySelectorAll('.identity-preview').length, 40);
  assert.equal(container.querySelectorAll('.logo-art').length, 38);
  assert.equal(container.querySelectorAll('.icon-art:not(.icon-small)').length, 2);
  assert.deepEqual([...container.querySelectorAll('.option-heading > span')].map(node => node.textContent),
    Array.from({ length: 20 }, (_, index) => String(index)));
  assert.equal(container.querySelector('#generated-51, #reference-53'), null);
  assert.equal(screen.queryByRole('heading', { name: 'Cipher / Plain', exact: true }), null);
  assert.equal(screen.queryByRole('heading', { name: 'Notch K', exact: true }), null);
  assert.deepEqual([...container.querySelectorAll('article')].slice(17).map(article => [
    article.querySelector('.option-heading > span').textContent,
    article.querySelector('h3').textContent,
  ]), [['17', 'Node K'], ['18', 'Relay'], ['19', 'Secret cell']]);
  for (const entry of candidates) {
    const article = container.querySelector(`#${entry.kind}-${entry.id}`);
    assert.equal(article.querySelectorAll('.theme-preview').length, 2);
    if (entry.svg) {
      assert.equal(article.querySelector('.logo-art').innerHTML, new DOMParser().parseFromString(entry.svg, 'text/html').body.innerHTML);
      assert.equal(article.querySelector('.small-logo').querySelectorAll(':scope > span').length, 1,
        'only the size label may inherit the muted span color, not the SVG wrapper');
    }
  }
});

test('new reference studies include reusable lockups and symbols at all three review sizes', () => {
  const { container } = render(<LogoPreview />);
  const additions = candidates.filter(entry => entry.kind === 'reference');
  assert.deepEqual(additions.map(entry => entry.name), ['Node K', 'Relay', 'Secret cell']);
  assert.equal(new Set(additions.map(entry => entry.symbol)).size, 3);
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
