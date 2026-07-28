import { isBanditMapObjectId } from './smallMapEnemyRoster.js';

/**
 * 事件 location 占位符解析（与 cities.city_type / 战场 ID 对齐）
 *
 * **前后端单一来源**（ESM）：游戏前端经 `@shared/utils/eventLocationPlaceholders.js` 引用，
 * Node 后端经 dynamic `import()`；`game/src/utils/eventLocationPlaceholders.js` 仅 `export *`。
 *
 * - {all}：无地理约束
 * - {battlefield}：郡战场锚点（`san_*_bf_*`；wild/mini 探索入口）
 * - {any_city} / {city_major|medium|small}：城邑类型
 * - {any_gate}：关隘（city_gate）
 * - {any_bandit}：匪寨地图对象 ID（`san_*_bandit_*`）
 *
 * **已废止**：`{any_wilderness}` / `{any_market}` / `{city_*_wilderness|market}`（探索改战场，城开关列已删）
 */

/** @type {readonly string[]} */
export const CITY_TYPES_ANY_CITY = ['city_major', 'city_medium', 'city_small'];

export const LOCATION_PLACEHOLDERS = {
  ALL: '{all}',
  BATTLEFIELD: '{battlefield}',
  ANY_CITY: '{any_city}',
  ANY_GATE: '{any_gate}',
  /** 仅大城 / 中城 / 小城类型（与 cities.city_type 一致） */
  CITY_MAJOR: '{city_major}',
  CITY_MEDIUM: '{city_medium}',
  CITY_SMALL: '{city_small}',
  ANY_BANDIT: '{any_bandit}',
};

/** 探索锚点是否为郡战场 ID（`san_1_bf_yingchuan`） */
export function isBattlefieldExploreAnchorId(id) {
  return /^san_\d+_bf_[a-z0-9_]+$/i.test(String(id ?? '').trim());
}

const ALL_PLACEHOLDERS = new Set(Object.values(LOCATION_PLACEHOLDERS));

function cityType(row) {
  return row?.city_type ?? row?.cityType;
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
      return ct === 'city_gate';
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
 * @param {string} exploreLocationId - 当前探索点 city_id / battlefieldId
 * @param {Array<{ city_id?: string, cityId?: string, city_type?: string, cityType?: string }>|null|undefined} cities
 * @returns {boolean}
 */
export function exploreLocationMatchesEvent(evLoc, exploreLocationId, cities) {
  const ev = String(evLoc ?? '').trim();
  const loc = String(exploreLocationId ?? '').trim();
  if (!loc) return false;
  if (ev === LOCATION_PLACEHOLDERS.ALL) return true;
  if (ev === loc) return true;
  if (ev === LOCATION_PLACEHOLDERS.BATTLEFIELD) {
    return isBattlefieldExploreAnchorId(loc);
  }
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
  if (loc === LOCATION_PLACEHOLDERS.BATTLEFIELD) {
    return {
      displayLocationId: loc,
      cityName: '战场',
      isPlaceholder: true,
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
