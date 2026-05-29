/**
 * 战术图玩家单位兵力：上限须来自 config_troops.max_troops（+ bonus_max_troops），
 * 禁止按稀有度套默认模板，禁止展平到 battleTroops 时被全量配置对象覆盖。
 *
 * @see docs/20-data-layer/22-1-TROOP_SYSTEM.md §4.1
 */

/**
 * @param {object|null|undefined} unit `buildPlayerUnitsFromContext` 产出
 * @param {Record<string, { maxTroops?: number }>|null|undefined} [catalogById] `GET /config/troops` 等按 troop_id 索引
 * @returns {{ base: number, bonus: number, max: number }}
 */
export function resolveBattleTroopCaps(unit, catalogById) {
  const bonus = Math.max(0, Math.round(Number(unit?.bonus_max_troops) || 0));
  const troop = unit?.troop && typeof unit.troop === 'object' ? unit.troop : {};
  const troopId = troop.id || troop.troopId || null;

  let base = 0;
  if (troopId && catalogById && catalogById[troopId]) {
    base = Math.round(Number(catalogById[troopId].maxTroops) || 0);
  }
  if (base <= 0) {
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
  const { max, current } = (() => {
    const caps = resolveBattleTroopCaps(unit, ctx.catalogById);
    const cur = resolveBattleTroopCurrent(unit, caps.max);
    return { max: caps.max, current: cur };
  })();
  const pos = ctx.pos || { y: 0, x: 0 };
  const baseUrl = ctx.baseUrl ?? '';
  const attempts =
    typeof ctx.getPortraitAttempts === 'function'
      ? ctx.getPortraitAttempts({ ...tr, faction: 'player' }, baseUrl)
      : [];

  const char = unit.character || null;
  return {
    ...pickTroopSpreadFields(tr),
    id: `${tr.id || 'troop'}_p${index}`,
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
