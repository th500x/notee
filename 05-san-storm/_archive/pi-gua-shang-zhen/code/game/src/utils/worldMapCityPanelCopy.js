/**
 * 大地图单城信息：与战略格网 tooltip 等共用字段解析与 `WorldMapCityInfoBlock` 入参构造。
 */

import { isBanditMapObjectId } from '@shared/utils/smallMapEnemyRoster';

export const WORLD_MAP_DEFAULT_FACTION_LABELS = {
  san_1_faction_1001: '刘备',
  san_1_faction_2001: '曹操',
  san_1_faction_3001: '孙坚',
  san_1_faction_4001: '袁绍',
  san_1_faction_5001: '董卓',
  san_1_faction_6001: '汉室',
  san_1_faction_7001: '黄巾',
};

export function worldMapCityTitleFromRow(cityRow) {
  if (!cityRow) return '城池';
  const bpid = cityRow.banditPoiId ?? cityRow.bandit_poi_id;
  const ct = cityRow.city_type ?? cityRow.cityType;
  const base = cityRow.city_name ?? cityRow.cityName ?? '城池';
  const s = String(base);
  if (ct === 'bandit_camp' || isBanditMapObjectId(bpid)) return s;
  const cid = cityRow.city_id ?? cityRow.cityId;
  if (isBanditMapObjectId(cid)) return s;
  return s.endsWith('城') ? s : `${s}城`;
}

/** 底栏按钮「攻打某某」用短名（不带强制「城」后缀） */
export function worldMapCityBaseNameFromRow(cityRow) {
  if (!cityRow) return '城池';
  return String(cityRow.city_name ?? cityRow.cityName ?? '城池');
}

export function worldMapRegionLabelFromRow(cityRow) {
  if (!cityRow) return '';
  const z = cityRow.zhouName ?? cityRow.zhou_name;
  const j = cityRow.junName ?? cityRow.jun_name;
  return [z, j].filter((x) => x != null && String(x).trim() !== '').map(String).join(' / ');
}

export function worldMapFactionLabelFromRow(cityRow, factionNameById = {}) {
  const fid = cityRow?.faction_id ?? cityRow?.factionId;
  if (!fid) return '中立';
  const map = { ...WORLD_MAP_DEFAULT_FACTION_LABELS, ...factionNameById };
  return map[fid] || '已占领';
}

export function worldMapGarrisonCapFromRow(cityRow) {
  if (!cityRow) return null;
  const v =
    cityRow.player_garrison_capacity ?? cityRow.garrison_capacity ?? cityRow.playerGarrisonCapacity;
  return v != null ? v : null;
}

