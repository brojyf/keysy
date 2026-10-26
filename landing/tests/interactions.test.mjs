import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import SdkShowcase from "../src/components/SdkShowcase";
import ProductWindow from "../src/components/previews/ProductWindow";

let browser;
let root;
let container;
let media;

beforeEach(() => {
  browser = new Window();
  for (const name of [
    "window",
    "document",
    "HTMLElement",
    "Node",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
  ]) {
    globalThis[name] =
      name === "window"
        ? browser
        : name === "document"
          ? browser.document
          : browser[name];
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  media = new browser.EventTarget();
  media.matches = false;
  browser.matchMedia = () => media;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  browser.happyDOM.abort();
  browser.close();
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
      ).toContain("Coming soon");
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
  test("updates the shared folder version and reminder, then resets the illustrative state", async () => {
    await act(() =>
      root.render(React.createElement(ProductWindow, { update: true })),
    );
    const row = () => container.querySelector("tbody tr");
    const version = () => row().querySelectorAll("td")[1].textContent;
    expect(version()).toBe("v5");
    await act(() => container.querySelector("button").click());
    expect(version()).toBe("v6");
    expect(row().textContent).toContain("in 90 days");
    expect(container.querySelector('[role="status"]').textContent).toContain(
      "Folder version v6",
    );
    await act(() => container.querySelector("button").click());
    expect(version()).toBe("v5");
    expect(row().textContent).toContain("in 14 days");
  });

  test("pauses the hero animation and honors changes to reduced motion", async () => {
    await act(() => root.render(React.createElement(ProductWindow)));
    expect(container.querySelector("button").textContent).toBe("Pause demo");
    await act(() => container.querySelector("button").click());
    expect(container.querySelector("button").textContent).toBe("Play demo");
    await act(() => {
      media.matches = true;
      media.dispatchEvent(new Event("change"));
    });
    expect(container.querySelector("button").textContent).toBe("Play demo");
    expect(container.querySelector("tbody tr").textContent).toContain(
      "production/shared/STRIPE_SECRET_KEY",
    );
    expect(container.textContent).toContain("Permissions verified");
  });
});
