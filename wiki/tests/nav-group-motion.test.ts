import { expect, mock, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

const sidebarScript = await Bun.file(new URL('../node_modules/sourcey/dist/client/sidebar.js', import.meta.url)).text();
const spring = 'linear(0, 0.06, 0.186, 1)';
type Listener = (event: Record<string, unknown>) => void;
type Motion = { onfinish: null | (() => void); cancel: ReturnType<typeof mock> };

// Run Sourcey's patched sidebar script against one collapsible endpoint group.
function loadGroup({ open = false, reducedMotion = false, linearEasing = true, loaded = true } = {}) {
  let onSummaryClick: Listener = () => {};
  let onLoad = () => {};
  const motions: Motion[] = [];
  const frames: (() => void)[] = [];
  const list = {
    style: { height: '', overflow: '' },
    scrollHeight: 120,
    renderedHeight: open ? 120 : 0,
    getBoundingClientRect: () => ({ height: list.renderedHeight }),
    animate: mock(() => {
      const motion: Motion = { onfinish: null, cancel: mock() };
      motions.push(motion);
      return motion;
    }),
  };
  const summary = { addEventListener: (_name: string, listener: Listener) => { onSummaryClick = listener; } };
  const group = {
    open,
    dataset: {} as Record<string, string>,
    querySelector: (selector: string) => ({ ':scope > summary': summary, ':scope > ul': list })[selector] ?? null,
  };
  const window = {
    addEventListener: (name: string, listener: () => void) => { if (name === 'load') onLoad = listener; },
    matchMedia: (query: string) => ({ matches: query.includes('reduce') && reducedMotion }),
    getComputedStyle: () => ({
      getPropertyValue: (name: string) => ({ '--keysy-spring': ` ${spring}`, '--keysy-spring-duration': ' 600ms' })[name] ?? '',
    }),
    CSS: { supports: (_property: string, value: string) => linearEasing || !value.startsWith('linear(') },
    requestAnimationFrame: (callback: () => void) => frames.push(callback),
    cancelAnimationFrame: (id: number) => { frames[id - 1] = () => {}; },
  };
  const document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: (selector: string) => selector === 'details.sourcey-nav-group' ? [group] : [],
  };
  runInNewContext(sidebarScript, { window, document });
  if (loaded) onLoad();
  function press() {
    const event = { preventDefault: mock() };
    onSummaryClick(event);
    return event;
  }
  function nextFrame() {
    frames.splice(0).forEach((frame) => frame());
  }
  function click() {
    const event = press();
    nextFrame();
    return event;
  }
  return { group, list, motions, press, nextFrame, click };
}

const keyframes = (from: string, to: string) => ({ height: [from, to], overflow: ['hidden', 'hidden'] });

test('opening a collapsed endpoint group springs its height from zero', () => {
  const { group, list, motions, click } = loadGroup();
  expect(click().preventDefault).toHaveBeenCalledTimes(1);
  expect(group.open).toBe(true);
  expect(list.animate).toHaveBeenCalledWith(keyframes('0px', '120px'), { duration: 600, easing: spring });
  motions[0]!.onfinish!();
  expect(group.open).toBe(true);
});

test('a first open holds the current height for one frame before springing', () => {
  const { group, list, press, nextFrame } = loadGroup();
  press();
  expect(group.open).toBe(true);
  expect(list.style).toEqual({ height: '0px', overflow: 'hidden' });
  expect(list.animate).not.toHaveBeenCalled();
  nextFrame();
  expect(list.animate).toHaveBeenCalledWith(keyframes('0px', '120px'), { duration: 600, easing: spring });
  expect(list.style).toEqual({ height: '', overflow: '' });
});

test('closing an endpoint group springs to zero before closing it', () => {
  const { group, list, motions, click } = loadGroup({ open: true });
  click();
  expect(group.open).toBe(true);
  expect('closing' in group.dataset).toBe(true);
  expect(list.animate).toHaveBeenCalledWith(keyframes('120px', '0px'), { duration: 600, easing: spring });
  motions[0]!.onfinish!();
  expect(group.open).toBe(false);
  expect('closing' in group.dataset).toBe(false);
});

test('reversing mid-close springs open from the current height', () => {
  const { group, list, motions, click } = loadGroup({ open: true });
  click();
  list.renderedHeight = 50;
  click();
  expect(motions[0]!.cancel).toHaveBeenCalledTimes(1);
  expect(list.animate).toHaveBeenLastCalledWith(keyframes('50px', '120px'), { duration: 600, easing: spring });
  expect(group.open).toBe(true);
  expect('closing' in group.dataset).toBe(false);
});

test('browsers without linear() easing fall back to ease-out', () => {
  const { list, click } = loadGroup({ linearEasing: false });
  click();
  expect(list.animate).toHaveBeenCalledWith(keyframes('0px', '120px'), { duration: 600, easing: 'ease-out' });
});

test('the first click springs open before the page finishes loading', () => {
  const { list, click } = loadGroup({ loaded: false });
  expect(click().preventDefault).toHaveBeenCalledTimes(1);
  expect(list.animate).toHaveBeenCalledWith(keyframes('0px', '120px'), { duration: 600, easing: spring });
});

test('reduced motion keeps the native instant toggle', () => {
  const { list, click } = loadGroup({ reducedMotion: true });
  expect(click().preventDefault).not.toHaveBeenCalled();
  expect(list.animate).not.toHaveBeenCalled();
});
