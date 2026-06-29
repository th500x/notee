/**
 * Google 地图短链接（maps.app.goo.gl / goo.gl）服务端展开后解析。
 */

const {
  parseGoogleMapsShareUrl,
  normalizeLocationMapsUrl,
  isGoogleMapsShortUrl,
} = require('../../../05-san-storm/shared/utils/parseGoogleMapsShareUrl.cjs');

const RESOLVE_TIMEOUT_MS = 12000;
const USER_AGENT = 'Mozilla/5.0 (compatible; notee-life-resume/1.0)';

class GoogleMapsResolveError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'GoogleMapsResolveError';
    this.code = code;
    this.status = status;
  }
}

async function followRedirectsToFinalUrl(startUrl) {
  const response = await fetch(startUrl, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,*/*',
    },
    signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
  });
  return response.url || startUrl;
}

/**
 * 同步解析完整链接；短链接则服务端跟随重定向后再解析。
 * @param {string} raw
 */
async function resolveGoogleMapsShareUrl(raw) {
  const trimmed = normalizeLocationMapsUrl(raw);
  if (!trimmed) {
    return { ok: true, empty: true };
  }

  let parsed = parseGoogleMapsShareUrl(trimmed);
  if (parsed.ok) {
    return parsed;
  }
  if (parsed.code !== 'GOOGLE_MAPS_SHORT_URL') {
    return parsed;
  }
  if (!isGoogleMapsShortUrl(trimmed)) {
    return parsed;
  }

  let finalUrl = trimmed;
  try {
    finalUrl = await followRedirectsToFinalUrl(trimmed);
  } catch (err) {
    throw new GoogleMapsResolveError(
      'GOOGLE_MAPS_RESOLVE_FAILED',
      '短链接解析失败，请检查网络或稍后重试',
      502
    );
  }

  parsed = parseGoogleMapsShareUrl(finalUrl);
  if (!parsed.ok) {
    throw new GoogleMapsResolveError(
      'GOOGLE_MAPS_RESOLVE_FAILED',
      '短链接已展开但无法识别地点，请填写地点名称或改粘贴完整链接',
      400
    );
  }

  return {
    ...parsed,
    shareUrl: parsed.shareUrl || finalUrl,
  };
}

module.exports = {
  GoogleMapsResolveError,
  resolveGoogleMapsShareUrl,
};
