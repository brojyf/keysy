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
    expect(css).toContain(`--${name}:var(--color-${name})`);
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
  const styles = resolve(import.meta.dir, "../src/styles");
  for (const file of readdirSync(styles, { recursive: true })) {
    const path = resolve(styles, String(file));
    if (!statSync(path).isFile()) continue;
    const css = readFileSync(path, "utf8");
    expect(css).not.toMatch(/#(?:101b30|e8eefc|b45309|aab8d0|1d4ed8|2f5aba)(?:[0-9a-f]{2})?\b/i);
  }
});
