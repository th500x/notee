/**
 * Vite 字体走 assets 内容哈希：字体文件未改则 URL 跨发版不变，浏览器可长期缓存。
 * 供 05 主站 / game / wiki 的 vite.config 复用。
 */

export const viteFontBuildOptions = {
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
};
