const palettes = [...globalThis.keysyPalettes, ...globalThis.keysyExtraPalettes];
const params = new URLSearchParams(location.search);
const state = {
  layout: params.get('layout') === 'mintlify' ? 'mintlify' : 'supabase',
  palette: palettes.find(p => p.id === params.get('palette'))?.id || palettes[0].id,
  mode: params.get('mode') === 'dark' ? 'dark' : 'light',
};
const icons = {
  home: '<path d="m3 10 9-7 9 7v11h-6v-8H9v8H3Z"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11M3 14h18"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3m6 0h4"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  folder: '<path d="M3 7h6l2-3h4l2 3h4v13H3Z"/>',
  key: '<circle cx="8" cy="9" r="5"/><path d="m12 13 8 8m-4-4 3-3m-7 3 3-3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  down: '<path d="m8 10 4 4 4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8Z"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10m0-4h5a7 7 0 0 0 7-5"/>',
  file: '<path d="M5 3h9l5 5v13H5Z"/><path d="M14 3v6h5M8 13h8M8 17h5"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v12h5"/>',
  book: '<path d="M12 5v16M3 3l9 2 9-2v16l-9 2-9-2Z"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon">${icons[name] || icons.file}</svg>`;
const logo = '<span class="keysy-symbol" aria-hidden="true"></span>';
const fauxButton = (label, name, primary = false) => `<span class="ui-button${primary ? ' primary' : ''}">${name ? icon(name) : ''}${label}</span>`;
const navItem = (label, name, active = false, count = '') => `<div class="nav-item${active ? ' active' : ''}">${icon(name)}<span>${label}</span>${count ? `<small>${count}</small>` : ''}</div>`;

function supabaseScreen() {
  const records = [
    ['STRIPE_SECRET_KEY', 'API key', 'v4', '2 hours ago', true],
    ['DATABASE_URL', 'Connection', 'v2', 'Yesterday'],
    ['AuthKey_Q7X9.p8', 'Private file', 'v1', 'Oct 12, 2026'],
    ['GITHUB_ACCESS_TOKEN', 'API key', 'v3', 'Oct 10, 2026'],
    ['RESEND_API_KEY', 'API key', 'v1', 'Oct 08, 2026'],
    ['WEBHOOK_SIGNING_SECRET', 'Secret', 'v2', 'Oct 06, 2026'],
  ];
  return `<div class="studio-topbar"><div class="studio-brand">${logo}<strong>keysy</strong></div><span class="org-avatar">A</span><span>Acme workspace</span>${icon('down')}<span class="slash">/</span><strong>production</strong><span class="branch-badge">${icon('branch')}main</span><div class="topbar-end">${fauxButton('Connect', 'terminal')}<span>Docs</span><span class="user-avatar">AL</span></div></div>
    <div class="studio-body">
      <aside class="icon-rail" aria-label="Product tools"><div>${['home','table','terminal'].map((name,i) => `<span class="rail-item${i === 1 ? ' active' : ''}">${icon(name)}</span>`).join('')}<hr>${['shield','folder','clock'].map(name => `<span class="rail-item">${icon(name)}</span>`).join('')}</div><div><span class="rail-item">${icon('settings')}</span><span class="rail-avatar">A</span></div></aside>
      <aside class="resource-sidebar"><h2>Secrets</h2><div class="sidebar-section"><div class="namespace-select"><span>namespace <strong>kv</strong></span>${icon('down')}</div>${fauxButton('New collection', 'plus')}<div class="sidebar-search">${icon('search')}<span>Find a collection…</span></div></div><p class="sidebar-label">COLLECTIONS</p>${navItem('production','folder',true,'6')}${navItem('staging','folder',false,'4')}${navItem('development','folder',false,'8')}<div class="sidebar-divider"></div>${navItem('All secrets','key',false,'18')}${navItem('Private files','file',false,'3')}<div class="sidebar-bottom"><span class="small-dot"></span> All changes saved</div></aside>
      <div class="studio-editor"><div class="editor-tabs"><span class="editor-tab selected">${icon('folder')}production<span class="tab-close">×</span></span><span class="editor-tab">${icon('folder')}staging</span><span class="tab-add">${icon('plus')}</span></div><div class="editor-toolbar"><span>${icon('filter')}Filter</span><span>↕ &nbsp;Sort</span><span class="toolbar-divider"></span>${fauxButton('New secret','plus',true)}<span class="toolbar-spacer"></span><span class="policy-label">${icon('shield')}Policy enabled</span></div>
        <div class="editor-workspace"><div class="table-pane"><table class="secrets-table"><thead><tr><th><span class="checkbox"></span></th><th>${icon('key')}Name</th><th>Type</th><th>Version</th><th>Updated</th></tr></thead><tbody>${records.map(([name,type,version,updated,selected]) => `<tr${selected ? ' class="selected-row"' : ''}><td><span class="checkbox${selected ? ' checked' : ''}">${selected ? '✓' : ''}</span></td><td class="secret-name">${name}</td><td>${type}</td><td><span class="version">${version}</span></td><td>${updated}</td></tr>`).join('')}</tbody></table><div class="table-space"><span>6 secrets in production</span></div><div class="table-bottom"><span>${icon('table')}Table view</span><span>6 records<span class="bottom-separator">|</span>Page 1 of 1 &nbsp; ‹ &nbsp; ›</span></div></div>
        <aside class="secret-detail"><div class="detail-heading"><span>${icon('key')}Secret details</span><span>×</span></div><div class="detail-content"><span class="eyebrow">PRODUCTION</span><h3>STRIPE_SECRET_KEY</h3><div class="detail-tags"><span class="type-tag">API key</span><span class="accent-tag">Version 4</span></div><label>Secret value</label><div class="secret-value"><span>••••••••••••••••</span>${icon('copy')}</div><p class="detail-hint">Values stay hidden until revealed.</p><div class="detail-rule"></div><dl><div><dt>Path</dt><dd>kv / production</dd></div><div><dt>Last updated</dt><dd>2 hours ago</dd></div><div><dt>Updated by</dt><dd>Alex Lee</dd></div></dl><label>Access policy</label><div class="access-policy">${icon('shield')}production-readonly${icon('arrow')}</div><div class="detail-rule"></div><label>Recent activity</label><div class="activity-item"><span class="activity-dot"></span><div>Secret updated<small>Alex Lee · 2 hours ago</small></div></div><div class="activity-item"><span class="activity-dot"></span><div>Secret accessed<small>service-api · 3 hours ago</small></div></div></div><div class="detail-footer">${fauxButton('View audit log','clock')}</div></aside></div>
      </div>
    </div>`;
}

// Text and directory rows are copied from mintlify-copy/index.mdx.
const directoryRows = [
  ['web/', 'React and TypeScript web app, built with Vite.'],
  ['cli/', 'Go CLI, built with Cobra.'],
  ['api/', 'Reserved for the application API service.'],
  ['auth/', 'Reserved for the authentication service.'],
  ['notify/', 'Reserved for the notification service.'],
  ['contracts/openapi/', 'Shared OpenAPI definitions for the API and authentication services.'],
  ['docs/', 'Mintlify documentation and site configuration.'],
  ['deploy/', 'Deployment configuration.'],
  ['otel/', 'OpenTelemetry Collector Docker image definition.'],
  ['supabase/', 'Reserved for Supabase configuration.'],
];
function mintlifyScreen() {
  return `<div class="mint-topbar"><div class="mint-brand">${logo}<strong>keysy</strong><span>docs</span></div><div class="mint-search">${icon('search')}<span>Search documentation…</span><kbd>⌘ K</kbd></div><div class="mint-links"><span>GitHub ↗</span>${icon('settings')}</div></div>
    <div class="mint-topnav">${['Overview','API','Auth','Notify','CLI','Web'].map((label,i) => `<span${i === 0 ? ' class="active"' : ''}>${label}</span>`).join('')}</div>
    <div class="mint-body"><aside class="mint-sidebar"><span class="mint-nav-heading">General</span><div class="mint-nav-selected">${icon('book')}Introduction</div><div class="mint-sidebar-foot">${icon('book')}Powered by Mintlify</div></aside>
      <article class="mint-article"><p class="mint-eyebrow">General</p><h1>Introduction</h1><p class="mint-description">Understand Keysy's monorepo and find the code you need.</p><p class="mint-intro">Keysy uses a <strong>monorepo</strong>: the web app, CLI, service directories, API contracts, and infrastructure files live in a single Git repository.</p><h2>Repository structure</h2><table class="directory-table"><thead><tr><th>Directory</th><th>Purpose</th></tr></thead><tbody>${directoryRows.map(([directory,purpose]) => `<tr><td><code>${directory}</code></td><td>${purpose}</td></tr>`).join('')}</tbody></table><div class="mint-feedback"><span>Was this page helpful?</span><span class="feedback-choice">Yes</span><span class="feedback-choice">No</span></div></article>
      <aside class="mint-toc"><span>On this page</span><div>Repository structure</div></aside></div>`;
}

function renderScreen(palette, mode, layout) {
  const variables = Object.entries(palette[mode]).map(([role, color]) => `--${role}:${color}`).join(';');
  return `<div class="screen-viewport"><div class="mock-screen ${layout}" data-palette="${palette.id}" data-mode="${mode}" style="${variables}" role="img" aria-label="${palette.number} ${palette.name} · ${layout === 'supabase' ? 'Supabase Dashboard' : 'Mintlify docs'} · ${mode === 'light' ? 'Light' : 'Dark'}">${layout === 'supabase' ? supabaseScreen() : mintlifyScreen()}</div></div>`;
}

const resizeObserver = new ResizeObserver(entries => entries.forEach(({target, contentRect}) => {
  target.style.setProperty('--screen-scale', contentRect.width / 1200);
}));
function observeScreens() {
  resizeObserver.disconnect();
  document.querySelectorAll('.screen-viewport').forEach(node => resizeObserver.observe(node));
}
function renderFocus() {
  const palette = palettes.find(p => p.id === state.palette);
  document.querySelector('#focus-title').textContent = `${palette.number} ${palette.name}`;
  document.querySelector('#focus-status').textContent = `${state.layout === 'supabase' ? 'Supabase Dashboard' : 'Mintlify docs'} / ${state.mode === 'light' ? 'Light' : 'Dark'}`;
  document.querySelector('#focus-preview').innerHTML = renderScreen(palette, state.mode, state.layout);
  document.querySelector('#palette-select').value = state.palette;
  document.querySelectorAll('[data-layout]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.layout === state.layout)));
  document.querySelectorAll('button[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
  document.querySelector('#layout-note').innerHTML = state.layout === 'supabase'
    ? 'Based on the <a href="https://supabase.com/blog/tabs-dashboard-updates" target="_blank" rel="noopener">Supabase Studio table workspace</a>. Uses Keysy Logo 33 and fictional records to compare colors only.'
    : 'Based on the <a href="https://www.mintlify.com/docs/customize/themes" target="_blank" rel="noopener">Mintlify Mint layout</a>. Navigation and content come from the docs copy; this is a static appearance mock, with production documentation unchanged.';
  const url = new URL(location.href);
  url.searchParams.set('layout', state.layout);
  url.searchParams.set('palette', state.palette);
  url.searchParams.set('mode', state.mode);
  history.replaceState(null, '', url);
  observeScreens();
}
function renderGallery() {
  document.querySelector('#palette-gallery').innerHTML = palettes.map(palette => `<section class="palette-pair"><header><div><span class="palette-number">${palette.number}</span><h3>${palette.name}</h3><span>${palette.english}</span></div><div class="mini-swatches" aria-hidden="true">${['bg','text','accent','soft'].map(role => `<i style="background:${palette.light[role]}"></i>`).join('')}</div></header><div class="comparison-pair">${['light','dark'].map(mode => `<div class="comparison-item"><div class="comparison-label"><span>${mode === 'light' ? 'LIGHT' : 'DARK'}</span><button type="button" data-open="${palette.id}" data-open-mode="${mode}" aria-label="Expand ${palette.number} ${palette.name} ${mode === 'light' ? 'Light' : 'Dark'}">Expand ↗</button></div>${renderScreen(palette, mode, state.layout)}</div>`).join('')}</div></section>`).join('');
}
document.querySelector('#palette-select').innerHTML = palettes.map(p => `<option value="${p.id}">${p.number} ${p.name}</option>`).join('');
document.querySelector('#palette-select').addEventListener('change', event => { state.palette = event.target.value; renderFocus(); });
document.querySelectorAll('[data-layout]').forEach(button => button.addEventListener('click', () => { state.layout = button.dataset.layout; renderGallery(); renderFocus(); }));
document.querySelectorAll('button[data-mode]').forEach(button => button.addEventListener('click', () => { state.mode = button.dataset.mode; renderFocus(); }));
document.querySelector('#palette-gallery').addEventListener('click', event => {
  const button = event.target.closest('button[data-open]');
  if (!button) return;
  state.palette = button.dataset.open;
  state.mode = button.dataset.openMode;
  renderFocus();
  document.querySelector('#focus').scrollIntoView({behavior:'instant', block:'start'});
});
renderGallery();
renderFocus();
