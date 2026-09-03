/**
 * 11-life-resume 地理坐标校验与展示
 * 须与 lifeResumeLocation.cjs 同步
 */

export const LATITUDE_MIN = -90;
export const LATITUDE_MAX = 90;
export const LONGITUDE_MIN = -180;
export const LONGITUDE_MAX = 180;

export const LOCATION_CAPTURE_METHODS = ['none', 'geolocation', 'map_pick'];

/** 超过此半径（米）时提示用户改用手动选点 */
export const GEOLOCATION_ACCURACY_WARN_METERS = 3000;

/**
 * @param {number|null|undefined} accuracyMeters — GeolocationPosition.coords.accuracy
 * @returns {string|null}
 */
export function formatGeolocationAccuracyMeters(accuracyMeters) {
  const meters = Number(accuracyMeters);
  if (!Number.isFinite(meters) || meters < 0) return null;
  if (meters < 1000) {
    const rounded = Math.max(10, Math.round(meters / 10) * 10);
    return `约 ±${rounded} m`;
  }
  const km = meters / 1000;
  const roundedKm = km >= 10 ? Math.round(km) : Math.round(km * 10) / 10;
  return `约 ±${roundedKm} km`;
}

/**
 * @param {number|null|undefined} accuracyMeters
 */
export function shouldWarnGeolocationAccuracy(accuracyMeters) {
  const meters = Number(accuracyMeters);
  return Number.isFinite(meters) && meters > GEOLOCATION_ACCURACY_WARN_METERS;
}

/**
 * @param {number|string|null|undefined} latitude
 * @param {number|string|null|undefined} longitude
 */
export function validateCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, error: '请输入有效的经纬度', code: 'INVALID_LOCATION' };
  }
  if (lat < LATITUDE_MIN || lat > LATITUDE_MAX) {
    return { ok: false, error: '纬度须在 -90 到 90 之间', code: 'INVALID_LOCATION' };
  }
  if (lon < LONGITUDE_MIN || lon > LONGITUDE_MAX) {
    return { ok: false, error: '经度须在 -180 到 180 之间', code: 'INVALID_LOCATION' };
  }
  return { ok: true, latitude: lat, longitude: lon };
}

/**
 * @param {number} latitude
 * @param {number} longitude
 */
export function formatExactCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  return `${lat.toFixed(7)}, ${lon.toFixed(7)}`;
}

function isStoredGoogleMapsHttpsUrl(raw) {
  const stored = String(raw || '').trim();
  if (!stored) return false;
  try {
    const url = new URL(stored);
    return url.protocol === 'https:' && /(^|\.)google\./i.test(url.hostname);
  } catch {
    return false;
  }
}

/**
 * @param {{ latitude?: number|null, longitude?: number|null, label?: string|null, placeName?: string|null, mapsUrl?: string|null }} options
 * @returns {string|null}
 */
export function buildGoogleMapsUrl({ latitude, longitude, label, placeName, mapsUrl } = {}) {
  if (isStoredGoogleMapsHttpsUrl(mapsUrl)) {
    return String(mapsUrl).trim();
  }

  const name = String(placeName || label || '').trim();
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (name) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  }
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lon}`)}`;
  }
  return null;
}
