import { DesignAsset } from "./DesignAsset";

export function ComingSoon({
  children,
  primary = false,
  className = "",
}: {
  children: React.ReactNode;
  primary?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`unavailable ${primary ? "primary" : ""} ${className}`}
      aria-disabled="true"
    >
      {children}
    </span>
  );
}

export function Actions() {
  return (
    <div className="actions">
      <ComingSoon primary>Create a workspace</ComingSoon>
      <ComingSoon>Read the docs</ComingSoon>
    </div>
  );
}

export function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a href="/" aria-label="Keysy home">
          <DesignAsset section="36000" name="imgKeysyLogo" loading="eager" />
        </a>
        <ComingSoon className="sign-in">Sign in</ComingSoon>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="section site-footer">
      <div className="section-inner">
        <div className="footer-row">
          <div className="footer-brand">
            <a href="/" aria-label="Keysy home">
              <DesignAsset section="36000" name="imgKeysyLogo" />
            </a>
            <p>A simpler home for your secrets.</p>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <div>
              <h3>Product</h3>
              <a href="/#dashboard">Dashboard</a>
              <a href="/#workflow">CLI</a>
              <ComingSoon>Browser extension</ComingSoon>
            </div>
            <div>
              <h3>Developers</h3>
              <ComingSoon>Documentation</ComingSoon>
              <ComingSoon>Agent skill</ComingSoon>
              <a href="/#sdks">SDKs</a>
              <a href="https://github.com/brojyf/keysy">GitHub</a>
            </div>
            <div>
              <h3>Support</h3>
              <ComingSoon>Contact support</ComingSoon>
              <ComingSoon>System status</ComingSoon>
            </div>
            <div>
              <h3>Legal</h3>
              <a href="/terms/">Terms of Use</a>
              <a href="/policy/">Privacy Policy</a>
            </div>
          </nav>
        </div>
        <p className="copyright">
          © 2026 Keysy · Product previews use illustrative data
        </p>
      </div>
    </footer>
  );
}
