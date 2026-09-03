/**
 * 大地图单城信息：与战略格网 tooltip 等共用字段解析与 `WorldMapCityInfoBlock` 入参构造。
 */

import { isBanditMapObjectId } from '@shared/utils/smallMapEnemyRoster';
import { getStrategicCityTypeLabel } from '@/utils/strategicMapCityLabels';

export const WORLD_MAP_DEFAULT_FACTION_LABELS = {
  san_1_faction_1001: '三王',
  san_1_faction_2001: '汉室',
  san_1_faction_3001: '黄巾',
};

/** 大地图势力旗：单字缩写（汉室→汉）；按 faction_id，避免运行时旧名（如「刘备」）干扰 */
export const WORLD_MAP_FACTION_SHORT_CHARS = {
  san_1_faction_1001: '三',
  san_1_faction_2001: '汉',
  san_1_faction_3001: '黄',
};

/**
 * 战略城池 tooltip 标题：`中城 · 许昌城`（类型 · 城名）；匪寨不加类型前缀。
 * 面板另附 `· 可攻打` 等后缀，勿把城类型再写进后缀。
 */
export function worldMapCityTitleFromRow(cityRow) {
  if (!cityRow) return '城池';
  const bpid = cityRow.banditPoiId ?? cityRow.bandit_poi_id;
  const ct = cityRow.city_type ?? cityRow.cityType;
  const base = cityRow.city_name ?? cityRow.cityName ?? '城池';
  const s = String(base);
  if (ct === 'bandit_camp' || isBanditMapObjectId(bpid)) return s;
  const cid = cityRow.city_id ?? cityRow.cityId;
  if (isBanditMapObjectId(cid)) return s;
  const cityName = s.endsWith('城') ? s : `${s}城`;
  const typeLabel = getStrategicCityTypeLabel(ct);
  return typeLabel ? `${typeLabel} · ${cityName}` : cityName;
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

/**
 * 势力旗单字：优先 `WORLD_MAP_FACTION_SHORT_CHARS`，否则取全称首字。
 * @returns {string|null}
 */
export function worldMapFactionShortCharFromRow(cityRow, factionNameById = {}) {
  const fid = cityRow?.faction_id ?? cityRow?.factionId;
  if (!fid || fid === 'san_1_faction_0001') return null;
  if (WORLD_MAP_FACTION_SHORT_CHARS[fid]) return WORLD_MAP_FACTION_SHORT_CHARS[fid];
  const full = worldMapFactionLabelFromRow(cityRow, factionNameById);
  if (!full || full === '中立' || full === '已占领') return null;
  const ch = Array.from(String(full))[0];
  return ch || null;
}

/**
 * 势力旗文案部件：`汉` + `东岭关` → 展示为「汉·东岭关」。
 * @returns {{ shortChar: string, cityName: string } | null}
 */
export function worldMapFactionFlagPartsFromRow(cityRow, factionNameById = {}) {
  const shortChar = worldMapFactionShortCharFromRow(cityRow, factionNameById);
  if (!shortChar) return null;
  const cityName = worldMapCityBaseNameFromRow(cityRow);
  if (!cityName || cityName === '城池') return null;
  return { shortChar, cityName };
}

export function worldMapGarrisonCapFromRow(_cityRow) {
  // 城级驻军所容量上限已废止（无 CSV / 无库列）
  return null;
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
 * 城备底部：五维 + 特色资源 + 简介（原独立「城况」分段）
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
 * 玩家是否与城池同属一方（可驻守编组；不可对该城发起攻城）。
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
 */
export function buildWorldMapCityPanelProps(cityRow, opts = {}) {
  const {
    factionNameById = {},
    playerFactionId = null,
    playerId = null,
    siegeQuota = null,
    siegeLoading = false,
    garrisonSlotCount = null,
  } = opts;

  const cityTitle = worldMapCityTitleFromRow(cityRow);
  const regionLabel = worldMapRegionLabelFromRow(cityRow);
  const factionLabel = worldMapFactionLabelFromRow(cityRow, factionNameById);
  const garrisonCap = worldMapGarrisonCapFromRow(cityRow);
  const fid = cityRow?.faction_id ?? cityRow?.factionId;
  const isOwnCity = worldMapCityIsPlayerSameFaction(cityRow, playerFactionId);
  const siegeTargetLabel = worldMapCitySiegeTargetLabel(cityRow, playerFactionId);

  let subtitleText = null;
  if (isOwnCity) subtitleText = '己方驻地 · 可编组';
  else if (playerId && siegeQuota?.loaded && !siegeQuota.canSiege) {
    subtitleText = '兵符不足';
  }

  const npcArr = cityRow?.npc_garrison ?? cityRow?.npcGarrison;
  const npcTotal = Array.isArray(npcArr) ? npcArr.length : '?';

  const cityIdVal = cityRow?.city_id ?? cityRow?.cityId ?? null;
  const banditPoiIdVal = cityRow?.banditPoiId ?? cityRow?.bandit_poi_id ?? null;
  const cityType = cityRow?.city_type ?? cityRow?.cityType ?? null;
  const junId = cityRow?.jun_id ?? cityRow?.junId ?? null;
  /** 旧版独立荒郊/集市行不参与城备面板（迁移后库中应无此类行） */
  const isLegacySubsidiaryType = cityType === 'wilderness' || cityType === 'market';
  const isBanditStronghold = !!(
    (banditPoiIdVal && isBanditMapObjectId(banditPoiIdVal)) ||
    (cityType === 'bandit_camp' && (banditPoiIdVal || cityIdVal)) ||
    (cityIdVal && isBanditMapObjectId(cityIdVal))
  );
  const banditPoiId = isBanditStronghold
    ? String(banditPoiIdVal || (isBanditMapObjectId(cityIdVal) ? cityIdVal : '') || '').trim() || null
    : null;
  const cityId = isBanditStronghold || isLegacySubsidiaryType ? null : cityIdVal;

  const cityBaseName = worldMapCityBaseNameFromRow(cityRow);
  const showOwnCityActions = isOwnCity && !!playerId && !!cityId;

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
    garrisonSlotCount,
    garrisonCap,
    npcAlive: cityRow?.npc_garrison_alive ?? cityRow?.npcGarrisonAlive,
    npcTotal,
    syncErrorMessage: null,
    cityId,
    banditPoiId,
    cityBaseName,
    showOwnCityActions,
    cityType,
    junId,
  };
}
