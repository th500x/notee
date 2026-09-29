/**
 * Google 地图短链接（maps.app.goo.gl / goo.gl）服务端展开后解析。
 */

const {
  parseGoogleMapsShareUrl,
  normalizeLocationMapsUrl,
  canonicalizeGoogleMapsShareUrl,
  isGoogleMapsShortUrl,
} = require('../../shared/utils/parseGoogleMapsShareUrl.cjs');

const RESOLVE_TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 10;
const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

class GoogleMapsResolveError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'GoogleMapsResolveError';
    this.code = code;
    this.status = status;
  }
}

function buildFetchOptions(redirect) {
  return {
    method: 'GET',
    redirect,
    headers: {
      'User-Agent': MOBILE_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
  };
}

async function followRedirectsToFinalUrl(startUrl) {
  let current = startUrl;

  for (let step = 0; step < MAX_REDIRECTS; step += 1) {
    const response = await fetch(current, buildFetchOptions('manual'));

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        break;
      }
      current = new URL(location, current).href;
      continue;
    }

    if (response.status === 404) {
      throw new GoogleMapsResolveError(
        'GOOGLE_MAPS_RESOLVE_FAILED',
        'Google 未能识别此短链接（每次分享会生成新链接，部分新链接暂无法自动展开）。请填写地点名称后仍可发布，或在浏览器打开该链接后复制地址栏中以 google.com/maps 开头的完整链接',
        400
      );
    }

    if (!response.ok) {
      throw new GoogleMapsResolveError(
        'GOOGLE_MAPS_RESOLVE_FAILED',
        `短链接解析失败（HTTP ${response.status}），请稍后重试或粘贴完整链接`,
        502
      );
    }

    return current;
  }

  return current;
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
  const isShort = !parsed.ok && parsed.code === 'GOOGLE_MAPS_SHORT_URL';
  const needsExpand =
    isShort ||
    (parsed.ok && !parsed.empty && parsed.latitude == null && parsed.longitude == null);

  if (needsExpand) {
    let finalUrl = trimmed;
    try {
      finalUrl = await followRedirectsToFinalUrl(trimmed);
    } catch (err) {
      if (isShort) {
        if (err instanceof GoogleMapsResolveError) throw err;
        throw new GoogleMapsResolveError(
          'GOOGLE_MAPS_RESOLVE_FAILED',
          '短链接解析失败，请检查网络或稍后重试',
          502
        );
      }
      if (!parsed.ok) return parsed;
    }

    if (isShort && isGoogleMapsShortUrl(finalUrl)) {
      throw new GoogleMapsResolveError(
        'GOOGLE_MAPS_RESOLVE_FAILED',
        '短链接未能展开为完整地图地址，请粘贴浏览器地址栏中的完整链接',
        400
      );
    }

    const reparsed = parseGoogleMapsShareUrl(finalUrl);
    if (reparsed.ok) {
      parsed = reparsed;
    } else if (!parsed.ok) {
      if (isShort) {
        throw new GoogleMapsResolveError(
          'GOOGLE_MAPS_RESOLVE_FAILED',
          '短链接已展开但无法识别地点，请填写地点名称或改粘贴完整链接',
          400
        );
      }
      return parsed;
    }
  }

  if (!parsed.ok) {
    return parsed;
  }

  const canonicalShareUrl = normalizeLocationMapsUrl(
    canonicalizeGoogleMapsShareUrl(parsed.shareUrl || trimmed) || parsed.shareUrl || trimmed
  );

  return {
    ...parsed,
    shareUrl: canonicalShareUrl,
  };
}

module.exports = {
  GoogleMapsResolveError,
  resolveGoogleMapsShareUrl,
};
