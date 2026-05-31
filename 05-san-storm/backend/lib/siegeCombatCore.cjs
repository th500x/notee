/**
 * 攻城披挂 PVP · 服务端战斗核心（与前端 combatSystem 公式对齐，随机数由种子注入）
 * @see game/src/systems/combatSystem.js
 */

const { getTroopAffinityOutgoingDamageMult } = require('../../shared/utils/troopAffinityCombat.cjs');
const { resolveSiegeCityDefenseMultFromOpts } = require('../../shared/utils/siegeCityDefenseMult.cjs');

const ELITE_TROOP_STRENGTH_EXPONENT = 0.8;
/** 与 `game/src/systems/combatSystem.js` 的 `ARCHER_MELEE_DAMAGE_MULT` 一致 */
const ARCHER_MELEE_DAMAGE_MULT = 0.8;

const MIRROR_STRIKE_DAMAGE_MULT = 1.18;
const MIRROR_COUNTER_DAMAGE_MULT = 0.68;
const COUNTER_STRIKE_DAMAGE_MULT = 1.22;

function troopRatioCoeffForStrike(rawTroopRatio, strikeMode) {
  const r = Math.min(3.0, Math.max(0.33, rawTroopRatio));
  if (strikeMode !== 'counter') {
    return r;
  }
  if (r >= 1) {
    return r;
  }
  const softened = Math.pow(r, 0.58) * 1.28;
  return Math.min(2.75, Math.max(0.52, softened));
}

/** Mulberry32 */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeededRng(seed) {
  const s = typeof seed === 'number' && !Number.isNaN(seed) ? seed : 0x9e3779b9;
  return mulberry32(s);
}

function troopStrengthRatioFromCasualties(troop) {
  const max = troop.maxTroops;
  const cur = troop.currentTroops != null ? troop.currentTroops : max;
  if (max == null || max <= 0) return 0;
  const r = Math.max(0, Math.min(1, Number(cur) / max));
  const w = troop.troopWeight != null ? Number(troop.troopWeight) : 1;
  if (!(w > 1)) return r;
  return Math.pow(r, ELITE_TROOP_STRENGTH_EXPONENT);
}

function troopDamageToCasualties(defender, rawDamage) {
  const raw = Math.max(0, Number(rawDamage) || 0);
  if (raw <= 0) return 0;
  const w = defender?.troopWeight != null ? Number(defender.troopWeight) : 1;
  if (!(w > 1)) return Math.round(raw);
  return Math.max(1, Math.round(raw / w));
}

function getMoraleEffects(troop) {
  const m = Math.round(Number(troop?.morale ?? 70));
  if (m >= 80) return { attack: 1.1, defense: 1.05 };
  if (m >= 60) return { attack: 1.0, defense: 1.0 };
  if (m >= 40) return { attack: 0.95, defense: 0.9 };
  return { attack: 0.9, defense: 0.85 };
}

/** 与 `shared/utils/characterTraitBonuses.js` 保持数值一致 */
function normTraitKey(trait) {
  if (trait == null || trait === '') return '';
  return String(trait).trim().toLowerCase();
}
const TRAIT_OUTGOING_DAMAGE_MULT = {
  brave: 1.06,
  reckless: 1.08,
  calm: 1.02,
  normal: 1,
  cautious: 0.98,
  timid: 0.94,
};
const TRAIT_DEFENDER_DEFENSE_STRENGTH_MULT = { reckless: 0.98 };
function getTraitOutgoingDamageMultFromAc(ac) {
  const k = normTraitKey(ac?.trait);
  const m = k ? TRAIT_OUTGOING_DAMAGE_MULT[k] : undefined;
  return typeof m === 'number' && m > 0 ? m : 1;
}
function getTraitDefenderDefenseStrengthMultFromDc(dc) {
  const k = normTraitKey(dc?.trait);
  const m = k ? TRAIT_DEFENDER_DEFENSE_STRENGTH_MULT[k] : undefined;
  return typeof m === 'number' && m > 0 ? m : 1;
}

function getTerrainDefBonus(y, x, terrain) {
  if (!terrain) return 1.0;
  const t = terrain[y]?.[x];
  if (t === 'forest') return 0.95;
  if (t === 'hill') return 0.9;
  return 1.0;
}

/**
 * @param {() => number} rng 0..1
 * @param {{ strike?: 'normal' | 'counter', siegeCityDefenseMult?: number, cityDefense?: number }} [options] 与前端 `combatSystem.calcDamage` 一致；主动一击 `normal`、反击 `counter`；攻城守方防御仅 normal 且 def 为守城方时由调用方传 `siegeCityDefenseMult`
 */
