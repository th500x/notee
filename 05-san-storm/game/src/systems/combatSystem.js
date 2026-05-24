/**
 * 战斗系统 - 伤害计算核心
 *
 * 三层伤害计算体系：
 *   第一部分：基础公式（将领属性+部队属性+士气+阵型+防御+兵力比例）
 *   第二部分：适应性修正（兵种相性+地形适应+官职兵种加成）
 *   第三部分：特殊加成（势力/仙人，暂不实装）
 *
 * @see docs/10-core-system/17-1-COMBAT_SYSTEM.md
 */

import {
  applyPhase2ConditionalIncomingMult,
  previewCasualtiesAfterPhase2FirstHit,
} from '@shared/utils/skillPhase2Passive';
import {
  getTraitOutgoingDamageMult,
  getTraitDefenderDefenseStrengthMult,
} from '@shared/utils/characterTraitBonuses';

// ── 精锐小队战损比例（troopWeight > 1）────────────────────────────────────────
// 仅影响「当前兵力/最大兵力」在攻防上的线性缩放；满编时与 troopWeight=1 一致，残血时衰减慢于线性。
// 现阶段仅燕云十八等配置了 troop_weight>1 的部队会走此分支，其余部队仍为 current/max。
export const ELITE_TROOP_STRENGTH_EXPONENT = 0.8;

/** 弓兵攻击曼哈顿距离 ≤1 目标时，总伤害乘子（与 `siegeCombatCore.cjs` 一致） */
export const ARCHER_MELEE_DAMAGE_MULT = 0.8;

/**
 * 等效兵力（max×troopWeight）**相等**时：主动一击略强于反击，打破「完全镜像则战损 1:1」。
 * 仅作用于本次 `calcDamage` / `estimateDamage`；调用处须传入 `strike`（棋盘战 `useBattleAnimations`、攻城推演 `siegePvpSkirmish` 等与主动/反击语义一致）。
 */
export const MIRROR_STRIKE_DAMAGE_MULT = 1.18;
export const MIRROR_COUNTER_DAMAGE_MULT = 0.68;

/**
 * 反击专用：在「以少打多」时弱化原公式 `clamp(r,0.33,3)` 对 r&lt;1 的过度压制，使反击威胁更接近策划梯度。
 * @param {number} rawTroopRatio 等效兵力比 (攻方/守方) = atkEff/defEff
 */
export function troopRatioCoeffForStrike(rawTroopRatio, strikeMode) {
  const r = Math.min(3.0, Math.max(0.33, rawTroopRatio));
  if (strikeMode !== 'counter') {
    return r;
  }
  // r≥1：以多打少时与主动一击相同，避免在「等兵力反击」时误放大（与镜像倍率叠加会反压攻方）
  if (r >= 1) {
    return r;
  }
  const softened = Math.pow(r, 0.58) * 1.28;
  return Math.min(2.75, Math.max(0.52, softened));
}

/** 反击在公式末段额外乘子（与兵力系数独立，便于整体抬高反击线） */
export const COUNTER_STRIKE_DAMAGE_MULT = 1.22;

/**
 * 战损后的兵力比例系数（攻击/防御环节共用）
 * @param {Object} troop - 需含 currentTroops、maxTroops；可选 troopWeight
 * @returns {number} 0..1
 */
export function troopStrengthRatioFromCasualties(troop) {
  const max = troop.maxTroops;
  const cur = troop.currentTroops != null ? troop.currentTroops : max;
  if (max == null || max <= 0) return 0;
  const r = Math.max(0, Math.min(1, Number(cur) / max));
  const w = troop.troopWeight != null ? Number(troop.troopWeight) : 1;
  if (!(w > 1)) return r;
  return Math.pow(r, ELITE_TROOP_STRENGTH_EXPONENT);
}

/**
 * 将公式层伤害折算为「兵力条」扣减。精锐（troopWeight>1）时 raw/weight 后四舍五入，
 * 与攻防公式里等效兵力（max×weight）对称；至少扣 1（当 raw≥1 且 weight>1 时）。
 */
export function troopDamageToCasualties(defender, rawDamage) {
  const raw = Math.max(0, Number(rawDamage) || 0);
  if (raw <= 0) return 0;
  const w = defender?.troopWeight != null ? Number(defender.troopWeight) : 1;
  if (!(w > 1)) return Math.round(raw);
  return Math.max(1, Math.round(raw / w));
}

