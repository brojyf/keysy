export default function mount(root: HTMLElement) {
  const document = root.ownerDocument;
  const frame = root.querySelector<HTMLIFrameElement>('iframe')!;
  const theme = () => document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const horizontalUrl = new URL(frame.src, document.baseURI);
  let layout: 'horizontal' | 'vertical' | undefined;
  let sizeObserver: ResizeObserver | undefined;
  let resizeDiagram = () => {};

  function selectLayout() {
    const nextLayout = frame.clientWidth >= 800 ? 'horizontal' : 'vertical';
    if (nextLayout === layout) return;
    layout = nextLayout;
    sizeObserver?.disconnect();
    sizeObserver = undefined;
    resizeDiagram = () => {};
    const url = new URL(horizontalUrl);
    if (layout === 'vertical') url.pathname = url.pathname.replace('.html', '-vertical.html');
    // A URL override prevents Archify's independent saved/system theme taking over.
    url.searchParams.set('theme', theme());
    frame.src = url.href;
  }

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
      html[data-present="true"] #focus-chip { display: none !important; }
      html[data-present="true"]:not([data-embed="true"]) .diagram-container {
        height: var(--wiki-diagram-height); padding: 0; border: 0; border-radius: 0; box-shadow: none; background: var(--bg);
      }
      html[data-present="true"] .reader-rail { display: block; }
      html[data-present="true"] .node-outline:not([hidden]) { display: block; }
      html[data-present="true"] .node-outline-list {
        overflow: visible; mask-image: none; -webkit-mask-image: none;
      }
      html[data-present="true"] .node-outline-group > ul {
        display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem 1.5rem;
      }
      html[data-present="true"] .node-outline-group > ul::before { display: none; }
      html[data-present="true"] .node-outline-item {
        grid-template-columns: 0.625rem minmax(0, 1fr) 0.75rem; align-items: start;
      }
      html[data-present="true"] .node-outline-item strong,
      html[data-present="true"] .node-outline-item small {
        grid-column: 2; overflow: visible; white-space: normal; overflow-wrap: anywhere; text-overflow: clip;
      }
      html[data-present="true"] .node-outline-item strong { grid-row: 1; }
      html[data-present="true"] .node-outline-item small { grid-row: 2; text-align: left; }
      html[data-present="true"] .node-outline-item::after { grid-column: 3; grid-row: 1; }
      @media (max-width: 60rem) {
        html[data-present="true"] .node-outline-group > ul { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
      @media (max-width: 44rem) {
        html[data-present="true"] .node-outline-group > ul { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 28rem) {
        html[data-present="true"] .node-outline-group > ul { grid-template-columns: 1fr; }
      }
    `;
      viewer.head.append(style);
    }
    const index = viewer.getElementById('node-outline')!;
    function resize() {
      // The horizontal chart renders below full width so it does not dominate the page.
      const scale = layout === 'horizontal' ? 0.8 : 1;
      const diagramHeight = Math.ceil(frame.clientWidth * height / width * scale);
      viewer!.documentElement.style.setProperty('--wiki-diagram-height', `${diagramHeight}px`);
      const frameHeight = `${Math.ceil(diagramHeight + index.getBoundingClientRect().height)}px`;
      if (frame.style.height !== frameHeight) frame.style.height = frameHeight;
    }
    resizeDiagram = resize;
    sizeObserver = new document.defaultView!.ResizeObserver(resize);
    sizeObserver.observe(index);
    resize();
  });

  // These document-owned listeners also survive back-forward cache restoration.
  document.addEventListener('sourcey:themechange', syncTheme);
  const layoutObserver = new document.defaultView!.ResizeObserver(() => {
    selectLayout();
    resizeDiagram();
  });
  layoutObserver.observe(root);
  selectLayout();
}
