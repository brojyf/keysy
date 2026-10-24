import { expect, mock, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

const sidebarScript = await Bun.file(new URL('../node_modules/sourcey/dist/client/sidebar.js', import.meta.url)).text();
type Listener = (event: Record<string, unknown>) => void;

// Execute Sourcey's actual handler without a browser or a second navigation implementation.
function loadDrawer({ supported = true, mobile = true, reducedMotion = false } = {}) {
  const clicks: Listener[] = [];
  const listeners = new Map<string, Listener>();
  const closingAnimation = { finish: mock() };
  const dialog = {
    open: true,
    autofocus: false,
    showModal: mock(() => { dialog.open = true; }),
    closest: () => null,
    addEventListener: (name: string, listener: Listener) => {
      if (name === 'click') clicks.push(listener);
    },
    close: mock(() => { dialog.open = false; }),
    getAnimations: mock(() => [closingAnimation]),
  };
  const window = {
    location: new URL('https://docs.example.com/'),
    addEventListener: (name: string, listener: Listener) => listeners.set(name, listener),
    matchMedia: (query: string) => ({
      matches: query.includes('min-width') ? !mobile : mobile && !reducedMotion,
      addEventListener: (_name: string, listener: Listener) => listeners.set('breakpoint', listener),
    }),
    ...(supported ? { CSSViewTransitionRule: class {} } : {}),
  };
  const document = {
    getElementById: (id: string) => id === 'mobile-nav' ? dialog : null,
    querySelector: () => null,
    querySelectorAll: () => [{
      addEventListener: (_name: string, listener: Listener) => listeners.set('open', listener),
    }],
  };
  runInNewContext(sidebarScript, { window, document, URL });
  listeners.get('load')!({});

  function click(href?: string, attributes: Record<string, string> = {}, eventOverrides: Record<string, unknown> = {}) {
    const link = href === undefined ? null : Object.assign(new URL(href, window.location.href), {
      getAttribute: (name: string) => name === 'href' ? href : attributes[name] ?? null,
      hasAttribute: (name: string) => name in attributes,
    });
    const target = {
      closest: (selector: string) => selector === 'a' || selector === 'a[href]' ? link : null,
    };
    const event = {
      button: 0,
      target,
      preventDefault: mock(),
      stopPropagation: mock(),
      ...eventOverrides,
    };
    for (const listener of clicks) listener(event);
    return event;
  }

  return { dialog, click, closingAnimation, dispatch: (name: string, event: Record<string, unknown>) => listeners.get(name)?.(event) };
}

test('opening the drawer sets initial focus on the dialog instead of the logo', () => {
  const { dialog, dispatch } = loadDrawer();
  expect(dialog.autofocus).toBe(true);
  dialog.open = false;
  dispatch('open', {});
  expect(dialog.showModal).toHaveBeenCalledTimes(1);
  expect(dialog.open).toBe(true);
});

test.each(['/api/overview', '/auth/overview', '/prd', '/?section=api'])(
  'keeps the outgoing drawer open for the navigation snapshot: %s', (href) => {
    const { dialog, click } = loadDrawer();
    const event = click(href);
    expect(dialog.open).toBe(true);
    expect(dialog.close).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  },
);

test('closes the retained drawer when restoring a page from the back-forward cache', () => {
  const { dialog, dispatch } = loadDrawer();
  dispatch('pageshow', { persisted: true });
  expect(dialog.open).toBe(false);
});

test('finishes the restored drawer exit before the incoming navigation snapshot', () => {
  const { dialog, closingAnimation, dispatch } = loadDrawer();
  dispatch('pageshow', { persisted: true });
  expect(dialog.getAnimations).toHaveBeenCalledTimes(1);
  expect(closingAnimation.finish).toHaveBeenCalledTimes(1);
});

test('does not close the drawer on an ordinary pageshow event', () => {
  const { dialog, dispatch } = loadDrawer();
  dispatch('pageshow', { persisted: false });
  expect(dialog.close).not.toHaveBeenCalled();
});

test.each([
  { supported: false },
  { mobile: false },
  { reducedMotion: true },
])('retains native closing without an active mobile view transition: %j', (options) => {
  const { dialog, click } = loadDrawer(options);
  click('/api/overview');
  expect(dialog.open).toBe(false);
});

test.each([
  ['/', {}],
  ['/#general', {}],
  ['https://example.org/api', {}],
  ['mailto:support@example.com', {}],
  ['/api/overview', { target: '_blank' }],
  ['/api/overview', { download: '' }],
] as const)('preserves native closing for non-transition links: %s %j', (href, attributes) => {
  const { dialog, click } = loadDrawer();
  click(href, attributes);
  expect(dialog.open).toBe(false);
});

test.each([
  { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true },
  { button: 1 }, { defaultPrevented: true },
])('does not treat modified or canceled clicks as page transitions: %j', (event) => {
  const { dialog, click } = loadDrawer();
  click('/api/overview', {}, event);
  expect(dialog.open).toBe(false);
});

test('the close button still closes the drawer immediately', () => {
  const { dialog, click } = loadDrawer();
  click(undefined, {}, { target: { closest: (selector: string) => selector === '[data-close-drawer]' ? {} : null } });
  expect(dialog.open).toBe(false);
});

test('the backdrop still closes the drawer immediately', () => {
  const { dialog, click } = loadDrawer();
  click(undefined, {}, { target: dialog });
  expect(dialog.open).toBe(false);
});

test('expanding to desktop still closes the drawer', () => {
  const { dialog, dispatch } = loadDrawer();
  dispatch('breakpoint', { matches: true });
  expect(dialog.open).toBe(false);
});
