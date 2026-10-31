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
    setSpeed() {},
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
  test("types the prompt, verifies permissions, then moves only the two paths and replies", async () => {
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
    expect(states).toEqual([null, "searching", "solving", "working", null]);
    const finding = run.checkpoints.find(
      (step) =>
        step.thought === "Finding affected policies…" && step.ms === 900,
    );
    expect(finding.path).toContain("production/payments/");
    // Nothing moves until the permissions check is done.
    const verifying = run.checkpoints.find(
      (step) => step.thought === "Verifying permissions…" && step.ms === 900,
    );
    expect(verifying.path).toBe("production/payments/STRIPE_SECRET_KEY");
    const moving = run.checkpoints.find(
      (step) => step.thought === "Moving 2 secrets…" && step.ms === 900,
    );
    expect(moving.replyHidden).toBe(true);
    const replied = run.checkpoints.find((step) => step.ms === 520);
    expect(replied.path).toBe("production/shared/STRIPE_SECRET_KEY");
    expect(
      root.querySelector('[data-secret="RESEND_API_KEY"] td').textContent,
    ).toBe("production/shared/RESEND_API_KEY");
    expect(
      [...root.querySelectorAll("tbody tr")].map((row) => row.dataset.secret),
    ).toEqual(order);
    expect(root.querySelector(".assistant-reply").hidden).toBe(false);
    expect(root.querySelector(".preview-scene").style.opacity).not.toBe("0");
  });

  test("mounts the thinking orb before the AI starts so its row never shifts", () => {
    const thinking = scene().querySelector(".thinking");
    // Mounting it mid-fade pushed the phrase sideways and flashed its first frames.
    expect(thinking.firstElementChild.tagName).toBe("CANVAS");
    expect(thinking.lastElementChild.className).toBe("thinking-text");
  });

  test("streams the reply as overlapping character fades", async () => {
    const root = scene();
    const run = immediatePlayback(root);
    const calls = [];
    const animate = run.animate;
    run.animate = run.play = async (targets, frames, options) => {
      calls.push({ targets, frames, options });
      await animate(targets, frames);
    };
    await playHeroStory(run, root, () => {});
    const text = root.querySelector(".assistant-reply > p");
    const sentence =
      "Done. I moved 2 secrets and updated the policies that use them.";
    const stream = calls.find(
      ({ targets }) => Array.isArray(targets) && targets.length > 10,
    );
    const characters = stream.targets;
    expect(characters.map((span) => span.textContent).join("")).toBe(sentence);
    expect(characters).toHaveLength(sentence.length);
    // Once streamed, the sentence is plain text again so no filter lingers on it.
    expect(text.textContent).toBe(sentence);
    expect(text.children).toHaveLength(0);
    expect(stream.frames.filter).toEqual(["blur(4px)", "blur(0px)"]);
    expect(stream.frames.opacity).toEqual([0, 1]);
    const total = characters.length;
    const step =
      stream.options.delay(1, total) - stream.options.delay(0, total);
    // Each fade spans many characters, so the sentence washes in instead of ticking.
    expect(stream.options.duration / step).toBeGreaterThanOrEqual(15);
  });

  test("sends the prompt up from the composer without a late flash", async () => {
    const root = scene();
    const run = immediatePlayback(root);
    const composer = root.querySelector(".composer-text");
    const bubble = root.querySelector(".assistant-prompt");
    // Hold the bubble's entrance open to inspect the frame while it is still rising.
    let finishRise;
    let rise;
    const animate = run.animate;
    run.animate = run.play = (targets, frames, options) => {
      if (targets !== bubble) return animate(targets, frames);
      rise = { frames, opacityBeforeStart: bubble.style.opacity };
      return new Promise((resolve) => {
        finishRise = resolve;
      });
    };
    const story = playHeroStory(run, root, () => {});
    while (!finishRise) await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Unhidden while still transparent, so no frame shows it before the fade starts.
    expect(rise.opacityBeforeStart).toBe("0");
    // It rises from below with no scaling.
    expect(rise.frames.y[0]).toBeGreaterThanOrEqual(16);
    expect(rise.frames.y.at(-1)).toBe(0);
    expect(rise.frames.scale).toBeUndefined();
    // The composer already shows its placeholder; nothing reappears once the bubble lands.
    expect(composer.textContent).toBe("");
    finishRise();
    await story;
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
