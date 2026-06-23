import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: '/11-life-resume/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../05-san-storm/shared'),
    },
  },
  server: {
    port: 5177,
    open: '/11-life-resume/',
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api/auth': {
        target: 'http://127.0.0.1:3005',
        changeOrigin: true,
      },
      '/api/life-resume': {
        target: 'http://localhost:3011',
        changeOrigin: true,
      },
    },
  },
});
