/**
 * 大地图四角 HUD（32-4 左上导航 · 32-5 左下通信/排行）显隐偏好。
 */

const STORAGE_KEY = 'san_storm_map_hud_buttons_visible';

export function readMapHudButtonsVisible() {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeMapHudButtonsVisible(visible) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, visible ? '1' : '0');
  } catch {
    /* quota / 隐私模式 */
  }
}
