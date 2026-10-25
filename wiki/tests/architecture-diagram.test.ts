import { expect, mock, test } from 'bun:test';
import mount from '../components/architecture-diagram.client';

function loadDiagram(initialTheme = 'dark') {
  let theme = initialTheme;
  const documentListeners = new Map<string, () => void>();
  const frameListeners = new Map<string, () => void>();
  const viewerAttributes = new Map<string, string>();
  const viewerVariables = new Map<string, string>();
  const styles: { id: string; textContent: string }[] = [];
  let indexHeight = 240;
  const index = { getBoundingClientRect: () => ({ height: indexHeight }) };
  const observers: { resize: () => void; observe: ReturnType<typeof mock>; disconnect: ReturnType<typeof mock> }[] = [];
  const viewer = {
    documentElement: {
      style: {
        colorScheme: '',
        setProperty: (name: string, value: string) => viewerVariables.set(name, value),
      },
      setAttribute: (name: string, value: string) => viewerAttributes.set(name, value),
    },
    querySelector: () => ({ viewBox: { baseVal: { width: 980, height: 1308 } } }),
    getElementById: (id: string) => id === 'node-outline' ? index : styles.find((style) => style.id === id),
    createElement: () => ({ id: '', textContent: '' }),
    head: { append: (style: { id: string; textContent: string }) => styles.push(style) },
  };
  const document = {
    baseURI: 'https://wiki.keysy.net/system-design',
    body: {},
    defaultView: {
      getComputedStyle: () => ({ backgroundColor: theme === 'dark' ? 'rgb(18, 18, 18)' : 'rgb(250, 250, 250)' }),
      ResizeObserver: class {
        observe = mock();
        disconnect = mock();
        constructor(resize: () => void) { observers.push({ resize, observe: this.observe, disconnect: this.disconnect }); }
      },
    },
    documentElement: { classList: { contains: () => theme === 'dark' } },
    addEventListener: (name: string, listener: () => void) => documentListeners.set(name, listener),
  };
  const navigations: string[] = [];
  let src = '/architecture/system-architecture.html?present=1';
  const frame = {
    get src() { return src; },
    set src(value: string) { src = value; navigations.push(value); },
    contentDocument: null as typeof viewer | null,
    clientWidth: 600,
    style: { aspectRatio: '', height: '' },
    addEventListener: (name: string, listener: () => void) => frameListeners.set(name, listener),
  };
  mount({ ownerDocument: document, querySelector: () => frame } as unknown as HTMLElement);
  return {
    frame, navigations, viewerAttributes, viewerVariables, styles, index, observers,
    loaded: () => { frame.contentDocument = viewer; frameListeners.get('load')!(); },
    setTheme: (value: string) => { theme = value; documentListeners.get('sourcey:themechange')!(); },
    resize: (width: number, nextIndexHeight: number) => {
      frame.clientWidth = width;
      indexHeight = nextIndexHeight;
      observers.at(-1)!.resize();
    },
  };
}

test.each(['light', 'dark'])('the architecture starts in the host %s theme with interaction enabled', (theme) => {
  const { frame, loaded, viewerAttributes } = loadDiagram(theme);
  const url = new URL(frame.src);
  expect(url.origin).toBe('https://wiki.keysy.net');
  expect(url.searchParams.get('present')).toBe('1');
  expect(url.searchParams.has('embed')).toBe(false);
  expect(url.searchParams.get('theme')).toBe(theme);
  loaded();
  expect(viewerAttributes.get('data-theme')).toBe(theme);
  expect(frame.contentDocument!.documentElement.style.colorScheme).toBe(theme);
});

test('theme changes update the loaded viewer without reloading or losing its view', () => {
  const { loaded, setTheme, viewerAttributes, navigations } = loadDiagram();
  loaded();
  setTheme('light');
  expect(viewerAttributes.get('data-theme')).toBe('light');
  setTheme('dark');
  expect(viewerAttributes.get('data-theme')).toBe('dark');
  expect(navigations).toHaveLength(1);
});

test('a theme change while the lazy iframe loads is applied on load', () => {
  const { setTheme, loaded, viewerAttributes } = loadDiagram();
  setTheme('light');
  loaded();
  expect(viewerAttributes.get('data-theme')).toBe('light');
});

test('the architecture background matches the computed page background in both themes', () => {
  const { loaded, setTheme, viewerVariables } = loadDiagram();
  loaded();
  expect(viewerVariables.get('--bg')).toBe('rgb(18, 18, 18)');
  setTheme('light');
  expect(viewerVariables.get('--bg')).toBe('rgb(250, 250, 250)');
});

test('the viewer uses its authored aspect ratio and hides its embedded toolbar', () => {
  const { frame, loaded, styles } = loadDiagram();
  loaded();
  expect(frame.style.aspectRatio).toBe('980 / 1308');
  expect(styles).toHaveLength(1);
  expect(styles[0]!.textContent).toContain('.toolbar');
  expect(styles[0]!.textContent).toContain('.header');
  expect(styles[0]!.textContent).toContain('.diagram-nav');
  expect(styles[0]!.textContent).not.toContain('.node-finder');
  loaded();
  expect(styles).toHaveLength(1);
});

test('the host overrides the original presentation padding without leaving a transparent gutter', async () => {
  const source = await Bun.file(new URL('../public/architecture/system-architecture.html', import.meta.url)).text();
  const selector = source.match(/(html\[data-present="true"\]:not\(\[data-embed="true"\]\) body) \{/)![1]!;
  const { loaded, styles } = loadDiagram();
  loaded();
  expect(styles[0]!.textContent).toContain(`${selector} { padding: 0; background: var(--bg); height: auto; }`);
});

test('the preview shows the original node index beneath the full diagram without toolbars', () => {
  const { loaded, frame, viewerVariables, styles, index, observers } = loadDiagram();
  loaded();
  expect(viewerVariables.get('--wiki-diagram-height')).toBe('801px');
  expect(frame.style.height).toBe('1041px');
  expect(observers[0]!.observe).toHaveBeenCalledWith(index);
  expect(styles[0]!.textContent).toContain('.node-outline:not([hidden])');
  expect(styles[0]!.textContent).toContain('.rail-controls');
});

test('the preview grows for a wrapped index and replaces resize observers on reload', () => {
  const { loaded, frame, resize, observers, navigations } = loadDiagram();
  loaded();
  resize(300, 400);
  expect(frame.style.height).toBe('801px');
  loaded();
  expect(observers[0]!.disconnect).toHaveBeenCalledTimes(1);
  expect(observers).toHaveLength(2);
  expect(navigations).toHaveLength(1);
});
