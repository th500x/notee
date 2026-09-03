/**
 * ESM 镜像 · 须与 lineupCombatPower.cjs 保持同步（22-2 §2.4）
 * @module shared/utils/lineupCombatPower
 */

/** 相对旧口径 /1000，适配压低后的兵力梯度 */
export const POWER_SCALE = 100;

export const POWER_MIN = 100;
export const POWER_MAX = 999;

export const CHAR_RARITY_MULT = Object.freeze({
  common: 1.0,
  rare: 1.04,
  epic: 1.08,
  legendary: 1.12,
  core: 1.16,
});

export const TROOP_RARITY_MULT = Object.freeze({
  common: 1.0,
  rare: 1.03,
  epic: 1.06,
  legendary: 1.1,
  core: 1.14,
});

function normalizeRarity(raw) {
  const s = String(raw || '').toLowerCase().trim();
  return CHAR_RARITY_MULT[s] != null ? s : 'common';
}

function rarityMult(table, rarity) {
  return table[normalizeRarity(rarity)] ?? 1;
}

/**
 * @param {Record<string, number>|null|undefined} bonus
 * @param {string} key
 */
function bonusAttr(bonus, key) {
  if (!bonus) return 0;
  return Number(bonus[key] || 0) / 10;
}

/**
 * 估算编组组合战力（编组/驻地 UI；不参与 calcDamage）。
 *
 * @param {{
 *   combat?: number,
 *   command?: number,
 *   courage?: number,
 *   attributeBonus?: Record<string, number>|null,
 *   characterRarity?: string|null,
 *   troops?: Array<object>,
 * }} [opts]
 * @returns {{ power: number|null, raw: number, score: number }}
 */
export function estimateLineupCombatPower(opts = {}) {
  const troops = Array.isArray(opts.troops) ? opts.troops : [];
  if (troops.length === 0) {
    return { power: null, raw: 0, score: 0 };
  }

  const bonus = opts.attributeBonus || null;
  const combat = Number(opts.combat || 0) + bonusAttr(bonus, 'combat');
  const command = Number(opts.command || 0) + bonusAttr(bonus, 'command');
  const courage = Number(opts.courage || 0) + bonusAttr(bonus, 'courage');
  const charMult = rarityMult(CHAR_RARITY_MULT, opts.characterRarity);

  let raw = 0;
  for (const card of troops) {
    const cfg = card?.config || {};
    const atk = Number(card.attack ?? cfg.attack ?? 0);
    const def = Number(card.defense ?? cfg.defense ?? 0);
    const maxTroops =
      Number(card.maxTroops ?? cfg.maxTroops ?? 0) + Number(card.bonusMaxTroops || 0);
    const currentTroops = Math.max(
      0,
      Math.floor(Number(card.currentTroops != null ? card.currentTroops : maxTroops) || 0),
    );
    const troopMult = rarityMult(TROOP_RARITY_MULT, card.rarity ?? cfg.rarity);

    const unitAtk = (atk + combat * 6) * (1 + courage / 40);
    const unitDef = def + command * 5 + combat * 3;
    raw += (unitAtk + unitDef) * currentTroops * troopMult;
  }

  raw *= charMult;
  const score = Math.round(raw / POWER_SCALE);
  const power = Math.min(POWER_MAX, Math.max(POWER_MIN, score));
  return { power, raw, score };
}
