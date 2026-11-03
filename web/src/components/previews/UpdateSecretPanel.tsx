export default function UpdateSecretPanel() {
  return (
    <>
      <strong>Update secret</strong>
      <div className="preview-fields">
        <div>
          <span>Path</span>
          <div className="preview-path">
            production/shared/STRIPE_SECRET_KEY
          </div>
        </div>
        <div>
          <span>Value</span>
          <div className="preview-value-input">
            <span className="preview-value">••••••••••••••••••</span>
            <small>Hidden</small>
          </div>
        </div>
        <div className="preview-expiry-field">
          <span>Expires</span>
          <div className="preview-expiry-input">
            <span className="preview-expiry">in 90 days</span>
            <small>⌄</small>
          </div>
          <div className="preview-expiry-menu" hidden>
            {["Never", "in 30 days", "in 90 days"].map((option) => (
              <div key={option}>{option}</div>
            ))}
          </div>
        </div>
        <div>
          <span>Note</span>
          <div>Rotate in the Stripe dashboard</div>
        </div>
      </div>
      <div className="preview-save">
        <span>Cancel</span>
        <span className="mini-primary">Save secret</span>
      </div>
    </>
  );
}
