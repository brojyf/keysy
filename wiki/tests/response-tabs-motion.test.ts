import { expect, mock, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

const script = await Bun.file(new URL('../node_modules/sourcey/dist/client/tabs.js', import.meta.url)).text();
// Values the stylesheet's --keysy-indicator-* tokens resolve to.
const indicatorMotion = { '--keysy-indicator-duration': ' 360ms', '--keysy-indicator-easing': ' cubic-bezier(0.4, 0, 0.2, 1)' };

function loadTabs({ reducedMotion = false, supported = true, motionTokens = indicatorMotion } = {}) {
  const clicks: ((event: unknown) => void)[] = [];
  let init = () => {};
  const motions: { cancel: ReturnType<typeof mock> }[] = [];
  let visibleLeft: number | null = null;
  const tabs = ['200', '400', '403'].map((status, index) => {
    const classes = new Set(index === 0 ? ['active'] : []);
    const attributes = new Map([['aria-selected', String(index === 0)]]);
    const indicator = {
      getBoundingClientRect: () => ({ left: visibleLeft ?? index * 48, width: 36 }),
      getAnimations: () => motions.slice(-1),
      animate: supported ? mock(() => {
        const motion = { cancel: mock(() => { visibleLeft = null; }) };
        motions.push(motion);
        return motion;
      }) : undefined,
    };
    const tab = {
      status, indicator, attributes,
      classList: {
        contains: (name: string) => classes.has(name),
        toggle: (name: string, value: boolean) => value ? classes.add(name) : classes.delete(name),
      },
      getAttribute: (name: string) => name === 'data-response-index' ? String(index) : attributes.get(name),
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      closest: (selector: string): unknown => selector === '.response-tab' ? tab : selector === '.response-tabs' ? container : null,
      querySelector: (selector: string) => selector === '.keysy-response-indicator' ? indicator : null,
    };
    return tab;
  });
  const panels = tabs.map((_, index) => ({
    active: index === 0,
    getAttribute: () => String(index),
    classList: { toggle: (_name: string, active: boolean) => { panels[index]!.active = active; } },
  }));
  const container = {
    querySelector: () => tabs.find((tab) => tab.classList.contains('active'))!.indicator,
    querySelectorAll: (selector: string) => selector === '.response-tab' ? tabs : selector === '.response-panel' ? panels : [],
  };
  const scrollTo = mock();
  runInNewContext(script, {
    document: {
      addEventListener: (name: string, listener: (event: unknown) => void) => { if (name === 'click') clicks.push(listener); },
      querySelectorAll: () => [],
      documentElement: { classList: { add: () => {} } },
    },
    window: {
      addEventListener: (_name: string, listener: () => void) => { init = listener; },
      matchMedia: () => ({ matches: reducedMotion }),
      getComputedStyle: () => ({ getPropertyValue: (name: string) => motionTokens[name as keyof typeof motionTokens] }),
      scrollY: 200, scrollTo,
    },
  });
  init();
  return {
    tabs, panels, scrollTo, motions,
    setVisibleLeft: (left: number) => { visibleLeft = left; },
    click: (index: number) => { for (const listener of clicks) listener({ target: tabs[index] }); },
  };
}

test('response status changes move the underline with the shared indicator timing and update the panel', () => {
  const { tabs, panels, scrollTo, click } = loadTabs();
  click(2);
  expect(tabs[2]!.indicator.animate).toHaveBeenCalledWith(
    [{ transform: 'translateX(-96px) scaleX(1)' }, { transform: 'none' }],
    { duration: 360, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  );
  expect(tabs.map((tab) => tab.attributes.get('aria-selected'))).toEqual(['false', 'false', 'true']);
  expect(panels.map((panel) => panel.active)).toEqual([false, false, true]);
  expect(scrollTo).toHaveBeenCalledWith(0, 200);
});

test('rapid status changes continue from the moving underline position', () => {
  const { tabs, motions, setVisibleLeft, click } = loadTabs();
  click(2);
  setVisibleLeft(60);
  click(1);
  expect(motions[0]!.cancel).toHaveBeenCalledTimes(1);
  expect(tabs[1]!.indicator.animate).toHaveBeenCalledWith(
    [{ transform: 'translateX(12px) scaleX(1)' }, { transform: 'none' }],
    { duration: 360, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  );
});

test('response status underlines follow the stylesheet indicator tokens', () => {
  const { tabs, click } = loadTabs({
    motionTokens: { '--keysy-indicator-duration': '200ms', '--keysy-indicator-easing': 'linear' },
  });
  click(1);
  expect(tabs[1]!.indicator.animate).toHaveBeenCalledWith(
    [{ transform: 'translateX(-48px) scaleX(1)' }, { transform: 'none' }],
    { duration: 200, easing: 'linear' },
  );
});

test('clicking the selected response status does not restart its animation', () => {
  const { motions, click } = loadTabs();
  click(0);
  expect(motions).toHaveLength(0);
});

test.each([{ reducedMotion: true }, { supported: false }])('status changes stay immediate without motion: %j', (options) => {
  const { panels, motions, click } = loadTabs(options);
  click(1);
  expect(panels.map((panel) => panel.active)).toEqual([false, true, false]);
  expect(motions).toHaveLength(0);
});
