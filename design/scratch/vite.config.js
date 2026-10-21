import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: Object.fromEntries(['index.html', 'logo/index.html']
        .map(path => [path, fileURLToPath(new URL(path, import.meta.url))])),
    },
  },
});
