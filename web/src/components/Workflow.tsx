import { DesignAsset } from "./DesignAsset";
import { TerminalPrompt, TerminalWindow } from "./TerminalWindow";

export default function Workflow() {
  return (
    <div className="split-section">
      <div>
        <div className="section-heading">
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
      <TerminalWindow className="workflow-terminal" folder="acme">
        <DesignAsset
          section="36776"
          name="imgEllipse"
          className="workflow-glow"
        />
        <pre>
          <code>
            {"# 01–02 · Create a secret with a note and reminder\n"}
            <TerminalPrompt folder="acme" />
            <b>{"keysy set "}</b>
            {"production/shared/STRIPE_SECRET_KEY\n"}
            <b>{"    --note "}</b>
            {'"Rotate in the Stripe dashboard"'}
            <b>{" --expires "}</b>
            {"90d\n"}
            <em>✓ Saved · production/shared is now v5</em>
            {"\n\n# 03 · Allow a service to read it\n"}
            <TerminalPrompt folder="acme" />
            <b>{"keysy policy allow "}</b>
            {"checkout-service \\\n"}
            <b>{"    read "}</b>
            {"production/shared/*\n"}
            <em>✓ Policy updated · permissions verified</em>
            {"\n\n# 04 · Retrieve it locally\n"}
            <TerminalPrompt folder="acme" />
            <b>{"keysy get "}</b>
            {"production/shared/STRIPE_SECRET_KEY\nsk_live_"}
            <span className="terminal-accent">••••••••••••••••</span>
            {"\n"}
            <TerminalPrompt folder="acme" />▍
          </code>
        </pre>
      </TerminalWindow>
    </div>
  );
}
