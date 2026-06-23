/**
 * 11-life-resume 档案地区展示与 IP 刷新策略
 * 须与 lifeResumeProfileRegion.cjs 同步
 */

/** 登录态下距上次 IP 解析超过该天数则静默重查（后端可用 env 覆盖，前端展示固定 7） */
export const REGION_REFRESH_DAYS = 7;

/**
 * @param {string|null|undefined} ip
 */
export function isPlaceholderClientIp(ip) {
  const s = String(ip || '')
    .trim()
    .replace(/^::ffff:/i, '');
  return !s || s === '0.0.0.0' || s === 'unknown' || s === '::1' || s === '127.0.0.1';
}

/**
 * @param {string|null|undefined} country
 * @param {string|null|undefined} regionName — 省 / 州 / 府级
 * @returns {string|null}
 */
export function buildRegionPublicLabel(country, regionName) {
  const c = String(country || '').trim();
  const r = String(regionName || '').trim();
  if (!c && !r) return null;
  if (!r) return c.slice(0, 128);
  if (!c) return r.slice(0, 128);
  return `${c}·${r}`.slice(0, 128);
}

/**
 * @param {string|null|undefined} username
 * @param {string|null|undefined} regionPublicLabel
 * @param {string|null|undefined} accountId
 */
export function formatProfileDisplayName(username, regionPublicLabel, accountId) {
  const name = String(username || '').trim() || String(accountId || '').trim();
  const region = String(regionPublicLabel || '').trim();
  if (!region) return name;
  return `${name} · ${region}`;
}

/**
 * @param {Date|string|null|undefined} regionUpdatedAt
 * @param {Date} [now]
 */
export function shouldRefreshProfileRegion(regionUpdatedAt, now = new Date()) {
  if (!regionUpdatedAt) return true;
  const last = regionUpdatedAt instanceof Date ? regionUpdatedAt : new Date(regionUpdatedAt);
  if (Number.isNaN(last.getTime())) return true;
  const days = Number.isFinite(REGION_REFRESH_DAYS) && REGION_REFRESH_DAYS > 0 ? REGION_REFRESH_DAYS : 7;
  return now.getTime() - last.getTime() >= days * 24 * 60 * 60 * 1000;
}
