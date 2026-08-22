import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(process.cwd(), 'src/renderer'),
  // Relative base so the packaged app loads assets over file://
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(process.cwd(), 'out/renderer'),
    emptyOutDir: true,
  },
});
