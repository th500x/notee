/**
 * 11-life-resume 档案地区展示与 IP 刷新策略
 * 须与 lifeResumeProfileRegion.js 同步
 */

const REGION_REFRESH_DAYS = parseInt(process.env.LIFE_RESUME_REGION_REFRESH_DAYS || '7', 10);

function isPlaceholderClientIp(ip) {
  const s = String(ip || '')
    .trim()
    .replace(/^::ffff:/i, '');
  return !s || s === '0.0.0.0' || s === 'unknown' || s === '::1' || s === '127.0.0.1';
}

function buildRegionPublicLabel(country, regionName) {
  const c = String(country || '').trim();
  const r = String(regionName || '').trim();
  if (!c && !r) return null;
  if (!r) return c.slice(0, 128);
  if (!c) return r.slice(0, 128);
  return `${c}·${r}`.slice(0, 128);
}

function formatProfileDisplayName(username, regionPublicLabel, accountId) {
  const name = String(username || '').trim() || String(accountId || '').trim();
  const region = String(regionPublicLabel || '').trim();
  if (!region) return name;
  return `${name} · ${region}`;
}

function shouldRefreshProfileRegion(regionUpdatedAt, now = new Date()) {
  if (!regionUpdatedAt) return true;
  const last = regionUpdatedAt instanceof Date ? regionUpdatedAt : new Date(regionUpdatedAt);
  if (Number.isNaN(last.getTime())) return true;
  const days = Number.isFinite(REGION_REFRESH_DAYS) && REGION_REFRESH_DAYS > 0 ? REGION_REFRESH_DAYS : 7;
  return now.getTime() - last.getTime() >= days * 24 * 60 * 60 * 1000;
}

module.exports = {
  REGION_REFRESH_DAYS,
  isPlaceholderClientIp,
  buildRegionPublicLabel,
  formatProfileDisplayName,
  shouldRefreshProfileRegion,
};
