import { useEffect, useRef, useState } from 'react';
import LogoPreview from './logo/LogoPreview.jsx';
import CssPreview from './css/CssPreview';
import candidates from './logo/candidates.json';
import { palettes } from '../theme/palettes.js';

const tabs = ['Logo', 'CSS'];

function initialTab() {
  const tab = new URLSearchParams(location.search).get('tab');
  if (tab === 'logo' || tab === 'css') return tab;
  if (/\/css(?:\/|$)/.test(location.pathname)) return 'css';
  return 'logo';
}

export default function DesignStudio() {
  const [activeTab, setActiveTab] = useState(initialTab);
  const buttons = useRef([]);

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('tab', activeTab);
    history.replaceState(null, '', url);
    document.title = `Keysy — ${tabs.find(label => label.toLowerCase() === activeTab)} · Design Studio`;
  }, [activeTab]);

  function navigateTabs(event, index) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    setActiveTab(tabs[next].toLowerCase());
    buttons.current[next].focus();
  }

  return <div className="design-studio">
    <header className="design-header">
      <div className="design-header-inner">
        <div className="design-brand"><strong>keysy<span>↗</span></strong><span>Design Studio</span></div>
        <div className="design-tabs" role="tablist" aria-label="Design studies">
          {tabs.map((label, index) => {
            const id = label.toLowerCase();
            return <button key={id} ref={element => { buttons.current[index] = element; }} type="button"
              role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={activeTab === id}
              tabIndex={activeTab === id ? 0 : -1} onClick={() => setActiveTab(id)} onKeyDown={event => navigateTabs(event, index)}>
              {label === 'Logo'
                ? <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="4" /><path d="m7 13 3-6 3 6M8 11h4" /></svg>
                : <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7" cy="7" r="4" /><circle cx="13" cy="7" r="4" /><circle cx="10" cy="13" r="4" /></svg>}
              {label}
            </button>;
          })}
        </div>
        <span className="design-meta">{candidates.length} marks <span>·</span> {palettes.length} color systems</span>
      </div>
    </header>
    <main>
      <section id="panel-logo" role="tabpanel" aria-labelledby="tab-logo" hidden={activeTab !== 'logo'} tabIndex={0}>
        <LogoPreview />
      </section>
      <section id="panel-css" role="tabpanel" aria-labelledby="tab-css" hidden={activeTab !== 'css'} tabIndex={0}>
        <CssPreview active={activeTab === 'css'} />
      </section>
    </main>
    <footer className="design-footer"><span>KEYSY / DESIGN STUDIES</span><p>A space to explore. Not production UI.</p></footer>
  </div>;
}
