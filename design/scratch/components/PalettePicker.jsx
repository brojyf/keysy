import { palettes } from '../theme/palettes.js';

export default function PalettePicker({ value, onChange, label }) {
  return <div className="palette-picker" role="group" aria-label={label}>
    <div className="control-heading"><span>Color system</span><span>Light & dark, together</span></div>
    <div className="palette-options">
      {palettes.map(palette => <button key={palette.id} type="button" className="palette-option"
        data-palette={palette.id} aria-label={`${palette.number} ${palette.name}`} aria-pressed={value === palette.id}
        onClick={() => onChange(palette.id)}>
        <span className="palette-option-top" aria-hidden="true">
          <span className="palette-swatches">{[palette.light.accent, palette.light.soft, palette.dark.accent, palette.dark.bg]
            .map((color, index) => <i key={index} style={{ background: color }} />)}</span>
          <span className="palette-check">{value === palette.id && <svg viewBox="0 0 16 16"><path d="m4 8 3 3 5-6" /></svg>}</span>
        </span>
        <span className="palette-option-label"><small>{palette.number.padStart(2, '0')}</small><span>{palette.name}</span></span>
      </button>)}
    </div>
  </div>;
}
