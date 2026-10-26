import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { Window } from "happy-dom";

const output = resolve(import.meta.dir, "../dist");
const pages = new Map(
  ["/", "/policy/", "/terms/"].map((route) => {
    const html = readFileSync(resolve(output, `.${route}index.html`), "utf8");
    const document = new Window().document;
    document.write(html);
    return [route, { html, document }];
  }),
);

describe("built landing site", () => {
  test("renders the complete landing page and useful semantic navigation", () => {
    const { document } = pages.get("/");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(document.querySelectorAll("main > section")).toHaveLength(9);
    for (const title of [
      "One vault. Four ways in.",
      "Room to breathe.",
      "Opened by policy.",
      "No single point of failure.",
      "to protected.",
      "first retrieval.",
      "from your code.",
      "More forward.",
    ]) {
      expect(document.body.textContent).toContain(title);
    }
    expect(document.querySelector(".skip-link").getAttribute("href")).toBe(
      "#main-content",
    );
  });

  test("all local links resolve to a generated page and an existing anchor", () => {
    for (const [route, { document }] of pages) {
      for (const anchor of document.querySelectorAll("a[href]")) {
        const href = anchor.getAttribute("href");
        expect(href).not.toBe("#");
        const url = new URL(href, `https://keysy.example${route}`);
        if (url.origin !== "https://keysy.example") continue;
        const target = pages.get(url.pathname);
        expect(target, `${route}: ${href}`).toBeDefined();
        if (url.hash)
          expect(
            target.document.getElementById(url.hash.slice(1)),
            href,
          ).not.toBeNull();
      }
    }
  });

  test("unreleased destinations are explicitly marked and do not link to invented URLs", () => {
    const { document } = pages.get("/");
    for (const item of document.querySelectorAll('[aria-disabled="true"]')) {
      expect(item.textContent).toContain("Coming soon");
      expect(item.hasAttribute("href")).toBe(false);
    }
    expect(document.querySelectorAll('a[href^="https:"]')).toHaveLength(1);
    expect(document.querySelector('a[href^="https:"]').href).toBe(
      "https://github.com/brojyf/keysy",
    );
  });

  test("legal routes are clear placeholders with noindex and working return links", () => {
    for (const route of ["/policy/", "/terms/"]) {
      const { document } = pages.get(route);
      expect(document.querySelector("main").textContent).toContain(
        "This page is a placeholder.",
      );
      expect(document.querySelector('meta[name="robots"]').content).toBe(
        "noindex, nofollow",
      );
      expect(document.querySelector(".back-link").getAttribute("href")).toBe(
        "/",
      );
      expect(document.querySelectorAll("h1")).toHaveLength(1);
    }
  });

  test("every image and stylesheet exists locally and SVG proportions match Figma exports", () => {
    for (const { document, html } of pages.values()) {
      expect(html).not.toContain("www.figma.com/api/mcp/asset");
      for (const node of document.querySelectorAll(
        'img[src], link[rel="stylesheet"][href], script[src]',
      )) {
        const path = resolve(
          output,
          `.${node.getAttribute("src") ?? node.getAttribute("href")}`,
        );
        expect(existsSync(path), path).toBe(true);
        expect(statSync(path).size).toBeGreaterThan(0);
        if (node.tagName !== "IMG" || !path.endsWith(".svg")) continue;
        const svg = readFileSync(path, "utf8").match(/<svg\b[^>]*>/)[0];
        const width = Number(svg.match(/width="([\d.]+)/)[1]);
        const height = Number(svg.match(/height="([\d.]+)/)[1]);
        expect(
          Number(node.getAttribute("width")) /
            Number(node.getAttribute("height")),
        ).toBeCloseTo(width / height, 4);
      }
    }
  });
});
