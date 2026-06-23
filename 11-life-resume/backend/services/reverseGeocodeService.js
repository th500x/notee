/**
 * Reverse geocoding for location_public_label (city / district level).
 * Uses OpenStreetMap Nominatim — no API key; respect rate limits in production.
 */

const { validateCoordinates } = require('../../../05-san-storm/shared/utils/lifeResumeLocation.cjs');

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT =
  process.env.LIFE_RESUME_GEOCODE_UA || 'notee-life-resume/1.0 (contact: local-dev)';

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
  url.searchParams.set('accept-language', 'zh');
  url.searchParams.set('zoom', '10');

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });

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

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('q', queryText);
  url.searchParams.set('accept-language', 'zh');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });

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

module.exports = {
  reverseGeocodeToPublicLabel,
  forwardGeocodePlaceToPublicLabel,
  buildPublicLabelFromAddress,
};
