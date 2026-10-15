const icons = {
  key: '<circle cx="8" cy="9" r="4"/><path d="m11 12 8 8m-4-4 3-3m-6 0 3-3"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 14h8m-8 3h5"/>',
  chevrons: '<path d="m9 8 3-3 3 3m-6 8 3 3 3-3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-1.2.6-1.2 1.4-1.2 2.3m0 3h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9zm-9 11 9 5 9-5M3 18l9 5 9-5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  pin: '<path d="m15 3 6 6-4 1-3 5-2-2-5 5m3-7-2-2 5-3z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.key}</svg>`;
function paintIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
}

// All names, values, identities and activity in this visual prototype are fictional.
const credentials = [
  { id:'stripe', name:'Stripe', detail:'STRIPE_SECRET_KEY', type:'key', collection:'Production', updated:'12 min ago', mark:'s', starred:true },
  { id:'apple', name:'App Store Connect', detail:'AuthKey_DEMO01.p8', type:'file', collection:'Production', updated:'3 hrs ago', mark:'file', starred:true },
  { id:'openai', name:'OpenAI', detail:'OPENAI_API_KEY', type:'key', collection:'Production', updated:'Yesterday', mark:'◎', starred:true },
  { id:'resend', name:'Resend', detail:'RESEND_API_KEY', type:'key', collection:'Development', updated:'12 min ago', mark:'R' },
  { id:'github', name:'GitHub', detail:'GITHUB_ACCESS_TOKEN', type:'key', collection:'Personal', updated:'Yesterday', mark:'⌘' },
  { id:'cloudflare', name:'Cloudflare', detail:'CF_API_TOKEN', type:'key', collection:'Production', updated:'Oct 12', mark:'☁' },
  { id:'push', name:'Apple Push Notifications', detail:'AuthKey_PUSH02.p8', type:'file', collection:'Development', updated:'Oct 11', mark:'file' },
  { id:'supabase', name:'Supabase', detail:'SUPABASE_SERVICE_KEY', type:'key', collection:'Production', updated:'Oct 10', mark:'ϟ' },
  { id:'signing', name:'Signing certificate', detail:'release-signing.pem', type:'file', collection:'Production', updated:'Oct 09', mark:'file' },
  { id:'linear', name:'Linear', detail:'LINEAR_API_KEY', type:'key', collection:'Development', updated:'Oct 08', mark:'◒' },
  { id:'ssh', name:'Development SSH', detail:'development-key.pem', type:'file', collection:'Development', updated:'Oct 07', mark:'file' },
  { id:'vercel', name:'Vercel', detail:'VERCEL_ACCESS_TOKEN', type:'key', collection:'Personal', updated:'Oct 06', mark:'▲' },
];
const palettes = { jade:'Jade', blue:'Cobalt', violet:'Iris', sand:'Sandstone', midnight:'Midnight', graphite:'Graphite' };
const layouts = {
  workspace: { number:'01', name:'Workspace', theme:'jade', title:'Everything under lock.' },
  command: { number:'02', name:'Command', theme:'midnight', title:'Your workspace. Secured.' },
  cabinet: { number:'03', name:'Cabinet', theme:'sand', title:'Good things, kept safe.' },
};
let filter = 'all';
let collection = '';
let favoritesOnly = false;
let cardView = false;
const list = document.querySelector('#credential-list');
const search = document.querySelector('#credential-search');
const dialog = document.querySelector('#credential-dialog');

function renderCredentials() {
  const query = search.value.trim().toLowerCase();
  const visible = credentials.filter(item => (filter === 'all' || item.type === filter)
    && (!collection || item.collection === collection)
    && (!favoritesOnly || item.starred)
    && `${item.name} ${item.detail} ${item.collection}`.toLowerCase().includes(query));
  list.classList.toggle('cards', cardView);
  document.querySelector('.table-head').hidden = cardView;
  // Contents come from the fixed fictional fixture above; form input is never interpolated here.
  list.innerHTML = visible.map(item => `<button class="credential-row" data-credential="${item.id}" aria-label="View ${item.name}">
    <span class="credential-name"><span class="provider-icon ${item.id}">${item.mark === 'file' ? icon('file') : item.mark}</span><span><strong>${item.name}</strong><small>${item.detail}</small></span></span>
    <span class="collection-tag ${item.collection.toLowerCase()}"><i></i>${item.collection}</span><span class="row-date">${item.updated}</span><span class="row-arrow">${icon('arrow')}</span><span class="row-type">${item.type === 'file' ? 'FILE' : 'API KEY'}</span>
  </button>`).join('') || '<div class="empty-state">No credentials found. Try another search or filter.</div>';
  document.querySelector('#result-count').textContent = visible.length;
  document.querySelector('#list-summary').textContent = `${visible.length} credential${visible.length === 1 ? '' : 's'}`;
  document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', button.dataset.filter === filter));
  document.querySelector('#list-view').setAttribute('aria-pressed', !cardView);
  document.querySelector('#grid-view').setAttribute('aria-pressed', cardView);
}

function updateDesignLabel() {
  const layout = layouts[document.body.dataset.layout];
  document.querySelector('#theme-description').textContent = `${layout.number} — ${layout.name} · ${palettes[document.body.dataset.theme]}`;
  document.querySelector('#layout-label').textContent = layout.name.toUpperCase();
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  document.querySelectorAll('button[data-theme]').forEach(button => button.setAttribute('aria-pressed', button.dataset.theme === theme));
  updateDesignLabel();
}

