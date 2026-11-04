import { installWindow } from "./dom.ts";
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import DotBackdrop from "../src/components/DotBackdrop";
import DotGrid from "../src/vendor/reactbits/DotGrid";
import Hero from "../src/components/Hero";

type VisibilityCallback = (entries: Pick<IntersectionObserverEntry, "isIntersecting">[]) => void;

let browser: ReturnType<typeof installWindow>;
let root: Root;
let container: HTMLDivElement;
let media: EventTarget & { matches: boolean };
let now: number;
let frames: Map<number, FrameRequestCallback>;
let intersections: VisibilityCallback[];
let uploads: Float32Array[];
let contextCalls: number;
let contextAvailable: boolean;
let linked: boolean;
let clock: ReturnType<typeof spyOn<typeof performance, "now">>;
let originalRaf: typeof requestAnimationFrame;
let originalCancelRaf: typeof cancelAnimationFrame;

beforeEach(() => {
  browser = installWindow();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  media = Object.assign(new browser.EventTarget(), { matches: false });
  browser.matchMedia = () => media as MediaQueryList;
  now = 1000;
  clock = spyOn(performance, "now").mockImplementation(() => now);
  frames = new Map();
  let nextFrame = 0;
  originalRaf = globalThis.requestAnimationFrame;
  originalCancelRaf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  intersections = [];
  Object.assign(globalThis, { IntersectionObserver: class {
    constructor(callback: VisibilityCallback) { intersections.push(callback); }
    observe() {}
    disconnect() {}
  } });
  Object.assign(globalThis, { ResizeObserver: class {
    observe() {}
    disconnect() {}
  } });
  uploads = [];
  linked = true;
  const gl = new Proxy({}, {
    get(_, name) {
      if (name === "getProgramParameter") return () => linked;
      if (name === "bufferSubData")
        return (_: unknown, __: unknown, values: Float32Array) => uploads.push(new Float32Array(values));
      if (/^[A-Z_]+$/.test(String(name))) return 1;
      return () => ({});
    },
  });
  contextCalls = 0;
  contextAvailable = true;
  Object.assign(browser.HTMLCanvasElement.prototype, { getContext(this: HTMLCanvasElement, contextType: string) {
    if (contextType !== "webgl2") return null;
    contextCalls++;
    // A detached capability probe can succeed while the renderer fails.
    return !this.isConnected || contextAvailable ? gl : null;
  } });
  browser.HTMLCanvasElement.prototype.getBoundingClientRect = () => new browser.DOMRect(0, 0, 1000, 500);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  clock.mockRestore();
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCancelRaf;
  Reflect.deleteProperty(globalThis, "IntersectionObserver");
  Reflect.deleteProperty(globalThis, "ResizeObserver");
  browser.happyDOM.abort();
  browser.close();
});

async function frameAt(time: number) {
  now = time;
  const pending = [...frames.values()];
  frames.clear();
  await act(() => pending.forEach((callback) => callback(now)));
}

