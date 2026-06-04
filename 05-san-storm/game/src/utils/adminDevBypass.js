/**
 * Game 门户「开发环境 / 生产环境」切换：仅浏览器 localStorage，不写源码。
 * 生产部署默认关闭；本地可开 bypass 跳过管理员 token，避免误提交 useAdmin 硬改。
 */
const STORAGE_KEY = 'san-storm-game-admin-dev-bypass';
const CHANGE_EVENT = 'san-storm-admin-dev-bypass-change';

/** 生产构建永远禁用 bypass（避免线上误开导致管理 API 401） */
export const isAdminDevBypassAllowed = !import.meta.env.PROD;

export function readAdminDevBypass() {
  if (!isAdminDevBypassAllowed) return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAdminDevBypass(enabled) {
  if (!isAdminDevBypassAllowed) return;
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { enabled: !!enabled } }));
  }
}

export function subscribeAdminDevBypass(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e) => callback(e.detail?.enabled ?? readAdminDevBypass());
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
