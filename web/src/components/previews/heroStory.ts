import { stagger } from "motion";
import type { OrbState } from "thinking-orbs";
import { prompt, resetRows } from "./previewContent";
import { query, spring, exit, type PreviewPlayback } from "./previewPlayback";

const moves = [
  ["STRIPE_SECRET_KEY", "production/payments/"],
  ["RESEND_API_KEY", "production/email/"],
];
const thoughts: [string, OrbState][] = [
  ["Finding affected policies…", "searching"],
  ["Moving 2 secrets…", "working"],
  ["Verifying permissions…", "solving"],
];

function resetHero(root: HTMLElement) {
  resetRows(root);
  for (const node of root.querySelectorAll<HTMLElement>(
    ".assistant-prompt, .thinking, .thinking-text, .assistant-reply, .assistant-reply > *, .assistant-reply > div > p",
  ))
    node.removeAttribute("style");
  query(root, ".thinking").hidden = true;
  query(root, ".composer-text").textContent = "";
  query(root, ".composer-text").classList.remove("typing");
}

export function renderHeroFinal(root: HTMLElement) {
  resetHero(root);
  query(root, ".preview-scene").style.opacity = "1";
  query(root, ".assistant-prompt").hidden = false;
  query(root, ".assistant-reply").hidden = false;
  for (const [key] of moves)
    query(root, `[data-secret="${key}"]`).classList.add("highlighted");
}

async function movePrefix(
  run: PreviewPlayback,
  root: HTMLElement,
  key: string,
) {
  const row = query(root, `[data-secret="${key}"]`);
  const prefix = query(row, ".path-prefix");
  const name = query(row, ".secret-key");
  await run.play(prefix, { opacity: 0, x: -6, filter: "blur(2px)" }, exit);
  const previous = name.offsetLeft;
  prefix.textContent = "production/shared/";
  query(row, "td").title = `production/shared/${key}`;
  row.classList.add("highlighted");
  run.animate(
    row,
    { backgroundColor: ["#dfe7fb", "#f4f7fe"] },
    { duration: 0.9, ease: "easeOut" },
  );
  run.animate(name, { x: [previous - name.offsetLeft, 0] }, spring(0.45));
  await run.play(
    prefix,
    { opacity: [0, 1], x: [6, 0], filter: ["blur(2px)", "blur(0px)"] },
    spring(0.45),
  );
}

// Spring flow (A) from design/landing/motion/hero-motion.html.
export async function playHeroStory(
  run: PreviewPlayback,
  root: HTMLElement,
  setOrb: (state: OrbState | null) => void,
) {
  resetHero(root);
  setOrb(null);
  const bubble = query(root, ".assistant-prompt");
  const reply = query(root, ".assistant-reply");
  const composer = query(root, ".composer-text");
  const thinking = query(root, ".thinking");
  const phrase = query(root, ".thinking-text");
  bubble.hidden = reply.hidden = true;
  for (const [key, from] of moves) {
    const row = query(root, `[data-secret="${key}"]`);
    query(row, ".path-prefix").textContent = from;
    query(row, "td").title = `${from}${key}`;
  }
  composer.classList.add("typing");
  for (const character of prompt) {
    composer.textContent += character;
    await run.wait(
      character === " "
        ? 40 + Math.random() * 27
        : /[.,]/.test(character)
          ? 120
          : 13 + Math.random() * 20,
    );
  }
  composer.classList.remove("typing");
  await run.wait(200);
  composer.textContent = "";
  bubble.hidden = false;
  await run.play(
    bubble,
    { opacity: [0, 1], y: [18, 0], scale: [0.94, 1] },
    spring(0.45),
  );
  thinking.hidden = false;
  phrase.textContent = thoughts[0][0];
  setOrb(thoughts[0][1]);
  await run.play(thinking, { opacity: [0, 1], y: [6, 0] }, spring(0.3));
  for (const [index, [text, state]] of thoughts.entries()) {
    if (index > 0) {
      await run.play(phrase, { opacity: 0, y: -6, filter: "blur(2px)" }, exit);
      phrase.textContent = text;
      setOrb(state);
      await run.play(
        phrase,
        { opacity: [0, 1], y: [6, 0], filter: ["blur(2px)", "blur(0px)"] },
        spring(0.3),
      );
    }
    if (index === 1) {
      await Promise.all([
        ...moves.map(async ([key], index) => {
          await run.wait(index * 90);
          await movePrefix(run, root, key);
        }),
        run.wait(900),
      ]);
    } else await run.wait(900);
  }
  await run.play(thinking, { opacity: 0, scale: 0.98 }, exit);
  thinking.hidden = true;
  setOrb(null);
  const text = query(reply, ":scope > p");
  const results = query(reply, ":scope > div");
  const link = query(reply, ":scope > span");
  for (const part of [text, results, link]) part.style.opacity = "0";
  const checks = [...results.querySelectorAll("p")];
  checks.forEach((check) => {
    check.style.opacity = "0";
  });
  reply.hidden = false;
  run.animate(text, { opacity: [0, 1], y: [8, 0] }, spring(0.45));
  run.animate(
    results,
    { opacity: [0, 1], y: [10, 0], scale: [0.97, 1] },
    { ...spring(0.45), delay: 0.06 },
  );
  run.animate(
    checks,
    { opacity: [0, 1], x: [-4, 0] },
    { ...spring(0.3), delay: stagger(0.07, { startDelay: 0.16 }) },
  );
  await run.wait(520);
  await run.play(link, { opacity: [0, 1], y: [4, 0] }, spring(0.3));
}
