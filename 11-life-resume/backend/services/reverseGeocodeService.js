/**
 * Reverse geocoding for location_public_label (city / district level).
 * Uses OpenStreetMap Nominatim — no API key; respect rate limits in production.
 */

const { validateCoordinates } = require('../../../05-san-storm/shared/utils/lifeResumeLocation.cjs');
const {
  extractGeocodeQueryCandidates,
  buildFallbackPublicLabelFromPlaceName,
} = require('../../../05-san-storm/shared/utils/locationPublicLabelFallback.cjs');

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT =
  process.env.LIFE_RESUME_GEOCODE_UA || 'notee-life-resume/1.0 (contact: local-dev)';
const GEOCODE_TIMEOUT_MS = 8000;

function buildPublicLabelFromAddress(address, displayName) {
  const addr = address || {};
  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    addr.state;
  const district =
    addr.suburb || addr.district || addr.neighbourhood || addr.quarter || addr.borough;

  const parts = [];
  if (city) parts.push(String(city));
  if (district && district !== city) parts.push(String(district));
  if (parts.length > 0) {
    return parts.join(' · ').slice(0, 128);
  }

  if (displayName) {
    return String(displayName)
      .split(',')
      .slice(0, 2)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' · ')
      .slice(0, 128);
  }

  return null;
}

function geocodeFetch(url) {
  return fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
  });
}

async function reverseGeocodeToPublicLabel(latitude, longitude) {
  const check = validateCoordinates(latitude, longitude);
  if (!check.ok) {
    const err = new Error(check.error);
    err.code = check.code;
    throw err;
  }

  const url = new URL(NOMINATIM_REVERSE);
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(check.latitude));
  url.searchParams.set('lon', String(check.longitude));
  url.searchParams.set('accept-language', 'zh,en');
  url.searchParams.set('zoom', '10');

  const res = await geocodeFetch(url);

  if (!res.ok) {
    const err = new Error('逆地理编码服务暂不可用');
    err.code = 'GEOCODE_FAILED';
    throw err;
  }

  const data = await res.json();
  const label = buildPublicLabelFromAddress(data.address, data.display_name);
  if (!label) {
    const err = new Error('无法解析该坐标对应的城/区县名称');
    err.code = 'GEOCODE_FAILED';
    throw err;
  }

  return label;
}

async function forwardGeocodePlaceToPublicLabel(placeName) {
  const queryText = String(placeName || '').trim();
  if (!queryText) {
    const err = new Error('地点名称不能为空');
    err.code = 'INVALID_LOCATION';
    throw err;
  }

  const url = new URL(NOMINATIM_SEARCH);
  url.searchParams.set('format', 'json');
  url.searchParams.set('q', queryText);
  url.searchParams.set('accept-language', 'zh,en');
  url.searchParams.set('limit', '1');

  const res = await geocodeFetch(url);

  if (!res.ok) {
    const err = new Error('地点解析服务暂不可用');
    err.code = 'GEOCODE_FAILED';
    throw err;
  }

  const rows = await res.json();
  const hit = Array.isArray(rows) ? rows[0] : null;
  if (!hit) {
    const err = new Error('无法根据地点名称解析城/区县，请尝试粘贴 Google 地图链接');
    err.code = 'GEOCODE_FAILED';
    throw err;
  }

  const label = buildPublicLabelFromAddress(hit.address, hit.display_name);
  if (!label) {
    const err = new Error('无法根据地点名称解析城/区县');
    err.code = 'GEOCODE_FAILED';
    throw err;
  }

  return label;
}

/**
 * 解析访客可见的城/区县模糊文案；外部地理编码不可用时使用纯文本回退，避免阻断发布。
 * @param {{ placeName?: string|null, latitude?: number|null, longitude?: number|null }} input
 * @returns {Promise<string>}
 */
async function resolveLocationPublicLabel(input) {
  const placeName = input?.placeName ? String(input.placeName).trim() : '';
  const latitude = input?.latitude ?? null;
  const longitude = input?.longitude ?? null;

  if (latitude != null && longitude != null) {
    try {
      return await reverseGeocodeToPublicLabel(latitude, longitude);
    } catch (err) {
      console.warn('[life-resume] reverse geocode failed:', err.message);
    }
  }

  if (placeName) {
    const queries = [
      placeName,
      ...extractGeocodeQueryCandidates(placeName),
    ].filter(Boolean);
    const seen = new Set();
    for (const query of queries) {
      const key = query.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        return await forwardGeocodePlaceToPublicLabel(query);
      } catch (err) {
        console.warn('[life-resume] forward geocode failed:', query.slice(0, 60), err.message);
      }
    }

    const fallback = buildFallbackPublicLabelFromPlaceName(placeName);
    if (fallback) {
      return fallback;
    }
  }

  const err = new Error('无法解析位置，请填写含城市信息的地点名称');
  err.code = 'GEOCODE_FAILED';
  throw err;
}

module.exports = {
  reverseGeocodeToPublicLabel,
  forwardGeocodePlaceToPublicLabel,
  resolveLocationPublicLabel,
  buildPublicLabelFromAddress,
};
