import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { siteFontDevPlugin } from '../shared/viteSiteFont.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function offTreeOutDir(bucket) {
  if (process.platform !== 'win32') return 'dist';
  return path.join(path.parse(__dirname).root, 'notee-build', bucket);
}

export default defineConfig({
  plugins: [react(), siteFontDevPlugin(path.resolve(__dirname, '..'))],
  base: '/08-life-resume/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  server: {
    port: 5177,
    open: '/08-life-resume/',
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    proxy: {
      '/api/life-resume': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: offTreeOutDir('08-life-resume'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          if (/\.(woff2?|ttf|otf|eot)$/i.test(name)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
