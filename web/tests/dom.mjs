import { Window } from "happy-dom";

export function installWindow(browser = new Window()) {
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
  ]) {
    globalThis[name] =
      name === "window"
        ? browser
        : name === "document"
          ? browser.document
          : browser[name];
  }
  globalThis.getComputedStyle = browser.getComputedStyle.bind(browser);
  return browser;
}

// Motion detects DOM and RAF support when imported, before the first test runs.
installWindow();
globalThis.requestAnimationFrame = (callback) =>
  setTimeout(() => callback(performance.now()), 16);
globalThis.cancelAnimationFrame = clearTimeout;
