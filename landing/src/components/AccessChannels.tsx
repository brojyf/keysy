import { DesignAsset } from "./DesignAsset";

export default function AccessChannels() {
  const channels = [
    ["Web app", "Manage secrets, policies, and audit logs in one workspace."],
    [
      "CLI",
      "Create, update, and retrieve secrets from your terminal. Pull everything a project needs with one command.",
    ],
    ["Browser extension", "Save new API keys straight from provider websites."],
    ["Coding agents", "A Keysy skill guides agents through the CLI."],
  ];
  return (
    <div className="channels">
      {channels.map(([title, description], i) => (
        <article key={title}>
          <div className="channel-icon">
            <DesignAsset
              section="36275"
              name={i === 0 ? "imgIcon" : `imgIcon${i}`}
            />
          </div>
          <h3>{title}</h3>
          <p>{description}</p>
          <div className="channel-preview" aria-hidden="true">
            {i === 0 ? (
              <div className="mini-window tiny-secrets">
                <small>Workspace</small>
                {[
                  "api/DATABASE_URL",
                  "api/REDIS_URL",
                  "shared/STRIPE_SECRET_KEY",
                  "ci/DEPLOY_TOKEN",
                ].map((path) => (
                  <code key={path}>production/{path}</code>
                ))}
              </div>
            ) : i === 1 ? (
              <div className="mini-window tiny-terminal">
                <small>~/payments-api</small>
                <code>$ keysy pull</code>
                <span>→ keysy.toml · payments-api</span>
                <b>✓ Pulled 12 secrets (development)</b>
                <code>$ ▍</code>
              </div>
            ) : i === 2 ? (
              <div className="extension-preview">
                <code>sk_live_51Hc8x…</code>
                <code>• • • • • • • •</code>
                <span>
                  <DesignAsset section="36275" name="imgKeysyMark" />
                  Save to Keysy
                </span>
              </div>
            ) : (
              <div className="agent-preview">
                <div className="agent-transcript">
                  <p>
                    <span className="agent-call-dot">● </span>
                    <b>Skill</b>(keysy)
                  </p>
                  <p className="agent-result">
                    {"  ⎿  Successfully loaded skill"}
                  </p>
                  <p>
                    <span className="agent-call-dot">● </span>
                    <b>Bash</b>(keysy ls production/api)
                  </p>
                  <p className="agent-result">
                    {"  ⎿  3 secrets · values hidden"}
                  </p>
                </div>
                <div className="agent-command">
                  ❯<i />
                </div>
                <p className="agent-status">
                  <b>▸▸ keysy skill on</b>
                  <span> · policy agent-dev</span>
                </p>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
