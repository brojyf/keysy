export default function mount(root: HTMLElement) {
  const document = root.ownerDocument;
  const frame = root.querySelector<HTMLIFrameElement>('iframe')!;
  const theme = () => document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  function syncTheme() {
    const viewer = frame.contentDocument?.documentElement;
    if (!viewer) return;
    const currentTheme = theme();
    viewer.setAttribute('data-theme', currentTheme);
    viewer.style.colorScheme = currentTheme;
    viewer.style.setProperty('--bg', document.defaultView!.getComputedStyle(document.body).backgroundColor);
  }

  frame.addEventListener('load', () => {
    const viewer = frame.contentDocument;
    const svg = viewer?.querySelector<SVGSVGElement>('.diagram-container > svg');
    if (!viewer || !svg) return;
    const { width, height } = svg.viewBox.baseVal;
    frame.style.aspectRatio = `${width} / ${height}`;
    syncTheme();
    if (viewer.getElementById('wiki-architecture-style')) return;
    const style = viewer.createElement('style');
    style.id = 'wiki-architecture-style';
    style.textContent = `
      html[data-present="true"]:not([data-embed="true"]) body { padding: 0; background: var(--bg); }
      html[data-present="true"]:not([data-embed="true"]) .container { height: 100dvh; gap: 0; }
      html[data-present="true"] .header,
      html[data-present="true"] .toolbar,
      html[data-present="true"] .diagram-nav,
      html[data-present="true"] .reader-rail { display: none !important; }
      html[data-present="true"]:not([data-embed="true"]) .diagram-container {
        padding: 0; border: 0; border-radius: 0; box-shadow: none; background: var(--bg);
      }
    `;
    viewer.head.append(style);
  });

  // These document-owned listeners also survive back-forward cache restoration.
  document.addEventListener('sourcey:themechange', syncTheme);
  const url = new URL(frame.src, document.baseURI);
  // A URL override prevents Archify's independent saved/system theme taking over.
  url.searchParams.set('theme', theme());
  frame.src = url.href;
}
