import { isBanditMapObjectId } from './smallMapEnemyRoster.js';

/**
 * 事件 location 占位符解析（与 cities.city_type + wilderness_enabled / market_enabled 对齐）
 *
 * **前后端单一来源**（ESM）：游戏前端经 `@shared/utils/eventLocationPlaceholders.js` 引用，
 * Node 后端经 dynamic `import()`（与 `smallMapEnemyRoster.js` 同模式）；
 * `game/src/utils/eventLocationPlaceholders.js` 仅做 `export *` 再导出，勿再写第二套实现。
 *
 * - {all}：无地理约束
 * - {any_city}：大城 / 中城 / 小城
 * - {any_gate} / {any_fort}：关隘 / 据点
 * - {any_wilderness} / {any_market}：任意开启荒郊 / 集市 的城（大中小均可；兼容旧 city_type=wilderness|market 行）
 * - {city_major_wilderness} / {city_medium_wilderness} / {city_major_market} / {city_medium_market}：按城格类型 + 开关细分
 * - {city_major} / {city_medium} / {city_small}：仅按城格类型匹配（不等同于荒郊/集市开关）
 * - {any_bandit}：匪寨地图对象 ID（`san_*_bandit_*`，与 `banditPoiId` / `targetPoiId` 同族）
 */

/** @type {readonly string[]} */
export const CITY_TYPES_ANY_CITY = ['city_major', 'city_medium', 'city_small'];

export const LOCATION_PLACEHOLDERS = {
  ALL: '{all}',
  ANY_CITY: '{any_city}',
  ANY_GATE: '{any_gate}',
  ANY_FORT: '{any_fort}',
  ANY_WILDERNESS: '{any_wilderness}',
  ANY_MARKET: '{any_market}',
  CITY_MAJOR_WILDERNESS: '{city_major_wilderness}',
  CITY_MEDIUM_WILDERNESS: '{city_medium_wilderness}',
  CITY_MAJOR_MARKET: '{city_major_market}',
  CITY_MEDIUM_MARKET: '{city_medium_market}',
  /** 仅大城 / 中城 / 小城类型（与 cities.city_type 一致） */
  CITY_MAJOR: '{city_major}',
  CITY_MEDIUM: '{city_medium}',
  CITY_SMALL: '{city_small}',
  ANY_BANDIT: '{any_bandit}',
};

const ALL_PLACEHOLDERS = new Set(Object.values(LOCATION_PLACEHOLDERS));

function cityType(row) {
  return row?.city_type ?? row?.cityType;
}

function rowWildernessExplore(row) {
  const w = row?.wilderness_enabled ?? row?.wildernessEnabled;
  if (w === true || w === 1 || w === '1') return true;
  return cityType(row) === 'wilderness';
}

function rowMarketExplore(row) {
  const m = row?.market_enabled ?? row?.marketEnabled;
  if (m === true || m === 1 || m === '1') return true;
  return cityType(row) === 'market';
}

/**
 * @param {string} ev
 * @param {{ city_id?: string, cityId?: string, city_type?: string, cityType?: string }|null|undefined} row
 */
function matchLocationPlaceholder(ev, row) {
  if (!row) return false;
  const ct = cityType(row);
  if (!ct) return false;
  switch (ev) {
    case LOCATION_PLACEHOLDERS.ANY_CITY:
      return CITY_TYPES_ANY_CITY.includes(ct);
    case LOCATION_PLACEHOLDERS.ANY_GATE:
      return ct === 'gate';
    case LOCATION_PLACEHOLDERS.ANY_FORT:
      return ct === 'fort';
    case LOCATION_PLACEHOLDERS.ANY_WILDERNESS:
      return rowWildernessExplore(row);
    case LOCATION_PLACEHOLDERS.ANY_MARKET:
      return rowMarketExplore(row);
    case LOCATION_PLACEHOLDERS.CITY_MAJOR_WILDERNESS:
      return ct === 'city_major' && rowWildernessExplore(row);
    case LOCATION_PLACEHOLDERS.CITY_MEDIUM_WILDERNESS:
      return ct === 'city_medium' && rowWildernessExplore(row);
    case LOCATION_PLACEHOLDERS.CITY_MAJOR_MARKET:
      return ct === 'city_major' && rowMarketExplore(row);
    case LOCATION_PLACEHOLDERS.CITY_MEDIUM_MARKET:
      return ct === 'city_medium' && rowMarketExplore(row);
    case LOCATION_PLACEHOLDERS.CITY_MAJOR:
      return ct === 'city_major';
    case LOCATION_PLACEHOLDERS.CITY_MEDIUM:
      return ct === 'city_medium';
    case LOCATION_PLACEHOLDERS.CITY_SMALL:
      return ct === 'city_small';
    default:
      return false;
  }
}

