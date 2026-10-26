import type { ReactNode } from "react";
import { DesignAsset } from "../DesignAsset";
import { ComingSoon } from "../SiteChrome";

function Card({
  title,
  description,
  children,
  wide = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <article className={`feature-card ${wide ? "wide" : ""}`}>
      <div className="feature-visual" aria-hidden="true">
        {!wide && (
          <DesignAsset section="36545" name="imgGlow" className="card-glow" />
        )}
        {children}
      </div>
      <div className="feature-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </article>
  );
}

export function PlatformCards() {
  return (
    <div className="platform-grid">
      <Card
        wide
        title="Reorganize with AI."
        description="Move secrets, find every affected policy, and verify permissions in one pass."
      >
        <div className="reorganization mini-window">
          <strong>
            <DesignAsset section="platform" name="64:36379" />
            Reorganization plan
          </strong>
          <div className="diff-lines">
            <s>− production/payments/STRIPE_SECRET_KEY</s>
            <b>+ production/shared/STRIPE_SECRET_KEY</b>
            <s>− production/email/RESEND_API_KEY</s>
            <b>+ production/shared/RESEND_API_KEY</b>
          </div>
          <small>AFFECTED POLICIES</small>
          {["checkout-service", "billing-team"].map((name) => (
            <p key={name}>
              {name}
              <span>
                <DesignAsset section="platform" name="64:36400" />
                Updated
              </span>
            </p>
          ))}
          <div className="verified">
            <DesignAsset section="platform" name="64:36410" />
            Permissions verified
          </div>
        </div>
      </Card>
      <Card
        wide
        title="Least privilege by default."
        description="Users and services retrieve only what their policies allow."
      >
        <div className="access-graph">
          <DesignAsset
            section="platform"
            name="64:36418"
            className="graph-connections"
          />
          <div className="graph-users">
            {["alice", "api", "worker"].map((name, i) => (
              <span key={name} className={`graph-person ${name}`}>
                <DesignAsset
                  section="platform"
                  name={["64:36428", "64:36432", "64:36436"][i]}
                />
                {name}
              </span>
            ))}
          </div>
          <span className="graph-denied">
            <DesignAsset section="platform" name="64:36424" />
            denied
          </span>
          <span className="graph-policy">
            <DesignAsset section="platform" name="64:36440" />
            policy · api-read
          </span>
          <span className="graph-secret">
            <DesignAsset section="platform" name="64:36444" />
            production/api/*
          </span>
        </div>
      </Card>
      <Card
        title="Every change, versioned."
        description="Every change in a folder saves a new version. See what changed and when."
      >
        <div className="mini-window version-list">
          <small>production/api/</small>
          {[
            ["v8", "Today"],
            ["v7", "12 days ago"],
            ["v6", "2 months ago"],
            ["v5", "5 months ago"],
          ].map(([version, date], i) => (
            <p key={version}>
              <b className={i === 0 ? "active-version" : ""}>{version}</b>
              <span>{date}</span>
            </p>
          ))}
        </div>
      </Card>
      <Card
        title="See what each service runs."
        description="Check which version of each folder a service has loaded, and spot the ones behind."
      >
        <div className="mini-window service-versions">
          <strong>
            billing-worker <small>production</small>
          </strong>
          {[
            ["api", "v8"],
            ["shared", "v4"],
            ["payments", "v3"],
          ].map(([folder, version]) => (
            <p key={folder}>
              production/{folder}/<span>{version}</span>
              {folder === "shared" && <b>v5 available</b>}
            </p>
          ))}
        </div>
      </Card>
      <Card
        title="Reminders before expiry."
        description="Add optional notes and expiration reminders to any secret."
      >
        <div className="mini-window calendar">
          <strong>November</strong>
          <div>
            {"MTWTFSS".split("").map((day, i) => (
              <small key={i}>{day}</small>
            ))}
            {Array.from({ length: 21 }, (_, i) => (
              <span key={i} className={i === 11 ? "calendar-day" : ""}>
                {i + 3}
              </span>
            ))}
          </div>
          <p>! STRIPE_SECRET_KEY expires in 14 days</p>
        </div>
      </Card>
    </div>
  );
}

export function SecurityCards() {
  return (
    <div className="three-cards">
      <Card
        title="Keys kept apart."
        description="Values are encrypted with keys that live outside the database, so a leak alone reveals nothing."
      >
        <div className="key-stores">
          <div className="mini-window">
            <small>KEY STORE</small>
            <code>root key</code>
          </div>
          <DesignAsset section="36545" name="imgIconLock" />
          <div className="mini-window">
            <small>DATABASE</small>
            <code>x9F2c7…aQ7=</code>
          </div>
        </div>
        <p className="visual-caption">Decrypted only for authorized policies</p>
      </Card>
      <Card
        title="Encrypted at rest and in transit."
        description="Stored values stay encrypted on disk, and every request travels over TLS."
      >
        <div className="encrypted-request mini-window">
          <DesignAsset section="36545" name="imgIconLock1" />
          TLS 1.3 · encrypted transport
        </div>
        <div className="mini-window encrypted-values">
          {["STRIPE_SECRET_KEY", "DATABASE_URL", "RESEND_API_KEY"].map(
            (name) => (
              <p key={name}>
                <code>{name}</code>
                <span>
                  <DesignAsset section="36545" name="imgIconLock2" />
                  x9F2c7…aQ7=
                </span>
              </p>
            ),
          )}
        </div>
      </Card>
      <Card
        title="Kept out of AI chats."
        description="The assistant and coding agents work with paths and policies. Values never enter the conversation."
      >
        <div className="chat-preview">
          <p>Move the Stripe key to production/payments.</p>
          <div className="mini-window">
            <small>Sent to AI</small>
            <dl>
              <div>
                <dt>paths</dt>
                <dd>
                  <code>production/api/DATABASE_URL</code>
                  <code>production/shared/STRIPE_SECRET_KEY</code>
                  <small>+ 5 more</small>
                </dd>
              </div>
              <div>
                <dt>policies</dt>
                <dd>
                  <code>api-read → production/api/*</code>
                  <code>payments-api → production/shared/*</code>
                </dd>
              </div>
              <div>
                <dt>values</dt>
                <dd>
                  <span>
                    <DesignAsset section="36545" name="imgIconLock3" />
                    Never sent
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function AvailabilityCards() {
  return (
    <div className="three-cards">
      <Card
        title="Redundant by design."
        description="Every Keysy service runs on more than one instance, so one failure doesn't stop your reads."
      >
        <div className="mini-window availability-instances">
          <small>API INSTANCES</small>
          {["api-1", "api-2", "api-3"].map((name, i) => (
            <p key={name}>
              <code>{name}</code>
              <span className={i === 1 ? "muted" : ""}>
                {i === 1 ? "Unavailable" : "Serving reads"}
              </span>
            </p>
          ))}
        </div>
        <p className="visual-caption">
          Reads keep working when one instance fails
        </p>
      </Card>
      <Card
        title="Status in the open."
        description="Check the health of every Keysy service on the public status page."
      >
        <div className="system-health">
          <span>All systems operational</span>
          <div className="mini-window">
            <small>SYSTEM STATUS</small>
            {["API", "Auth", "Web app", "Notifications"].map((name) => (
              <p key={name}>
                {name}
                <span>Operational</span>
              </p>
            ))}
          </div>
        </div>
      </Card>
      <article className="feature-card">
        <div className="feature-visual uptime">
          <DesignAsset section="36545" name="imgGlow" className="card-glow" />
          <strong>99.9%</strong>
          <p>Monthly uptime commitment</p>
          <ComingSoon>Uptime SLA</ComingSoon>
        </div>
        <div className="feature-copy">
          <h3>99.9% uptime.</h3>
          <p>Keysy commits to at least 99.9% uptime every month.</p>
        </div>
      </article>
    </div>
  );
}
