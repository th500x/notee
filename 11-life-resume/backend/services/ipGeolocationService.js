/**
 * IP → 档案地区标签（国家·省/府，中文）
 * 使用 ip-api.com（无 key；服务端调用，须遵守其速率限制）
 */

const {
  buildRegionPublicLabel,
  isPlaceholderClientIp,
} = require('../../../33-san-storm/shared/utils/lifeResumeProfileRegion.cjs');

const FETCH_TIMEOUT_MS = parseInt(process.env.LIFE_RESUME_IP_GEO_TIMEOUT_MS || '4500', 10);

async function fetchIpApiPayload(ip) {
  const url = new URL(`http://ip-api.com/json/${encodeURIComponent(ip)}`);
  url.searchParams.set('lang', 'zh-CN');
  url.searchParams.set('fields', 'status,message,country,regionName,query');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { status: 'fail', message: `HTTP ${res.status}` };
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string|null|undefined} ip
 * @returns {Promise<{ ok: true, regionPublicLabel: string } | { ok: false, code: string, message?: string }>}
 */
async function resolveRegionFromIp(ip) {
  const cleaned = String(ip || '')
    .trim()
    .replace(/^::ffff:/i, '');
  if (isPlaceholderClientIp(cleaned)) {
    return { ok: false, code: 'PLACEHOLDER_IP' };
  }

  try {
    const data = await fetchIpApiPayload(cleaned);
    if (!data || data.status !== 'success') {
      return {
        ok: false,
        code: 'IP_GEO_FAILED',
        message: data?.message || 'IP 地理解析失败',
      };
    }
    const regionPublicLabel = buildRegionPublicLabel(data.country, data.regionName);
    if (!regionPublicLabel) {
      return { ok: false, code: 'IP_GEO_FAILED', message: '无法生成地区标签' };
    }
    return { ok: true, regionPublicLabel };
  } catch (err) {
    const aborted = err && err.name === 'AbortError';
    return {
      ok: false,
      code: 'IP_GEO_FAILED',
      message: aborted ? 'IP 地理解析超时' : err?.message || 'IP 地理解析异常',
    };
  }
}

module.exports = {
  resolveRegionFromIp,
};
