import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { viteFontBuildOptions } from '../shared/viteFontBuildConfig.js';

// https://vitejs.dev/config/
// 与 game 一致：静态资源直接指向仓库 `05-san-storm/public`（勿依赖 wiki/public 下符号链接；
// Linux core.symlinks=false 时链接会变成文本文件导致 ENOENT）。
// 生产构建必须把 san_1_ui_card 等打入 dist，否则 /05-san-storm/wiki/assets/ 下全部 404。
export default defineConfig({
  plugins: [react()],
  base: '/05-san-storm/wiki/',
  publicDir: path.resolve(__dirname, '../public'),
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
      '@game-texts': path.resolve(__dirname, '../game/src/data/texts'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 3001,
    strictPort: true,
    open: true,
    fs: {
      allow: ['..'],
    },
    // 与 game 一致：开发走同源 /api 代理到 3005，避免直连跨域
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3005',
        changeOrigin: true,
      },
    },
    // 配置静态资源缓存响应头（开发环境）
    headers: {
      // 字体文件缓存 1 年
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    assetsInlineLimit: viteFontBuildOptions.assetsInlineLimit,
    rollupOptions: viteFontBuildOptions.rollupOptions,
  },
});