// ── 士气攻防系数（战术整数点 0～120，与 UI/文档一致）──────────────────────────────

/** 士气崩溃分界线：整数点严格小于此值（即 39 及以下）本回合无法行动 */
export const MORALE_COLLAPSE_THRESHOLD = 40;

/**
 * @param {number|object} troopOrMorale - 士气点数或含 `morale` 的部队对象
 */
export function isMoraleCollapsed(troopOrMorale) {
  const raw =
    typeof troopOrMorale === 'number'
      ? troopOrMorale
      : troopOrMorale?.morale;
  const m = Math.round(Number(raw ?? 70));
  return m < MORALE_COLLAPSE_THRESHOLD;
}

/**
 * 根据部队士气返回攻防系数
 * @param {Object} troop - 部队对象（需要 morale 字段）
 * @returns {{ attack: number, defense: number }}
 */
export function getMoraleEffects(troop) {
  const m = Math.round(Number(troop?.morale ?? 70));
  if (m >= 80) return { attack: 1.10, defense: 1.05 };
  if (m >= 60) return { attack: 1.00, defense: 1.00 };
  if (m >= 40) return { attack: 0.95, defense: 0.90 };
  return { attack: 0.90, defense: 0.85 };
}

// ── 地形防御加成 ──────────────────────────────────────────────────────────────

/**
 * 返回地形防御加成（受伤倍率，越低=防御越高）
 * @param {number} y - 行坐标
 * @param {number} x - 列坐标
 * @param {string[][]} terrain - 地形二维数组（mapResult.terrain）
 * @returns {number} 受伤倍率
 */
export function getTerrainDefBonus(y, x, terrain) {
  if (!terrain) return 1.0;
  const t = terrain[y]?.[x];
  if (t === 'forest') return 0.95;  // 树林+5%防御
  if (t === 'hill')   return 0.90;  // 丘陵+10%防御
  return 1.0;
}

// ── 将领被动 · 阶段1（与 @shared/utils/skillPhase1Passive 装配字段一致）────────────────

/** @param {object|null|undefined} ch */
function skillPhase1Combat(ch) {
  return ch?._skillPhase1Combat || null;
}

export function getEffectiveCritRateFromCharacter(ac) {
  if (!ac) return 0.1;
  const base = ((ac.courage || 5) + (ac.luck || 5)) / 80;
  const add = skillPhase1Combat(ac)?.critRate || 0;
  return Math.min(0.25, Math.max(0, base + add));
}

export function getEffectiveDodgeRateFromCharacter(dc) {
  if (!dc) return 0.05;
  const base = (dc.luck || 5) / 100;
  const add = skillPhase1Combat(dc)?.dodgeRate || 0;
  return Math.min(0.45, Math.max(0, base + add));
}

export function getEffectiveHitRatePreview(ac, dc) {
  const dodge = getEffectiveDodgeRateFromCharacter(dc);
  const hitAdd = skillPhase1Combat(ac)?.hitRate || 0;
  return Math.min(0.99, Math.max(0.05, 1 - dodge + hitAdd));
}

function applyPhase1OutgoingCharacterDamageMult(ac, totalDmg) {
  const s1 = skillPhase1Combat(ac);
  if (!s1?.damageBonus) return totalDmg;
  return totalDmg * (1 + s1.damageBonus);
}

function applyPhase1TroopOutgoingMult(atk, totalDmg) {
  const m = atk.phase1OutgoingDamageMult;
  if (m == null || m <= 0) return totalDmg;
  return totalDmg * m;
}

function applyPhase1IncomingReduction(dc, totalDmg) {
  const s1 = skillPhase1Combat(dc);
  if (!s1) return totalDmg;
  let mult = 1;
  if (s1.physicalReduction) mult *= (1 - s1.physicalReduction);
  if (s1.strategyReduction) mult *= (1 - s1.strategyReduction);
  if (s1.damageReduction) mult *= (1 - s1.damageReduction);
  let out = totalDmg * mult;
  if (s1.strategyVulnerable) out *= (1 + s1.strategyVulnerable);
  return out;
}

