import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test } from 'bun:test';
import LogoPreview from './LogoPreview.jsx';
import candidates from './candidates.json';
import { palettes } from '../theme/palettes.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('retained candidates keep their source artwork and removed candidates are absent', () => {
  assert.deepEqual(candidates.filter(entry => entry.kind === 'logo').map(entry => entry.id),
    ['02', '07', '08', '10', '11', '12', '13', '14', '15', '17', '18', '19', '20', '21', '22', '30', '31', '32', '35', '36']);
  assert.deepEqual(candidates.filter(entry => entry.kind === 'study').map(entry => entry.id), ['B']);
  assert.deepEqual(candidates.filter(entry => entry.kind === 'icon').map(entry => entry.id), ['B', 'D']);
  assert.deepEqual(candidates.filter(entry => entry.kind === 'generated').map(entry => entry.id),
    ['37', '40', '42', '43', '45', '46', '47', '48', '49', '51']);
  for (const entry of candidates) {
    for (const artwork of [entry.svg, entry.symbol].filter(Boolean)) {
      assert.match(artwork, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      assert.match(artwork, /currentColor/);
      assert.doesNotMatch(artwork, /<(?:text|image|script)\b|href=|\bvar\(/);
      assert.doesNotMatch(artwork, /\b(?:style|color|fill|stroke)="[^"]*#[0-9a-f]{3,8}\b/i);
    }
    if (entry.image) assert.match(entry.image, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
    if (entry.source) assert.equal(entry.svg, read(entry.source));
  }
});

test('the React grid preserves all 33 candidates, consecutive numbering, and both modes', () => {
  const { container } = render(<LogoPreview />);
  assert.equal(container.querySelectorAll('article').length, 33);
  assert.equal(container.querySelectorAll('.identity-preview').length, 66);
  assert.equal(container.querySelectorAll('.logo-art').length, 62);
  assert.equal(container.querySelectorAll('.icon-art:not(.icon-small)').length, 4);
  assert.deepEqual([...container.querySelectorAll('.option-heading > span')].map(node => node.textContent),
    Array.from({ length: 33 }, (_, index) => String(index)));
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
