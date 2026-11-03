import { installWindow } from "./dom.mjs";
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
import React, { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import SdkShowcase from "../src/components/SdkShowcase";
import * as playbackModule from "../src/components/previews/previewPlayback";

let browser;
let root;
let container;
let media;

const { default: ProductWindow } = await import(
  "../src/components/previews/ProductWindow"
);
const { createPreviewPlayback } = await import(
  "../src/components/previews/previewPlayback"
);
const { default: CallToAction } = await import(
  "../src/components/CallToAction"
);
const { usePreviewPlayback } = await import(
  "../src/components/previews/usePreviewPlayback"
);

beforeEach(() => {
  browser = installWindow();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  media = new browser.EventTarget();
  media.matches = false;
  browser.matchMedia = () => media;
  browser.HTMLCanvasElement.prototype.getContext = () => null;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  browser.happyDOM.abort();
  browser.close();
  delete globalThis.IntersectionObserver;
});

describe("SDK showcase", () => {
  test("selects every SDK with the matching panel and documentation placeholder", async () => {
    await act(() => root.render(React.createElement(SdkShowcase)));
    const samples = [
      ["Go", "keysy.NewClient()"],
      ["TypeScript", "new Keysy()"],
      ["Python", "psycopg.connect(db_url)"],
      ["Rust", "Client::new()?"],
      ["Java", "DriverManager.getConnection(dbUrl)"],
      ["C#", "new KeysyClient()"],
    ];
    for (const [language, code] of samples) {
      const tab = container.querySelector(
        `[role="tab"][aria-label="${language}"]`,
      );
      await act(() => tab.click());
      const panel = container.querySelector('[role="tabpanel"]:not([hidden])');
      expect(tab.getAttribute("aria-selected")).toBe("true");
      expect(panel.id).toBe(tab.getAttribute("aria-controls"));
      expect(panel.textContent).toContain(code);
      expect(panel.textContent).toContain(`${language} SDK docs`);
      expect(
        panel.querySelector('[aria-disabled="true"]').textContent,
      ).toBe(`${language} SDK docs ↗`);
      expect(
        container.querySelectorAll('[role="tabpanel"]:not([hidden])'),
      ).toHaveLength(1);
    }
  });

  test("supports arrow navigation, wrapping, Home and End with one tab stop", async () => {
    await act(() => root.render(React.createElement(SdkShowcase)));
    const press = async (key) => {
      const selected = container.querySelector(
        '[role="tab"][aria-selected="true"]',
      );
      await act(() =>
        selected.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true }),
        ),
      );
    };
    await press("ArrowLeft");
    expect(document.activeElement.getAttribute("aria-label")).toBe("C#");
    await press("ArrowRight");
    expect(document.activeElement.getAttribute("aria-label")).toBe("Go");
    await press("End");
    expect(document.activeElement.getAttribute("aria-label")).toBe("C#");
    await press("Home");
    expect(document.activeElement.getAttribute("aria-label")).toBe("Go");
    expect(
      container.querySelectorAll('[role="tab"][tabindex="0"]'),
    ).toHaveLength(1);
  });
});