function calcDamageSeeded(atk, def, terrain, rng, options = {}) {
  const ac = atk.character;
  const dc = def.character;

  const atkWorn =
    atk.rarity === 'legendary' &&
    atk.battleCount != null &&
    atk.maxBattleCount != null &&
    atk.battleCount >= atk.maxBattleCount;
  const defWorn =
    def.rarity === 'legendary' &&
    def.battleCount != null &&
    def.maxBattleCount != null &&
    def.battleCount >= def.maxBattleCount;
  const WORN_PENALTY = 0.8;

  const troopAtk = ((atk.attack || 100) / 10) * (atkWorn ? WORN_PENALTY : 1);
  const combat = ac ? ac.combat || 5 : 5;
  const singleAtk = troopAtk + combat * 6;
  const courage = ac ? ac.courage || 5 : 5;
  const courageBonus = 1 + courage / 40;
  const singleFinal = singleAtk * courageBonus;
  const atkRatio = troopStrengthRatioFromCasualties(atk);
  let totalDmg = singleFinal * atkRatio;
  const atkMorale = getMoraleEffects(atk);
  totalDmg *= atkMorale.attack;
  totalDmg *= getTraitOutgoingDamageMultFromAc(ac);
  if (atk._formationBuffs && atk._formationBuffs.attackBonus) {
    totalDmg *= 1 + atk._formationBuffs.attackBonus;
  }
  if (ac?.characterEnhanceAttackPct) {
    totalDmg *= 1 + ac.characterEnhanceAttackPct / 100;
  }

  const troopDef = ((def.defense || 50) / 10) * (defWorn ? WORN_PENALTY : 1);
  const dCombat = dc ? dc.combat || 5 : 5;
  const dCommand = dc ? dc.command || 5 : 5;
  const singleDefBase = troopDef + dCommand * 5 + dCombat * 3;
  const singleDef = singleDefBase * getTraitDefenderDefenseStrengthMultFromDc(dc);
  const defRatio = troopStrengthRatioFromCasualties(def);
  const siegeDefMult = resolveSiegeCityDefenseMultFromOpts(options);
  const totalDef = singleDef * defRatio * siegeDefMult;
  const defReduction = totalDef / (totalDef + 140);
  const defMorale = getMoraleEffects(def);
  let defMultiplier = defReduction * defMorale.defense;
  if (def._formationBuffs && def._formationBuffs.defenseBonus) {
    defMultiplier = Math.min(0.9, defMultiplier * (1 + def._formationBuffs.defenseBonus));
  }
  if (dc?.characterEnhanceDefensePct) {
    defMultiplier = Math.min(0.9, defMultiplier * (1 + dc.characterEnhanceDefensePct / 100));
  }
  totalDmg *= 1 - defMultiplier;
  totalDmg *= getTerrainDefBonus(def.y, def.x, terrain);
  const atkEffective = atk.maxTroops * (atk.troopWeight || 1);
  const defEffective = def.maxTroops * (def.troopWeight || 1);
  const rawTroopRatio = atkEffective / defEffective;
  const strikeMode = options.strike === 'counter' ? 'counter' : 'normal';
  totalDmg *= troopRatioCoeffForStrike(rawTroopRatio, strikeMode);
  if (strikeMode === 'counter') {
    totalDmg *= COUNTER_STRIKE_DAMAGE_MULT;
  }
  const mirror = Math.abs(atkEffective - defEffective) < 1e-6;
  if (mirror) {
    totalDmg *= strikeMode === 'counter' ? MIRROR_COUNTER_DAMAGE_MULT : MIRROR_STRIKE_DAMAGE_MULT;
  }

  const defType = def.troopType || 'infantry';
  const counterKey = defType + 'Counter';
  totalDmg *= atk[counterKey] ?? 1.0;

  if (terrain) {
    const terrainType = terrain[atk.y]?.[atk.x] || 'plain';
    const adaptKey = terrainType + 'Adapt';
    totalDmg *= atk[adaptKey] ?? 1.0;
  }

  const atkType = atk.troopType || 'infantry';
  const posBonus = ac?.positionBonuses;
  if (posBonus) {
    const posBonusKey = atkType + 'Bonus';
    totalDmg *= 1 + (posBonus[posBonusKey] || 0);
  }
  totalDmg *= getTroopAffinityOutgoingDamageMult(ac, atkType);

  if (atkType === 'archer') {
    const dist = Math.abs(atk.y - def.y) + Math.abs(atk.x - def.x);
    if (dist <= 1) totalDmg *= ARCHER_MELEE_DAMAGE_MULT;
  }

  totalDmg *= 0.9 + rng() * 0.2;
  return Math.max(1, Math.round(totalDmg));
}

function rollCritDodgeSeeded(atk, def, rng) {
  const ac = atk.character;
  const dc = def.character;
  const dodgeRate = dc ? (dc.luck || 5) / 100 : 0.05;
  if (rng() < dodgeRate) return 'dodge';
  const critRate = ac ? ((ac.courage || 5) + (ac.luck || 5)) / 80 : 0.1;
  if (rng() < critRate) return 'crit';
  return 'normal';
}

module.exports = {
  createSeededRng,
  mulberry32,
  troopStrengthRatioFromCasualties,
  troopDamageToCasualties,
  getMoraleEffects,
  getTerrainDefBonus,
  calcDamageSeeded,
  rollCritDodgeSeeded,
};
