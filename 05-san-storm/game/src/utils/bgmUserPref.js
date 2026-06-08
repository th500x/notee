/**
 * 个人中心 · BGM 开/关偏好（localStorage）
 */

const STORAGE_KEY = 'san_storm_bgm_enabled';

export function readBgmEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeBgmEnabled(enabled) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* quota / 隐私模式 */
  }
}
