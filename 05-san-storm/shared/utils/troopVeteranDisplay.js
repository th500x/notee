/**
 * ESM 镜像 · 须与 troopVeteranDisplay.cjs 保持同步（22-1 §6.2）
 * @module shared/utils/troopVeteranDisplay
 */

export const VETERAN_ELIGIBLE_RARITIES = new Set(['legendary', 'core']);

/** core 三档系数 × max_battle_count（M 通常 60 → 180 / 360 / 540 场） */
export const CORE_VETERAN_THRESHOLDS = [3, 6, 9];

export const LEGENDARY_VETERAN_LIFETIME_THRESHOLDS = [120, 240, 360];

export const VETERAN_TIER_ROMAN = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ'];

export function isVeteranEligibleRarity(rarity) {
  return VETERAN_ELIGIBLE_RARITIES.has(String(rarity || '').toLowerCase());
}

export function getCoreVeteranLifetimeThreshold(tier, maxBattleCount) {
  const t = Math.max(0, Math.floor(Number(tier) || 0));
  if (t >= CORE_VETERAN_THRESHOLDS.length) return null;
  const m = Math.max(1, Math.floor(Number(maxBattleCount) || 60));
  return CORE_VETERAN_THRESHOLDS[t] * m;
}

export function getNextVeteranThreshold(rarity, tier, maxBattleCount) {
  const r = String(rarity || '').toLowerCase();
  const t = Math.max(0, Math.floor(Number(tier) || 0));
  if (t >= 3) return null;
  if (r === 'legendary') return LEGENDARY_VETERAN_LIFETIME_THRESHOLDS[t];
  return getCoreVeteranLifetimeThreshold(t, maxBattleCount);
}

/** @returns {number[]} 三档晋升所需 lifetime_battle_count */
export function getVeteranPromotionThresholdList(rarity, maxBattleCount) {
  const r = String(rarity || '').toLowerCase();
  if (r === 'legendary') return [...LEGENDARY_VETERAN_LIFETIME_THRESHOLDS];
  const m = Math.max(1, Math.floor(Number(maxBattleCount) || 60));
  return CORE_VETERAN_THRESHOLDS.map((coef) => coef * m);
}

export function formatVeteranPromotionThresholdsLine(rarity, maxBattleCount) {
  const thresholds = getVeteranPromotionThresholdList(rarity, maxBattleCount);
  return `（${thresholds.join(' / ')} 场晋升）`;
}

export function getVeteranStatMultiplier(veteranBonusPct) {
  return 1 + (Math.max(0, Number(veteranBonusPct) || 0)) / 100;
}

/** @param {{ attack?: number, defense?: number, speed?: number, movement?: number }} stats */
export function applyVeteranBonusToTroopCombatStats(stats, veteranBonusPct) {
  const mult = getVeteranStatMultiplier(veteranBonusPct);
  const attack = (Number(stats?.attack) || 0) * mult;
  const defense = (Number(stats?.defense) || 0) * mult;
  return {
    attack: Math.round(attack * 10) / 10,
    defense: Math.round(defense * 10) / 10,
    speed: Math.round((Number(stats?.speed) || 0) * mult),
    movement: Math.round((Number(stats?.movement) || 0) * mult),
  };
}

/** @param {{ showThresholds?: boolean, rarity?: string, maxBattleCount?: number }} [options] */
export function formatVeteranSlotTooltip(lifetime, pct, options = {}) {
  const battles = Math.max(0, Math.floor(Number(lifetime) || 0));
  const bonus = Math.max(0, Number(pct) || 0);
  const line1 = `已战斗 ${battles} 场 · 全属性 +${bonus}%`;
  if (options.showThresholds && options.rarity) {
    return `${line1}\n${formatVeteranPromotionThresholdsLine(options.rarity, options.maxBattleCount)}`;
  }
  return line1;
}

/** @param {object} troop */
export function getVeteranSlotDisplay(troop) {
  if (!troop || !isVeteranEligibleRarity(troop.rarity)) return null;

  const tier = Math.max(0, Math.floor(Number(troop.veteranTier) || 0));
  const pct = Number(troop.veteranBonusPct) || 0;
  const lifetime = Math.max(0, Math.floor(Number(troop.lifetimeBattleCount) || 0));
  const tooltipOpts = {
    showThresholds: tier < 3,
    rarity: troop.rarity,
    maxBattleCount: troop.maxBattleCount,
  };

  if (tier > 0) {
    return {
      emoji: VETERAN_TIER_ROMAN[tier] || String(tier),
      tooltip: formatVeteranSlotTooltip(lifetime, pct, tooltipOpts),
      active: true,
    };
  }

  return {
    emoji: '🔒',
    locked: true,
    tooltip: formatVeteranSlotTooltip(lifetime, 0, tooltipOpts),
  };
}
