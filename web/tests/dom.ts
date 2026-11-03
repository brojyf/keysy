import { Window as HappyWindow } from "happy-dom";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

export function installWindow(browser = new HappyWindow()) {
  for (const name of [
    "window",
    "document",
    "HTMLElement",
    "Node",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
    "SVGElement",
    "Element",
    "NodeList",
  ] as const) {
    Object.assign(globalThis, {
      [name]: name === "window"
        ? browser
        : name === "document"
          ? browser.document
          : browser[name],
    });
  }
  Object.assign(globalThis, { getComputedStyle: browser.getComputedStyle.bind(browser) });
  // Happy DOM implements these browser APIs with its own declaration types.
  return browser as unknown as Window & typeof globalThis & Pick<HappyWindow, "happyDOM">;
}

// Motion detects DOM and RAF support when imported, before the first test runs.
installWindow();
globalThis.requestAnimationFrame = (callback) =>
  setTimeout(() => callback(performance.now()), 16) as unknown as number;
globalThis.cancelAnimationFrame = clearTimeout;
