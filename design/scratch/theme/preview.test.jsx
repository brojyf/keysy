import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock, test } from 'bun:test';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemePreview from './ThemePreview.jsx';
import SupabaseScreen from './SupabaseScreen.jsx';
import MintlifyScreen, { directoryRows } from './MintlifyScreen.jsx';
import { palettes } from './palettes.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('both React layouts render every retained palette in both modes with matching tokens', async () => {
  const user = userEvent.setup();
  const { container } = render(<ThemePreview />);
  for (const layout of ['Supabase Dashboard', 'Mintlify docs']) {
    await user.click(screen.getByRole('button', { name: layout, exact: true }));
    const gallery = container.querySelector('#palette-gallery');
    assert.equal(gallery.querySelectorAll('.palette-pair').length, 11);
    assert.equal(gallery.querySelectorAll('.mock-screen').length, 22);
    assert.equal(container.querySelector('.preview-count').textContent, '11 palettes · 2 layouts');
    assert.equal(container.querySelector('.preview-description').textContent, '11 color systems, from the first impression to the smallest detail.');
    for (const palette of palettes) for (const mode of ['light', 'dark']) {
      const preview = gallery.querySelector(`[data-palette="${palette.id}"][data-mode="${mode}"]`);
      assert.ok(preview);
      for (const [role, color] of Object.entries(palette[mode])) assert.equal(preview.style.getPropertyValue(`--${role}`), color);
    }
  }
});

