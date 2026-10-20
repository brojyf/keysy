import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DesignStudio from './DesignStudio.jsx';

test('the studio starts with accessible Logo tabs and one visible panel', () => {
  const { container } = render(<DesignStudio />);
  assert.equal(container.querySelector('.design-meta').textContent, '29 marks · 9 color systems');
  const logo = screen.getByRole('tab', { name: 'Logo', exact: true });
  const theme = screen.getByRole('tab', { name: 'Theme', exact: true });
  assert.equal(logo.getAttribute('aria-selected'), 'true');
  assert.equal(logo.tabIndex, 0);
  assert.equal(theme.tabIndex, -1);
  const panel = screen.getByRole('tabpanel', { name: 'Logo', exact: true });
  assert.equal(panel.id, logo.getAttribute('aria-controls'));
  assert.equal(screen.getAllByRole('tabpanel').length, 1);
  assert.equal(document.title, 'Keysy — Logo · Design Studio');
});

test('switching tabs retains each preview selection and updates the shareable tab URL', async () => {
  const user = userEvent.setup();
  const { container } = render(<DesignStudio />);
  await user.click(screen.getByRole('button', { name: '4 Slate', exact: true }));
  await user.click(screen.getByRole('tab', { name: 'Theme', exact: true }));
  await user.click(screen.getByRole('button', { name: '5 Cocoa / Ice', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Mintlify docs', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Dark', exact: true }));
  assert.equal(new URLSearchParams(location.search).get('tab'), 'theme');
  await user.click(screen.getByRole('tab', { name: 'Logo', exact: true }));
  assert.equal(screen.getByRole('button', { name: '4 Slate', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(new URLSearchParams(location.search).get('tab'), 'logo');
  await user.click(screen.getByRole('tab', { name: 'Theme', exact: true }));
  const focus = container.querySelector('#focus-preview .mock-screen');
  assert.equal(focus.dataset.palette, 'cocoaice');
  assert.equal(focus.dataset.mode, 'dark');
  assert.ok(focus.classList.contains('mintlify'));
  assert.equal(screen.getByRole('button', { name: '5 Cocoa / Ice', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(document.title, 'Keysy — Theme · Design Studio');
});

test('arrow, Home, and End keys activate and focus tabs without entering hidden controls', async () => {
  const user = userEvent.setup();
  render(<DesignStudio />);
  const logo = screen.getByRole('tab', { name: 'Logo', exact: true });
  const theme = screen.getByRole('tab', { name: 'Theme', exact: true });
  const css = screen.getByRole('tab', { name: 'CSS', exact: true });
  logo.focus();
  for (const [key, target] of [['{ArrowRight}', theme], ['{ArrowRight}', css], ['{ArrowRight}', logo], ['{ArrowLeft}', css], ['{Home}', logo], ['{End}', css]]) {
    await user.keyboard(key);
    assert.equal(document.activeElement, target);
    assert.equal(target.getAttribute('aria-selected'), 'true');
    assert.equal(screen.getAllByRole('tabpanel').length, 1);
  }
});

for (const path of ['/logo/', '/logo/index.html', '/theme/', '/theme/index.html', '/css/', '/css/index.html']) {
  test(`legacy entry ${path} opens the matching studio tab`, () => {
    history.replaceState(null, '', path);
    render(<DesignStudio />);
    const name = path.includes('/css') ? 'CSS' : path.includes('/theme') ? 'Theme' : 'Logo';
    assert.equal(screen.getByRole('tab', { name, exact: true }).getAttribute('aria-selected'), 'true');
  });
}

test('a shareable theme URL restores both its tab and theme controls', () => {
  history.replaceState(null, '', '/?tab=theme&layout=mintlify&palette=slate&mode=dark&review=1#comparison');
  const { container } = render(<DesignStudio />);
  assert.equal(screen.getByRole('tab', { name: 'Theme', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(screen.getByRole('button', { name: '4 Slate', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(container.querySelector('#focus-preview .mock-screen').dataset.mode, 'dark');
  assert.equal(new URLSearchParams(location.search).get('review'), '1');
  assert.equal(location.hash, '#comparison');
});

test('an explicit tab overrides a legacy path and hidden theme updates do not change its URL', async () => {
  const user = userEvent.setup();
  history.replaceState(null, '', '/theme/?tab=logo&review=1');
  render(<DesignStudio />);
  assert.equal(screen.getByRole('tab', { name: 'Logo', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(screen.queryByRole('button', { name: '3 Cobalt', exact: true }), null);
  await user.click(screen.getByRole('button', { name: '7 Terminal', exact: true }));
  assert.equal(new URLSearchParams(location.search).get('palette'), null);
  assert.equal(new URLSearchParams(location.search).get('review'), '1');
  const palettes = within(screen.getByRole('tabpanel', { name: 'Logo', exact: true })).getByRole('group', { name: 'Logo palette' });
  assert.equal(within(palettes).getAllByRole('button').length, 9);
});
