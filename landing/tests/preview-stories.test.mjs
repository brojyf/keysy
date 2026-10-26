import "./dom.mjs";
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProductWindow from "../src/components/previews/ProductWindow";
import { playHeroStory } from "../src/components/previews/heroStory";
import { playUpdateStory } from "../src/components/previews/updateSecretStory";

function scene(update = false) {
  const document = new Window().document;
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    React.createElement(ProductWindow, { update }),
  );
  return host;
}

// Step through the story without simulating spring physics or browser layout.
function immediatePlayback(root) {
  const checkpoints = [];
  const animate = (targets, frames) => {
    for (const node of Array.isArray(targets) ? targets : [targets]) {
      if (frames.opacity !== undefined)
        node.style.opacity = String(
          Array.isArray(frames.opacity)
            ? frames.opacity.at(-1)
            : frames.opacity,
        );
    }
    return Promise.resolve();
  };
  return {
    checkpoints,
    animate,
    play: async (target, frames) => {
      await animate(target, frames);
    },
    wait: async (ms) => {
      checkpoints.push({
        ms,
        path: root.querySelector('[data-secret="STRIPE_SECRET_KEY"] td')
          .textContent,
        version: root.querySelector(
          '[data-secret="STRIPE_SECRET_KEY"] .secret-version',
        ).textContent,
        value: root.querySelector(".preview-value")?.textContent,
        expiry: root.querySelector(".preview-expiry")?.textContent,
        menu: root.querySelector(".preview-expiry-menu")?.hidden,
        thought: root.querySelector(".thinking-text")?.textContent,
        replyHidden: root.querySelector(".assistant-reply")?.hidden,
        composer: root.querySelector(".composer-text")?.textContent,
      });
    },
  };
}

describe("HTML demo stories", () => {
  test("types the prompt, moves only the two paths, verifies, then reveals the reply", async () => {
    const root = scene();
    const states = [];
    const run = immediatePlayback(root);
    const order = [...root.querySelectorAll("tbody tr")].map(
      (row) => row.dataset.secret,
    );
    await playHeroStory(run, root, (state) => states.push(state));
    expect(run.checkpoints[0].composer).toBe("M");
    const typed = run.checkpoints.findIndex(
      (step) =>
        step.composer ===
        "Move the Stripe and Resend keys into production/shared.",
    );
    expect(
      Math.max(...run.checkpoints.slice(0, typed + 1).map((step) => step.ms)),
    ).toBeLessThanOrEqual(120);
    expect(run.checkpoints[0].path).toBe(
      "production/payments/STRIPE_SECRET_KEY",
    );
    expect(
      run.checkpoints.some(
        (step) =>
          step.composer ===
          "Move the Stripe and Resend keys into production/shared.",
      ),
    ).toBe(true);
    expect(states).toEqual([null, "searching", "working", "solving", null]);
    const finding = run.checkpoints.find(
      (step) =>
        step.thought === "Finding affected policies…" && step.ms === 900,
    );
    expect(finding.path).toContain("production/payments/");
    const verified = run.checkpoints.find(
      (step) => step.thought === "Verifying permissions…" && step.ms === 900,
    );
    expect(verified.path).toBe("production/shared/STRIPE_SECRET_KEY");
    expect(verified.replyHidden).toBe(true);
    expect(
      root.querySelector('[data-secret="RESEND_API_KEY"] td').textContent,
    ).toBe("production/shared/RESEND_API_KEY");
    expect(
      [...root.querySelectorAll("tbody tr")].map((row) => row.dataset.secret),
    ).toEqual(order);
    expect(root.querySelector(".assistant-reply").hidden).toBe(false);
    expect(root.querySelector(".preview-scene").style.opacity).not.toBe("0");
  });

  test("pastes an already masked value, selects the reminder, saves, and resets on replay", async () => {
    const root = scene(true);
    const run = immediatePlayback(root);
    await playUpdateStory(run, root);
    expect(run.checkpoints[0].ms).toBe(700);
    expect(run.checkpoints[0].value).toBe("");
    expect(
      run.checkpoints.some(
        (step) => step.value === "•".repeat(18) && step.menu === false,
      ),
    ).toBe(true);
    expect(run.checkpoints.find((step) => step.ms === 180).version).toBe("v5");
    const saved = run.checkpoints.find((step) => step.ms === 2600);
    expect(saved.version).toBe("v6");
    expect(saved.expiry).toBe("in 90 days");
    expect(saved.menu).toBe(true);
    expect(
      root.querySelector('[data-secret="RESEND_API_KEY"] .secret-version')
        .textContent,
    ).toBe("v6");
    expect(
      root.querySelector('[data-secret="DATABASE_URL"] .secret-version')
        .textContent,
    ).toBe("v8");
    const replay = immediatePlayback(root);
    await playUpdateStory(replay, root);
    expect(replay.checkpoints[0].version).toBe("v5");
    expect(replay.checkpoints[0].expiry).toBe("in 14 days");
    expect(replay.checkpoints[0].value).toBe("");
  });
});
