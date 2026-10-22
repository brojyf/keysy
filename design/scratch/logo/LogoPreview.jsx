import candidates from './candidates.json';
import { palettes } from '../../theme/palettes.js';

// Source-controlled SVG artwork is kept verbatim, including its outlined typography.
function Artwork({ entry }) {
  const isTerminal = entry.kind === 'generated' && entry.id === '46';
  if (entry.image) return <>
    <span className="icon-art" role="img" aria-label={entry.name} />
    <span className="icon-art icon-small" aria-hidden="true" />
  </>;
  return <>
    <div className="logo-art" role="img" aria-label={entry.name} dangerouslySetInnerHTML={{ __html: entry.svg }} />
    {(isTerminal ? [16, 24, 32] : [28]).map(size => <div key={size}
      className={`small-logo${isTerminal ? ' terminal-size' : ''}`} aria-hidden="true"
      style={isTerminal ? { '--lockup-size': `${size}px` } : undefined}>
      <div dangerouslySetInnerHTML={{ __html: entry.svg }} /><span>{size}px</span>
    </div>)}
    {entry.symbol && <div className="symbol-sizes" aria-hidden="true">
      {[16, 24, 32].map(size => <span key={size} style={{ '--symbol-size': `${size}px` }} dangerouslySetInnerHTML={{ __html: entry.symbol }} />)}
      <small>16 / 24 / 32px</small>
    </div>}
  </>;
}

export default function LogoPreview() {
  const palette = palettes[0];

  return <div className="logo-workspace preview-content">
      <header className="preview-heading">
        <div><p className="preview-eyebrow">THE IDENTITY COLLECTION</p><h1>Find the right mark.</h1>
          <p className="preview-description">{candidates.length} directions. One color system. See what feels like Keysy.</p>
        </div>
        <span className="preview-count">{candidates.length} candidates · 0–{candidates.length - 1}</span>
      </header>
      <div className="collection-heading"><h2>All directions <span>{candidates.length}</span></h2>
        <p>{palette.name} <span> / </span> Light & dark</p>
      </div>
      <div id="comparisons" className="comparison-grid">
        {candidates.map((entry, number) => <article key={`${entry.kind}-${entry.id}`} id={`${entry.kind}-${entry.id}`}
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
        </article>)}
      </div>
      <p className="preview-footnote">The same artwork in light and dark. Original outlines, unchanged.</p>
  </div>;
}