function setLayout(layout) {
  document.body.dataset.layout = layout;
  document.querySelectorAll('button[data-layout]').forEach(button => button.setAttribute('aria-pressed', button.dataset.layout === layout));
  document.querySelector('#page-title').textContent = layouts[layout].title;
  cardView = layout === 'cabinet';
  setTheme(layouts[layout].theme);
  renderCredentials();
}

function setView(view, selectedCollection = '') {
  filter = ['key','file'].includes(view) ? view : 'all';
  collection = selectedCollection;
  favoritesOnly = view === 'starred';
  const label = selectedCollection || ({all:'Overview', key:'API keys', file:'Private files', starred:'Favorites'})[view];
  document.querySelector('#breadcrumb-current').textContent = label;
  document.querySelector('#list-title').firstChild.textContent = `${label === 'Overview' ? 'Your credentials' : label} `;
  document.querySelectorAll('.nav-item').forEach(button => {
    button.classList.toggle('active', selectedCollection ? button.dataset.collection === selectedCollection : button.dataset.view === view);
  });
  renderCredentials();
}

let toastTimeout;
function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3000);
}

function showCredential(id) {
  const item = credentials.find(entry => entry.id === id);
  document.querySelector('#dialog-eyebrow').textContent = 'CREDENTIAL DETAILS';
  document.querySelector('#dialog-content').innerHTML = `<span class="provider-icon ${item.id}">${item.mark === 'file' ? icon('file') : item.mark}</span><h2 id="dialog-title">${item.name}</h2><span class="dialog-type">${item.type === 'file' ? 'Private file' : 'API key'}</span><dl><dt>${item.type === 'file' ? 'Filename' : 'Variable'}</dt><dd>${item.detail}</dd><dt>Collection</dt><dd>${item.collection}</dd><dt>Updated</dt><dd>${item.updated}</dd></dl><div class="masked-value">${item.type === 'file' ? 'Private file contents are hidden.' : '•••• •••• •••• •••• •••• ••••'}</div><button class="secondary-button" id="copy-reference">Copy reference ${icon('key')}</button><p class="dialog-note">Visual prototype · no real credentials or file contents.</p>`;
  document.querySelector('#copy-reference').addEventListener('click', async () => {
    const reference = `keysy://${item.collection.toLowerCase()}/${item.id}`;
    try {
      await navigator.clipboard.writeText(reference);
      showToast('Demo credential reference copied');
    } catch {
      showToast(`Demo reference: ${reference}`);
    }
  });
  dialog.showModal();
}

document.querySelectorAll('button[data-layout]').forEach(button => button.addEventListener('click', () => setLayout(button.dataset.layout)));
document.querySelectorAll('button[data-theme]').forEach(button => button.addEventListener('click', () => setTheme(button.dataset.theme)));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelectorAll('[data-collection]').forEach(button => button.addEventListener('click', () => setView('all', button.dataset.collection)));
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  renderCredentials();
}));
document.querySelector('#list-view').addEventListener('click', () => { cardView = false; renderCredentials(); });
document.querySelector('#grid-view').addEventListener('click', () => { cardView = true; renderCredentials(); });
search.addEventListener('input', renderCredentials);
list.addEventListener('click', event => {
  const row = event.target.closest('[data-credential]');
  if (row) showCredential(row.dataset.credential);
});
document.querySelector('#featured-button').addEventListener('click', () => showCredential('apple'));
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !dialog.open && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault(); search.focus();
  }
});
document.querySelector('#add-button').addEventListener('click', () => {
  document.querySelector('#dialog-eyebrow').textContent = 'NEW CREDENTIAL';
  document.querySelector('#dialog-content').innerHTML = '<h2 id="dialog-title">Make yourself at home.</h2><p>A first look at adding a credential to Keysy.</p><form id="demo-form"><label>Name<input name="name" placeholder="e.g. Stripe production" required maxlength="80"></label><label>Type<select name="type"><option>API key</option><option>Private file (.p8 / .pem)</option></select></label><label>Collection<select name="collection"><option>Production</option><option>Development</option><option>Personal</option></select></label><button class="primary-button" type="submit">Preview confirmation</button><p class="dialog-note">Demo interaction only. No secrets are collected or saved.</p></form>';
  document.querySelector('#demo-form').addEventListener('submit', event => {
    event.preventDefault();
    dialog.close();
    showToast('Preview complete — no credential was created');
  });
  dialog.showModal();
});
document.querySelector('#help-button').addEventListener('click', () => {
  document.querySelector('#dialog-eyebrow').textContent = 'ABOUT THIS EXPLORATION';
  document.querySelector('#dialog-content').innerHTML = '<h2 id="dialog-title">A few ways to feel at home.</h2><p>Switch between three layouts and six color palettes using the design bar. Search, filter, switch views and open credential details to explore.</p><p>Everything here is fictional demo content. This standalone visual prototype does not connect to a backend.</p><p class="dialog-note">Tip: press / to focus search. Press Escape to close dialogs.</p>';
  dialog.showModal();
});
paintIcons();
renderCredentials();
