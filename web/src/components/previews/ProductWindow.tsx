import { useCallback, useRef, useState } from "react";
import type { OrbState } from "thinking-orbs";
import HeroAssistant from "./HeroAssistant";
import UpdateSecretPanel from "./UpdateSecretPanel";
import { secretRows } from "./previewContent";
import { usePreviewPlayback } from "./usePreviewPlayback";
import { playHeroStory, renderHeroFinal } from "./heroStory";
import { playUpdateStory, renderUpdateFinal } from "./updateSecretStory";
import type { PreviewPlayback } from "./previewPlayback";
import { DesignAsset } from "../DesignAsset";

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
  const scope = useRef<HTMLDivElement>(null);
  const [orbState, setOrbState] = useState<OrbState | null>(null);
  const heroStory = useCallback(
    (run: PreviewPlayback, root: HTMLElement) =>
      playHeroStory(run, root, setOrbState),
    [],
  );
  const heroFinal = useCallback((root: HTMLElement) => {
    setOrbState(null);
    renderHeroFinal(root);
  }, []);
  const { active } = usePreviewPlayback(
    scope,
    update ? playUpdateStory : heroStory,
    update ? renderUpdateFinal : heroFinal,
    update,
  );
  const rows = update
    ? [secretRows[0], ...secretRows.slice(2, 6), secretRows[1], secretRows[6]]
    : secretRows;

  return (
    <div
      ref={scope}
      className={`product-stage ${update ? "dashboard-stage" : ""} ${active ? "" : "preview-paused"}`}
    >
      <div className="preview-scene">
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
                  <DesignAsset
                    key={i}
                    section="36008"
                    loading={update ? "lazy" : "eager"}
                    name="imgEllipse1"
                  />
                ))}
              </div>
              <span>
                <DesignAsset
                  section="36008"
                  loading={update ? "lazy" : "eager"}
                  name="imgIconLock"
                />{" "}
                keysy / acme / production
              </span>
            </div>
            <div className="product-body">
              <aside className="product-sidebar">
                <strong>Workspace</strong>
                {navItems.map((item, i) => (
                  <div key={item} className={i === 0 ? "selected" : ""}>
                    <DesignAsset
                      section="36008"
                      loading={update ? "lazy" : "eager"}
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
                  <DesignAsset
                    section="36008"
                    loading={update ? "lazy" : "eager"}
                    name="imgIconSearch"
                  />
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
                      const split = path.lastIndexOf("/") + 1;
                      const secretKey = path.slice(split);
                      return (
                        <tr
                          key={path}
                          data-secret={secretKey}
                          className={!update && i < 2 ? "highlighted" : ""}
                        >
                          <td title={path}>
                            <span className="path-prefix">
                              {path.slice(0, split)}
                            </span>
                            <span className="secret-key">{secretKey}</span>
                          </td>
                          <td>
                            <span className="secret-version">{version}</span>
                          </td>
                          <td>
                            <span
                              className={`secret-expiry ${expiry === "—" ? "" : "expiry"}`}
                            >
                              {expiry}
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
              {update && <div className="preview-scrim" />}
              <aside className="product-panel">
                {update ? (
                  <UpdateSecretPanel />
                ) : (
                  <HeroAssistant orbState={orbState} active={active} />
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
                  <DesignAsset
                    key={name}
                    section="36008"
                    loading={update ? "lazy" : "eager"}
                    name={name}
                  />
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
                production/api/REDIS_URL v6 —{"\n"}production/api/SENTRY_DSN v7
                —{"\n\n"}$ keysy get production/api/DATABASE_URL{"\n"}
                <em>✓ authorized by policy api-read</em>
                {"\n"}postgres://app:••••••••@db.internal:5432{"\n\n"}$ keysy
                get production/shared/STRIPE_SECRET_KEY{"\n"}
                <span className="code-error">✗ denied by policy api-read</span>
                {"\n\n"}$ ▍
              </code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
