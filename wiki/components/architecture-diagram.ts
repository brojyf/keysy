import { defineComponent } from 'sourcey';

export const architectureDiagram = defineComponent({
  parseProps: () => ({}),
  resolve: () => ({ content: [] }),
  renderHtml: () => '<iframe class="architecture-diagram" src="/architecture/system-architecture.html?present=1" title="Keysy system architecture" width="100%" height="760" loading="lazy"></iframe>',
  client: {
    entry: './components/architecture-diagram.client.ts',
    css: ['./components/architecture-diagram.css'],
  },
});
