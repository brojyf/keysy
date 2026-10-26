import { resetRows } from "./previewContent";
import { query, spring, exit, type PreviewPlayback } from "./previewPlayback";

function resetDashboard(root: HTMLElement) {
  resetRows(root);
  for (const node of root.querySelectorAll<HTMLElement>(
    ".product-panel, .preview-scrim, .preview-value, .preview-expiry-menu, .preview-save .mini-primary",
  ))
    node.removeAttribute("style");
  for (const node of root.querySelectorAll(".focused, .hover"))
    node.classList.remove("focused", "hover");
  query(root, ".preview-expiry-menu").hidden = true;
  query(root, ".product-panel").style.transform = "translateX(100%)";
  query(root, ".preview-scrim").style.opacity = "0";
  query(root, ".preview-value").textContent = "";
  query(root, ".preview-expiry").textContent = "in 14 days";
}

function applyUpdate(root: HTMLElement) {
  for (const key of ["STRIPE_SECRET_KEY", "RESEND_API_KEY"])
    query(root, `[data-secret="${key}"] .secret-version`).textContent = "v6";
  query(root, '[data-secret="STRIPE_SECRET_KEY"] .secret-expiry').textContent =
    "in 90 days";
  query(root, '[data-secret="STRIPE_SECRET_KEY"]').classList.add("highlighted");
}

export function renderUpdateFinal(root: HTMLElement) {
  resetDashboard(root);
  query(root, ".preview-scene").style.opacity = "1";
  applyUpdate(root);
}

async function press(run: PreviewPlayback, element: HTMLElement) {
  await run.play(element, { scale: 0.96 }, { duration: 0.1, ease: "easeOut" });
  run.animate(element, { scale: 1 }, spring(0.3));
}

// The panel, paste, expiry picker, and save sequence follow update-secret-motion.html.
export async function playUpdateStory(run: PreviewPlayback, root: HTMLElement) {
  resetDashboard(root);
  const scene = query(root, ".preview-scene");
  const panel = query(root, ".product-panel");
  const scrim = query(root, ".preview-scrim");
  const target = query(root, '[data-secret="STRIPE_SECRET_KEY"]');
  const value = query(root, ".preview-value");
  const valueInput = query(root, ".preview-value-input");
  const expiryInput = query(root, ".preview-expiry-input");
  const menu = query(root, ".preview-expiry-menu");
  if (scene.style.opacity === "0")
    await run.play(
      scene,
      { opacity: [0, 1] },
      { duration: 0.4, ease: "easeOut" },
    );
  await run.wait(700);
  await press(run, target);
  target.classList.add("highlighted");
  run.animate(scrim, { opacity: [0, 1] }, { duration: 0.25, ease: "easeOut" });
  await run.play(panel, { x: ["100%", "0%"] }, spring(0.55));
  valueInput.classList.add("focused");
  await run.wait(380);
  value.textContent = "•".repeat(18);
  await run.play(
    value,
    { opacity: [0, 1], filter: ["blur(3px)", "blur(0px)"] },
    spring(0.3),
  );
  await run.wait(250);
  valueInput.classList.remove("focused");
  expiryInput.classList.add("focused");
  menu.hidden = false;
  await run.play(
    menu,
    { opacity: [0, 1], scale: [0.97, 1], y: [-4, 0] },
    spring(0.3),
  );
  const options = [...menu.children];
  for (const option of options) {
    options.forEach((item) => item.classList.toggle("hover", item === option));
    await run.wait(170);
  }
  await run.wait(160);
  query(root, ".preview-expiry").textContent = "in 90 days";
  await run.play(menu, { opacity: 0, scale: 0.98 }, exit);
  menu.hidden = true;
  expiryInput.classList.remove("focused");
  await run.wait(250);
  await press(run, query(root, ".preview-save .mini-primary"));
  await run.wait(180);
  run.animate(scrim, { opacity: 0 }, { duration: 0.2, ease: "easeIn" });
  await run.play(panel, { x: "100%" }, spring(0.4));
  const cells = [
    query(target, ".secret-version"),
    query(target, ".secret-expiry"),
  ];
  run.animate(
    target,
    { backgroundColor: ["#dfe7fb", "#f4f7fe"] },
    { duration: 0.9, ease: "easeOut" },
  );
  await run.play(cells, { opacity: 0, y: -6 }, exit);
  applyUpdate(root);
  await run.play(cells, { opacity: [0, 1], y: [6, 0] }, spring(0.3));
  await run.wait(2600);
  await run.play(scene, { opacity: 0 }, { duration: 0.35, ease: "easeIn" });
}
