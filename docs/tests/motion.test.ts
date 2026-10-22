import { expect, test } from 'bun:test';

const stylesheet = await Bun.file(new URL('../style.css', import.meta.url)).text();

test('desktop pages share only the selected tab underline for nonlinear navigation motion', () => {
  expect(stylesheet).toMatch(/@media \(width >= 64rem\) and \(prefers-reduced-motion: no-preference\)/);
  expect(stylesheet).toMatch(/a\[aria-current='page'\] > div\s*\{\s*view-transition-name: keysy-tab-indicator;/);
  expect(stylesheet).toMatch(/::view-transition-group\(keysy-tab-indicator\)\s*\{[^}]*animation-duration: 500ms;[^}]*animation-timing-function: cubic-bezier\(0\.32, 0\.72, 0, 1\);/);
  expect(stylesheet).toMatch(/::view-transition-old\(keysy-tab-indicator\),\s*::view-transition-new\(keysy-tab-indicator\)\s*\{\s*animation: none;/);
});

test('appearance fades a single page snapshot instead of repeatedly transitioning inherited text colors', () => {
  expect(stylesheet).not.toContain('color 200ms ease-out');
  expect(stylesheet).toMatch(/html\.keysy-theme-transition::view-transition\s*\{\s*pointer-events: none;/);
  expect(stylesheet).toMatch(/html\.keysy-theme-transition \*::after\s*\{[^}]*transition: none !important;[^}]*view-transition-name: none !important;/);
  expect(stylesheet).toMatch(/html\.keysy-theme-transition::view-transition-old\(root\)\s*\{[^}]*display: block;[^}]*animation: keysy-theme-fade-out 200ms ease-out both;/);
  expect(stylesheet).toMatch(/html\.keysy-theme-transition::view-transition-new\(root\)\s*\{[^}]*animation: keysy-theme-fade-in 200ms ease-out both;/);
  expect(stylesheet).toMatch(/@keyframes keysy-theme-fade-out\s*\{\s*to\s*\{\s*opacity: 0;/);
  expect(stylesheet).toMatch(/@keyframes keysy-theme-fade-in\s*\{\s*from\s*\{\s*opacity: 0;/);
});
