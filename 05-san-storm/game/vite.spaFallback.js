/**
 * Game 子站 SPA：兼容 Vite base 带尾斜杠与 React Router basename 无尾斜杠。
 * - GET /05-san-storm/game → 308 到 /05-san-storm/game/
 * - GET /05-san-storm/game/*（非静态资源）→ 回退 index.html
 */
const BASE = '/05-san-storm/game';
const BASE_INDEX = `${BASE}/`;

function splitPathQuery(url = '/') {
  const q = url.indexOf('?');
  if (q === -1) return { pathname: url, search: '' };
  return { pathname: url.slice(0, q), search: url.slice(q) };
}

function isStaticAsset(pathname) {
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

export function createGameSpaFallbackMiddleware() {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const { pathname, search } = splitPathQuery(req.url || '/');

    if (pathname === BASE) {
      res.writeHead(308, { Location: `${BASE_INDEX}${search}` });
      res.end();
      return;
    }

    const underBase = pathname === BASE || pathname.startsWith(`${BASE}/`);
    if (!underBase) return next();

    if (isStaticAsset(pathname)) return next();
    if (pathname.includes('/@') || pathname.includes('/node_modules')) return next();

    req.url = `${BASE_INDEX}${search}`;
    next();
  };
}

export function gameSpaFallbackPlugin() {
  const attach = (server) => {
    server.middlewares.use(createGameSpaFallbackMiddleware());
  };
  return {
    name: 'game-spa-fallback',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
