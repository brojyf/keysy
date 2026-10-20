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

export default function ThemePreview({ active = true }) {
  const [{ layout, paletteId, mode }, setSelection] = useState(initialSelection);
  const palette = palettes.find(option => option.id === paletteId);
  const select = changes => setSelection(selection => ({ ...selection, ...changes }));

  useEffect(() => {
    if (!active) return;
    const url = new URL(location.href);
    url.searchParams.set('layout', layout);
    url.searchParams.set('palette', paletteId);
    url.searchParams.set('mode', mode);
    history.replaceState(null, '', url);
  }, [active, layout, paletteId, mode]);

  return <div className="theme-workspace">
    <div className="theme-split">
      <section id="focus" className="theme-preview-pane" aria-label="Theme preview">
        <div className="theme-preview-stage">
          <div id="focus-preview"><Screen palette={palette} mode={mode} layout={layout} /></div>
        </div>
        <p id="focus-status" className="theme-status" role="status" aria-live="polite">{palette.number} {palette.name} · {layout === 'supabase' ? 'Supabase Dashboard' : 'Mintlify docs'} / {mode === 'light' ? 'Light' : 'Dark'}</p>
        <div className="theme-options-row">
          <div className="segmented" role="group" aria-label="Reference layout">
            {['supabase', 'mintlify'].map(option => <button key={option} type="button" data-layout={option}
              aria-pressed={layout === option} onClick={() => select({ layout: option })}>
              {option === 'supabase' ? 'Supabase Dashboard' : 'Mintlify docs'}
            </button>)}
          </div>
          <div className="segmented" role="group" aria-label="Appearance mode">
            {['light', 'dark'].map(option => <button key={option} type="button" data-mode={option}
              aria-pressed={mode === option} onClick={() => select({ mode: option })}>{option === 'light' ? 'Light' : 'Dark'}</button>)}
          </div>
        </div>
        <p id="layout-note" className="layout-note">
          {layout === 'supabase'
            ? <>Based on the <a href="https://supabase.com/blog/tabs-dashboard-updates" target="_blank" rel="noopener">Supabase Studio table workspace</a>. Uses Keysy Logo 33 and fictional records to compare colors only.</>
            : <>Based on the <a href="https://www.mintlify.com/docs/customize/themes" target="_blank" rel="noopener">Mintlify Mint layout</a>. Navigation and content come from the docs copy; this is a static appearance mock, with production documentation unchanged.</>}
        </p>
      </section>
      <aside className="theme-palette-panel" aria-labelledby="theme-palettes-title">
        <header className="theme-palette-heading"><h2 id="theme-palettes-title">Color systems</h2><span>{palettes.length} choices</span></header>
        <div className="theme-palette-scroll" role="region" aria-label="Color choices" tabIndex={0}>
          <div className="theme-color-choices" role="group" aria-label="Theme palette">
            {palettes.map(option => <div key={option.id} className="theme-color-choice">
              <button type="button" className="theme-color-select" data-palette={option.id}
                aria-label={`${option.number} ${option.name}`} aria-pressed={paletteId === option.id}
                onClick={() => select({ paletteId: option.id })}>
                <span className="palette-option-top">
                  <span className="palette-option-label"><small>{option.number.padStart(2, '0')}</small><span>{option.name}</span></span>
                  <span className="palette-check" aria-hidden="true">{paletteId === option.id && <svg viewBox="0 0 16 16"><path d="m4 8 3 3 5-6" /></svg>}</span>
                </span>
                <span className="palette-swatches" aria-hidden="true">{[option.light.accent, option.light.soft, option.dark.accent, option.dark.bg]
                  .map((color, index) => <i key={index} style={{ background: color }} />)}</span>
              </button>
              <div className="theme-choice-preview" aria-hidden="true"><Screen palette={option} mode={mode} layout={layout} /></div>
            </div>)}
          </div>
        </div>
      </aside>
    </div>
  </div>;
}
