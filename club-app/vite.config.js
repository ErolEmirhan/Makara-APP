import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Göreli yol: /club/ altında, kendi alan adında ya da önizlemede aynı build çalışır.
  base: './',
  server: { port: 5175, host: true },
  // Kök dizindeki Tailwind/PostCSS ayarlarını devralma.
  css: { postcss: {} },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
