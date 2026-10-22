import { expect, mock, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

const themeScript = await Bun.file(new URL('../node_modules/sourcey/dist/client/theme-init.js', import.meta.url)).text();
type Listener = (event: Record<string, unknown>) => void;

function loadTheme({ reducedMotion = false, stored = 'light', storageDisabled = false } = {}) {
  const classes = new Set<string>();
  const listeners = new Map<string, Listener>();
  const timers = new Map<number, () => void>();
  const attributes = new Map([
    ['data-light-label', 'Switch to light mode'],
    ['data-dark-label', 'Switch to dark mode'],
  ]);
  let timerId = 0;
  class Element {
    closest(selector: string) { return selector === '#theme-toggle' ? this : null; }
  }
  const root = {
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
      contains: (name: string) => classes.has(name),
      toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name),
    },
    style: { colorScheme: '' },
  };
  const storage = {
    getItem: () => stored,
    setItem: mock(() => { if (storageDisabled) throw new Error('Storage disabled'); }),
  };
  const document = {
    documentElement: root,
    currentScript: null,
    readyState: 'complete',
    getElementById: () => ({
      getAttribute: (name: string) => attributes.get(name),
      setAttribute: (name: string, value: string) => attributes.set(name, value),
    }),
    querySelectorAll: () => [],
    dispatchEvent: mock(),
    addEventListener: (name: string, listener: Listener) => listeners.set(name, listener),
  };
  runInNewContext(themeScript, {
    document, Element, localStorage: storage,
    CustomEvent: class {},
    window: {
      matchMedia: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)' && reducedMotion,
        addEventListener: () => {},
      }),
      addEventListener: () => {},
    },
    setTimeout: (callback: () => void) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id: number) => timers.delete(id),
  });
  return {
    classes, root, storage, attributes, timers,
    click: () => listeners.get('click')!({ target: new Element() }),
    finish: () => { for (const callback of timers.values()) callback(); timers.clear(); },
  };
}

test('initial theme loads immediately without a color transition', () => {
  const { classes, timers } = loadTheme({ stored: 'dark' });
  expect(classes.has('dark')).toBe(true);
  expect(classes.has('keysy-theme-transition')).toBe(false);
  expect(timers.size).toBe(0);
});

test.each(['light', 'dark'])('appearance toggles from %s immediately while colors transition', (stored) => {
  const { classes, root, storage, attributes, click, finish } = loadTheme({ stored });
  click();
  const next = stored === 'light' ? 'dark' : 'light';
  expect(classes.has('keysy-theme-transition')).toBe(true);
  expect(classes.has('dark')).toBe(next === 'dark');
  expect(root.style.colorScheme).toBe(next);
  expect(attributes.get('aria-label')).toBe(`Switch to ${stored} mode`);
  expect(storage.setItem).toHaveBeenCalledWith('sourcey-theme', next);
  finish();
  expect(classes.has('keysy-theme-transition')).toBe(false);
  expect(classes.has('dark')).toBe(next === 'dark');
});

test('rapid appearance clicks keep the latest theme and only one cleanup timer', () => {
  const { classes, timers, click, finish } = loadTheme();
  click();
  click();
  expect(classes.has('dark')).toBe(false);
  expect(classes.has('keysy-theme-transition')).toBe(true);
  expect(timers.size).toBe(1);
  finish();
  expect(classes.has('keysy-theme-transition')).toBe(false);
});

test('reduced motion switches appearance without starting a transition', () => {
  const { classes, timers, click } = loadTheme({ reducedMotion: true });
  click();
  expect(classes.has('dark')).toBe(true);
  expect(classes.has('keysy-theme-transition')).toBe(false);
  expect(timers.size).toBe(0);
});

test('appearance still transitions when preference storage is unavailable', () => {
  const { classes, click } = loadTheme({ storageDisabled: true });
  click();
  expect(classes.has('dark')).toBe(true);
  expect(classes.has('keysy-theme-transition')).toBe(true);
});
