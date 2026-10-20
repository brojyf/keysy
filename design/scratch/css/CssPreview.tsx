import { useEffect, useState } from 'react';
import { palettes } from '../theme/palettes.js';
import { frameUrl, libraries, readSelection, type Selection } from './catalog';
import './preview.css';

export default function CssPreview({ active = true }: { active?: boolean }) {
  const [selection, setSelection] = useState(() => readSelection(location.search));
  const library = libraries.find(library => library.id === selection.library)!;
  const select = (changes: Partial<Selection>) => setSelection(current => ({ ...current, ...changes }));
  const src = frameUrl(selection, location.pathname);

  useEffect(() => {
    if (!active) return;
    const url = new URL(location.href);
    url.searchParams.set('library', selection.library);
    url.searchParams.set('cssPalette', selection.palette);
    url.searchParams.set('cssMode', selection.mode);
    history.replaceState(null, '', url);
  }, [active, selection]);

  return <div className="css-workspace">
    <section className="css-preview-pane" aria-label="CSS integration preview">
      <div className="css-preview-toolbar"><div><strong>{library.name}</strong><span>{library.stack}</span></div>
        <div className="segmented" role="group" aria-label="CSS appearance">
          {(['light', 'dark'] as const).map(mode => <button key={mode} type="button" aria-pressed={selection.mode === mode} onClick={() => select({ mode })}>{mode === 'light' ? 'Light' : 'Dark'}</button>)}
        </div>
      </div>
      {active && <iframe key={src} src={src} title={`${library.name} interactive preview`} className="css-preview-frame" />}
      <div className="css-integration-note"><span>{library.kind}</span><p>{library.note}</p><a href={library.source} target="_blank" rel="noopener noreferrer">Official documentation ↗</a><a href={src} target="_blank" rel="noopener noreferrer">Open preview ↗</a></div>
    </section>
    <aside className="css-choice-panel" aria-label="CSS preview choices">
      <div className="css-choice-scroll">
        <h2>Integrations <span>{libraries.length}</span></h2>
        <div className="css-library-choices" role="group" aria-label="CSS library">
          {libraries.map(option => <button key={option.id} type="button" aria-pressed={selection.library === option.id} onClick={() => select({ library: option.id })}><strong>{option.name}</strong><span>{option.kind}</span></button>)}
        </div>
        <h2>Color systems <span>{palettes.length}</span></h2>
        <div className="css-palette-choices" role="group" aria-label="CSS palette">
          {palettes.map(palette => <button key={palette.id} type="button" aria-pressed={selection.palette === palette.id} onClick={() => select({ palette: palette.id })}><span className="css-color-dot" style={{ background: palette[selection.mode].accent }} /><span>{palette.number.padStart(2, '0')} {palette.name}</span></button>)}
        </div>
        <p className="css-choice-hint">Same fictional content. Real integrations. Each preview has an isolated document. Switching a library, palette, or mode resets demo edits.</p>
      </div>
    </aside>
  </div>;
}
