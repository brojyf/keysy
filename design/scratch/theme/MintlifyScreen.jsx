import { Icon, Logo } from './PreviewIcons.jsx';

// Text and directory rows are copied from mintlify-copy/index.mdx.
export const directoryRows = [
  ['web/', 'React and TypeScript web app, built with Vite.'],
  ['cli/', 'Go CLI, built with Cobra.'],
  ['api/', 'Reserved for the application API service.'],
  ['auth/', 'Reserved for the authentication service.'],
  ['notify/', 'Reserved for the notification service.'],
  ['contracts/openapi/', 'Shared OpenAPI definitions for the API and authentication services.'],
  ['docs/', 'Mintlify documentation and site configuration.'],
  ['deploy/', 'Deployment configuration.'],
  ['otel/', 'OpenTelemetry Collector Docker image definition.'],
  ['supabase/', 'Reserved for Supabase configuration.'],
];

export default function MintlifyScreen() {
  return <>
    <div className="mint-topbar">
      <div className="mint-brand"><Logo /><strong>keysy</strong><span>docs</span></div>
      <div className="mint-search"><Icon name="search" /><span>Search documentation…</span><kbd>⌘ K</kbd></div>
      <div className="mint-links"><span>GitHub ↗</span><Icon name="settings" /></div>
    </div>
    <div className="mint-topnav">{['Overview', 'API', 'Auth', 'Notify', 'CLI', 'Web'].map((label, index) =>
      <span key={label} className={index === 0 ? 'active' : undefined}>{label}</span>)}</div>
    <div className="mint-body">
      <aside className="mint-sidebar">
        <span className="mint-nav-heading">General</span><div className="mint-nav-selected"><Icon name="book" />Introduction</div>
        <div className="mint-sidebar-foot"><Icon name="book" />Powered by Mintlify</div>
      </aside>
      <article className="mint-article">
        <p className="mint-eyebrow">General</p><h1>Introduction</h1>
        <p className="mint-description">Understand Keysy's monorepo and find the code you need.</p>
        <p className="mint-intro">Keysy uses a <strong>monorepo</strong>: the web app, CLI, service directories, API contracts, and infrastructure files live in a single Git repository.</p>
        <h2>Repository structure</h2>
        <table className="directory-table">
          <thead><tr><th>Directory</th><th>Purpose</th></tr></thead>
          <tbody>{directoryRows.map(([directory, purpose]) => <tr key={directory}><td><code>{directory}</code></td><td>{purpose}</td></tr>)}</tbody>
        </table>
        <div className="mint-feedback"><span>Was this page helpful?</span><span className="feedback-choice">Yes</span><span className="feedback-choice">No</span></div>
      </article>
      <aside className="mint-toc"><span>On this page</span><div>Repository structure</div></aside>
    </div>
  </>;
}
