import { expect, mock, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

const client = new URL('../node_modules/sourcey/dist/client/', import.meta.url);
const sidebarScript = await Bun.file(new URL('sidebar.js', client)).text();
const themeScript = await Bun.file(new URL('theme-init.js', client)).text();
const stylesheet = await Bun.file(new URL('../style.css', import.meta.url)).text();
const spring = 'linear(0, 0.06, 0.186, 1)';
type Listener = (event: Record<string, unknown>) => void;

function storage(initial: Record<string, string> = {}) {
  const items = { ...initial };
  return {
    items,
    getItem: (key: string) => items[key] ?? null,
    setItem: (key: string, value: string) => { items[key] = value; },
    removeItem: (key: string) => { delete items[key]; },
  };
}

// Run Sourcey's patched sidebar script on a page whose Account group holds /api/me.
function loadSidebar({ marked = false, groupOpen = false } = {}) {
  let onDocumentClick: Listener = () => {};
  const attributes = new Set(marked ? ['data-keysy-nav-reveal'] : []);
  const list = { scrollHeight: 120, animate: mock(() => ({ onfinish: null, cancel: mock() })) };
  const group = { open: groupOpen, querySelector: () => null };
  const navLink = { getAttribute: () => '/api/me', closest: () => group };
  const sessionStorage = storage();
  const window = {
    location: { href: 'https://wiki.keysy.net/api', origin: 'https://wiki.keysy.net', pathname: '/api', search: '' },
    sessionStorage,
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({
      getPropertyValue: (name: string) => ({ '--keysy-spring': ` ${spring}`, '--keysy-spring-duration': ' 600ms' })[name] ?? '',
    }),
    CSS: { supports: () => true },
  };
  const document = {
    documentElement: {
      hasAttribute: (name: string) => attributes.has(name),
      removeAttribute: (name: string) => { attributes.delete(name); },
    },
    addEventListener: (name: string, listener: Listener) => { if (name === 'click') onDocumentClick = listener; },
    getElementById: () => null,
    querySelector: (selector: string) => selector === '#nav details.sourcey-nav-group[open] > ul' ? list : null,
    querySelectorAll: (selector: string) => selector === '#nav a.nav-link[href]' ? [navLink] : [],
  };
  runInNewContext(sidebarScript, { window, document, URL, Element: Object });
  function clickLink(href: string) {
    const link = { getAttribute: (name: string) => ({ href })[name] ?? null, hasAttribute: () => false };
    onDocumentClick({ target: { closest: () => link }, defaultPrevented: false, button: 0 });
  }
  return { attributes, list, sessionStorage, clickLink };
}

test('a page marked before paint springs its open sidebar group from zero', () => {
  const { attributes, list } = loadSidebar({ marked: true });
  expect(list.animate).toHaveBeenCalledWith(
    { height: ['0px', '120px'], overflow: ['hidden', 'hidden'] },
    { duration: 600, easing: spring },
  );
  expect(attributes.has('data-keysy-nav-reveal')).toBe(false);
});

test('an unmarked page shows its open sidebar group without motion', () => {
  expect(loadSidebar().list.animate).not.toHaveBeenCalled();
});

test('a link into a collapsed sidebar group asks the next page to reveal it', () => {
  const { sessionStorage, clickLink } = loadSidebar();
  clickLink('/api/me');
  expect(sessionStorage.items['keysy:nav-reveal']).toBe('/api/me');
});

test('a link into an open sidebar group asks for nothing', () => {
  const { sessionStorage, clickLink } = loadSidebar({ groupOpen: true });
  clickLink('/api/me');
  expect(sessionStorage.items['keysy:nav-reveal']).toBeUndefined();
});

// Run Sourcey's patched head script, which marks the page before paint.
function loadThemeInit({ saved = '/api/me', pathname = '/api/me', reducedMotion = false } = {}) {
  const attributes = new Set<string>();
  const sessionStorage = storage({ 'keysy:nav-reveal': saved });
  const root = {
    classList: { add: () => {}, toggle: () => {}, contains: () => false },
    style: {},
    setAttribute: (name: string) => { attributes.add(name); },
  };
  const window = {
    matchMedia: (query: string) => ({ matches: query.includes('reduce') && reducedMotion, addEventListener: () => {} }),
    addEventListener: () => {},
  };
  const document = {
    documentElement: root,
    currentScript: null,
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    dispatchEvent: () => {},
  };
  runInNewContext(themeScript, { window, document, sessionStorage, localStorage: storage(), location: { pathname }, CustomEvent: class {} });
  return { attributes, sessionStorage };
}

test('the head script marks the page that the last click asked to reveal', () => {
  const { attributes, sessionStorage } = loadThemeInit();
  expect(attributes.has('data-keysy-nav-reveal')).toBe(true);
  expect(sessionStorage.items['keysy:nav-reveal']).toBeUndefined();
});

test('the head script ignores a request for another page and reduced motion', () => {
  expect(loadThemeInit({ pathname: '/api/orgs' }).attributes.size).toBe(0);
  expect(loadThemeInit({ reducedMotion: true }).attributes.size).toBe(0);
});

test('a marked page starts its open sidebar group closed', () => {
  expect(stylesheet).toMatch(/html\[data-keysy-nav-reveal\] #nav details\.sourcey-nav-group\[open\] > ul \{\s*height: 0;\s*overflow: hidden;/);
});
