import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DesignStudio from './DesignStudio.jsx';
import candidates from './logo/candidates.json';
import { palettes as themePalettes } from '../theme/palettes.js';

test('the studio exposes only Logo and CSS tabs with one visible panel', () => {
  const { container } = render(<DesignStudio />);
  assert.equal(container.querySelector('.design-meta').textContent, `${candidates.length} marks · ${themePalettes.length} color systems`);
  const logo = screen.getByRole('tab', { name: 'Logo', exact: true });
  const css = screen.getByRole('tab', { name: 'CSS', exact: true });
  assert.equal(logo.getAttribute('aria-selected'), 'true');
  assert.equal(logo.tabIndex, 0);
  assert.equal(css.tabIndex, -1);
  assert.deepEqual(screen.getAllByRole('tab').map(tab => tab.textContent), ['Logo', 'CSS']);
  assert.equal(container.querySelector('#panel-theme'), null);
  const panel = screen.getByRole('tabpanel', { name: 'Logo', exact: true });
  assert.equal(screen.queryByRole('group', { name: 'Logo palette' }), null);
  assert.equal(panel.id, logo.getAttribute('aria-controls'));
  assert.equal(screen.getAllByRole('tabpanel').length, 1);
  assert.equal(document.title, 'Keysy — Logo · Design Studio');
});

test('switching tabs retains CSS choices and updates the shareable tab URL', async () => {
  const user = userEvent.setup();
  render(<DesignStudio />);
  await user.click(screen.getByRole('tab', { name: 'CSS', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Intent UI Copied React components', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Dark', exact: true }));
  assert.equal(new URLSearchParams(location.search).get('tab'), 'css');
  await user.click(screen.getByRole('tab', { name: 'Logo', exact: true }));
  assert.equal(screen.queryByRole('group', { name: 'Logo palette' }), null);
  assert.equal(new URLSearchParams(location.search).get('tab'), 'logo');
  assert.equal(screen.queryByTitle('Intent UI interactive preview'), null);
  await user.click(screen.getByRole('tab', { name: 'CSS', exact: true }));
  assert.equal(screen.getByTitle('Intent UI interactive preview').getAttribute('src'), '/css/frame.html?library=intent&cssPalette=blue&cssMode=dark');
  assert.equal(document.title, 'Keysy — CSS · Design Studio');
});

test('arrow, Home, and End keys activate and focus tabs without entering hidden controls', async () => {
  const user = userEvent.setup();
  render(<DesignStudio />);
  const logo = screen.getByRole('tab', { name: 'Logo', exact: true });
  const css = screen.getByRole('tab', { name: 'CSS', exact: true });
  logo.focus();
  for (const [key, target] of [['{ArrowRight}', css], ['{ArrowRight}', logo], ['{ArrowLeft}', css], ['{Home}', logo], ['{End}', css]]) {
    await user.keyboard(key);
    assert.equal(document.activeElement, target);
    assert.equal(target.getAttribute('aria-selected'), 'true');
    assert.equal(screen.getAllByRole('tabpanel').length, 1);
  }
});

for (const path of ['/logo/', '/logo/index.html', '/css/', '/css/index.html']) {
  test(`legacy entry ${path} opens the matching studio tab`, () => {
    history.replaceState(null, '', path);
    render(<DesignStudio />);
    const name = path.includes('/css') ? 'CSS' : 'Logo';
    assert.equal(screen.getByRole('tab', { name, exact: true }).getAttribute('aria-selected'), 'true');
  });
}

test('a shareable CSS URL restores its controls and preserves unrelated parameters', () => {
  history.replaceState(null, '', '/?tab=css&library=shadcn&cssPalette=blue&cssMode=dark&review=1#comparison');
  render(<DesignStudio />);
  assert.equal(screen.getByRole('tab', { name: 'CSS', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(screen.getByTitle('shadcn/ui + tweakcn interactive preview').getAttribute('src'), '/css/frame.html?library=shadcn&cssPalette=blue&cssMode=dark');
  assert.equal(new URLSearchParams(location.search).get('review'), '1');
  assert.equal(location.hash, '#comparison');
});

test('an explicit tab overrides an entry path and hidden CSS updates do not change its URL', () => {
  history.replaceState(null, '', '/css/?tab=logo&review=1');
  render(<DesignStudio />);
  assert.equal(screen.getByRole('tab', { name: 'Logo', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(screen.queryByRole('button', { name: '3 Cobalt', exact: true }), null);
  assert.equal(new URLSearchParams(location.search).get('cssPalette'), null);
  assert.equal(new URLSearchParams(location.search).get('review'), '1');
  assert.equal(screen.queryByRole('group', { name: 'Logo palette' }), null);
});

test('a removed Theme tab falls back to Logo', () => {
  history.replaceState(null, '', '/?tab=theme');
  render(<DesignStudio />);
  assert.equal(screen.getByRole('tab', { name: 'Logo', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(new URLSearchParams(location.search).get('tab'), 'logo');
});
