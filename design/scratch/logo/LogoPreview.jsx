import { useState } from 'react';
import candidates from './candidates.json';
import { palettes } from '../theme/palettes.js';
import PalettePicker from '../components/PalettePicker.jsx';

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

  return <div className="logo-workspace preview-content">
      <header className="preview-heading">
        <div><p className="preview-eyebrow">THE IDENTITY COLLECTION</p><h1>Find the right mark.</h1>
          <p className="preview-description">27 directions. One color system. See what feels like Keysy.</p>
        </div>
        <span className="preview-count">27 candidates · 0–26</span>
      </header>
      <div className="preview-controls"><PalettePicker value={paletteId} onChange={setPaletteId} label="Logo palette" /></div>
      <div className="collection-heading"><h2>All directions <span>27</span></h2>
        <p id="palette-status" role="status" aria-live="polite">{palette.number} {palette.name} <span> / </span> Light & dark</p>
      </div>
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
      <p className="preview-footnote">The same artwork in every palette. Original outlines, unchanged.</p>
  </div>;
}
