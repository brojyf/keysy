import { expect, mock, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

const sidebarScript = await Bun.file(new URL('../node_modules/sourcey/dist/client/sidebar.js', import.meta.url)).text();
type Listener = (event: Record<string, unknown>) => void;

// Run Sourcey's patched sidebar script against one collapsible endpoint group.
function loadGroup({ open = false, reducedMotion = false } = {}) {
  let onSummaryClick: Listener = () => {};
  let onLoad = () => {};
  const animation: { onfinish: null | (() => void) } = { onfinish: null };
  const list = { scrollHeight: 120, animate: mock(() => animation) };
  const summary = { addEventListener: (_name: string, listener: Listener) => { onSummaryClick = listener; } };
  const group = {
    open,
    dataset: {} as Record<string, string>,
    querySelector: (selector: string) => ({ ':scope > summary': summary, ':scope > ul': list })[selector] ?? null,
  };
  const window = {
    addEventListener: (name: string, listener: () => void) => { if (name === 'load') onLoad = listener; },
    matchMedia: (query: string) => ({ matches: query.includes('reduce') && reducedMotion }),
  };
  const document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: (selector: string) => selector === 'details.sourcey-nav-group' ? [group] : [],
  };
  runInNewContext(sidebarScript, { window, document });
  onLoad();
  function click() {
    const event = { preventDefault: mock() };
    onSummaryClick(event);
    return event;
  }
  return { group, list, animation, click };
}

test('opening a collapsed endpoint group animates its height from zero', () => {
  const { group, list, animation, click } = loadGroup();
  expect(click().preventDefault).toHaveBeenCalledTimes(1);
  expect(group.open).toBe(true);
  expect(list.animate).toHaveBeenCalledWith(
    { height: ['0px', '120px'], overflow: ['hidden', 'hidden'] },
    { duration: 200, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
  );
  animation.onfinish!();
  expect(group.open).toBe(true);
});

test('closing an endpoint group animates to zero before closing it', () => {
  const { group, list, animation, click } = loadGroup({ open: true });
  click();
  expect(group.open).toBe(true);
  expect('closing' in group.dataset).toBe(true);
  expect(list.animate).toHaveBeenCalledWith(
    { height: ['120px', '0px'], overflow: ['hidden', 'hidden'] },
    { duration: 150, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
  );
  animation.onfinish!();
  expect(group.open).toBe(false);
  expect('closing' in group.dataset).toBe(false);
});

test('reduced motion keeps the native instant toggle', () => {
  const { list, click } = loadGroup({ reducedMotion: true });
  expect(click().preventDefault).not.toHaveBeenCalled();
  expect(list.animate).not.toHaveBeenCalled();
});
