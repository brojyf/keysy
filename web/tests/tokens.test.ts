import { expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

test("landing imports design tokens into the built CSS", () => {
  const landing = readFileSync(resolve(import.meta.dir, "../src/styles/landing.css"), "utf8");
  expect(landing).toMatch(/^@import ["']\.\.\/\.\.\/\.\.\/design\/tokens\/tokens\.css["'];\r?\n@import ["']\.\.\/\.\.\/\.\.\/design\/tokens\/web\.css["'];/);
  const assets = resolve(import.meta.dir, "../dist/_astro");
  const css = readdirSync(assets).filter((file) => file.endsWith(".css"))
    .map((file) => readFileSync(resolve(assets, file), "utf8")).join("\n");
  for (const name of ["bg", "surface", "text", "muted", "accent", "button", "soft", "line"]) {
    expect(css).toContain(`--color-${name}:`);
    expect(css).not.toContain(`var(--${name})`);
  }
  const webTokens = readFileSync(resolve(import.meta.dir, "../../design/tokens/web.css"), "utf8");
  for (const [, name] of webTokens.matchAll(/(--[\w-]+):/g)) expect(css).toContain(`${name}:`);
  expect(css).toContain("--font-sans:");
  expect(css).toContain("font-family:var(--font-sans)");
});

test("non-CSS colors match shared tokens", () => {
  const tokens = readFileSync(resolve(import.meta.dir, "../../design/tokens/tokens.css"), "utf8");
  const cases = [
    ["../src/components/DotBackdrop.tsx", "activeColor", "button"],
    ["../src/components/previews/HeroAssistant.tsx", "color", "accent"],
    ["../src/layouts/Page.astro", "content", "bg"],
  ];
  for (const [file, attribute, name] of cases) {
    const source = readFileSync(resolve(import.meta.dir, file), "utf8");
    const value = tokens.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]+);`, "i"))?.[1];
    expect(value).toBeDefined();
    expect(source).toContain(`${attribute}="${value}"`);
  }
});

test("styles do not repeat token color literals", () => {
  const tokens = ["tokens.css", "web.css"]
    .map((file) => readFileSync(resolve(import.meta.dir, "../../design/tokens", file), "utf8"))
    // The landing page has no dark mode, so its dark terminal keeps literal colors. White is not a Keysy color.
    // A color becomes a token only if it is a Figma variable or a repeated value, so one-off colors stay in place.
    .map((css) => css.split("\n.dark")[0]).join("\n");
  const colors = [...tokens.matchAll(/--color-[\w-]+:\s*#([0-9a-f]+);/gi)].map(([, hex]) => hex).filter((hex) => hex !== "ffffff");
  expect(colors.length).toBeGreaterThan(0);
  const literal = new RegExp(`#(?:${colors.join("|")})(?:[0-9a-f]{2})?\\b`, "i");
  const styles = resolve(import.meta.dir, "../src/styles");
  for (const file of readdirSync(styles, { recursive: true })) {
    const path = resolve(styles, String(file));
    if (!statSync(path).isFile()) continue;
    const css = readFileSync(path, "utf8");
    expect(css).not.toMatch(literal);
  }
});
