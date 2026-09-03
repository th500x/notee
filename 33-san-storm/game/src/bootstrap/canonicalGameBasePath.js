/**
 * 将裸路径 /33-san-storm/game 规范为 /33-san-storm/game/（与 Vite base 一致）。
 * 在 React 启动前执行，减轻刷新时浏览器去掉尾斜杠导致的白屏。
 */
const BASE = '/33-san-storm/game';
const BASE_INDEX = `${BASE}/`;

export function ensureCanonicalGameBasePath() {
  if (typeof window === 'undefined') return;
  const { pathname, search, hash } = window.location;
  if (pathname !== BASE) return;
  window.location.replace(`${BASE_INDEX}${search}${hash}`);
}

ensureCanonicalGameBasePath();
