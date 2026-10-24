import { expect, mock, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

const themeScript = await Bun.file(new URL('../node_modules/sourcey/dist/client/theme-init.js', import.meta.url)).text();
type Listener = (event: Record<string, unknown>) => void;

function loadTheme({ reducedMotion = false, stored = 'light', storageDisabled = false, supported = true, deferCapture = false } = {}) {
  const classes = new Set<string>();
  const listeners = new Map<string, Listener>();
  const transitions: { capture: () => void; finish: () => void; skipTransition: ReturnType<typeof mock> }[] = [];
  const attributes = new Map([
    ['data-light-label', 'Switch to light mode'],
    ['data-dark-label', 'Switch to dark mode'],
  ]);
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
    setItem: mock((_key: string, _value: string) => { if (storageDisabled) throw new Error('Storage disabled'); }),
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
    ...(supported ? {
      startViewTransition: mock((update: () => void) => {
        let finish!: () => void;
        const finished = new Promise<void>((resolve) => { finish = resolve; });
        const transition = { capture: update, finish, skipTransition: mock(), finished };
        transitions.push(transition);
        if (!deferCapture) update();
        return transition;
      }),
    } : {}),
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
  });
  return {
    classes, root, storage, attributes, transitions,
    click: () => listeners.get('click')!({ target: new Element() }),
    finish: async () => { for (const transition of transitions) transition.finish(); await Promise.resolve(); },
  };
}

test('initial theme loads immediately without a color transition', () => {
  const { classes, transitions } = loadTheme({ stored: 'dark' });
  expect(classes.has('dark')).toBe(true);
  expect(classes.has('keysy-theme-transition')).toBe(false);
  expect(transitions).toHaveLength(0);
});

test.each(['light', 'dark'])('appearance toggles from %s inside one page transition', async (stored) => {
  const { classes, root, storage, attributes, transitions, click, finish } = loadTheme({ stored });
  click();
  const next = stored === 'light' ? 'dark' : 'light';
  expect(classes.has('keysy-theme-transition')).toBe(true);
  expect(classes.has('dark')).toBe(next === 'dark');
  expect(root.style.colorScheme).toBe(next);
  expect(attributes.get('aria-label')).toBe(`Switch to ${stored} mode`);
  expect(storage.setItem).toHaveBeenCalledWith('sourcey-theme', next);
  expect(transitions).toHaveLength(1);
  await finish();
  expect(classes.has('keysy-theme-transition')).toBe(false);
  expect(classes.has('dark')).toBe(next === 'dark');
});

test('rapid appearance clicks interrupt the old fade without clearing the new transition', async () => {
  const { classes, transitions, click, finish } = loadTheme();
  click();
  click();
  expect(classes.has('dark')).toBe(false);
  expect(classes.has('keysy-theme-transition')).toBe(true);
  expect(transitions).toHaveLength(2);
  expect(transitions[0]!.skipTransition).toHaveBeenCalledTimes(1);
  transitions[0]!.finish();
  await Promise.resolve();
  expect(classes.has('keysy-theme-transition')).toBe(true);
  await finish();
  expect(classes.has('keysy-theme-transition')).toBe(false);
});

test.each([{ reducedMotion: true }, { supported: false }])(
  'appearance switches directly without motion when %j', (options) => {
    const { classes, transitions, click } = loadTheme(options);
    click();
    expect(classes.has('dark')).toBe(true);
    expect(classes.has('keysy-theme-transition')).toBe(false);
    expect(transitions).toHaveLength(0);
  },
);

test('clicks before the first snapshot still toggle the selected preference correctly', async () => {
  const { classes, transitions, storage, click, finish } = loadTheme({ deferCapture: true });
  click();
  click();
  expect(storage.setItem.mock.calls.map((call) => call[1])).toEqual(['dark', 'light']);
  for (const transition of transitions) transition.capture();
  expect(classes.has('dark')).toBe(false);
  await finish();
});

test('appearance still transitions when preference storage is unavailable', () => {
  const { classes, click } = loadTheme({ storageDisabled: true });
  click();
  expect(classes.has('dark')).toBe(true);
  expect(classes.has('keysy-theme-transition')).toBe(true);
});
