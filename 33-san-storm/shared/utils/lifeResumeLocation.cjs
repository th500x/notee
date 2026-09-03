/**
 * 11-life-resume 地理坐标校验与展示
 * 须与 lifeResumeLocation.js 同步
 */

const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;

const LOCATION_CAPTURE_METHODS = ['none', 'geolocation', 'map_pick'];

const GEOLOCATION_ACCURACY_WARN_METERS = 3000;

function formatGeolocationAccuracyMeters(accuracyMeters) {
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

function shouldWarnGeolocationAccuracy(accuracyMeters) {
  const meters = Number(accuracyMeters);
  return Number.isFinite(meters) && meters > GEOLOCATION_ACCURACY_WARN_METERS;
}

function validateCoordinates(latitude, longitude) {
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

function formatExactCoordinates(latitude, longitude) {
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

function buildGoogleMapsUrl({ latitude, longitude, label, placeName, mapsUrl } = {}) {
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

module.exports = {
  LATITUDE_MIN,
  LATITUDE_MAX,
  LONGITUDE_MIN,
  LONGITUDE_MAX,
  LOCATION_CAPTURE_METHODS,
  GEOLOCATION_ACCURACY_WARN_METERS,
  validateCoordinates,
  formatExactCoordinates,
  formatGeolocationAccuracyMeters,
  shouldWarnGeolocationAccuracy,
  buildGoogleMapsUrl,
};
