import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CssPreview from './CssPreview';
import DesignStudio from '../DesignStudio.jsx';

test('CSS choices expose all nine integrations and shared palettes with one isolated preview', () => {
  render(<CssPreview />);
  assert.equal(within(screen.getByRole('group', { name: 'CSS library' })).getAllByRole('button').length, 9);
  assert.equal(within(screen.getByRole('group', { name: 'CSS palette' })).getAllByRole('button').length, 9);
  const frame = screen.getByTitle('Radix Themes interactive preview');
  assert.equal(frame.getAttribute('src'), '/css/frame.html?library=radix-themes&cssPalette=blue&cssMode=light');
  assert.equal(screen.getByRole('complementary', { name: 'CSS preview choices' }).contains(frame), false);
});

test('library, palette, and appearance changes update the iframe and preserve unrelated URL values', async () => {
  history.replaceState(null, '', '/theme/?tab=css&library=shadcn&cssPalette=evergreen&cssMode=dark&palette=slate&mode=light&review=1#comparison');
  const user = userEvent.setup();
  render(<CssPreview />);
  assert.ok(screen.getByTitle('shadcn/ui + tweakcn interactive preview'));
  await user.click(screen.getByRole('button', { name: 'Intent UI Copied React components' }));
  await user.click(screen.getByRole('button', { name: '04 Slate' }));
  await user.click(screen.getByRole('button', { name: 'Light', exact: true }));
  assert.equal(screen.getByTitle('Intent UI interactive preview').getAttribute('src'), '/css/frame.html?library=intent&cssPalette=slate&cssMode=light');
  const params = new URLSearchParams(location.search);
  for (const [key, value] of Object.entries({ library: 'intent', cssPalette: 'slate', cssMode: 'light', palette: 'slate', mode: 'light', review: '1', tab: 'css' })) assert.equal(params.get(key), value);
  assert.equal(location.hash, '#comparison');
});

test('inactive CSS previews do not mount an iframe or write URL parameters', async () => {
  const user = userEvent.setup();
  render(<CssPreview active={false} />);
  await user.click(screen.getByRole('button', { name: 'Geist reference Specification reference' }));
  assert.equal(document.querySelector('iframe'), null);
  assert.equal(location.search, '');
  assert.ok(screen.getByText(/not an official installable Geist component package/));
});

test('the CSS tab restores selections and retains them across other studio tabs', async () => {
  history.replaceState(null, '', '/css/?library=coss&cssPalette=orchid&cssMode=dark');
  const user = userEvent.setup();
  render(<DesignStudio />);
  assert.equal(screen.getByRole('tab', { name: 'CSS', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(document.title, 'Keysy — CSS · Design Studio');
  assert.match(screen.getByTitle('coss ui interactive preview').getAttribute('src')!, /cssPalette=orchid&cssMode=dark/);
  await user.click(screen.getByRole('tab', { name: 'Theme', exact: true }));
  assert.equal(document.querySelector('iframe'), null);
  await user.click(screen.getByRole('tab', { name: 'CSS', exact: true }));
  assert.equal(screen.getByRole('button', { name: 'coss ui Copied React components' }).getAttribute('aria-pressed'), 'true');
  assert.match(screen.getByTitle('coss ui interactive preview').getAttribute('src')!, /cssPalette=orchid&cssMode=dark/);
});