test('a new reference palette restores from a shareable URL and expands in either mode', async () => {
  history.replaceState(null, '', '/?tab=theme&palette=terminal&layout=mintlify&mode=dark');
  const user = userEvent.setup();
  const { container } = render(<ThemePreview />);
  assert.equal(screen.getByRole('button', { name: '7 Terminal', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(container.querySelector('#focus-preview .mock-screen').dataset.palette, 'terminal');
  for (const mode of ['Light', 'Dark']) {
    await user.click(screen.getByRole('button', { name: `Expand 11 Evergreen ${mode}`, exact: true }));
    const focus = container.querySelector('#focus-preview .mock-screen');
    assert.equal(focus.dataset.palette, 'evergreen');
    assert.equal(focus.dataset.mode, mode.toLowerCase());
    assert.equal(new URLSearchParams(location.search).get('palette'), 'evergreen');
  }
});

test('palette, mode, and layout controls update the focused preview and shareable URL', async () => {
  const user = userEvent.setup();
  const { container } = render(<ThemePreview />);
  await user.click(screen.getByRole('button', { name: '5 Cocoa / Ice', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Dark', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Mintlify docs', exact: true }));
  const focus = container.querySelector('#focus-preview .mock-screen');
  assert.equal(focus.dataset.palette, 'cocoaice');
  assert.equal(focus.dataset.mode, 'dark');
  assert.ok(focus.classList.contains('mintlify'));
  assert.equal(screen.getByRole('button', { name: 'Dark', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(screen.getByRole('button', { name: 'Mintlify docs', exact: true }).getAttribute('aria-pressed'), 'true');
  const params = new URLSearchParams(location.search);
  assert.equal(params.get('palette'), 'cocoaice');
  assert.equal(params.get('layout'), 'mintlify');
  assert.equal(params.get('mode'), 'dark');
});

test('expanding a comparison selects its exact palette and mode and scrolls to focus', async () => {
  const user = userEvent.setup();
  const { container } = render(<ThemePreview />);
  await user.click(screen.getByRole('button', { name: 'Expand 6 Ink / Iris Dark', exact: true }));
  assert.equal(container.querySelector('#focus-title').textContent, '6 Ink / Iris');
  assert.equal(container.querySelector('#focus-preview .mock-screen').dataset.mode, 'dark');
  assert.equal(container.querySelector('#focus-preview .mock-screen').dataset.palette, 'inkiris');
  assert.equal(Element.prototype.scrollIntoView.mock.calls.length, 1);
});

test('valid URLs restore selections without dropping unrelated parameters or hashes', () => {
  history.replaceState(null, '', '/theme/?layout=mintlify&palette=slate&mode=dark&review=1#comparison');
  const { container } = render(<ThemePreview />);
  const focus = container.querySelector('#focus-preview .mock-screen');
  assert.equal(focus.dataset.palette, 'slate');
  assert.equal(focus.dataset.mode, 'dark');
  assert.ok(focus.classList.contains('mintlify'));
  assert.equal(new URLSearchParams(location.search).get('review'), '1');
  assert.equal(location.hash, '#comparison');
});

for (const id of ['missing', 'olive', 'ochre', 'pinechalk', 'aubergineceladon', 'oxblood', 'petrol', 'plum', 'navyrose']) {
  test(`invalid URL palette ${id} falls back and removed choices stay absent`, () => {
    history.replaceState(null, '', `/theme/?layout=invalid&palette=${id}&mode=invalid`);
    const { container } = render(<ThemePreview />);
    const focus = container.querySelector('#focus-preview .mock-screen');
    assert.equal(focus.dataset.palette, 'blue');
    assert.equal(focus.dataset.mode, 'light');
    assert.ok(focus.classList.contains('supabase'));
    assert.equal(container.querySelector(`button[data-palette="${id}"]`), null);
    assert.equal(container.querySelector(`[data-palette="${id}"]`), null);
  });
}

test('Mintlify React preview retains copied documentation rows and navigation', () => {
  const rows = [...read('mintlify-copy/index.mdx').matchAll(/^\| `([^`]+)` \| (.+) \|$/gm)].map(match => [match[1], match[2]]);
  assert.deepEqual(directoryRows, rows);
  const { container } = render(<MintlifyScreen />);
  const config = JSON.parse(read('mintlify-copy/docs.json'));
  assert.deepEqual([...container.querySelectorAll('.mint-topnav > span')].map(node => node.textContent), config.navigation.tabs.map(({ tab }) => tab));
  assert.ok(container.textContent.includes("Understand Keysy's monorepo and find the code you need."));
  assert.equal(container.querySelectorAll('tr').length, rows.length + 1);
});

test('Supabase React mock retains the table, selected row, masked value, and secret details', () => {
  const { container } = render(<SupabaseScreen />);
  assert.equal(container.querySelectorAll('tr').length, 7);
  assert.equal(container.querySelectorAll('.selected-row').length, 1);
  for (const text of ['STRIPE_SECRET_KEY', 'AuthKey_Q7X9.p8', 'production-readonly', 'Secret details', '••••••••••••••••']) assert.ok(container.textContent.includes(text));
  assert.equal(container.querySelector('button, input, form'), null);
});

test('screen scaling follows viewport measurements and disconnects observers on unmount', () => {
  const observers = [];
  globalThis.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.disconnect = mock(() => {});
      observers.push(this);
    }
    observe(target) { this.target = target; }
  };
  const { unmount } = render(<ThemePreview />);
  assert.equal(observers.length, 23);
  act(() => observers[0].callback([{ target: observers[0].target, contentRect: { width: 600 } }]));
  assert.equal(observers[0].target.style.getPropertyValue('--screen-scale'), '0.5');
  unmount();
  for (const observer of observers) assert.equal(observer.disconnect.mock.calls.length, 1);
});

test('React previews use only local runtime assets and no product services', () => {
  assert.doesNotMatch(read('index.html'), /(?:src|href)="https?:\/\//);
  for (const file of ['ThemePreview.jsx', 'SupabaseScreen.jsx', 'MintlifyScreen.jsx']) {
    assert.doesNotMatch(read(file), /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
    assert.doesNotMatch(read(file), /innerHTML|querySelector/);
  }
  assert.match(read('../main.jsx'), /createRoot/);
});
