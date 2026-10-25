export default function mount(root: HTMLElement) {
  const document = root.ownerDocument;
  const frame = root.querySelector<HTMLIFrameElement>('iframe')!;
  const theme = () => document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  let sizeObserver: ResizeObserver | undefined;

  function syncTheme() {
    const viewer = frame.contentDocument?.documentElement;
    if (!viewer) return;
    const currentTheme = theme();
    viewer.setAttribute('data-theme', currentTheme);
    viewer.style.colorScheme = currentTheme;
    viewer.style.setProperty('--bg', document.defaultView!.getComputedStyle(document.body).backgroundColor);
  }

  frame.addEventListener('load', () => {
    sizeObserver?.disconnect();
    const viewer = frame.contentDocument;
    const svg = viewer?.querySelector<SVGSVGElement>('.diagram-container > svg');
    if (!viewer || !svg) return;
    const { width, height } = svg.viewBox.baseVal;
    frame.style.aspectRatio = `${width} / ${height}`;
    syncTheme();
    if (!viewer.getElementById('wiki-architecture-style')) {
      const style = viewer.createElement('style');
      style.id = 'wiki-architecture-style';
      style.textContent = `
      html[data-present="true"]:not([data-embed="true"]) body { padding: 0; background: var(--bg); height: auto; }
      html[data-present="true"]:not([data-embed="true"]) .container { display: block; height: auto; }
      html[data-present="true"] .header,
      html[data-present="true"] .toolbar,
      html[data-present="true"] .diagram-nav,
      html[data-present="true"] .rail-controls { display: none !important; }
      html[data-present="true"]:not([data-embed="true"]) .diagram-container {
        height: var(--wiki-diagram-height); padding: 0; border: 0; border-radius: 0; box-shadow: none; background: var(--bg);
      }
      html[data-present="true"] .reader-rail { display: block; }
      html[data-present="true"] .node-outline:not([hidden]) { display: block; }
      html[data-present="true"] .node-outline-list {
        overflow: visible; mask-image: none; -webkit-mask-image: none;
      }
      html[data-present="true"] .node-outline-group > ul {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: 0.25rem 0.5rem;
      }
    `;
      viewer.head.append(style);
    }
    const index = viewer.getElementById('node-outline')!;
    function resize() {
      const diagramHeight = Math.ceil(frame.clientWidth * height / width);
      viewer!.documentElement.style.setProperty('--wiki-diagram-height', `${diagramHeight}px`);
      const frameHeight = `${Math.ceil(diagramHeight + index.getBoundingClientRect().height)}px`;
      if (frame.style.height !== frameHeight) frame.style.height = frameHeight;
    }
    sizeObserver = new document.defaultView!.ResizeObserver(resize);
    sizeObserver.observe(root);
    sizeObserver.observe(index);
    resize();
  });

  // These document-owned listeners also survive back-forward cache restoration.
  document.addEventListener('sourcey:themechange', syncTheme);
  const url = new URL(frame.src, document.baseURI);
  // A URL override prevents Archify's independent saved/system theme taking over.
  url.searchParams.set('theme', theme());
  frame.src = url.href;
}
