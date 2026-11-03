export const secretRows = [
  ["production/shared/STRIPE_SECRET_KEY", "v5", "in 14 days"],
  ["production/shared/RESEND_API_KEY", "v5", "—"],
  ["production/api/DATABASE_URL", "v8", "—"],
  ["production/api/REDIS_URL", "v6", "—"],
  ["production/api/SENTRY_DSN", "v7", "—"],
  ["production/payments/WEBHOOK_SECRET", "v3", "in 30 days"],
  ["production/ci/DEPLOY_TOKEN", "v2", "—"],
];
export const prompt = "Move the Stripe and Resend keys into production/shared.";

export function resetRows(root: HTMLElement) {
  for (const row of root.querySelectorAll<HTMLElement>("tbody tr")) {
    const [path, version, expiry] = secretRows.find(([path]) =>
      path.endsWith(`/${row.dataset.secret}`),
    )!;
    row.classList.remove("highlighted");
    row.removeAttribute("style");
    row.querySelector<HTMLElement>("td")!.title = path;
    row.querySelector<HTMLElement>(".path-prefix")!.textContent = path.slice(
      0,
      path.lastIndexOf("/") + 1,
    );
    row.querySelector<HTMLElement>(".secret-version")!.textContent = version;
    row.querySelector<HTMLElement>(".secret-expiry")!.textContent = expiry;
    for (const child of row.querySelectorAll<HTMLElement>("[style]"))
      child.removeAttribute("style");
  }
}
