import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      // Two pages, one build: the landing page and the /treegen/ editor.
      input: { main: r('index.html'), treegen: r('treegen/index.html') },
    },
  },
});
