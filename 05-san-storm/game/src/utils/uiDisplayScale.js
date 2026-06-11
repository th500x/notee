/**
 * 界面可读性：低 DPR（典型 1080p @100%）字号 +1px；个人中心可选整页缩放（localStorage）。
 * CSS 变量：`--ui-font-dpr-bump`、`--ui-user-scale`；`html { zoom }` 实现同比放大。
 */

const STORAGE_KEY = 'san_storm_ui_user_scale';

/** devicePixelRatio ≤ 此值时视为「标准 DPI 屏」，启用 +1px 补偿 */
export const UI_DPR_BUMP_MAX = 1.25;

/** 战略地图 clamp 上限参照格边长（与默认 `--ws-tile` ≈48px 对齐） */
export const UI_MAP_LABEL_REF_TILE_PX = 48;

export const UI_USER_SCALE_OPTIONS = [
  { value: 1, label: '100%' },
  { value: 1.2, label: '120%' },
  { value: 1.4, label: '140%' },
];

function normalizeUserScale(raw) {
  const n = Number(raw);
  if (n === 1.2 || n === 1.4) return n;
  /* 旧档 110%/125% → 就近映射到新档 */
  if (n === 1.1) return 1.2;
  if (n === 1.25) return 1.4;
  return 1;
}

export function readUiUserScale() {
  if (typeof window === 'undefined') return 1;
  try {
    return normalizeUserScale(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 1;
  }
}

export function writeUiUserScale(scale) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, String(normalizeUserScale(scale)));
  } catch {
    /* quota / 隐私模式 */
  }
  applyUiDisplayScale();
}

/** @returns {boolean} 是否启用低 DPR +1px（供 UI 展示） */
export function isUiFontDprBumpActive() {
  if (typeof window === 'undefined') return false;
  return (window.devicePixelRatio || 1) <= UI_DPR_BUMP_MAX;
}

/**
 * 写入 `:root` CSS 变量与 `html` zoom / rem 基准；入口与设置变更后调用。
 */
export function applyUiDisplayScale() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const userScale = readUiUserScale();
  const dprBump = isUiFontDprBumpActive() ? 1 : 0;

  root.style.setProperty('--ui-user-scale', String(userScale));
  root.style.setProperty('--ui-font-dpr-bump', dprBump ? '1px' : '0px');
  root.dataset.uiDprBump = dprBump ? '1' : '0';
  root.dataset.uiUserScale = String(userScale);

  /* Chromium / Safari：整页同比缩放，不改变各组件相对比例 */
  root.style.zoom = userScale === 1 ? '' : String(userScale);

  /*
   * 不用 html font-size 17px：会破坏 rem 定位（如角钮 left-2）与 px 格网的左缘对齐。
   * 字号补偿仅经 --ui-font-dpr-bump 写入地图等显式 calc()。
   */
  root.style.fontSize = '';
}
