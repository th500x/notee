import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/** `npm run build:vps` 时开启：压低 Rollup 并行，减轻 rendering chunks 内存峰值 */
const lowMemBuild = process.env.VITE_LOW_MEM_BUILD === '1';
const vpsParallel = Number(process.env.VPS_BUILD_PARALLEL);
const rollupParallelOps = lowMemBuild
  ? (Number.isFinite(vpsParallel) && vpsParallel >= 1 ? Math.min(4, Math.floor(vpsParallel)) : 1)
  : 20;

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
    // 开发：与 `API_CONFIG.BASE_URL` 默认 `/api` 对齐，避免直连 3005 跨源 + 确保走当前仓库的后端进程
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3005',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    cssMinify: 'esbuild',
    /** 关闭 gzip 体积统计，减轻低配 VPS 连续 build 时的内存峰值 */
    reportCompressedSize: false,
    chunkSizeWarningLimit: 480,
    rollupOptions: {
      /** rendering chunks 阶段默认并行较高；低配机易 OOM 死机 */
      maxParallelFileOps: rollupParallelOps,
      onwarn(warning, warn) {
        if (warning.message?.includes('JYHPHS.woff2')) return;
        if (warning.message?.includes('ZCOOLKuaiLe-Regular.woff2')) return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[/\\]node_modules[/\\]html2canvas/.test(id)) return 'vendor-html2canvas';
          if (
            /[/\\]node_modules[/\\]react[/\\]/.test(id) ||
            /[/\\]node_modules[/\\]react-dom[/\\]/.test(id) ||
            /[/\\]node_modules[/\\]react-router[/\\]/.test(id) ||
            /[/\\]node_modules[/\\]scheduler[/\\]/.test(id)
          ) {
            return 'vendor-react';
          }
          return 'vendor-libs';
        },
      },
    },
  },
});
