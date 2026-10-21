import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import DesignStudio from './DesignStudio.jsx';
import candidates from './logo/candidates.json';
import { palettes } from '../theme/palettes.js';

for (const path of ['/', '/logo/', '/logo/index.html']) {
  test(`entry ${path} shows only the logo study without experiment tabs`, () => {
    history.replaceState(null, '', path);
    const { container } = render(<DesignStudio />);
    assert.equal(container.querySelector('.design-meta').textContent, `${candidates.length} marks · ${palettes.length} color systems`);
    assert.equal(screen.getAllByRole('article').length, candidates.length);
    assert.equal(screen.queryByRole('tablist'), null);
    assert.equal(screen.queryByRole('tab'), null);
    assert.equal(container.querySelector('iframe, #panel-css, #panel-theme'), null);
    assert.equal(document.title, 'Keysy — Logo · Design Studio');
  });
}

test('legacy tab parameters do not restore removed experiments or change the URL', () => {
  const path = '/?tab=css&review=1#comparison';
  history.replaceState(null, '', path);
  const { container } = render(<DesignStudio />);
  assert.equal(screen.getAllByRole('article').length, candidates.length);
  assert.equal(container.querySelector('iframe'), null);
  assert.equal(location.pathname + location.search + location.hash, path);
});

test('CSS selection is documented outside scratch without a runnable comparison', () => {
  assert.equal(existsSync(new URL('./css', import.meta.url)), false);
  const decision = readFileSync(new URL('../css/README.md', import.meta.url), 'utf8');
  for (const choice of ['shadcn/ui', 'Radix', 'tweakcn', 'Geist Sans', 'Geist Mono', 'Vercel Geist', '../theme/README.md']) {
    assert.ok(decision.includes(choice), `CSS selection must document ${choice}`);
  }
  const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), ['react', 'react-dom']);
  assert.equal(Object.hasOwn(manifest.scripts, 'test:browser'), false);
  assert.equal(Object.hasOwn(manifest.scripts, 'typecheck'), false);
});