/**
 * @param {string} evLoc - config_events.location
 * @param {string} exploreLocationId - 当前探索点 city_id
 * @param {Array<{ city_id?: string, cityId?: string, city_type?: string, cityType?: string }>|null|undefined} cities
 * @returns {boolean}
 */
export function exploreLocationMatchesEvent(evLoc, exploreLocationId, cities) {
  const ev = String(evLoc ?? '').trim();
  const loc = String(exploreLocationId ?? '').trim();
  if (!loc) return false;
  if (ev === LOCATION_PLACEHOLDERS.ALL) return true;
  if (ev === loc) return true;
  const list = Array.isArray(cities) ? cities : [];
  if (!isLocationPlaceholder(ev)) return false;
  if (ev === LOCATION_PLACEHOLDERS.ANY_BANDIT && isBanditMapObjectId(loc)) return true;
  if (ev === LOCATION_PLACEHOLDERS.ANY_BANDIT) return false;
  const row = list.find((c) => (c.city_id ?? c.cityId) === loc);
  return matchLocationPlaceholder(ev, row);
}

/**
 * @param {string | null | undefined} loc
 * @returns {boolean}
 */
export function isLocationPlaceholder(loc) {
  if (loc == null || typeof loc !== 'string') return false;
  const s = loc.trim();
  return s.startsWith('{') && s.endsWith('}') && ALL_PLACEHOLDERS.has(s);
}

/**
 * @param {Array<{ city_id?: string, city_type?: string }>} cities
 * @param {string} placeholder
 * @returns {Array<typeof cities[0]>}
 */
export function filterCitiesByPlaceholder(cities, placeholder) {
  if (!cities?.length) return [];
  const p = String(placeholder).trim();
  return cities.filter((c) => matchLocationPlaceholder(p, c));
}

/**
 * @param {string} seed
 * @param {number} modulo
 */
function stableIndex(seed, modulo) {
  if (modulo <= 0) return 0;
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % modulo;
}

/**
 * @param {string} placeholder
 * @param {Array<{ city_id: string, city_name?: string, cityName?: string, city_type?: string }>} cities
 * @param {string} seed
 * @returns {{ locationId: string, cityName: string, cityType?: string } | null}
 */
export function resolveLocationPlaceholder(placeholder, cities, seed) {
  const pool = filterCitiesByPlaceholder(cities, placeholder);
  if (!pool.length) return null;
  const idx = stableIndex(seed, pool.length);
  const row = pool[idx];
  const cityName = row.city_name ?? row.cityName ?? '';
  return { locationId: row.city_id ?? row.cityId, cityName, cityType: row.city_type ?? row.cityType };
}

/**
 * UI 用：占位符 → 具体 city_id + 展示名；已是具体 ID 则只查名称。
 *
 * @param {string | null | undefined} rawLocation
 * @param {Array<{ city_id: string, city_name?: string, cityName?: string, city_type?: string }>} cities
 * @param {string} seed 建议 `playerId:eventId:rawLocation`
 * @returns {{
 *   displayLocationId: string,
 *   cityName: string,
 *   isPlaceholder: boolean,
 *   unresolved?: boolean,
 *   allLocations?: boolean,
 * }}
 */
export function resolveEventLocationForUi(rawLocation, cities, seed) {
  if (rawLocation == null || rawLocation === '') {
    return { displayLocationId: '', cityName: '', isPlaceholder: false };
  }
  const loc = String(rawLocation).trim();
  if (loc === LOCATION_PLACEHOLDERS.ALL) {
    return {
      displayLocationId: '',
      cityName: '',
      isPlaceholder: true,
      allLocations: true,
    };
  }
  if (!cities?.length) {
    return { displayLocationId: loc, cityName: '', isPlaceholder: isLocationPlaceholder(loc) };
  }
  if (isLocationPlaceholder(loc)) {
    const r = resolveLocationPlaceholder(loc, cities, seed);
    if (!r) {
      return { displayLocationId: loc, cityName: '', isPlaceholder: true, unresolved: true };
    }
    return {
      displayLocationId: r.locationId,
      cityName: r.cityName,
      isPlaceholder: true,
    };
  }
  const found = cities.find((c) => (c.city_id ?? c.cityId) === loc);
  const cityName = found ? (found.city_name ?? found.cityName ?? '') : '';
  return { displayLocationId: loc, cityName, isPlaceholder: false };
}