/** 阶段1 + 阶段2条件减免（首击免疫不在此，在兵力折算后处理） */
function applyPhase1And2IncomingReduction(defTroop, dc, totalDmg, options = {}) {
  let d = applyPhase1IncomingReduction(dc, totalDmg);
  d = applyPhase2ConditionalIncomingMult(defTroop, dc, d, options.battleTroops);
  return d;
}

// ── 完整伤害计算 ──────────────────────────────────────────────────────────────

/**
 * 计算一次攻击的伤害值
 * @param {Object} atk - 攻击方部队
 * @param {Object} def - 防守方部队
 * @param {string[][]} terrain - 地形二维数组（mapResult.terrain）
 * @param {{
 *   strike?: 'normal' | 'counter',
 *   battleTroops?: object[],
 *   damageKind?: 'physical' | 'strategy',
 *   skillDamageMultiplier?: number,
 * }} [options] - `counter`：本次为反击；`battleTroops`：有则结算坚韧等「场上编制数」条件减免；`damageKind`+`skillDamageMultiplier`：阶段4 主动纯伤等
 * @returns {number} 伤害值（最小1）
 */
export function calcDamage(atk, def, terrain, options = {}) {
  const ac = atk.character, dc = def.character;

  // 0. 磨损衰减：legendary（橙）部队耐久耗尽后攻防-20%（仅PVE可用）
  const atkWorn = (atk.rarity === 'legendary' && atk.battleCount != null && atk.maxBattleCount != null && atk.battleCount >= atk.maxBattleCount);
  const defWorn = (def.rarity === 'legendary' && def.battleCount != null && def.maxBattleCount != null && def.battleCount >= def.maxBattleCount);
  const WORN_PENALTY = 0.80; // 攻防×0.8 = -20%

  // 1. 单兵基础攻击力 = 部队攻击力 + 将领主属性×6（物理：武力；谋略：智力；防御侧暂与普攻线一致）
  // ?? 而非 ||：attack=0 是合法的「极弱」设定，不应被当成缺失数据触发 fallback
  const troopAtk = ((atk.attack ?? 100) / 10) * (atkWorn ? WORN_PENALTY : 1);
  const dk = options.damageKind === 'strategy' ? 'strategy' : 'physical';
  const primary = ac ? (dk === 'strategy' ? (ac.intelligence || 5) : (ac.combat || 5)) : 5;
  const singleAtk = troopAtk + primary * 6;

  // 2. 勇气加成 = 1 + courage/40
  const courage = ac ? (ac.courage || 5) : 5;
  const courageBonus = 1 + (courage / 40);
  const singleFinal = singleAtk * courageBonus;

  // 3. 兵力比例（troopWeight>1 时用凹曲线，残血衰减缓于线性）
  const atkRatio = troopStrengthRatioFromCasualties(atk);
  let totalDmg = singleFinal * atkRatio;

  // 4. 士气攻击系数
  const atkMorale = getMoraleEffects(atk);
  totalDmg *= atkMorale.attack;
  totalDmg *= getTraitOutgoingDamageMult(ac);

  // 4.5 阵型攻击加成
  if (atk._formationBuffs && atk._formationBuffs.attackBonus) {
    totalDmg *= (1 + atk._formationBuffs.attackBonus);
  }

  // 5. 防御减免
  const troopDef = ((def.defense ?? 50) / 10) * (defWorn ? WORN_PENALTY : 1);
  const dCombat = dc ? (dc.combat || 5) : 5;
  const dCommand = dc ? (dc.command || 5) : 5;
  const singleDefBase = troopDef + dCommand * 5 + dCombat * 3;
  const singleDef = singleDefBase * getTraitDefenderDefenseStrengthMult(dc);
  const defRatio = troopStrengthRatioFromCasualties(def);
  const totalDef = singleDef * defRatio;
  const defReduction = totalDef / (totalDef + 140);
  const defMorale = getMoraleEffects(def);
  let defMultiplier = defReduction * defMorale.defense;

  // 5.5 阵型防御加成
  if (def._formationBuffs && def._formationBuffs.defenseBonus) {
    defMultiplier = Math.min(0.9, defMultiplier * (1 + def._formationBuffs.defenseBonus));
  }
  totalDmg *= (1 - defMultiplier);

  // 6. 地形防御加成
  totalDmg *= getTerrainDefBonus(def.y, def.x, terrain);

  // 7. 兵力比例系数（用等效兵力 = maxTroops × troopWeight）；主动一击 / 反击分支见 troopRatioCoeffForStrike
  const atkEffective = (atk.maxTroops) * (atk.troopWeight || 1);
  const defEffective = (def.maxTroops) * (def.troopWeight || 1);
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

  // ═══ 第二部分：适应性修正 ═══

  // 8. 兵种相性（攻击方对防守方兵种的克制系数）
  const defType = def.troopType || 'infantry';
  const counterKey = defType + 'Counter'; // e.g. 'cavalryCounter'
  const counterCoeff = atk[counterKey] ?? 1.0;
  totalDmg *= counterCoeff;

  // 9. 地形适应性（攻击方在当前地形的适应系数）
  if (terrain) {
    const terrainType = terrain[atk.y]?.[atk.x] || 'plain';
    const adaptKey = terrainType + 'Adapt'; // e.g. 'forestAdapt'
    const adaptCoeff = atk[adaptKey] ?? 1.0;
    totalDmg *= adaptCoeff;
  }

  // 10. 官职兵种加成（攻击方 character.positionBonuses；开战前由 positionCombatBonuses 装配）
  const atkType = atk.troopType || 'infantry';
  const posBonus = ac?.positionBonuses;
  if (posBonus) {
    const posBonusKey = atkType + 'Bonus'; // e.g. 'infantryBonus'
    const posBonusVal = posBonus[posBonusKey] || 0;
    totalDmg *= (1 + posBonusVal);
  }

  // 11. 弓兵近战惩罚：弓兵攻击相邻格目标时，总伤害×ARCHER_MELEE_DAMAGE_MULT
  if (atkType === 'archer') {
    const dist = Math.abs(atk.y - def.y) + Math.abs(atk.x - def.x);
    if (dist <= 1) totalDmg *= ARCHER_MELEE_DAMAGE_MULT;
  }

  totalDmg = applyPhase1OutgoingCharacterDamageMult(ac, totalDmg);
  totalDmg = applyPhase1TroopOutgoingMult(atk, totalDmg);
  totalDmg = applyPhase1And2IncomingReduction(def, dc, totalDmg, options);

  const skMult = Number(options.skillDamageMultiplier);
  if (Number.isFinite(skMult) && skMult > 0) totalDmg *= skMult;

  // ═══ 第三部分：特殊加成（暂不实装，预留接口）═══
  // totalDmg *= (1 + factionBonus + sageBonus);

  // 12. 随机浮动 ±10%
  totalDmg *= (0.9 + Math.random() * 0.2);

  return Math.max(1, Math.round(totalDmg));
}

