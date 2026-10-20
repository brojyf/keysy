import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    rollupOptions: {
      input: Object.fromEntries(['index.html', 'logo/index.html', 'theme/index.html', 'css/index.html', 'css/frame.html']
        .map(path => [path, fileURLToPath(new URL(path, import.meta.url))])),
    },
  },
});
