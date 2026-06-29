/**
 * Google 地图分享链接解析（11-life-resume）
 * 须与 parseGoogleMapsShareUrl.cjs 同步
 */

import { validateCoordinates } from './lifeResumeLocation.js';

export const GOOGLE_MAPS_ALLOWED_HOSTS = [
  'google.com',
  'maps.google.com',
  'maps.app.goo.gl',
  'goo.gl',
];

const HOST_SUFFIXES = ['google.com', 'google.com.hk', 'google.co.jp'];

function normalizeHost(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
}

function isGoogleMapsHost(host) {
  if (GOOGLE_MAPS_ALLOWED_HOSTS.includes(host)) return true;
  return HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function normalizeLocationPlaceName(raw) {
  const text = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return null;
  return text.slice(0, 256);
}

export function normalizeLocationMapsUrl(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  return text.slice(0, 1024);
}

function isGoogleMapsShortUrlHost(host) {
  return host === 'goo.gl' || host === 'maps.app.goo.gl';
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
export function isGoogleMapsShortUrl(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return false;
    return isGoogleMapsShortUrlHost(normalizeHost(url.hostname));
  } catch {
    return false;
  }
}

function decodePlaceSegment(segment) {
  try {
    return decodeURIComponent(String(segment || '').replace(/\+/g, ' ')).trim();
  } catch {
    return String(segment || '').replace(/\+/g, ' ').trim();
  }
}

function extractCoordsFromHref(href) {
  let latitude = null;
  let longitude = null;

  const atMatch = href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    latitude = Number(atMatch[1]);
    longitude = Number(atMatch[2]);
  }

  const dataMatch = href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dataMatch) {
    latitude = Number(dataMatch[1]);
    longitude = Number(dataMatch[2]);
  }

  if (latitude != null && longitude != null) {
    const check = validateCoordinates(latitude, longitude);
    if (check.ok) {
      return { latitude: check.latitude, longitude: check.longitude };
    }
  }

  return { latitude: null, longitude: null };
}

/**
 * @param {string} raw
 * @returns {{ ok: true, empty?: boolean, shareUrl?: string, placeName?: string|null, latitude?: number|null, longitude?: number|null } | { ok: false, error: string, code: string }}
 */
export function parseGoogleMapsShareUrl(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return { ok: true, empty: true };
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: '请粘贴 Google 地图的 https 分享链接',
      code: 'INVALID_GOOGLE_MAPS_URL',
    };
  }

  if (url.protocol !== 'https:') {
    return {
      ok: false,
      error: '地图链接须以 https:// 开头',
      code: 'INVALID_GOOGLE_MAPS_URL',
    };
  }

  const host = normalizeHost(url.hostname);
  if (!isGoogleMapsHost(host)) {
    return {
      ok: false,
      error: '仅支持 Google 地图链接',
      code: 'INVALID_GOOGLE_MAPS_URL',
    };
  }

  if (isGoogleMapsShortUrlHost(host)) {
    return {
      ok: false,
      code: 'GOOGLE_MAPS_SHORT_URL',
      error: '正在解析 Google 地图短链接…',
      shortUrl: trimmed,
    };
  }

  let placeName = null;
  const placeMatch = url.pathname.match(/\/place\/([^/]+)/);
  if (placeMatch) {
    placeName = normalizeLocationPlaceName(decodePlaceSegment(placeMatch[1]));
  }

  const q = url.searchParams.get('q');
  if (q) {
    const coordQ = q.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    if (coordQ) {
      const check = validateCoordinates(coordQ[1], coordQ[2]);
      if (check.ok) {
        return {
          ok: true,
          shareUrl: trimmed,
          placeName,
          latitude: check.latitude,
          longitude: check.longitude,
        };
      }
    } else if (!placeName) {
      placeName = normalizeLocationPlaceName(q);
    }
  }

  const query = url.searchParams.get('query');
  if (query && !placeName) {
    placeName = normalizeLocationPlaceName(query);
  }

  const { latitude, longitude } = extractCoordsFromHref(url.href);

  if (!placeName && latitude == null) {
    return {
      ok: false,
      error: '无法从链接识别地点，请确认链接指向具体地点，或直接填写地点名称',
      code: 'INVALID_GOOGLE_MAPS_URL',
    };
  }

  return {
    ok: true,
    shareUrl: trimmed,
    placeName,
    latitude,
    longitude,
  };
}
