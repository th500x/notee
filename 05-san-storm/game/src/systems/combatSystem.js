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

// ── 精锐小队战损比例（troopWeight > 1）────────────────────────────────────────
// 仅影响「当前兵力/最大兵力」在攻防上的线性缩放；满编时与 troopWeight=1 一致，残血时衰减慢于线性。
// 现阶段仅燕云十八等配置了 troop_weight>1 的部队会走此分支，其余部队仍为 current/max。
export const ELITE_TROOP_STRENGTH_EXPONENT = 0.85;

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

// ── 士气攻防系数 ──────────────────────────────────────────────────────────────

/**
 * 根据部队士气返回攻防系数
 * @param {Object} troop - 部队对象（需要 morale 字段）
 * @returns {{ attack: number, defense: number }}
 */
export function getMoraleEffects(troop) {
  const m = troop.morale || 70;
  if (m >= 80) return { attack: 1.10, defense: 1.05 };  // 高昂/超高昂
  if (m > 20)  return { attack: 1.00, defense: 1.00 };  // 普通
  return { attack: 0.95, defense: 0.90 };                // 低落
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

// ── 完整伤害计算 ──────────────────────────────────────────────────────────────

/**
 * 计算一次攻击的伤害值
 * @param {Object} atk - 攻击方部队
 * @param {Object} def - 防守方部队
 * @param {string[][]} terrain - 地形二维数组（mapResult.terrain）
 * @returns {number} 伤害值（最小1）
 */
export function calcDamage(atk, def, terrain) {
  const ac = atk.character, dc = def.character;

  // 0. 磨损衰减：legendary（橙）部队耐久耗尽后攻防-20%（仅PVE可用）
  const atkWorn = (atk.rarity === 'legendary' && atk.battleCount != null && atk.maxBattleCount != null && atk.battleCount >= atk.maxBattleCount);
  const defWorn = (def.rarity === 'legendary' && def.battleCount != null && def.maxBattleCount != null && def.battleCount >= def.maxBattleCount);
  const WORN_PENALTY = 0.80; // 攻防×0.8 = -20%

  // 1. 单兵基础攻击力 = 部队攻击力 + 将领武力×6
  const troopAtk = ((atk.attack || 100) / 10) * (atkWorn ? WORN_PENALTY : 1);
  const combat = ac ? (ac.combat || 5) : 5;
  const singleAtk = troopAtk + combat * 6;

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

  // 4.5 阵型攻击加成
  if (atk._formationBuffs && atk._formationBuffs.attackBonus) {
    totalDmg *= (1 + atk._formationBuffs.attackBonus);
  }

  // 5. 防御减免
  const troopDef = ((def.defense || 50) / 10) * (defWorn ? WORN_PENALTY : 1);
  const dCombat = dc ? (dc.combat || 5) : 5;
  const dCommand = dc ? (dc.command || 5) : 5;
  const singleDef = troopDef + dCommand * 5 + dCombat * 3;
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

  // 7. 兵力比例系数（用等效兵力 = maxTroops × troopWeight）
  const atkEffective = (atk.maxTroops) * (atk.troopWeight || 1);
  const defEffective = (def.maxTroops) * (def.troopWeight || 1);
  const rawTroopRatio = atkEffective / defEffective;
  const troopRatioCoeff = Math.min(3.0, Math.max(0.33, rawTroopRatio));
  totalDmg *= troopRatioCoeff;

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

  // 10. 官职兵种加成（攻击方将领的官职对该兵种的加成）
  const atkType = atk.troopType || 'infantry';
  const posBonus = ac?.positionBonuses;
  if (posBonus) {
    const posBonusKey = atkType + 'Bonus'; // e.g. 'infantryBonus'
    const posBonusVal = posBonus[posBonusKey] || 0;
    totalDmg *= (1 + posBonusVal);
  }

  // 11. 弓兵近战惩罚：弓兵攻击相邻格目标时，总伤害×0.85
  if (atkType === 'archer') {
    const dist = Math.abs(atk.y - def.y) + Math.abs(atk.x - def.x);
    if (dist <= 1) totalDmg *= 0.85;
  }

  // ═══ 第三部分：特殊加成（暂不实装，预留接口）═══
  // totalDmg *= (1 + factionBonus + sageBonus);

  // 11. 随机浮动 ±10%
  totalDmg *= (0.9 + Math.random() * 0.2);

  return Math.max(1, Math.round(totalDmg));
}

// ── 预估伤害（去掉随机浮动，用于攻击预览） ──────────────────────────────────

/**
 * 预估一次攻击的伤害、暴击率、命中率（不含随机浮动）
 * @param {Object} atk - 攻击方部队
 * @param {Object} def - 防守方部队
 * @param {string[][]} terrain - 地形二维数组
 * @returns {{ damage: number, critRate: number, hitRate: number, critDamage: number }} damage/critDamage 为防守方兵力条实际扣减（精锐已除 troopWeight）
 */
export function estimateDamage(atk, def, terrain) {
  const ac = atk.character, dc = def.character;

  // 复用 calcDamage 的全部逻辑，但不加随机浮动（legendary = 橙档磨损）
  const atkWorn = (atk.rarity === 'legendary' && atk.battleCount != null && atk.maxBattleCount != null && atk.battleCount >= atk.maxBattleCount);
  const defWorn = (def.rarity === 'legendary' && def.battleCount != null && def.maxBattleCount != null && def.battleCount >= def.maxBattleCount);
  const WORN_PENALTY = 0.80;
  const troopAtk = ((atk.attack || 100) / 10) * (atkWorn ? WORN_PENALTY : 1);
  const combat = ac ? (ac.combat || 5) : 5;
  const singleAtk = troopAtk + combat * 6;
  const courage = ac ? (ac.courage || 5) : 5;
  const courageBonus = 1 + (courage / 40);
  const singleFinal = singleAtk * courageBonus;
  const atkRatio = troopStrengthRatioFromCasualties(atk);
  let totalDmg = singleFinal * atkRatio;
  const atkMorale = getMoraleEffects(atk);
  totalDmg *= atkMorale.attack;
  if (atk._formationBuffs?.attackBonus) totalDmg *= (1 + atk._formationBuffs.attackBonus);
  const troopDef = ((def.defense || 50) / 10) * (defWorn ? WORN_PENALTY : 1);
  const dCombat = dc ? (dc.combat || 5) : 5;
  const dCommand = dc ? (dc.command || 5) : 5;
  const singleDef = troopDef + dCommand * 5 + dCombat * 3;
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
  totalDmg *= Math.min(3.0, Math.max(0.33, atkEffective / defEffective));
  const defType = def.troopType || 'infantry';
  totalDmg *= (atk[defType + 'Counter'] ?? 1.0);
  if (terrain) {
    const adaptKey = (terrain[atk.y]?.[atk.x] || 'plain') + 'Adapt';
    totalDmg *= (atk[adaptKey] ?? 1.0);
  }
  const posBonus = ac?.positionBonuses;
  if (posBonus) totalDmg *= (1 + (posBonus[(atk.troopType || 'infantry') + 'Bonus'] || 0));

  // 弓兵近战惩罚：弓兵攻击相邻格目标时，总伤害×0.85
  if ((atk.troopType || 'infantry') === 'archer') {
    const dist = Math.abs(atk.y - def.y) + Math.abs(atk.x - def.x);
    if (dist <= 1) totalDmg *= 0.85;
  }

  const rawDamage = Math.max(1, Math.round(totalDmg));
  const damage = troopDamageToCasualties(def, rawDamage);
  const critDamage = troopDamageToCasualties(def, Math.round(rawDamage * 1.5));

  // 暴击率 / 命中率
  const dodgeRate = dc ? (dc.luck || 5) / 100 : 0.05;
  const hitRate = 1 - dodgeRate;
  const critRate = ac ? ((ac.courage || 5) + (ac.luck || 5)) / 80 : 0.1;

  return { damage, critRate: Math.min(critRate, 0.25), hitRate, critDamage };
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
  // 闪避率 = luck/100
  const dodgeRate = dc ? (dc.luck || 5) / 100 : 0.05;
  if (Math.random() < dodgeRate) return 'dodge';
  // 暴击率 = (courage+luck)/80
  const critRate = ac ? ((ac.courage || 5) + (ac.luck || 5)) / 80 : 0.1;
  if (Math.random() < critRate) return 'crit';
  return 'normal';
}
