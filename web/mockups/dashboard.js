const palettes = [...globalThis.keysyPalettes, ...globalThis.keysyExtraPalettes];
const swatchRoles = [
  ['bg', '背景'], ['surface', '卡片'], ['text', '正文'],
  ['muted', '次文'], ['accent', '主色'], ['soft', '选中'],
];

function renderPreview(palette, mode) {
  const colors = palette[mode];
  const label = mode === 'light' ? '浅色 / LIGHT' : '深色 / DARK';
  const properties = Object.entries(colors).map(([role, color]) => `--${role}:${color}`).join(';');
  return `<section class="theme-preview" data-mode="${mode}" style="${properties}" aria-label="${palette.name} ${label}">
    <span class="mode-label">${label}</span>
    <div class="sample-card">
      <h3>井然有序。</h3>
      <p>你的密钥，妥善归位。</p>
      <div class="sample-actions"><span class="primary-sample">主按钮</span><span class="selected-sample">✓ 已选中</span></div>
    </div>
    <dl class="swatches">${swatchRoles.map(([role, name]) => `<div><dt style="--swatch:${colors[role]}"><span hidden>${name}</span></dt><dd><span class="swatch-label">${name}</span><span class="swatch-hex">${colors[role]}</span></dd></div>`).join('')}</dl>
  </section>`;
}

// Only fixed palette values are rendered. No input or product interactions.
document.querySelector('#palettes').innerHTML = palettes.map((palette, index) => `
  <section class="palette" aria-labelledby="${palette.id}-title">
    <header class="palette-heading"><span class="palette-number">${palette.number}</span><h2 id="${palette.id}-title">${palette.name}</h2><span class="palette-name">${palette.english}</span></header>
    <div class="theme-pair">${renderPreview(palette, 'light')}${renderPreview(palette, 'dark')}</div>
  </section>`).join('');
