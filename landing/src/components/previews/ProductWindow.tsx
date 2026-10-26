import { useEffect, useState } from "react";
import { DesignAsset } from "../DesignAsset";

const secretRows = [
  ["production/shared/STRIPE_SECRET_KEY", "v5", "in 14 days"],
  ["production/shared/RESEND_API_KEY", "v5", "—"],
  ["production/api/DATABASE_URL", "v8", "—"],
  ["production/api/REDIS_URL", "v6", "—"],
  ["production/api/SENTRY_DSN", "v7", "—"],
  ["production/payments/WEBHOOK_SECRET", "v3", "in 30 days"],
  ["production/ci/DEPLOY_TOKEN", "v2", "—"],
];
const prompt = "Move the Stripe and Resend keys into production/shared.";
const navItems = [
  "Secrets",
  "Access policies",
  "Version history",
  "Audit logs",
  "AI assistant",
];

export default function ProductWindow({
  update = false,
}: {
  update?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (update) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setPlaying(!preference.matches);
      setProgress(preference.matches ? 100 : 0);
    };
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, [update]);
  useEffect(() => {
    if (!playing || update) return;
    const timer = window.setInterval(
      () => setProgress((value) => (value + 1) % 330),
      45,
    );
    return () => window.clearInterval(timer);
  }, [playing, update]);
  const moved = progress >= 85;
  const sent = progress >= 65;
  const finished = progress >= 100;
  const rows = update
    ? [secretRows[0], ...secretRows.slice(2, 6), secretRows[1], secretRows[6]]
    : secretRows;

  return (
    <div className={`product-stage ${update ? "dashboard-stage" : ""}`}>
      <div className="product-scale">
        {update && (
          <DesignAsset
            section="36620"
            name="imgGlowBlue"
            className="dashboard-glow"
          />
        )}
        <div
          className="product-window"
          role="img"
          aria-label={
            update
              ? "Illustrative Keysy dashboard showing an update to a secret"
              : "Illustrative Keysy dashboard with an AI assistant reorganizing secrets"
          }
        >
          <div className="window-chrome">
            <div className="window-dots">
              {[0, 1, 2].map((i) => (
                <DesignAsset key={i} section="36008" name="imgEllipse1" />
              ))}
            </div>
            <span>
              <DesignAsset section="36008" name="imgIconLock" /> keysy / acme /
              production
            </span>
          </div>
          <div className="product-body">
            <aside className="product-sidebar">
              <strong>Workspace</strong>
              {navItems.map((item, i) => (
                <div key={item} className={i === 0 ? "selected" : ""}>
                  <DesignAsset
                    section="36008"
                    name={i ? `imgIcon${i}` : "imgIcon"}
                  />
                  {item}
                </div>
              ))}
            </aside>
            <div className="product-main">
              <div className="product-heading">
                <div>
                  <strong>Secrets</strong>
                  <p>Everything in its right place.</p>
                </div>
                <div className="product-tools">
                  <span className="environment">
                    <b>Production</b> Development
                  </span>
                  <span className="mini-primary">+ New secret</span>
                </div>
              </div>
              <div className="product-search">
                <DesignAsset section="36008" name="imgIconSearch" />
                Search secrets<kbd>⌘K</kbd>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Path</th>
                    <th>Changed in</th>
                    <th>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([path, version, expiry], i) => {
                    const displayPath =
                      !update && !moved && i < 2
                        ? path.replace("shared", i === 0 ? "payments" : "email")
                        : path;
                    return (
                      <tr
                        key={path}
                        className={
                          (update ? i === 0 : moved && i < 2)
                            ? "highlighted"
                            : ""
                        }
                      >
                        <td title={displayPath}>{displayPath}</td>
                        <td>
                          {saved && path.includes("/shared/") ? "v6" : version}
                        </td>
                        <td>
                          <span className={expiry === "—" ? "" : "expiry"}>
                            {saved && i === 0 ? "in 90 days" : expiry}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="product-note">
                7 secrets · Values hidden by default
              </p>
            </div>
            <aside className="product-panel">
              {update ? (
                <>
                  <strong>Update secret</strong>
                  <div className="preview-fields">
                    {[
                      ["Path", "production/shared/STRIPE_SECRET_KEY"],
                      ["Value", "••••••••••••••••••"],
                      ["Expires", "in 90 days"],
                      ["Note", "Rotate in the Stripe dashboard"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <div>{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="preview-save">
                    <span>Cancel</span>
                    <span className="mini-primary">
                      {saved ? "Secret saved" : "Save secret"}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <strong>
                    <DesignAsset section="36008" name="imgIconSparkle" />
                    AI assistant
                  </strong>
                  <div className="assistant-thread" aria-hidden="true">
                    {sent && <p className="assistant-prompt">{prompt}</p>}
                    {sent && !finished && (
                      <p className="thinking">
                        {moved ? "Verifying permissions…" : "Moving 2 secrets…"}
                      </p>
                    )}
                    {finished && (
                      <div className="assistant-reply">
                        <p>
                          Done. I moved 2 secrets and updated the policies that
                          use them.
                        </p>
                        <div>
                          {[
                            "2 secrets moved",
                            "2 policies updated",
                            "Permissions verified",
                          ].map((text, i) => (
                            <p key={text}>
                              <DesignAsset
                                section="36008"
                                name={`imgIcon${i + 5}`}
                              />
                              {text}
                            </p>
                          ))}
                        </div>
                        <span>View changes →</span>
                      </div>
                    )}
                  </div>
                  <div className="assistant-input">
                    {sent
                      ? "Ask about your secrets"
                      : prompt.slice(0, Math.max(0, progress - 12))}
                    <b>↑</b>
                  </div>
                </>
              )}
            </aside>
          </div>
        </div>
      </div>
      {!update && (
        <div className="hero-terminal" aria-hidden="true">
          <div className="terminal-bar">
            <span className="terminal-lights">
              {["imgEllipse2", "imgEllipse3", "imgEllipse4"].map((name) => (
                <DesignAsset key={name} section="36008" name={name} />
              ))}
            </span>
            ~/acme/api — zsh
          </div>
          <pre>
            <code>
              <span>$ keysy login</span>
              {"\n"}
              <em>✓ Signed in as alice · workspace acme</em>
              {"\n\n"}$ keysy ls production/api{"\n"}
              <span className="code-comment">PATH CHANGED EXPIRES</span>
              {"\n"}production/api/DATABASE_URL v8 —{"\n"}
              production/api/REDIS_URL v6 —{"\n"}production/api/SENTRY_DSN v7 —
              {"\n\n"}$ keysy get production/api/DATABASE_URL{"\n"}
              <em>✓ authorized by policy api-read</em>
              {"\n"}postgres://app:••••••••@db.internal:5432{"\n\n"}$ keysy get
              production/shared/STRIPE_SECRET_KEY{"\n"}
              <span className="code-error">✗ denied by policy api-read</span>
              {"\n\n"}$ ▍
            </code>
          </pre>
        </div>
      )}
      <button
        type="button"
        className="demo-control"
        onClick={() =>
          update ? setSaved((value) => !value) : setPlaying((value) => !value)
        }
      >
        {update
          ? saved
            ? "Reset demo"
            : "Play update demo"
          : playing
            ? "Pause demo"
            : "Play demo"}
      </button>
      {update && (
        <span className="sr-only" role="status">
          {saved
            ? "Illustrative secret updated. Folder version v6. Reminder in 90 days."
            : ""}
        </span>
      )}
    </div>
  );
}
