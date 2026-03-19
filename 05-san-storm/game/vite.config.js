import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // SPA子路由回退：确保 /05-san-storm/game/san_1 等不带尾部斜杠的路径也能正确回退到 index.html
    {
      name: 'spa-fallback',
      configureServer(server) {
        const base = '/05-san-storm/game/';
        server.middlewares.use((req, res, next) => {
          // 只处理 base 路径下、非静态资源的 GET 请求
          if (
            req.method === 'GET' &&
            req.url.startsWith(base) &&
            !req.url.includes('.') &&
            !req.url.startsWith(base + '@') &&
            !req.url.startsWith(base + 'node_modules')
          ) {
            req.url = base;
          }
          next();
        });
      }
    },
    react(),
  ],
  base: '/05-san-storm/game/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@constants': path.resolve(__dirname, './src/constants'),
      '@config': path.resolve(__dirname, './src/config'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@types': path.resolve(__dirname, './src/types'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
    // 确保React只使用一个实例
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 3002,
    open: true,
    // public/assets 是 symlink 指向上级目录，需要允许 Vite 访问
    fs: {
      allow: ['..'],
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
