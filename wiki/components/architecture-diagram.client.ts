export default function mount(root: HTMLElement) {
  const document = root.ownerDocument;
  const frame = root.querySelector<HTMLIFrameElement>('iframe')!;
  const theme = () => document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  function syncTheme() {
    frame.contentDocument?.documentElement.setAttribute('data-theme', theme());
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
      html[data-present="true"] body { padding: 0; background: transparent; }
      html[data-present="true"] .container { height: 100dvh; gap: 0; }
      html[data-present="true"] .header,
      html[data-present="true"] .toolbar,
      html[data-present="true"] .reader-rail { display: none !important; }
      html[data-present="true"] .diagram-container { border: 0; border-radius: 0; box-shadow: none; }
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
