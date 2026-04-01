import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
// 静态资源使用 05-san-storm/public（与 wiki 共用），不依赖 game/public 下符号链接
//（Linux 上 core.symlinks=false 时链接会变成文本文件，导致 vite build ENOENT）
export default defineConfig({
  publicDir: path.resolve(__dirname, '../public'),
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
    strictPort: true,
    open: true,
    fs: {
      allow: ['..'],
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      onwarn(warning, warn) {
        // 抑制 public 目录字体文件的路径解析警告
        if (warning.message?.includes('JYHPHS.woff2')) return;
        warn(warning);
      },
    },
  },
});
