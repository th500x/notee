/**
 * 战术图玩家单位兵力：上限须来自 config_troops.max_troops（+ bonus_max_troops），
 * 禁止按稀有度套默认模板，禁止展平到 battleTroops 时被全量配置对象覆盖。
 *
 * 权威顺序：`troops.json`（CSV 流水线）→ 运行时 catalog（API）→ 编组 bundled 字段（仅兜底）。
 *
 * @see docs/20-data-layer/22-1-TROOP_SYSTEM.md §4.1
 */

import troopsCatalog from '../../public/data/shared/troops.json';

const STATIC_TROOP_BY_ID = Object.create(null);
for (const row of troopsCatalog.troops || []) {
  if (row?.id) STATIC_TROOP_BY_ID[row.id] = row;
}

function normalizeConfigTroopId(raw) {
  if (raw == null || raw === '') return '';
  let s = String(raw).replace(/_(?:p|e)\d+$/i, '');
  if (s.includes('san_1_troop_')) return s;
  if (/^\d+$/.test(s)) return `san_1_troop_${s}`;
  return s;
}

/**
 * @param {object|null|undefined} unit `buildPlayerUnitsFromContext` 产出
 * @param {string|null|undefined} [cardId]
 */
export function resolveTroopConfigId(unit, cardId) {
  const troop = unit?.troop && typeof unit.troop === 'object' ? unit.troop : unit;
  if (!troop || typeof troop !== 'object') {
    return normalizeConfigTroopId(cardId);
  }
  return normalizeConfigTroopId(troop.id || troop.troopId || cardId || unit?.card_id);
}

/**
 * @param {string|null|undefined} troopId
 * @param {Record<string, { maxTroops?: number }>|null|undefined} [catalogById]
 */
export function lookupTroopBaseMaxTroops(troopId, catalogById) {
  const id = normalizeConfigTroopId(troopId);
  if (!id) return 0;
  const staticMax = Math.round(Number(STATIC_TROOP_BY_ID[id]?.maxTroops) || 0);
  if (staticMax > 0) return staticMax;
  if (catalogById && catalogById[id]) {
    return Math.round(Number(catalogById[id].maxTroops) || 0);
  }
  return 0;
}

/**
 * 合并静态 JSON 与 API 列表；兵力上限以 JSON 为准（避免库表未同步仍显示 core 默认 520）。
 * @param {Array<{ id?: string, maxTroops?: number }>} [apiTroops]
 */
export function buildTroopCatalogById(apiTroops) {
  const map = Object.create(null);
  for (const id of Object.keys(STATIC_TROOP_BY_ID)) {
    map[id] = STATIC_TROOP_BY_ID[id];
  }
  for (const t of apiTroops || []) {
    if (!t?.id) continue;
    const staticRow = STATIC_TROOP_BY_ID[t.id];
    const staticMax = staticRow ? Math.round(Number(staticRow.maxTroops) || 0) : 0;
    map[t.id] = {
      ...(staticRow || {}),
      ...t,
      maxTroops: staticMax > 0 ? staticMax : Math.round(Number(t.maxTroops) || 0),
    };
  }
  return map;
}

/**
 * @param {object|null|undefined} unit `buildPlayerUnitsFromContext` 产出
 * @param {Record<string, { maxTroops?: number }>|null|undefined} [catalogById]
 * @returns {{ base: number, bonus: number, max: number }}
 */
export function resolveBattleTroopCaps(unit, catalogById) {
  const bonus = Math.max(0, Math.round(Number(unit?.bonus_max_troops) || 0));
  const troopId = resolveTroopConfigId(unit, unit?.card_id);

  let base = lookupTroopBaseMaxTroops(troopId, catalogById);
  if (base <= 0) {
    const troop = unit?.troop && typeof unit.troop === 'object' ? unit.troop : {};
    const bundled = Math.round(Number(unit.maxTroops ?? troop.maxTroops ?? troop.max_troops) || 0);
    base = Math.max(0, bundled - bonus);
  }

  const max = Math.max(0, base + bonus);
  return { base, bonus, max };
}

/**
 * @param {object|null|undefined} unit
 * @param {number} maxTroops
 * @returns {number}
 */
export function resolveBattleTroopCurrent(unit, maxTroops) {
  const max = Math.max(0, Math.round(Number(maxTroops) || 0));
  if (max <= 0) return 0;
  const raw =
    unit?.currentTroops ??
    unit?.troop?.currentTroops ??
    unit?.current_troops;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return Math.min(max, Math.round(n));
  return max;
}

/**
 * 展平到 battleTroops 时剥离兵力字段，避免 `...tr` 带入错误 maxTroops。
 * @param {object|null|undefined} troop unit.troop
 */
export function pickTroopSpreadFields(troop) {
  if (!troop || typeof troop !== 'object') return {};
  const {
    maxTroops: _maxDrop,
    max_troops: _maxSnake,
    currentTroops: _curDrop,
    initialTroops: _initDrop,
    ...rest
  } = troop;
  return rest;
}

/**
 * @param {object} unit
 * @param {number} index
 * @param {{ pos: { y: number, x: number }, catalogById?: Record<string, { maxTroops?: number }>, baseUrl?: string, lineupSlot?: string }} ctx
 */
export function flattenPlayerUnitToBattleTroop(unit, index, ctx) {
  const tr = unit.troop || {};
  const configTroopId = resolveTroopConfigId(unit, unit?.card_id);
  const catalog = ctx.catalogById || buildTroopCatalogById();
  const { max, current } = (() => {
    const caps = resolveBattleTroopCaps(unit, catalog);
    const cur = resolveBattleTroopCurrent(unit, caps.max);
    return { max: caps.max, current: cur };
  })();
  const pos = ctx.pos || { y: 0, x: 0 };
  const baseUrl = ctx.baseUrl ?? '';
  const portraitMeta = {
    ...pickTroopSpreadFields(tr),
    id: configTroopId || tr.id,
    assetTroopId: configTroopId || tr.id,
    faction: 'player',
  };
  const attempts =
    typeof ctx.getPortraitAttempts === 'function'
      ? ctx.getPortraitAttempts(portraitMeta, baseUrl)
      : [];

  const char = unit.character || null;
  return {
    ...pickTroopSpreadFields(tr),
    assetTroopId: configTroopId || tr.id,
    id: `${configTroopId || tr.id || 'troop'}_p${index}`,
    faction: 'player',
    y: pos.y,
    x: pos.x,
    maxTroops: max,
    currentTroops: current,
    initialTroops: current,
    instanceId: tr.instanceId ?? tr.instance_id ?? unit.instanceId,
    bonus_max_troops: unit.bonus_max_troops,
    character: char,
    displayName: char ? char.courtesyName || char.name : tr.name,
    morale: unit.morale ?? 70,
    ...(unit.lineupSlot || ctx.lineupSlot ? { lineupSlot: unit.lineupSlot || ctx.lineupSlot } : {}),
    imgSrc: attempts[0],
    imgPortraitAttempts: attempts,
    imgFallback: attempts[attempts.length - 1],
  };
}