// ── 预估伤害（去掉随机浮动，用于攻击预览） ──────────────────────────────────

/**
 * 预估一次攻击的伤害、暴击率、命中率（不含随机浮动）
 * @param {Object} atk - 攻击方部队
 * @param {Object} def - 防守方部队
 * @param {string[][]} terrain - 地形二维数组
 * @param {{
 *   strike?: 'normal' | 'counter',
 *   battleTroops?: object[],
 *   damageKind?: 'physical' | 'strategy',
 *   skillDamageMultiplier?: number,
 * }} [options] - 与 calcDamage 一致
 * @returns {{ damage: number, critRate: number, hitRate: number, critDamage: number }} damage/critDamage 为防守方兵力条实际扣减（精锐已除 troopWeight）；含首击免疫预览
 */
export function estimateDamage(atk, def, terrain, options = {}) {
  const ac = atk.character, dc = def.character;

  // 复用 calcDamage 的全部逻辑，但不加随机浮动（legendary = 橙档磨损）
  const atkWorn = (atk.rarity === 'legendary' && atk.battleCount != null && atk.maxBattleCount != null && atk.battleCount >= atk.maxBattleCount);
  const defWorn = (def.rarity === 'legendary' && def.battleCount != null && def.maxBattleCount != null && def.battleCount >= def.maxBattleCount);
  const WORN_PENALTY = 0.80;
  const troopAtk = ((atk.attack ?? 100) / 10) * (atkWorn ? WORN_PENALTY : 1);
  const dk = options.damageKind === 'strategy' ? 'strategy' : 'physical';
  const primary = ac ? (dk === 'strategy' ? (ac.intelligence || 5) : (ac.combat || 5)) : 5;
  const singleAtk = troopAtk + primary * 6;
  const courage = ac ? (ac.courage || 5) : 5;
  const courageBonus = 1 + (courage / 40);
  const singleFinal = singleAtk * courageBonus;
  const atkRatio = troopStrengthRatioFromCasualties(atk);
  let totalDmg = singleFinal * atkRatio;
  const atkMorale = getMoraleEffects(atk);
  totalDmg *= atkMorale.attack;
  totalDmg *= getTraitOutgoingDamageMult(ac);
  if (atk._formationBuffs?.attackBonus) totalDmg *= (1 + atk._formationBuffs.attackBonus);
  const troopDef = ((def.defense ?? 50) / 10) * (defWorn ? WORN_PENALTY : 1);
  const dCombat = dc ? (dc.combat || 5) : 5;
  const dCommand = dc ? (dc.command || 5) : 5;
  const singleDefBase = troopDef + dCommand * 5 + dCombat * 3;
  const singleDef = singleDefBase * getTraitDefenderDefenseStrengthMult(dc);
  const defRatio = troopStrengthRatioFromCasualties(def);
  const totalDef = singleDef * defRatio;
  const defReduction = totalDef / (totalDef + 140);
  const defMorale = getMoraleEffects(def);
  let defMultiplier = defReduction * defMorale.defense;
  if (def._formationBuffs?.defenseBonus) defMultiplier = Math.min(0.9, defMultiplier * (1 + def._formationBuffs.defenseBonus));
  totalDmg *= (1 - defMultiplier);
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
  totalDmg *= (atk[defType + 'Counter'] ?? 1.0);
  if (terrain) {
    const adaptKey = (terrain[atk.y]?.[atk.x] || 'plain') + 'Adapt';
    totalDmg *= (atk[adaptKey] ?? 1.0);
  }
  const posBonus = ac?.positionBonuses;
  if (posBonus) totalDmg *= (1 + (posBonus[(atk.troopType || 'infantry') + 'Bonus'] || 0));

  // 弓兵近战惩罚：弓兵攻击相邻格目标时，总伤害×ARCHER_MELEE_DAMAGE_MULT
  if ((atk.troopType || 'infantry') === 'archer') {
    const dist = Math.abs(atk.y - def.y) + Math.abs(atk.x - def.x);
    if (dist <= 1) totalDmg *= ARCHER_MELEE_DAMAGE_MULT;
  }

  totalDmg = applyPhase1OutgoingCharacterDamageMult(ac, totalDmg);
  totalDmg = applyPhase1TroopOutgoingMult(atk, totalDmg);
  totalDmg = applyPhase1And2IncomingReduction(def, dc, totalDmg, options);

  const skMult = Number(options.skillDamageMultiplier);
  if (Number.isFinite(skMult) && skMult > 0) totalDmg *= skMult;

  const rawDamage = Math.max(1, Math.round(totalDmg));
  const damage = previewCasualtiesAfterPhase2FirstHit(def, troopDamageToCasualties(def, rawDamage));
  const critDamage = previewCasualtiesAfterPhase2FirstHit(def, troopDamageToCasualties(def, Math.round(rawDamage * 1.5)));

  const dodgeRate = getEffectiveDodgeRateFromCharacter(dc);
  const hitRate = getEffectiveHitRatePreview(ac, dc);
  const critRate = getEffectiveCritRateFromCharacter(ac);

  return { damage, critRate, hitRate, critDamage };
}

// ── 暴击/闪避判定 ─────────────────────────────────────────────────────────────

/**
 * 判定攻击结果：普通命中、暴击、闪避
 * @param {Object} atk - 攻击方部队
 * @param {Object} def - 防守方部队
 * @returns {'normal'|'crit'|'dodge'}
 */
export function rollCritDodge(atk, def) {
  const ac = atk.character, dc = def.character;
  const dodgeRate = getEffectiveDodgeRateFromCharacter(dc);
  if (Math.random() < dodgeRate) return 'dodge';
  const critRate = getEffectiveCritRateFromCharacter(ac);
  if (Math.random() < critRate) return 'crit';
  return 'normal';
}