function hide(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("dot backdrop fallback", () => {
  test.each(["context", "shader"])("keeps the static background when %s initialization fails", async (failure) => {
    contextAvailable = failure !== "context";
    linked = failure !== "shader";
    await act(() => root.render(React.createElement(DotBackdrop)));
    expect(contextCalls).toBeGreaterThan(0);
    expect(container.querySelector<HTMLElement>(".dot-backdrop")!.classList.contains("animated")).toBe(false);
    expect(uploads).toHaveLength(0);
  });

  test("replaces the static background only after a successful draw and restores it for reduced motion", async () => {
    await act(() => root.render(React.createElement(DotBackdrop)));
    expect(uploads.length).toBeGreaterThan(0);
    expect(container.querySelector<HTMLElement>(".dot-backdrop")!.classList.contains("animated")).toBe(false);
    await frameAt(1000);
    expect(container.querySelector<HTMLElement>(".dot-backdrop")!.classList.contains("animated")).toBe(true);
    await act(() => {
      media.matches = true;
      media.dispatchEvent(new Event("change"));
    });
    expect(container.querySelector<HTMLElement>(".dot-backdrop")!.classList.contains("animated")).toBe(false);
    expect(container.querySelector("canvas")).toBeNull();
    await act(() => {
      contextAvailable = false;
      media.matches = false;
      media.dispatchEvent(new Event("change"));
    });
    expect(container.querySelector<HTMLElement>(".dot-backdrop")!.classList.contains("animated")).toBe(false);
  });
});

describe("shared hero start", () => {
  test("starts typing on the grid's first animation frame", async () => {
    await act(() => root.render(React.createElement(Hero)));
    expect(container.querySelector<HTMLElement>(".product-stage")!.classList.contains("preview-paused")).toBe(true);
    expect(container.querySelector<HTMLElement>(".composer-text")!.textContent).toBe("");
    expect(container.querySelector<HTMLElement>(".dot-backdrop")!.classList.contains("animated")).toBe(false);
    await frameAt(1000);
    expect(container.querySelector<HTMLElement>(".product-stage")!.classList.contains("preview-paused")).toBe(false);
    expect(container.querySelector<HTMLElement>(".composer-text")!.textContent).toBe("M");
    expect(container.querySelector<HTMLElement>(".dot-backdrop")!.classList.contains("animated")).toBe(true);
  });

  test.each(["context", "shader"])("plays the hero with a static background when %s initialization fails", async (failure) => {
    contextAvailable = failure !== "context";
    linked = failure !== "shader";
    await act(() => root.render(React.createElement(Hero)));
    expect(container.querySelector<HTMLElement>(".product-stage")!.classList.contains("preview-paused")).toBe(false);
    expect(container.querySelector<HTMLElement>(".composer-text")!.textContent).toBe("M");
    expect(container.querySelector<HTMLElement>(".dot-backdrop")!.classList.contains("animated")).toBe(false);
  });

  test("shows the complete hero and static background for reduced motion", async () => {
    media.matches = true;
    await act(() => root.render(React.createElement(Hero)));
    expect(container.querySelector<HTMLElement>(".product-stage")!.classList.contains("preview-paused")).toBe(true);
    expect(container.querySelector<HTMLElement>(".assistant-reply")!.hidden).toBe(false);
    expect(container.querySelector<HTMLElement>(".path-prefix")!.textContent).toBe("production/shared/");
    expect(container.querySelector<HTMLElement>(".dot-backdrop canvas")).toBeNull();
    expect(container.querySelector<HTMLElement>(".dot-backdrop")!.classList.contains("animated")).toBe(false);
  });
});

describe("dot grid playback clock", () => {
  test.each(["offscreen", "hidden", "paused"])("resumes the intro from its paused frame after being %s", async (reason) => {
    await act(() => root.render(React.createElement(DotGrid)));
    await frameAt(1000);
    await frameAt(1150);
    const before = uploads.at(-1)!;
    const scales = Array.from(before).filter((_, index) => index % 6 === 5);
    expect(scales.some((scale) => scale > 0)).toBe(true);
    expect(scales.some((scale) => scale === 0)).toBe(true);
    await act(() => {
      if (reason === "offscreen") intersections[0]([{ isIntersecting: false }]);
      if (reason === "hidden") hide(true);
      if (reason === "paused") root.render(React.createElement(DotGrid, { paused: true }));
    });
    expect(frames.size).toBe(0);
    now = 101150;
    await act(() => {
      if (reason === "offscreen") intersections[0]([{ isIntersecting: true }]);
      if (reason === "hidden") hide(false);
      if (reason === "paused") root.render(React.createElement(DotGrid, { paused: false }));
    });
    await frameAt(now);
    expect(uploads.at(-1)).toEqual(before);
    await frameAt(now + 100);
    expect(uploads.at(-1)).not.toEqual(before);
  });

  test("keeps a shock wave at its paused age and waits until both visibility guards clear", async () => {
    await act(() => root.render(React.createElement(DotGrid, { intro: false })));
    await frameAt(1000);
    await act(() => window.dispatchEvent(new browser.PointerEvent("pointerdown", { clientX: 400, clientY: 250 })));
    await frameAt(1100);
    const before = uploads.at(-1)!;
    expect(Array.from(before).some((value, index) => index % 6 === 4 && value > 0)).toBe(true);
    await act(() => {
      intersections[0]([{ isIntersecting: false }]);
      hide(true);
    });
    await frameAt(2000);
    now = 101100;
    await act(() => intersections[0]([{ isIntersecting: true }]));
    expect(frames.size).toBe(0);
    await act(() => hide(false));
    await frameAt(now);
    expect(uploads.at(-1)).toEqual(before);
    await frameAt(now + 100);
    expect(uploads.at(-1)).not.toEqual(before);
  });
});
