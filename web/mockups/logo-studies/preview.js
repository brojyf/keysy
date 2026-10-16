// Same restrained accents as the previous Keysy color studies.
const palettes = {
  mono: { light: '#171717', dark: '#ededed', label: '黑白 · 先看造型' },
  green: { light: '#087f5b', dark: '#3ecf8e', label: '翠绿 · 深浅配套' },
  ink: { light: '#315fc4', dark: '#8daaf0', label: '墨蓝 · 深浅配套' },
  sand: { light: '#865c36', dark: '#d0ae83', label: '暖砂 · 深浅配套' },
};

for (const slot of document.querySelectorAll('[data-logo], [data-symbol]')) {
  const kind = slot.hasAttribute('data-logo') ? 'logo' : 'symbol';
  const id = slot.dataset[kind];
  const svg = document.getElementById(`${id}-${kind}`).content.firstElementChild.cloneNode(true);
  svg.style.removeProperty('color');
  slot.append(svg);
}

function applyPalette(light, dark, label) {
  document.documentElement.style.setProperty('--accent-light', light);
  document.documentElement.style.setProperty('--accent-dark', dark);
  document.getElementById('color-note').textContent = label;
}

for (const button of document.querySelectorAll('[data-palette]')) {
  button.addEventListener('click', () => {
    const palette = palettes[button.dataset.palette];
    for (const choice of document.querySelectorAll('[data-palette]')) {
      choice.setAttribute('aria-pressed', String(choice === button));
    }
    applyPalette(palette.light, palette.dark, palette.label);
  });
}

document.getElementById('custom-color').addEventListener('input', (event) => {
  for (const button of document.querySelectorAll('[data-palette]')) {
    button.setAttribute('aria-pressed', 'false');
  }
  applyPalette(event.target.value, event.target.value, '自定义 · 深浅同色，请留意对比度');
});

for (const button of document.querySelectorAll('[data-download]')) {
  button.addEventListener('click', () => {
    const preview = document.querySelector(`[data-study="${button.dataset.download}"] .${button.dataset.mode} .logo-slot svg`);
    const exported = preview.cloneNode(true);
    exported.style.color = getComputedStyle(preview).color;
    exported.querySelector('[data-accent]').style.color = getComputedStyle(preview.querySelector('[data-accent]')).color;
    const blob = new Blob([new XMLSerializer().serializeToString(exported)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `keysy-${button.dataset.download}-${button.dataset.mode}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
