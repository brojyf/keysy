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

test('the theme workspace starts with an untitled preview beside the full-height color rail', () => {
  const { container } = render(<ThemePreview />);
  assert.equal(container.querySelector('.theme-workspace').firstElementChild.className, 'theme-split');
  const preview = screen.getByRole('region', { name: 'Theme preview', exact: true });
  assert.equal(preview.firstElementChild.className, 'theme-preview-stage');
  assert.equal(container.querySelector('.preview-heading, .section-heading, #focus-title'), null);
  assert.equal(screen.getByRole('status').textContent, '1 Ink · Supabase Dashboard / Light');
});

test('the theme workspace separates the preview and its controls from scrollable color choices', () => {
  const { container } = render(<ThemePreview />);
  const workspace = container.querySelector('.theme-split');
  assert.equal(workspace.children.length, 2);
  const [preview, choices] = workspace.children;
  assert.ok(preview.classList.contains('theme-preview-pane'));
  assert.ok(choices.classList.contains('theme-palette-panel'));
  assert.ok(preview.querySelector('#focus-preview'));
  assert.ok(preview.querySelector('[aria-label="Reference layout"]'));
  assert.ok(preview.querySelector('[aria-label="Appearance mode"]'));
  assert.ok(preview.querySelector('#focus-preview').compareDocumentPosition(preview.querySelector('.theme-options-row')) & Node.DOCUMENT_POSITION_FOLLOWING);
  const scroll = screen.getByRole('region', { name: 'Color choices', exact: true });
  assert.ok(choices.contains(scroll));
  assert.equal(scroll.tabIndex, 0);
  assert.equal(scroll.querySelectorAll('button').length, palettes.length);
  assert.equal(container.querySelector('#comparison, #palette-gallery, .gallery-link'), null);
  assert.equal(screen.queryByRole('button', { name: /^Expand / }), null);
});

test('color choices include swatches and thumbnails matching both layouts and appearance modes', async () => {
  const user = userEvent.setup();
  const { container } = render(<ThemePreview />);
  for (const layout of ['Supabase Dashboard', 'Mintlify docs']) {
    await user.click(screen.getByRole('button', { name: layout, exact: true }));
    for (const mode of ['light', 'dark']) {
      await user.click(screen.getByRole('button', { name: mode === 'light' ? 'Light' : 'Dark', exact: true }));
      const choices = screen.getByRole('group', { name: 'Theme palette', exact: true });
      assert.equal(choices.querySelectorAll('.mock-screen').length, palettes.length);
      for (const palette of palettes) {
        const choice = choices.querySelector(`button[data-palette="${palette.id}"]`);
        assert.ok(choice);
        assert.equal(choice.querySelectorAll('.palette-swatches i').length, 4);
        const card = choice.closest('.theme-color-choice');
        assert.equal(card.querySelector('.theme-choice-preview').getAttribute('aria-hidden'), 'true');
        const preview = card.querySelector('.mock-screen');
        assert.equal(preview.dataset.palette, palette.id);
        assert.equal(preview.dataset.mode, mode);
        assert.ok(preview.classList.contains(layout === 'Supabase Dashboard' ? 'supabase' : 'mintlify'));
        for (const [role, color] of Object.entries(palette[mode])) assert.equal(preview.style.getPropertyValue(`--${role}`), color);
      }
    }
  }
  assert.equal(container.querySelector('.theme-palette-heading > span').textContent, '7 choices');
});

test('a reference palette restores from a shareable URL and choices retain the current layout and mode', async () => {
  history.replaceState(null, '', '/?tab=theme&palette=terminal&layout=mintlify&mode=dark');
  const user = userEvent.setup();
  const { container } = render(<ThemePreview />);
  assert.equal(screen.getByRole('button', { name: '7 Terminal', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(container.querySelector('#focus-preview .mock-screen').dataset.palette, 'terminal');
  for (const mode of ['Light', 'Dark']) {
    await user.click(screen.getByRole('button', { name: mode, exact: true }));
    await user.click(screen.getByRole('button', { name: '10 Evergreen', exact: true }));
    const focus = container.querySelector('#focus-preview .mock-screen');
    assert.equal(focus.dataset.palette, 'evergreen');
    assert.equal(focus.dataset.mode, mode.toLowerCase());
    assert.ok(focus.classList.contains('mintlify'));
    const params = new URLSearchParams(location.search);
    assert.equal(params.get('palette'), 'evergreen');
    assert.equal(params.get('mode'), mode.toLowerCase());
    assert.equal(params.get('layout'), 'mintlify');
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

test('keyboard selection updates the preview without scrolling away from the color choices', async () => {
  const user = userEvent.setup();
  const { container } = render(<ThemePreview />);
  const choice = screen.getByRole('button', { name: '6 Ink / Iris', exact: true });
  choice.focus();
  await user.keyboard('{Enter}');
  assert.equal(screen.getByRole('status').textContent, '6 Ink / Iris · Supabase Dashboard / Light');
  assert.equal(container.querySelector('#focus-preview .mock-screen').dataset.palette, 'inkiris');
  assert.equal(choice.getAttribute('aria-pressed'), 'true');
  assert.equal(document.activeElement, choice);
  assert.equal(screen.getByRole('button', { name: '1 Ink', exact: true }).getAttribute('aria-pressed'), 'false');
  assert.equal(Element.prototype.scrollIntoView.mock.calls.length, 0);
});

test('valid URLs restore selections without dropping unrelated parameters or hashes', () => {
  history.replaceState(null, '', '/theme/?layout=mintlify&palette=terminal&mode=dark&review=1#comparison');
  const { container } = render(<ThemePreview />);
  const focus = container.querySelector('#focus-preview .mock-screen');
  assert.equal(focus.dataset.palette, 'terminal');
  assert.equal(focus.dataset.mode, 'dark');
  assert.ok(focus.classList.contains('mintlify'));
  assert.equal(new URLSearchParams(location.search).get('review'), '1');
  assert.equal(location.hash, '#comparison');
});

for (const id of ['missing', 'slate', 'ember', 'cobalt', 'citron', 'olive', 'ochre', 'pinechalk', 'aubergineceladon', 'oxblood', 'petrol', 'plum', 'navyrose']) {
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
  assert.equal(observers.length, 8);
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