function pickInt(row, camel, snake) {
  const v = row?.[camel] ?? row?.[snake];
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickStr(row, camel, snake) {
  const v = row?.[camel] ?? row?.[snake];
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** 大地图面板「长官：」— 已任命显示角色名，否则「暂无」 */
export function worldMapLordDisplayFromRow(cityRow) {
  if (!cityRow) return '暂无';
  const name = pickStr(cityRow, 'lordCharacterName', 'lord_character_name');
  if (name) return name;
  return '暂无';
}

/** `cities.defense`，攻城倍率用「防守系数」展示 */
export function worldMapCityDefenseDisplayFromRow(cityRow) {
  if (!cityRow) return null;
  const n = pickInt(cityRow, 'defense', 'defense');
  return n == null ? null : n;
}

/**
 * 「城况」分段：CSV/库五维 + 特色资源 + 简介
 * @returns {{ population: number|null, trading: number|null, farming: number|null, military: number|null, culture: number|null, specialResourceName: string|null, description: string|null }}
 */
export function worldMapCityOverviewFromRow(cityRow) {
  if (!cityRow) {
    return {
      population: null,
      trading: null,
      farming: null,
      military: null,
      culture: null,
      specialResourceName: null,
      description: null,
    };
  }
  return {
    population: pickInt(cityRow, 'population', 'population'),
    trading: pickInt(cityRow, 'trading', 'trading'),
    farming: pickInt(cityRow, 'farming', 'farming'),
    military: pickInt(cityRow, 'military', 'military'),
    culture: pickInt(cityRow, 'culture', 'culture'),
    specialResourceName: pickStr(cityRow, 'specialResourceName', 'special_resource_name'),
    description: pickStr(cityRow, 'description', 'description'),
  };
}

/**
 * 玩家是否与城池同属一方（可驻守编组 / 披挂；不可对该城发起攻城）。
 * 城无势力、玩家未选势力或未登录 → false。
 */
export function worldMapCityIsPlayerSameFaction(cityRow, playerFactionId) {
  const cityFid = cityRow?.faction_id ?? cityRow?.factionId;
  if (cityFid == null || cityFid === '' || playerFactionId == null || playerFactionId === '') return false;
  return String(cityFid).trim() === String(playerFactionId).trim();
}

/** 仅大城、中城可设为玩家主城（存卡） */
export function worldMapCityTypeAllowsMainCitySet(cityRow) {
  if (!cityRow) return false;
  const t = cityRow.city_type ?? cityRow.cityType;
  return t === 'city_major' || t === 'city_medium';
}

/**
 * 标题后缀「· 可攻打 / · 不可攻打」：暂不实装邻接与外交，仅按是否同势力。
 * 中立城、非己方占城 → 可攻打；与玩家同势力 → 不可攻打。
 */
export function worldMapCitySiegeTargetLabel(cityRow, playerFactionId) {
  return worldMapCityIsPlayerSameFaction(cityRow, playerFactionId) ? '不可攻打' : '可攻打';
}

function pickBool01(row, camel, snake) {
  const v = row?.[camel] ?? row?.[snake];
  if (v === true || v === 1 || v === '1') return true;
  return false;
}

/** 荒郊 / 集市旧版独立行不参与「主城」解析（迁移后库中应无此类行） */
function isStrategicMainCityRow(row) {
  if (!row) return false;
  const t = row.city_type ?? row.cityType;
  if (t === 'wilderness' || t === 'market') return false;
  return true;
}

/**
 * 从主城行上的 `wilderness_enabled` / `market_enabled`（API 亦可能为 camelCase）解析荒郊/集市入口。
 * 展示名：`{城名}荒郊` / `{城名}集市`；`cityId` 与主城相同（探索占位符与事件池见 `eventLocationPlaceholders`）。
 */
export function subsidiaryWildernessAndMarketFromCityMap(cityById, parentCityId) {
  const empty = { wilderness: null, market: null };
  if (!parentCityId || !cityById || typeof cityById !== 'object') return empty;
  const row = cityById[parentCityId];
  if (!row) return empty;
  const base = String(row.city_name ?? row.cityName ?? '').trim() || '城池';
  const we = pickBool01(row, 'wildernessEnabled', 'wilderness_enabled');
  const me = pickBool01(row, 'marketEnabled', 'market_enabled');
  return {
    wilderness: we ? { cityId: parentCityId, displayName: `${base}荒郊` } : null,
    market: me ? { cityId: parentCityId, displayName: `${base}集市` } : null,
  };
}

/**
 * 至少开启荒郊或集市的城 `city_id` 集合（战略格网光效等用）。
 */
export function parentCityIdsWithSubsidiaryExplore(cityById) {
  if (!cityById || typeof cityById !== 'object') return null;
  const parents = new Set();
  for (const c of Object.values(cityById)) {
    const id = c.city_id ?? c.cityId;
    if (!id) continue;
    if (pickBool01(c, 'wildernessEnabled', 'wilderness_enabled') || pickBool01(c, 'marketEnabled', 'market_enabled')) {
      parents.add(String(id));
      continue;
    }
    const pid = c.parent_city_id ?? c.parentCityId;
    const t = c.city_type ?? c.cityType;
    if (pid && (t === 'wilderness' || t === 'market')) parents.add(String(pid));
  }
  return parents.size ? parents : null;
}

/**
 * 构造 `WorldMapCityInfoBlock` 的 props（战略 tooltip 等共用）。
 * @param {object|null|undefined} cityRow
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.factionNameById]
 * @param {string|null} [opts.playerFactionId]
 * @param {string|null} [opts.playerId]
 * @param {object|null} [opts.siegeQuota]
 * @param {boolean} [opts.siegeLoading]
 * @param {number|null} [opts.garrisonSlotCount] — null 时驻地已用显示 —
 * @param {number|null} [opts.onDutyCount] — null 时披挂显示 —
 * @param {Record<string, object>|null} [opts.cityById] — 传入时按主城行开关解析荒郊/集市入口
 */
export function buildWorldMapCityPanelProps(cityRow, opts = {}) {
  const {
    factionNameById = {},
    playerFactionId = null,
    playerId = null,
    siegeQuota = null,
    siegeLoading = false,
    garrisonSlotCount = null,
    onDutyCount = null,
    cityById = null,
  } = opts;

  const cityTitle = worldMapCityTitleFromRow(cityRow);
  const regionLabel = worldMapRegionLabelFromRow(cityRow);
  const factionLabel = worldMapFactionLabelFromRow(cityRow, factionNameById);
  const garrisonCap = worldMapGarrisonCapFromRow(cityRow);
  const fid = cityRow?.faction_id ?? cityRow?.factionId;
  const isOwnCity = worldMapCityIsPlayerSameFaction(cityRow, playerFactionId);
  const siegeTargetLabel = worldMapCitySiegeTargetLabel(cityRow, playerFactionId);

  let subtitleText = null;
  if (isOwnCity) subtitleText = '己方驻地 · 可编组 / 披挂';
  else if (playerId && siegeQuota?.loaded && !siegeQuota.canSiege) {
    subtitleText = '攻城次数不足';
  }

  const npcArr = cityRow?.npc_garrison ?? cityRow?.npcGarrison;
  const npcTotal = Array.isArray(npcArr) ? npcArr.length : '?';

  const cityIdVal = cityRow?.city_id ?? cityRow?.cityId ?? null;
  const banditPoiIdVal = cityRow?.banditPoiId ?? cityRow?.bandit_poi_id ?? null;
  const cityType = cityRow?.city_type ?? cityRow?.cityType ?? null;
  const isBanditStronghold = !!(
    (banditPoiIdVal && isBanditMapObjectId(banditPoiIdVal)) ||
    (cityType === 'bandit_camp' && (banditPoiIdVal || cityIdVal)) ||
    (cityIdVal && isBanditMapObjectId(cityIdVal))
  );
  const banditPoiId = isBanditStronghold
    ? String(banditPoiIdVal || (isBanditMapObjectId(cityIdVal) ? cityIdVal : '') || '').trim() || null
    : null;
  const cityId = isBanditStronghold ? null : cityIdVal;

  const cityBaseName = worldMapCityBaseNameFromRow(cityRow);
  const showOwnCityActions = isOwnCity && !!playerId && !!cityId;

  const subsidiaryExplore =
    cityId && cityById && isStrategicMainCityRow(cityRow) && !isBanditStronghold
      ? subsidiaryWildernessAndMarketFromCityMap(cityById, cityId)
      : { wilderness: null, market: null };

  const lordDisplayLabel = worldMapLordDisplayFromRow(cityRow);
  const cityDefenseCoefficient = worldMapCityDefenseDisplayFromRow(cityRow);
  const cityOverview = worldMapCityOverviewFromRow(cityRow);

  return {
    cityTitle,
    isBanditStronghold,
    siegeTargetLabel,
    subtitleText,
    factionId: fid,
    factionLabel,
    regionLabel,
    lordDisplayLabel,
    cityDefenseCoefficient,
    cityOverview,
    playerId,
    siegeQuota,
    siegeLoading,
    onDutyCount,
    garrisonSlotCount,
    garrisonCap,
    npcAlive: cityRow?.npc_garrison_alive ?? cityRow?.npcGarrisonAlive,
    npcTotal,
    syncErrorMessage: null,
    cityId,
    banditPoiId,
    cityBaseName,
    showOwnCityActions,
    subsidiaryExplore,
    cityType,
  };
}
