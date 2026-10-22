import { expect, test } from 'bun:test';

const stylesheet = await Bun.file(new URL('../style.css', import.meta.url)).text();

test('the selected desktop underline moves for 400ms with zero start and end velocity', () => {
  expect(stylesheet).toMatch(/@media \(width >= 64rem\) and \(prefers-reduced-motion: no-preference\)/);
  expect(stylesheet).toMatch(/a\[aria-current='page'\] > div\s*\{\s*view-transition-name: keysy-tab-indicator;/);
  const underline = stylesheet.match(/::view-transition-group\(keysy-tab-indicator\)\s*\{([^}]+)\}/)![1]!;
  expect(underline).toContain('animation-duration: 400ms');
  const [x1, y1, x2, y2] = underline.match(/cubic-bezier\(([^)]+)\)/)![1]!.split(',').map(Number);
  expect(x1).toBeGreaterThan(0);
  expect(x2).toBeLessThan(1);
  expect(y1! / x1!).toBe(0);
  expect((1 - y2!) / (1 - x2!)).toBe(0);
  expect(stylesheet).toMatch(/::view-transition-old\(keysy-tab-indicator\),\s*::view-transition-new\(keysy-tab-indicator\)\s*\{\s*animation: none;/);
});

test('appearance fades a single page snapshot instead of repeatedly transitioning inherited text colors', () => {
  expect(stylesheet).not.toContain('color 200ms ease-out');
  expect(stylesheet).toMatch(/html\.keysy-theme-transition::view-transition\s*\{\s*pointer-events: none;/);
  expect(stylesheet).toMatch(/html\.keysy-theme-transition \*::after\s*\{[^}]*transition: none !important;[^}]*view-transition-name: none !important;/);
  expect(stylesheet).toMatch(/html\.keysy-theme-transition::view-transition-old\(root\)\s*\{[^}]*display: block;[^}]*animation: keysy-theme-fade-out 300ms ease-in-out both;/);
  expect(stylesheet).toMatch(/html\.keysy-theme-transition::view-transition-new\(root\)\s*\{[^}]*animation: keysy-theme-fade-in 300ms ease-in-out both;/);
  expect(stylesheet).toMatch(/@keyframes keysy-theme-fade-out\s*\{\s*to\s*\{\s*opacity: 0;/);
  expect(stylesheet).toMatch(/@keyframes keysy-theme-fade-in\s*\{\s*from\s*\{\s*opacity: 0;/);
});

test('theme snapshots retain additive blending to avoid a midfade brightness shift', () => {
  expect(stylesheet).toMatch(/html\.keysy-theme-transition::view-transition-image-pair\(root\)\s*\{\s*isolation: isolate;/);
  expect(stylesheet).toMatch(/html\.keysy-theme-transition::view-transition-old\(root\),\s*html\.keysy-theme-transition::view-transition-new\(root\)\s*\{[^}]*mix-blend-mode: plus-lighter;/);
});