describe("product previews", () => {
  test("waits for the shared hero start before typing the first character", async () => {
    await act(() => root.render(React.createElement(ProductWindow, { ready: false })));
    expect(container.querySelector(".product-stage").classList.contains("preview-paused")).toBe(true);
    expect(container.querySelector(".composer-text").textContent).toBe("");
    await act(() => root.render(React.createElement(ProductWindow, { ready: true })));
    expect(container.querySelector(".product-stage").classList.contains("preview-paused")).toBe(false);
    expect(container.querySelector(".composer-text").textContent).toBe("M");
  });
  test("plays the dashboard once, holds the saved frame, and does not replay on return", async () => {
    let starts = 0;
    let entered;
    let stopped = false;
    const run = {
      get stopped() { return stopped; },
      guard() {},
      setPaused() {},
      stop() { stopped = true; },
      animate: async () => {},
      play: async () => {},
      wait: async (ms) => {
        if (ms === 4800) await new Promise(() => {});
        if (ms === 700 && ++starts > 1) await new Promise(() => {});
      },
    };
    globalThis.IntersectionObserver = class {
      constructor(callback) { entered = callback; }
      observe() {}
      disconnect() {}
    };
    const deadline = { setPaused() {}, stop() {}, wait: () => new Promise(() => {}) };
    const playback = spyOn(playbackModule, "createPreviewPlayback")
      .mockReturnValueOnce(run).mockReturnValueOnce(deadline);
    try {
      await act(() => root.render(React.createElement(ProductWindow, { update: true })));
      expect(starts).toBe(1);
      expect(container.querySelector("tbody tr").textContent).toContain("v6");
      expect(container.querySelector("tbody tr").textContent).toContain("in 90 days");
      expect(container.querySelector(".product-stage").classList.contains("preview-paused")).toBe(true);
      await act(() => entered([{ isIntersecting: false }]));
      await act(() => entered([{ isIntersecting: true }]));
      for (const matches of [true, false]) {
        await act(() => {
          media.matches = matches;
          media.dispatchEvent(new Event("change"));
        });
      }
      expect(starts).toBe(1);
      expect(container.querySelector("tbody tr").textContent).toContain("v6");
    } finally {
      playback.mockRestore();
    }
  });
  test.each([false, true])("bounds stalled preview playback and shows its complete result (update=%s)", async (update) => {
    let finish;
    let budget;
    let stopped = false;
    const run = {
      get stopped() { return stopped; },
      guard() {},
      setPaused() {},
      setSpeed() {},
      stop() { stopped = true; },
      wait: () => new Promise(() => {}),
    };
    const deadline = {
      setPaused() {},
      stop() {},
      wait: (ms) => new Promise((resolve) => { budget = ms; finish = resolve; }),
    };
    const playback = spyOn(playbackModule, "createPreviewPlayback")
      .mockReturnValueOnce(run).mockReturnValueOnce(deadline);
    try {
      await act(() => root.render(React.createElement(ProductWindow, { update })));
      expect(budget).toBeGreaterThan(0);
      expect(budget).toBeLessThanOrEqual(5000);
      container.querySelector(".secret-version").style.opacity = "0";
      await act(() => finish());
      await act(() => Bun.sleep(40));
      expect(stopped).toBe(true);
      expect(container.querySelector(".product-stage").classList.contains("preview-paused")).toBe(true);
      expect(container.querySelector(".secret-version").style.opacity).toBe("");
      if (update) {
        expect(container.querySelector("tbody tr").textContent).toContain("v6");
        expect(container.querySelector("tbody tr").textContent).toContain("in 90 days");
        expect(container.querySelector(".preview-scrim").style.opacity).toBe("0");
        expect(container.querySelector(".product-panel").style.transform).toBe("translateX(100%)");
      } else {
        expect(container.querySelector("tbody tr").textContent).toContain("production/shared/STRIPE_SECRET_KEY");
        expect(container.querySelector(".thinking").hidden).toBe(true);
        expect(container.querySelector(".assistant-reply").hidden).toBe(false);
        expect(container.querySelector(".composer-text").classList.contains("typing")).toBe(false);
      }
    } finally {
      playback.mockRestore();
    }
  });
  test("holds the final dashboard after the real playback deadline cancels the unfinished story", async () => {
    const nativeAnimate = browser.Element.prototype.animate;
    const waapi = spyOn(browser.Element.prototype, "animate").mockImplementation(function (...args) {
      const animation = nativeAnimate.apply(this, args);
      // Happy DOM eagerly creates this promise; Motion uses its own completion promise.
      void animation.finished.catch((error) => {
        if (error.name !== "AbortError") throw error;
      });
      return animation;
    });
    try {
      await act(() => root.render(React.createElement(ProductWindow, { update: true })));
      await act(() => Bun.sleep(4950));
      expect(container.querySelector(".product-stage").classList.contains("preview-paused")).toBe(true);
      expect(container.querySelector("tbody tr").textContent).toContain("v6");
      expect(container.querySelector("tbody tr").textContent).toContain("in 90 days");
      expect(container.querySelector(".product-panel").style.transform).toBe("translateX(100%)");
      expect(container.querySelector(".secret-version").style.opacity).toBe("");
      const final = container.innerHTML;
      await act(() => Bun.sleep(300));
      expect(container.innerHTML).toBe(final);
    } finally {
      waapi.mockRestore();
    }
  }, 10000);
  test("keeps the last frame instead of redrawing it when a single-play story finishes", async () => {
    let complete;
    let redraws = 0;
    const story = () =>
      new Promise((resolve) => {
        complete = resolve;
      });
    const renderFinal = () => {
      redraws++;
    };
    function SinglePlayPreview() {
      const scope = useRef(null);
      usePreviewPlayback(scope, story, renderFinal, false);
      return React.createElement("div", { ref: scope });
    }
    await act(() => root.render(React.createElement(SinglePlayPreview)));
    await act(async () => {
      complete();
      await Promise.resolve();
    });
    expect(redraws).toBe(0);
  });
  test("does not restart a single-play story after completion or visibility changes", async () => {
    let complete;
    let entered;
    let runs = 0;
    const story = () => {
      runs++;
      return new Promise((resolve) => {
        complete = resolve;
      });
    };
    const renderFinal = (element) => {
      element.dataset.complete = "true";
    };
    globalThis.IntersectionObserver = class {
      constructor(callback) {
        entered = callback;
      }
      observe() {}
      disconnect() {}
    };
    function SinglePlayPreview() {
      const scope = useRef(null);
      usePreviewPlayback(scope, story, renderFinal, false);
      return React.createElement("div", { ref: scope });
    }
    await act(() => root.render(React.createElement(SinglePlayPreview)));
    await act(async () => {
      complete();
      await Promise.resolve();
    });
    expect(runs).toBe(1);
    await act(() => entered([{ isIntersecting: false }]));
    await act(() => entered([{ isIntersecting: true }]));
    await act(() => {
      media.matches = true;
      media.dispatchEvent(new Event("change"));
    });
    await act(() => {
      media.matches = false;
      media.dispatchEvent(new Event("change"));
    });
    expect(runs).toBe(1);
    expect(container.firstChild.dataset.complete).toBe("true");
  });
  test("freezes an active transition as well as timeline holds", async () => {
    const run = createPreviewPlayback();
    const element = document.createElement("div");
    element.style.opacity = "0";
    document.body.append(element);
    const transition = run.animate(
      element,
      { opacity: 1 },
      { duration: 0.25, ease: "linear" },
    );
    await Bun.sleep(60);
    run.setPaused(true);
    const pausedOpacity = element.style.opacity;
    await Bun.sleep(90);
    expect(element.style.opacity).toBe(pausedOpacity);
    run.setPaused(false);
    await transition;
    expect(Number(element.style.opacity)).toBe(1);
    run.stop();
  });

  test("pauses the dashboard while it is off-screen and resumes when it returns", async () => {
    let observe;
    globalThis.IntersectionObserver = class {
      constructor(callback) {
        observe = callback;
      }
      observe() {}
      disconnect() {}
    };
    await act(() =>
      root.render(React.createElement(ProductWindow, { update: true })),
    );
    await act(() => observe([{ isIntersecting: false }]));
    expect(
      container
        .querySelector(".product-stage")
        .classList.contains("preview-paused"),
    ).toBe(true);
    await act(() => observe([{ isIntersecting: true }]));
    expect(
      container
        .querySelector(".product-stage")
        .classList.contains("preview-paused"),
    ).toBe(false);
  });
  test("pauses timeline holds and resumes from the same point", async () => {
    const run = createPreviewPlayback();
    let completed = false;
    const finished = run.wait(140).then(() => {
      completed = true;
    });
    await Bun.sleep(30);
    run.setPaused(true);
    await Bun.sleep(180);
    expect(completed).toBe(false);
    run.setPaused(false);
    await finished;
    expect(completed).toBe(true);
    run.stop();
  });
  test("autoplays the update story without demo controls", async () => {
    await act(() =>
      root.render(React.createElement(ProductWindow, { update: true })),
    );
    const row = container.querySelector("tbody tr");
    expect(row.querySelectorAll("td")[1].textContent).toBe("v5");
    expect(row.textContent).toContain("in 14 days");
    expect(container.querySelector("button")).toBeNull();
  });

  test("plays the update story without fading the dashboard in or out", async () => {
    const played = [];
    const run = {
      play: async (element, keyframes) => played.push([element, keyframes]),
      animate: (element, keyframes) => played.push([element, keyframes]),
      wait: async () => {},
    };
    const { playUpdateStory } = await import(
      "../src/components/previews/updateSecretStory.ts"
    );
    await act(() =>
      root.render(React.createElement(ProductWindow, { update: true })),
    );
    await playUpdateStory(run, container.querySelector(".product-stage"));
    const scene = container.querySelector(".preview-scene");
    expect(played.filter(([element]) => element === scene)).toHaveLength(0);
  });

  test("shows the saved dashboard state without animation under reduced motion", async () => {
    media.matches = true;
    await act(() =>
      root.render(React.createElement(ProductWindow, { update: true })),
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("v6");
    expect(rows[0].textContent).toContain("in 90 days");
    expect(rows[5].textContent).toContain("v6");
    expect(container.querySelector("button")).toBeNull();
  });

  test("autoplays the hero without controls and honors reduced motion", async () => {
    await act(() => root.render(React.createElement(ProductWindow)));
    expect(container.querySelector("button")).toBeNull();
    expect(
      container
        .querySelector(".product-stage")
        .classList.contains("preview-paused"),
    ).toBe(false);
    await act(() => {
      media.matches = true;
      media.dispatchEvent(new Event("change"));
    });
    expect(container.querySelector("button")).toBeNull();
    expect(
      container
        .querySelector(".product-stage")
        .classList.contains("preview-paused"),
    ).toBe(true);
    expect(container.querySelector("tbody tr").textContent).toContain(
      "production/shared/STRIPE_SECRET_KEY",
    );
    expect(container.textContent).toContain("Permissions verified");
  });
  test("finishes the complete hero story within five seconds and holds its final frame", async () => {
    const nativeAnimate = browser.Element.prototype.animate;
    const waapi = spyOn(browser.Element.prototype, "animate").mockImplementation(function (...args) {
      const animation = nativeAnimate.apply(this, args);
      // Happy DOM stores playbackRate as a field without rescheduling its finish timer.
      let rate = animation.playbackRate;
      Object.defineProperty(animation, "playbackRate", {
        get: () => rate,
        set: (next) => {
          const currentTime = animation.currentTime;
          rate = next;
          animation.currentTime = currentTime;
        },
      });
      void animation.finished.catch((error) => {
        if (error.name !== "AbortError") throw error;
      });
      return animation;
    });
    try {
      await act(() => root.render(React.createElement(ProductWindow)));
      await act(() => Bun.sleep(4950));
      expect(container.querySelector(".product-stage").classList.contains("preview-paused")).toBe(true);
      expect(container.querySelector(".thinking").hidden).toBe(true);
      expect(container.querySelector(".assistant-reply").hidden).toBe(false);
      expect(container.querySelector(".assistant-reply > p").children).toHaveLength(0);
      for (const key of ["STRIPE_SECRET_KEY", "RESEND_API_KEY"])
        expect(container.querySelector(`[data-secret="${key}"] .path-prefix`).textContent).toBe("production/shared/");
      const final = container.innerHTML;
      await act(() => Bun.sleep(300));
      expect(container.innerHTML).toBe(final);
    } finally {
      waapi.mockRestore();
    }
  }, 10000);
});

describe("CTA pointer motion", () => {
  test("tilts for the mouse without a hover glow and disables rotation for reduced motion", async () => {
    await act(() => root.render(React.createElement(CallToAction)));
    const card = container.querySelector(".cta-card");
    card.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1000,
      height: 500,
    });
    card.dispatchEvent(
      new browser.PointerEvent("pointermove", {
        pointerType: "mouse",
        clientX: 1000,
        clientY: 500,
      }),
    );
    expect(card.querySelector(".cta-sheen")).toBeNull();
    await Bun.sleep(950);
    expect(
      Number(card.style.transform.match(/rotateX\(([-\d.]+)deg\)/)[1]),
    ).toBeCloseTo(-3, 1);
    expect(
      Number(card.style.transform.match(/rotateY\(([-\d.]+)deg\)/)[1]),
    ).toBeCloseTo(3, 1);
    await act(() => {
      media.matches = true;
      media.dispatchEvent(new Event("change"));
    });
    expect(card.style.transform).toBe("none");
    card.dispatchEvent(
      new browser.PointerEvent("pointermove", {
        pointerType: "touch",
        clientX: 20,
        clientY: 20,
      }),
    );
    expect(card.style.transform).toBe("none");
  });
});
