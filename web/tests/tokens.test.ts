import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

test("landing imports design tokens into the built CSS", () => {
  const landing = readFileSync(resolve(import.meta.dir, "../src/styles/landing.css"), "utf8");
  expect(landing).toMatch(/^@import ["']\.\.\/\.\.\/\.\.\/design\/tokens\/tokens\.css["'];/);
  const assets = resolve(import.meta.dir, "../dist/_astro");
  const css = readdirSync(assets).filter((file) => file.endsWith(".css"))
    .map((file) => readFileSync(resolve(assets, file), "utf8")).join("\n");
  for (const name of ["bg", "surface", "text", "muted", "accent", "button", "soft", "line"]) {
    expect(css).toContain(`--color-${name}:`);
    expect(css).toContain(`--${name}:var(--color-${name})`);
  }
  expect(css).toContain("--font-sans:");
  expect(css).toContain("font-family:var(--font-sans)");
});
