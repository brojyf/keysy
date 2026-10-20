import { useRef, useState, type ComponentType, type InputHTMLAttributes, type ReactNode } from 'react';
import type { Selection } from './catalog';
import type { PaletteColors } from './theme';

export type ButtonProps = { children: ReactNode; secondary?: boolean; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean };
export type BadgeProps = { children: ReactNode; status?: boolean };
type InputProps = Pick<InputHTMLAttributes<HTMLInputElement>, 'id' | 'aria-label' | 'placeholder' | 'onChange' | 'required' | 'pattern' | 'title' | 'autoFocus' | 'readOnly'> & { type?: 'text' | 'search' | 'password'; value?: string };
export type Controls = {
  Button: ComponentType<ButtonProps>;
  Input: ComponentType<InputProps>;
  Badge: ComponentType<BadgeProps>;
};
export type DemoProps = { selection: Selection; colors: PaletteColors };

const initialSecrets = [
  { name: 'STRIPE_SECRET_KEY', value: 'demo_stripe_not_a_real_key', service: 'Payments', updated: '2 hours ago' },
  { name: 'DATABASE_URL', value: 'postgresql://example.invalid/keysy', service: 'Database', updated: '5 hours ago' },
  { name: 'RESEND_API_KEY', value: 'demo_resend_not_a_real_key', service: 'Email', updated: '1 day ago' },
  { name: 'GITHUB_CLIENT_SECRET', value: 'demo_github_not_a_real_key', service: 'Authentication', updated: '2 days ago' },
  { name: 'S3_ACCESS_KEY', value: 'demo_storage_not_a_real_key', service: 'Storage', updated: '3 days ago' },
];

