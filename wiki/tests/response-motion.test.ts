import { expect, mock, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

const sidebarScript = await Bun.file(new URL('../node_modules/sourcey/dist/client/sidebar.js', import.meta.url)).text();
type Motion = { onfinish: null | (() => void); cancel: ReturnType<typeof mock> };

function loadResponse({ open = false, reducedMotion = false, supported = true, linearEasing = true } = {}) {
  let click = (_event: { preventDefault: ReturnType<typeof mock> }) => {};
  const motions: Motion[] = [];
  const summary = {
    getBoundingClientRect: () => ({ height: 40 }),
    addEventListener: (_name: string, listener: typeof click) => { click = listener; },
  };
  const group = {
    open,
    dataset: {} as Record<string, string>,
    renderedHeight: null as number | null,
    getBoundingClientRect: () => ({ height: group.renderedHeight ?? (group.open ? 162 : 42) }),
    querySelector: (selector: string) => selector === ':scope > summary' ? summary : null,
    animate: supported ? mock(() => {
      const motion: Motion = { onfinish: null, cancel: mock(() => { group.renderedHeight = null; }) };
      motions.push(motion);
      return motion;
    }) : undefined,
  };
  runInNewContext(sidebarScript, {
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: (selector: string) => selector === '#responses details.schema-expandable' ? [group] : [],
    },
    window: {
      addEventListener: () => {},
      matchMedia: () => ({ matches: reducedMotion }),
      getComputedStyle: () => ({
        borderTopWidth: '1px', borderBottomWidth: '1px',
        getPropertyValue: (name: string) => name === '--keysy-spring' ? 'linear(0, 0.5, 1)' : '600ms',
      }),
      CSS: { supports: () => linearEasing },
    },
  });
  return { group, motions, click: () => { const event = { preventDefault: mock() }; click(event); return event; } };
}

const frames = (from: string, to: string) => ({ height: [from, to], overflow: ['hidden', 'hidden'] });

test('response fields open with the sidebar spring, including content padding and borders', () => {
  const { group, click, motions } = loadResponse();
  expect(click().preventDefault).toHaveBeenCalledTimes(1);
  expect(group.open).toBe(true);
  expect(group.animate).toHaveBeenCalledWith(frames('42px', '162px'), { duration: 600, easing: 'linear(0, 0.5, 1)' });
  motions[0]!.onfinish!();
  expect(group.open).toBe(true);
});

test('response fields keep their content visible until the collapse finishes', () => {
  const { group, click, motions } = loadResponse({ open: true });
  click();
  expect(group.open).toBe(true);
  expect('closing' in group.dataset).toBe(true);
  expect(group.animate).toHaveBeenCalledWith(frames('162px', '42px'), { duration: 600, easing: 'linear(0, 0.5, 1)' });
  motions[0]!.onfinish!();
  expect(group.open).toBe(false);
  expect('closing' in group.dataset).toBe(false);
});

test.each([false, true])('response fields reverse from their visible height while initially open=%s', (open) => {
  const { group, click, motions } = loadResponse({ open });
  click();
  group.renderedHeight = 90;
  click();
  expect(motions[0]!.cancel).toHaveBeenCalledTimes(1);
  expect(group.animate).toHaveBeenLastCalledWith(frames('90px', open ? '162px' : '42px'), { duration: 600, easing: 'linear(0, 0.5, 1)' });
});

test('response fields use ease-out when linear easing is unavailable', () => {
  const { group, click } = loadResponse({ linearEasing: false });
  click();
  expect(group.animate).toHaveBeenCalledWith(frames('42px', '162px'), { duration: 600, easing: 'ease-out' });
});

test.each([{ reducedMotion: true }, { supported: false }])('response fields retain native toggling without motion: %j', (options) => {
  const { click, motions } = loadResponse(options);
  expect(click().preventDefault).not.toHaveBeenCalled();
  expect(motions).toHaveLength(0);
});
