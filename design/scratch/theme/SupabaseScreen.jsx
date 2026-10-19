import { FauxButton, Icon, Logo } from './PreviewIcons.jsx';

const records = [
  ['STRIPE_SECRET_KEY', 'API key', 'v4', '2 hours ago', true],
  ['DATABASE_URL', 'Connection', 'v2', 'Yesterday'],
  ['AuthKey_Q7X9.p8', 'Private file', 'v1', 'Oct 12, 2026'],
  ['GITHUB_ACCESS_TOKEN', 'API key', 'v3', 'Oct 10, 2026'],
  ['RESEND_API_KEY', 'API key', 'v1', 'Oct 08, 2026'],
  ['WEBHOOK_SIGNING_SECRET', 'Secret', 'v2', 'Oct 06, 2026'],
];

function NavItem({ label, name, active = false, count }) {
  return <div className={`nav-item${active ? ' active' : ''}`}><Icon name={name} /><span>{label}</span>{count && <small>{count}</small>}</div>;
}

export default function SupabaseScreen() {
  return <>
    <div className="studio-topbar">
      <div className="studio-brand"><Logo /><strong>keysy</strong></div>
      <span className="org-avatar">A</span><span>Acme workspace</span><Icon name="down" />
      <span className="slash">/</span><strong>production</strong><span className="branch-badge"><Icon name="branch" />main</span>
      <div className="topbar-end"><FauxButton name="terminal">Connect</FauxButton><span>Docs</span><span className="user-avatar">AL</span></div>
    </div>
    <div className="studio-body">
      <aside className="icon-rail" aria-label="Product tools">
        <div>{['home', 'table', 'terminal'].map((name, index) => <span key={name} className={`rail-item${index === 1 ? ' active' : ''}`}><Icon name={name} /></span>)}
          <hr />{['shield', 'folder', 'clock'].map(name => <span key={name} className="rail-item"><Icon name={name} /></span>)}</div>
        <div><span className="rail-item"><Icon name="settings" /></span><span className="rail-avatar">A</span></div>
      </aside>
      <aside className="resource-sidebar">
        <h2>Secrets</h2>
        <div className="sidebar-section">
          <div className="namespace-select"><span>namespace <strong>kv</strong></span><Icon name="down" /></div>
          <FauxButton name="plus">New collection</FauxButton>
          <div className="sidebar-search"><Icon name="search" /><span>Find a collection…</span></div>
        </div>
        <p className="sidebar-label">COLLECTIONS</p>
        <NavItem label="production" name="folder" active count="6" />
        <NavItem label="staging" name="folder" count="4" />
        <NavItem label="development" name="folder" count="8" />
        <div className="sidebar-divider" />
        <NavItem label="All secrets" name="key" count="18" />
        <NavItem label="Private files" name="file" count="3" />
        <div className="sidebar-bottom"><span className="small-dot" /> All changes saved</div>
      </aside>
      <div className="studio-editor">
        <div className="editor-tabs">
          <span className="editor-tab selected"><Icon name="folder" />production<span className="tab-close">×</span></span>
          <span className="editor-tab"><Icon name="folder" />staging</span><span className="tab-add"><Icon name="plus" /></span>
        </div>
        <div className="editor-toolbar">
          <span><Icon name="filter" />Filter</span><span>↕ &nbsp;Sort</span><span className="toolbar-divider" />
          <FauxButton name="plus" primary>New secret</FauxButton><span className="toolbar-spacer" />
          <span className="policy-label"><Icon name="shield" />Policy enabled</span>
        </div>
        <div className="editor-workspace">
          <div className="table-pane">
            <table className="secrets-table">
              <thead><tr><th><span className="checkbox" /></th><th><Icon name="key" />Name</th><th>Type</th><th>Version</th><th>Updated</th></tr></thead>
              <tbody>{records.map(([name, type, version, updated, selected]) => <tr key={name} className={selected ? 'selected-row' : undefined}>
                <td><span className={`checkbox${selected ? ' checked' : ''}`}>{selected ? '✓' : ''}</span></td>
                <td className="secret-name">{name}</td><td>{type}</td><td><span className="version">{version}</span></td><td>{updated}</td>
              </tr>)}</tbody>
            </table>
            <div className="table-space"><span>6 secrets in production</span></div>
            <div className="table-bottom"><span><Icon name="table" />Table view</span><span>6 records<span className="bottom-separator">|</span>Page 1 of 1 &nbsp; ‹ &nbsp; ›</span></div>
          </div>
          <aside className="secret-detail">
            <div className="detail-heading"><span><Icon name="key" />Secret details</span><span>×</span></div>
            <div className="detail-content">
              <span className="eyebrow">PRODUCTION</span><h3>STRIPE_SECRET_KEY</h3>
              <div className="detail-tags"><span className="type-tag">API key</span><span className="accent-tag">Version 4</span></div>
              <label>Secret value</label><div className="secret-value"><span>••••••••••••••••</span><Icon name="copy" /></div>
              <p className="detail-hint">Values stay hidden until revealed.</p><div className="detail-rule" />
              <dl><div><dt>Path</dt><dd>kv / production</dd></div><div><dt>Last updated</dt><dd>2 hours ago</dd></div><div><dt>Updated by</dt><dd>Alex Lee</dd></div></dl>
              <label>Access policy</label><div className="access-policy"><Icon name="shield" />production-readonly<Icon name="arrow" /></div>
              <div className="detail-rule" /><label>Recent activity</label>
              <div className="activity-item"><span className="activity-dot" /><div>Secret updated<small>Alex Lee · 2 hours ago</small></div></div>
              <div className="activity-item"><span className="activity-dot" /><div>Secret accessed<small>service-api · 3 hours ago</small></div></div>
            </div>
            <div className="detail-footer"><FauxButton name="clock">View audit log</FauxButton></div>
          </aside>
        </div>
      </div>
    </div>
  </>;
}