export default function Workspace({ controls, tableClassName = '' }: { controls: Controls; tableClassName?: string }) {
  const { Button, Input, Badge } = controls;
  const [secrets, setSecrets] = useState(initialSecrets);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(initialSecrets[0].name);
  const [revealed, setRevealed] = useState(false);
  const [secretName, setSecretName] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [nameError, setNameError] = useState('');
  const [message, setMessage] = useState('All changes saved locally.');
  const dialog = useRef<HTMLDialogElement>(null);
  const active = secrets.find(secret => secret.name === selected)!;
  const filtered = secrets.filter(secret => `${secret.name} ${secret.service}`.toLowerCase().includes(query.toLowerCase()));

  function addSecret(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = secretName.trim();
    if (secrets.some(secret => secret.name === name)) {
      setNameError('A secret with this name already exists.');
      return;
    }
    setSecrets(current => [...current, { name, value: secretValue, service: 'Application', updated: 'Just now' }]);
    setSelected(name);
    setRevealed(false);
    setQuery('');
    setSecretName('');
    setSecretValue('');
    dialog.current?.close();
    setMessage(`${name} added to this preview only.`);
  }

  return <div className="demo-workspace">
    <header className="demo-topbar">
      <a className="demo-brand" href="#secrets"><span aria-hidden="true">k</span>keysy</a>
      <span className="demo-breadcrumb">Acme / <strong>Web application</strong></span>
      <Badge>Pro workspace</Badge><span className="demo-avatar" aria-label="Demo account">JD</span>
    </header>
    <div className="demo-body">
      <aside className="demo-sidebar" aria-label="Workspace context">
        <p className="demo-label">WORKSPACE</p>
        <span className="demo-nav-item">Overview</span>
        <a href="#secrets" className="demo-nav-item demo-nav-active" aria-current="page">Secrets <span>{secrets.length}</span></a>
        <span className="demo-nav-item">Access policies</span><span className="demo-nav-item">Audit logs</span>
        <p className="demo-label demo-environments">ENVIRONMENT</p>
        <div className="demo-environment"><i aria-hidden="true" /> Production</div>
        <div className="demo-sidebar-bottom"><span className="demo-avatar">A</span><div>Acme organization<small>Developer workspace</small></div></div>
      </aside>
      <main className="demo-main" id="secrets">
        <div className="demo-page-heading"><div><p className="demo-label">WEB APPLICATION / PRODUCTION</p><h1>Secrets</h1><p>Manage the credentials that keep your application running.</p></div>
          <Button onClick={() => { setNameError(''); dialog.current?.showModal(); }}>+ Add secret</Button>
        </div>
        <div className="demo-summary"><div><span>Total secrets</span><strong>{secrets.length.toString().padStart(2, '0')}</strong></div><div><span>Environment</span><strong>Production</strong></div><div><span>Protection</span><Badge status>Encrypted</Badge></div></div>
        <div className="demo-toolbar"><div className="demo-search"><Input type="search" aria-label="Search secrets" placeholder="Search secrets…" value={query} onChange={event => setQuery(event.target.value)} /></div><Badge>Production</Badge><span className="demo-record-count">{filtered.length} records</span></div>
        <div className="demo-table-scroll"><table className={`demo-table ${tableClassName}`} aria-label="Secrets">
          <thead><tr><th scope="col">Name</th><th scope="col">Service</th><th scope="col">Status</th><th scope="col">Last updated</th></tr></thead>
          <tbody>{filtered.map(secret => <tr key={secret.name} data-selected={selected === secret.name}>
            <td><button type="button" className="demo-row-select" aria-pressed={selected === secret.name} onClick={() => { setSelected(secret.name); setRevealed(false); }}><span aria-hidden="true">⌘</span>{secret.name}</button></td>
            <td>{secret.service}</td><td><Badge status>Active</Badge></td><td>{secret.updated}</td>
          </tr>)}</tbody>
        </table>{filtered.length === 0 && <p className="demo-empty">No secrets match your search.</p>}</div>
        <section className="demo-detail" aria-label="Selected secret">
          <div className="demo-detail-heading"><div><p className="demo-label">SELECTED SECRET</p><h2>{active.name}</h2></div><Badge>Read / Write</Badge></div>
          <label htmlFor="selected-secret-value" className="demo-field-label">Value</label>
          <div className="demo-value"><Input id="selected-secret-value" aria-label="Selected secret value" readOnly type={revealed ? 'text' : 'password'} value={active.value} /><Button secondary onClick={() => setRevealed(value => !value)}>{revealed ? 'Hide value' : 'Reveal value'}</Button></div>
          <p className="demo-hint">Fictional credentials. Revealing a value affects only this local preview.</p>
        </section>
        <footer className="demo-local-status"><span role="status" aria-live="polite">{message}</span><span>No API connection</span></footer>
      </main>
    </div>
    <dialog ref={dialog} className="demo-dialog" aria-labelledby="new-secret-title">
      <form onSubmit={addSecret}>
        <h2 id="new-secret-title">Add secret</h2><p>Create a fictional credential for this preview.</p>
        <label id="new-secret-name-label" className="demo-field-label" htmlFor="new-secret-name">Name</label>
        <Input id="new-secret-name" autoFocus required pattern="[A-Z][A-Z0-9_]*" title="Use uppercase letters, numbers, and underscores; start with a letter." value={secretName} onChange={event => { setSecretName(event.target.value); setNameError(''); }} placeholder="EXAMPLE_API_KEY" />
        <label id="new-secret-value-label" className="demo-field-label" htmlFor="new-secret-value">Value</label>
        <Input id="new-secret-value" required type="password" value={secretValue} onChange={event => setSecretValue(event.target.value)} placeholder="Enter a fictional value" />
        {nameError && <p role="alert" className="demo-error">{nameError}</p>}
        <p className="demo-hint">Preview only. Never enter real credentials.</p>
        <div className="demo-dialog-actions"><Button secondary onClick={() => dialog.current?.close()}>Cancel</Button><Button type="submit">Save secret</Button></div>
      </form>
    </dialog>
  </div>;
}
