import { useState } from 'react';
import candidates from './candidates.json';
import { palettes } from '../theme/palettes.js';
import PalettePicker from '../components/PalettePicker.jsx';

const candidateGroups = [
  { id: 'wordmarks', name: 'Wordmarks', numbers: [1, 2, 21] },
  { id: 'brackets-asterisks', name: 'Brackets & asterisks', numbers: [0, 4, 6, 7, 8, 9, 10, 11, 12, 14] },
  { id: 'keys-keyholes', name: 'Keys & keyholes', numbers: [3, 16, 18, 19, 23, 24] },
  { id: 'rings-links', name: 'Rings & links', numbers: [5, 13, 20, 25, 27] },
  { id: 'geometric-blocks', name: 'K & geometric blocks', numbers: [15, 17, 22, 26, 28] },
];

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
          <p className="preview-description">{candidates.length} directions. One color system. See what feels like Keysy.</p>
        </div>
        <span className="preview-count">{candidates.length} candidates · 0–{candidates.length - 1}</span>
      </header>
      <div className="preview-controls"><PalettePicker value={paletteId} onChange={setPaletteId} label="Logo palette" /></div>
      <div className="collection-heading"><h2>All directions <span>{candidates.length}</span></h2>
        <p id="palette-status" role="status" aria-live="polite">{palette.number} {palette.name} <span> / </span> Light & dark</p>
      </div>
      <div id="comparisons">
        {candidateGroups.map(group => <section key={group.id} className="logo-group" aria-labelledby={`logo-group-${group.id}`}>
          <header className="collection-heading"><h2 id={`logo-group-${group.id}`}>{group.name}<span aria-hidden="true">{group.numbers.length}</span></h2></header>
          <div className="comparison-grid">
            {group.numbers.map(number => {
              const entry = candidates[number];
              return <article key={`${entry.kind}-${entry.id}`} id={`${entry.kind}-${entry.id}`}
                style={entry.image ? { '--image': `url(${entry.image})` } : undefined}>
                <header className="option-heading"><span>{number}</span><h3>{entry.name}</h3></header>
                {(entry.meaning || entry.note) && <p className="concept-note">{entry.meaning || entry.note}</p>}
                <div className="theme-pair">
                  {['light', 'dark'].map(mode => <div key={mode} className="theme-preview identity-preview" data-mode={mode}
                    style={Object.fromEntries(Object.entries(palette[mode]).map(([role, color]) => [`--${role}`, color]))}>
                    <span className="mode-label">{mode.toUpperCase()}</span>
                    <Artwork entry={entry} />
                  </div>)}
                </div>
              </article>;
            })}
          </div>
        </section>)}
      </div>
      <p className="preview-footnote">The same artwork in every palette. Original outlines, unchanged.</p>
  </div>;
}
