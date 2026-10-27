import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import config from '../sourcey.config';

const docs = new URL('../', import.meta.url);
const stylesheet = await Bun.file(new URL('style.css', docs)).text();

function contrast(foreground: string, background: string) {
  function luminance(hex: string) {
    const rgb = hex.slice(1).match(/../g)!.map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
  }
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

test('navbar uses the native GitHub brand icon with an accessible label', () => {
  expect(config.navbar?.links).toContainEqual({
    type: 'github',
    label: 'GitHub',
    href: 'https://github.com/brojyf/keysy',
  });
});

test('native theme loads both Geist families and the brand stylesheet', () => {
  expect(config.theme?.fonts).toEqual({ sans: 'Geist', mono: 'Geist Mono' });
  expect(config.theme?.css).toEqual(['./style.css']);
  expect(stylesheet).not.toContain('mintlify');
});

test('page headers hide redundant descriptions and retain the page title', () => {
  expect(stylesheet).toMatch(/#sourcey \.page-description\s*\{\s*display: none;\s*\}/);
  expect(stylesheet).not.toMatch(/(?:h1|> header)\s*\{[^}]*display: none;/);
});

test('plain search page titles use the UI font without overriding method and path rows', () => {
  expect(stylesheet).toMatch(/#sourcey \.search-result-main > \.search-result-path:only-child\s*\{\s*font-family: var\(--font-sans\);/);
  expect(stylesheet).not.toMatch(/#sourcey \.search-result-path\s*\{[^}]*font-family:/);
});

test('search method badges use the sidebar method colors in both themes', async () => {
  const sidebar = await readFile(new URL('node_modules/sourcey/dist/components/layout/Sidebar.js', docs), 'utf8');
  for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']) {
    const classes = sidebar.match(new RegExp(`${method}: "([^"]+)"`))![1]!;
    const [, lightBackground] = classes.match(/(?:^| )bg-(\S+)/)!;
    const [, darkBackground] = classes.match(/dark:bg-(\S+)\/20/)!;
    const [, lightText] = classes.match(/(?:^| )text-(\S+)/)!;
    const [, darkText] = classes.match(/dark:text-(\S+)/)!;
    const selector = `#sourcey .search-result-method.method-${method.toLowerCase()}`;
    expect(stylesheet).toContain(`${selector} {\n  background: var(--color-${lightBackground});\n  color: var(--color-${lightText});\n}`);
    expect(stylesheet).toContain(`.dark ${selector} {\n  background: color-mix(in oklab, var(--color-${darkBackground}) 20%, transparent);\n  color: var(--color-${darkText});\n}`);
  }
});

test('search section headings use bold primary text in both themes', () => {
  expect(stylesheet).toMatch(/#sourcey #search-dialog \.search-category\s*\{\s*font-weight: 700;\s*color: var\(--keysy-text\);/);
});

test('the documentation logo is 48px tall and preserves its aspect ratio', () => {
  expect(stylesheet).toMatch(/#sourcey \.sourcey-logo img\s*\{\s*height: 3rem;\s*width: auto;/);
});

test('both logo variants share an outlined Geist SemiBold wordmark without font requests', async () => {
  const variants = await Promise.all(['light', 'dark'].map(async (mode) => {
    const svg = await Bun.file(new URL(`logo/${mode}.svg`, docs)).text();
    expect(svg).toContain('<desc>Keysy logo with a Geist SemiBold wordmark.</desc>');
    // Same mark as design/logo/logo.svg: the wordmark is tracked −4%, so it runs wider than 234.
    expect(svg).toContain('width="241.14" height="85" viewBox="0 0 241.14 85"');
    expect(svg).not.toMatch(/<text\b|<image\b|<foreignObject\b|@font-face|font-family=/);
    const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((match) => match[1]);
    expect(paths).toHaveLength(3);
    expect(paths[0]).toBe('M6.5 23H24.375V31.125H14.625V53.875H37.375V44.125H45.5V62H6.5V23Z');
    expect(paths[1]).toBe('M21.125 37.625H30.875V27.875H45.5V36H39V47.375H21.125V37.625Z');
    expect(paths[2]!.length).toBeGreaterThan(100);
    return paths;
  }));
  expect(variants[0]).toEqual(variants[1]);
});

test('the drawer container has no initial focus outline', () => {
  expect(stylesheet).toMatch(/#sourcey #mobile-nav:focus\s*\{\s*outline: none;/);
});

test('drawer logo removes the automatic blue outline but keeps a neutral keyboard focus indicator', () => {
  expect(stylesheet).toMatch(/#sourcey #mobile-nav \.sourcey-logo:focus\s*\{\s*outline: none;/);
  expect(stylesheet).toMatch(/#sourcey #mobile-nav \.sourcey-logo:focus-visible\s*\{\s*outline: 2px solid var\(--keysy-text\);/);
});

test('search and appearance icons have heavier strokes without resizing their SVGs', () => {
  expect(stylesheet).toMatch(/#sourcey #search-open svg,\s*#sourcey #search-open-mobile svg,\s*#sourcey #theme-toggle svg\s*\{\s*stroke-width: 3;/);
  expect(stylesheet).toMatch(/#sourcey #theme-toggle svg g\s*\{\s*stroke-width: 2;/);
});

test('native drawer closing retains its display and top-layer overlay during the slide', () => {
  expect(stylesheet).toMatch(/#sourcey #mobile-nav\s*\{[^}]*transform: translateX\(-100%\);/);
  expect(stylesheet).toContain('display 250ms allow-discrete');
  expect(stylesheet).toContain('overlay 250ms allow-discrete');
  expect(stylesheet).toMatch(/#sourcey #mobile-nav\[open\]\s*\{\s*transform: translateX\(0\);/);
  expect(stylesheet).toContain('@starting-style');
});

test('mobile page transitions slide only the old drawer snapshot over the new page', () => {
  expect(stylesheet).toMatch(/@view-transition\s*\{\s*navigation: auto;/);
  expect(stylesheet).toContain('view-transition-name: keysy-mobile-nav');
  expect(stylesheet).toMatch(/::view-transition-old\(keysy-mobile-nav\)\s*\{\s*animation: keysy-nav-slide-out 250ms/);
  expect(stylesheet).toMatch(/::view-transition-new\(root\)\s*\{\s*animation: none;/);
  expect(stylesheet).toMatch(/::view-transition-old\(root\)\s*\{\s*display: none;/);
  expect(stylesheet).toMatch(/@keyframes keysy-nav-slide-out\s*\{\s*to\s*\{\s*transform: translateX\(-100%\);/);
});

test('custom drawer motion is restricted to mobile users without reduced motion', () => {
  const motionGate = stylesheet.indexOf('@media (width < 64rem) and (prefers-reduced-motion: no-preference)');
  expect(motionGate).toBeGreaterThan(0);
  expect(stylesheet.indexOf('view-transition-name: keysy-mobile-nav')).toBeGreaterThan(motionGate);
  expect(stylesheet.indexOf('transition: transform')).toBeGreaterThan(motionGate);
  expect(stylesheet).toMatch(/#sourcey #mobile-nav\[open\],\s*#sourcey #mobile-nav\[open\]::backdrop\s*\{\s*animation: none;/);
});

test('root favicon fallback provides standard browser icon sizes', async () => {
  expect(config.publicDir).toBe('./public');
  const icon = Buffer.from(await Bun.file(new URL('public/favicon.ico', docs)).arrayBuffer());
  expect(icon.readUInt16LE(0)).toBe(0);
  expect(icon.readUInt16LE(2)).toBe(1);
  const sizes = Array.from({ length: icon.readUInt16LE(4) }, (_, index) =>
    icon.readUInt8(6 + index * 16),
  );
  for (const size of [16, 32, 48]) expect(sizes).toContain(size);
});

for (const mode of ['light', 'dark'] as const) {
  const background = mode === 'light' ? '#fafafa' : '#121212';

  test(`${mode} accent meets WCAG AA on the configured neutral background`, () => {
    const accent = mode === 'light' ? config.theme!.colors!.primary : config.theme!.colors!.light!;
    expect(accent).toBe(mode === 'light' ? '#1d4ed8' : '#7aa2ff');
    expect(contrast(accent, background)).toBeGreaterThanOrEqual(4.5);
    expect(stylesheet).toContain(`--color-background-${mode}: ${mode === 'light' ? '250 250 250' : '18 18 18'}`);
  });

  test(`${mode} logo resolves to a visible standalone SVG`, async () => {
    const logo = config.logo as { light: string; dark: string };
    const svg = await readFile(new URL(logo[mode], docs), 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).toMatch(/viewBox="[\d. ]+"/);
    expect(svg).not.toContain('currentColor');
    const fills = [...svg.matchAll(/fill="(#[\da-f]{6})"/gi)];
    expect(fills.length).toBeGreaterThan(0);
    for (const [, fill] of fills) {
      expect(contrast(fill!, background)).toBeGreaterThanOrEqual(3);
    }
  });
}

test('favicon adapts the Namespace symbol to the browser color scheme', async () => {
  const svg = await Bun.file(new URL(config.favicon!, docs)).text();
  expect(svg).toContain('prefers-color-scheme: dark');
  expect(svg).toContain('#638ce5');
  expect(svg).not.toContain('<text');
  for (const background of ['#ffffff', '#121212']) {
    expect(contrast(background === '#ffffff' ? '#2f5aba' : '#638ce5', background)).toBeGreaterThanOrEqual(3);
  }
});
