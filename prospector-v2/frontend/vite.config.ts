import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/puglinv2/',
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:3456', changeOrigin: true }, '/sites': { target: 'http://localhost:3456', changeOrigin: true } } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    css: true,
  },
  build: { outDir: 'dist' },
});
