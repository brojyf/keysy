import { useEffect, useRef, useState } from 'react';
import { palettes } from './palettes.js';
import SupabaseScreen from './SupabaseScreen.jsx';
import MintlifyScreen from './MintlifyScreen.jsx';

function initialSelection() {
  const params = new URLSearchParams(location.search);
  return {
    layout: params.get('layout') === 'mintlify' ? 'mintlify' : 'supabase',
    paletteId: palettes.find(palette => palette.id === params.get('palette'))?.id || palettes[0].id,
    mode: params.get('mode') === 'dark' ? 'dark' : 'light',
  };
}

function Screen({ palette, mode, layout }) {
  const viewport = useRef(null);
  useEffect(() => {
    const observer = new ResizeObserver(entries => entries.forEach(({ target, contentRect }) => {
      target.style.setProperty('--screen-scale', contentRect.width / 1200);
    }));
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={viewport} className="screen-viewport">
    <div className={`mock-screen ${layout}`} data-palette={palette.id} data-mode={mode}
      style={Object.fromEntries(Object.entries(palette[mode]).map(([role, color]) => [`--${role}`, color]))}
      role="img" aria-label={`${palette.number} ${palette.name} · ${layout === 'supabase' ? 'Supabase Dashboard' : 'Mintlify docs'} · ${mode === 'light' ? 'Light' : 'Dark'}`}>
      {layout === 'supabase' ? <SupabaseScreen /> : <MintlifyScreen />}
    </div>
  </div>;
}

export default function ThemePreview() {
  const [{ layout, paletteId, mode }, setSelection] = useState(initialSelection);
  const focus = useRef(null);
  const palette = palettes.find(option => option.id === paletteId);
  const select = changes => setSelection(selection => ({ ...selection, ...changes }));

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('layout', layout);
    url.searchParams.set('palette', paletteId);
    url.searchParams.set('mode', mode);
    history.replaceState(null, '', url);
  }, [layout, paletteId, mode]);

  function expand(paletteId, mode) {
    select({ paletteId, mode });
    focus.current.scrollIntoView({ behavior: 'instant', block: 'start' });
  }

  return <>
    <header className="workbench-header">
      <div className="workbench-heading"><a href="../logo/">keysy / logo selection</a><span>8 palettes · 2 layouts · Light and dark</span></div>
      <div className="workbench-controls">
        <div className="segmented" role="group" aria-label="Reference layout">
          {['supabase', 'mintlify'].map(option => <button key={option} type="button" data-layout={option}
            aria-pressed={layout === option} onClick={() => select({ layout: option })}>
            {option === 'supabase' ? 'Supabase Dashboard' : 'Mintlify docs'}
          </button>)}
        </div>
        <label className="palette-select">Palette <select id="palette-select" aria-label="Focused preview palette"
          value={paletteId} onChange={event => select({ paletteId: event.target.value })}>
          {palettes.map(option => <option key={option.id} value={option.id}>{option.number} {option.name}</option>)}
        </select></label>
        <div className="segmented" role="group" aria-label="Appearance mode">
          {['light', 'dark'].map(option => <button key={option} type="button" data-mode={option}
            aria-pressed={mode === option} onClick={() => select({ mode: option })}>{option === 'light' ? 'Light' : 'Dark'}</button>)}
        </div>
        <a className="gallery-link" href="#comparison">Compare all palettes ↓</a>
      </div>
    </header>
    <main>
      <section id="focus" ref={focus} aria-labelledby="focus-title">
        <header className="section-heading"><div><p className="eyebrow">IN CONTEXT / 01</p><h1 id="focus-title">{palette.number} {palette.name}</h1></div>
          <p id="focus-status" role="status" aria-live="polite">{layout === 'supabase' ? 'Supabase Dashboard' : 'Mintlify docs'} / {mode === 'light' ? 'Light' : 'Dark'}</p>
        </header>
        <div id="focus-preview"><Screen palette={palette} mode={mode} layout={layout} /></div>
        <p id="layout-note" className="layout-note">
          {layout === 'supabase'
            ? <>Based on the <a href="https://supabase.com/blog/tabs-dashboard-updates" target="_blank" rel="noopener">Supabase Studio table workspace</a>. Uses Keysy Logo 33 and fictional records to compare colors only.</>
            : <>Based on the <a href="https://www.mintlify.com/docs/customize/themes" target="_blank" rel="noopener">Mintlify Mint layout</a>. Navigation and content come from the docs copy; this is a static appearance mock, with production documentation unchanged.</>}
        </p>
      </section>
      <section id="comparison" aria-labelledby="comparison-title">
        <header className="section-heading"><div><p className="eyebrow">SIDE BY SIDE / 02</p><h2 id="comparison-title">Every palette. The same interface.</h2></div><p>Click Expand for details; original color values are unchanged.</p></header>
        <div id="palette-gallery">
          {palettes.map(option => <section key={option.id} className="palette-pair">
            <header><div><span className="palette-number">{option.number}</span><h3>{option.name}</h3><span>{option.english}</span></div>
              <div className="mini-swatches" aria-hidden="true">{['bg', 'text', 'accent', 'soft'].map(role => <i key={role} style={{ background: option.light[role] }} />)}</div>
            </header>
            <div className="comparison-pair">{['light', 'dark'].map(appearance => <div key={appearance} className="comparison-item">
              <div className="comparison-label"><span>{appearance.toUpperCase()}</span>
                <button type="button" aria-label={`Expand ${option.number} ${option.name} ${appearance === 'light' ? 'Light' : 'Dark'}`}
                  onClick={() => expand(option.id, appearance)}>Expand ↗</button>
              </div>
              <Screen palette={option} mode={appearance} layout={layout} />
            </div>)}</div>
          </section>)}
        </div>
      </section>
      <footer>Visual comparison only. The Dashboard uses fictional records; documentation content comes from the docs copy under design.</footer>
    </main>
  </>;
}
