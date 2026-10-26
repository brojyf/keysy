import { DesignAsset } from "./DesignAsset";
import { SyntaxCode } from "./SdkShowcase";

const commands = `# 01–02 · Create a secret with a note and reminder
$ keysy set production/shared/STRIPE_SECRET_KEY
    --note "Rotate in the Stripe dashboard" --expires 90d
✓ Saved · production/shared is now v5

# 03 · Allow a service to read it
$ keysy policy allow checkout-service read production/shared/*
✓ Policy updated · permissions verified

# 04 · Retrieve it locally
$ keysy get production/shared/STRIPE_SECRET_KEY
sk_live_••••••••••••••••`;

export default function Workflow() {
  return (
    <div className="split-section">
      <div>
        <div className="section-heading">
          <p className="eyebrow">Workflow</p>
          <h2>
            From new secret to
            <br />
            first retrieval.
          </h2>
          <p>
            Create it in the web app or CLI, grant access, and fetch it locally
            or at runtime.
          </p>
        </div>
        <ol className="workflow-steps">
          {[
            ["Create a secret", "Choose a storage path and value."],
            ["Add context", "Optional notes and an expiration reminder."],
            ["Assign a policy", "Allow a user or service to read it."],
            ["Retrieve it", "Locally for development, or at runtime."],
          ].map(([title, description], i) => (
            <li key={title}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="workflow-terminal">
        <DesignAsset
          section="36776"
          name="imgEllipse"
          className="workflow-glow"
        />
        <div className="terminal-bar">
          <span className="terminal-lights">
            {["imgEllipse1", "imgEllipse2", "imgEllipse3"].map((name) => (
              <DesignAsset key={name} section="36776" name={name} />
            ))}
          </span>
          <span className="terminal-tab">Terminal</span>
        </div>
        <pre>
          <SyntaxCode code={commands} />
        </pre>
        <div className="terminal-footer">
          <span>Illustrative commands</span>
          <span>zsh · ~/acme</span>
        </div>
      </div>
    </div>
  );
}
