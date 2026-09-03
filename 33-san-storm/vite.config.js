import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { viteFontBuildOptions } from './shared/viteFontBuildConfig.js';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/33-san-storm/',
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
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  server: {
    port: 3000,
    open: true,
    fs: {
      allow: ['..'],
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
