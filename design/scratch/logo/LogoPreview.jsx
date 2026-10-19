import { useState } from 'react';
import candidates from './candidates.json';
import { palettes } from '../theme/palettes.js';

// Source-controlled SVG artwork is kept verbatim, including its outlined typography.
function Artwork({ entry }) {
  if (entry.image) return <>
    <span className="icon-art" role="img" aria-label={entry.name} />
    <span className="icon-art icon-small" aria-hidden="true" />
  </>;
  return <>
    <div className="logo-art" role="img" aria-label={entry.name} dangerouslySetInnerHTML={{ __html: entry.svg }} />
    <div className="small-logo" aria-hidden="true">
      <div dangerouslySetInnerHTML={{ __html: entry.svg }} /><span>28px</span>
    </div>
    {entry.symbol && <div className="symbol-sizes" aria-hidden="true">
      {[16, 24, 32].map(size => <span key={size} style={{ '--symbol-size': `${size}px` }} dangerouslySetInnerHTML={{ __html: entry.symbol }} />)}
      <small>16 / 24 / 32px</small>
    </div>}
  </>;
}

export default function LogoPreview() {
  const [paletteId, setPaletteId] = useState('graphite');
  const palette = palettes.find(option => option.id === paletteId);

  return <>
    <div className="toolbar"><div className="toolbar-inner">
      <div className="color-controls" role="group" aria-label="Logo palette">
        <span className="control-label">Logo palette</span>
        <span id="palette-options" className="color-controls">
          {palettes.map(option => <button key={option.id} type="button" className="palette-button"
            data-palette={option.id} aria-pressed={option.id === paletteId}
            style={{ '--swatch': option.light.accent }} onClick={() => setPaletteId(option.id)}>
            {option.number} {option.name}
          </button>)}
        </span>
      </div>
      <a href="../theme/">Theme preview ↗</a>
    </div></div>
    <main>
      <header className="page-heading"><h1>keysy / logo selection</h1>
        <p id="palette-status" role="status" aria-live="polite">Current palette: {palette.number} {palette.name} · switch in the toolbar</p>
      </header>
      <div id="comparisons" className="comparison-grid">
        {candidates.map((entry, index) => <article key={`${entry.kind}-${entry.id}`} id={`${entry.kind}-${entry.id}`}
          style={entry.image ? { '--image': `url(${entry.image})` } : undefined}>
          <header className="option-heading"><span>{index}</span><h3>{entry.name}</h3></header>
          {(entry.meaning || entry.note) && <p className="concept-note">{entry.meaning || entry.note}</p>}
          <div className="theme-pair">
            {['light', 'dark'].map(mode => <div key={mode} className="theme-preview identity-preview" data-mode={mode}
              style={Object.fromEntries(Object.entries(palette[mode]).map(([role, color]) => [`--${role}`, color]))}>
              <span className="mode-label">{mode.toUpperCase()}</span>
              <Artwork entry={entry} />
            </div>)}
          </div>
        </article>)}
      </div>
      <footer>Palette switching reuses the same artwork. These are review previews, not production UI.</footer>
    </main>
  </>;
}
