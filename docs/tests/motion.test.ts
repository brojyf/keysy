import { expect, test } from 'bun:test';

const stylesheet = await Bun.file(new URL('../style.css', import.meta.url)).text();

test('desktop pages share only the selected tab underline for nonlinear navigation motion', () => {
  expect(stylesheet).toMatch(/@media \(width >= 64rem\) and \(prefers-reduced-motion: no-preference\)/);
  expect(stylesheet).toMatch(/a\[aria-current='page'\] > div\s*\{\s*view-transition-name: keysy-tab-indicator;/);
  expect(stylesheet).toMatch(/::view-transition-group\(keysy-tab-indicator\)\s*\{[^}]*animation-duration: 300ms;[^}]*animation-timing-function: cubic-bezier\(0\.32, 0\.72, 0, 1\);/);
  expect(stylesheet).toMatch(/::view-transition-old\(keysy-tab-indicator\),\s*::view-transition-new\(keysy-tab-indicator\)\s*\{\s*animation: none;/);
});

test('theme colors transition only during an explicit appearance switch without reduced motion', () => {
  expect(stylesheet).toMatch(/@media \(prefers-reduced-motion: no-preference\)\s*\{\s*html\.keysy-theme-transition/);
  expect(stylesheet).toContain('background-color 200ms ease-out');
  expect(stylesheet).toContain('color 200ms ease-out');
});
