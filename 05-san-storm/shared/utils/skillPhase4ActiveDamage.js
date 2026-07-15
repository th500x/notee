/**
 * 将领主动 · 阶段4（纯伤害 `damage`）：形状格、随机多目标、`costSelf`、`_skillPhase4Damage` 与 `_phase4DamageRuntime`。
 * 契约：`docs/20-data-layer/23-SKILL_SYSTEM.md` 阶段4；`skill-template.csv` 中 `implementation_phase === 4` 且 `skill_type === damage` 的主动技能。
 */

import {
  getSharedActiveSkillRuntimeBag,
  initBattleSharedChargesFromSlots,
} from './battleActiveSkillRuntimePool.js';

/**
 * @param {object|null|undefined} skill
 */
export function isActiveSkillPhase4PureDamage(skill) {
  if (!skill || skill.type !== 'active' || skill.skillEffectType !== 'damage') return false;
  const ph = Number(skill.implementationPhase);
  if (!Number.isFinite(ph) || ph !== 4) return false;
  const se = skill.specialEffect;
  if (se != null && String(se).trim() !== '' && parsePhase4CostSelfOnly(skill) === null) return false;
  return true;
}

/**
 * 仅允许整段为 `costSelf:N`（如浴血），否则返回 null 表示非本批纯伤形态。
 * @returns {number|null} costSelf 值；无 cost 段时返回 0；非法时 null
 */
export function parsePhase4CostSelfOnly(skill) {
  const se = skill?.specialEffect;
  if (se == null || String(se).trim() === '') return 0;
  const parts = String(se)
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  let cost = 0;
  for (const p of parts) {
    const idx = p.indexOf(':');
    if (idx <= 0) return null;
    const key = p.slice(0, idx).trim().toLowerCase();
    const val = p.slice(idx + 1).trim();
    if (key !== 'costself') return null;
    const n = parseInt(val, 10);
    if (!Number.isFinite(n) || n < 0 || n > 50000) return null;
    cost += n;
  }
  return cost;
}

/**
 * @param {object} skill
 * @returns {{ skillId: string, name: string, damageMultiplier: number, damageType: string, targetRange: string, targetCount: string, costSelf: number } | null}
 */
export function phase4DamageSlotFromSkill(skill, skillId) {
  if (!isActiveSkillPhase4PureDamage(skill)) return null;
  const mult = Number(skill.damageMultiplier);
  if (!Number.isFinite(mult) || mult <= 0) return null;
  const costSelf = parsePhase4CostSelfOnly(skill);
  if (costSelf === null) return null;
  const tr = String(skill.targetRange || 'single').toLowerCase();
  const tc = String(skill.targetCount ?? '1');
  const dt = String(skill.damageType || 'physical').toLowerCase();
  if (dt !== 'physical' && dt !== 'strategy') return null;
  return {
    skillId,
    name: skill.name || skillId,
    damageMultiplier: mult,
    damageType: dt,
    targetRange: tr,
    targetCount: tc,
    costSelf,
  };
}

/**
 * @param {string[]} skillIds
 * @param {Record<string, object>} skillsMap
 */
export function buildPhase4DamageSlotsFromSkillIds(skillIds, skillsMap) {
  const out = [];
  const seen = new Set();
  for (const id of skillIds || []) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const sk = skillsMap[id];
    const slot = phase4DamageSlotFromSkill(sk, id);
    if (slot) out.push(slot);
  }
  return out;
}

/**
 * @param {object|null|undefined} charLike
 * @param {ReturnType<typeof buildPhase4DamageSlotsFromSkillIds>} slots
 */
export function attachPhase4DamageToCharacter(charLike, slots) {
  if (!charLike || typeof charLike !== 'object') return charLike;
  const next = { ...charLike };
  if (!slots || slots.length === 0) {
    delete next._skillPhase4Damage;
    return next;
  }
  next._skillPhase4Damage = { slots: slots.map((s) => ({ ...s })) };
  return next;
}

/**
 * 以 **锚点格**（通常为玩家点选的敌军所在格）为基准展开形状；`square` 为锚点作 **2×2 左上** 四格（田字）。
 * @returns {{ y: number, x: number }[]}
 */
export function cellsForPhase4TargetPattern(anchorY, anchorX, targetRange) {
  const tr = String(targetRange || 'single').toLowerCase();
  const ay = Math.floor(Number(anchorY)) || 0;
  const ax = Math.floor(Number(anchorX)) || 0;
  if (tr === 'single') return [{ y: ay, x: ax }];
  if (tr === 'cross') {
    return [
      { y: ay, x: ax },
      { y: ay + 1, x: ax },
      { y: ay - 1, x: ax },
      { y: ay, x: ax + 1 },
      { y: ay, x: ax - 1 },
    ];
  }
  if (tr === 'square') {
    return [
      { y: ay, x: ax },
      { y: ay, x: ax + 1 },
      { y: ay + 1, x: ax },
      { y: ay + 1, x: ax + 1 },
    ];
  }
  if (tr === 'line') {
    // 默认水平三格；实际结算与候选锚点判定见 pickPhase4LineCellsForAnchor（横/竖择优）
    return [
      { y: ay, x: ax - 1 },
      { y: ay, x: ax },
      { y: ay, x: ax + 1 },
    ];
  }
  return [{ y: ay, x: ax }];
}

/**
 * `line`：以锚点为正中一格的 **3 格直线**（横或竖）。在两种合法朝向中取**命中敌对单位数较多**的一种（平局取横）。
 * @param {{ y: number, x: number }} anchorEnemy
 * @param {object} actor
 * @param {object[]} battleTroops
 */
export function pickPhase4LineCellsForAnchor(anchorEnemy, actor, battleTroops, mapH, mapW) {
  const ay = Math.floor(Number(anchorEnemy?.y)) || 0;
  const ax = Math.floor(Number(anchorEnemy?.x)) || 0;
  const h = Math.max(1, Math.floor(Number(mapH)) || 10);
  const w = Math.max(1, Math.floor(Number(mapW)) || 8);
  const horizontal = filterPatternCellsInMap(
    [
      { y: ay, x: ax - 1 },
      { y: ay, x: ax },
      { y: ay, x: ax + 1 },
    ],
    h,
    w,
  );
  const vertical = filterPatternCellsInMap(
    [
      { y: ay - 1, x: ax },
      { y: ay, x: ax },
      { y: ay + 1, x: ax },
    ],
    h,
    w,
  );
  const countHostilesOnCells = (cells) => {
    const keys = new Set(cells.map((c) => `${c.y},${c.x}`));
    let n = 0;
    for (const u of battleTroops || []) {
      if (!u || u.currentTroops <= 0 || !isHostileToActor(actor, u)) continue;
      if (keys.has(`${u.y},${u.x}`)) n += 1;
    }
    return n;
  };
  const ch = countHostilesOnCells(horizontal);
  const cv = countHostilesOnCells(vertical);
  if (cv > ch) return vertical;
  return horizontal;
}

export function filterPatternCellsInMap(cells, mapH, mapW) {
  const h = Math.max(1, Math.floor(Number(mapH)) || 10);
  const w = Math.max(1, Math.floor(Number(mapW)) || 8);
  return cells.filter((c) => c.y >= 0 && c.y < h && c.x >= 0 && c.x < w);
}

/** 与 `battleFlowManager.dist` 一致：曼哈顿距离 */
export function manhattanDist(a, b) {
  if (!a || !b) return Infinity;
  return Math.abs((a.y || 0) - (b.y || 0)) + Math.abs((a.x || 0) - (b.x || 0));
}

export function isHostileToActor(actor, target) {
  if (!actor || !target) return false;
  const af = actor.faction;
  const tf = target.faction;
  if (af === 'enemy') return tf === 'player' || tf === 'ally';
  if (af === 'player' || af === 'ally') return tf === 'enemy';
  return false;
}

/**
 * @param {number} maxCastManhattan 施法者与锚点/随机池内敌军的最大曼哈顿距离（由 `getTacticalActiveSkillCastRange(slot.skillId)`）
 */
export function listPhase4AnchorEnemyCandidates(actor, slot, battleTroops, mapH, mapW, maxCastManhattan) {
  const rng = Math.max(1, Math.floor(Number(maxCastManhattan)) || 1);
  const tr = String(slot.targetRange || '').toLowerCase();
  if (tr === 'random') {
    return battleTroops.filter(
      (t) =>
        t &&
        t.currentTroops > 0 &&
        isHostileToActor(actor, t) &&
        manhattanDist(actor, t) <= rng,
    );
  }
  const out = [];
  for (const t of battleTroops || []) {
    if (!t || t.currentTroops <= 0 || !isHostileToActor(actor, t)) continue;
    if (manhattanDist(actor, t) > rng) continue;
    const trSlot = String(slot.targetRange || '').toLowerCase();
    const lineVariants =
      trSlot === 'line'
        ? [
            filterPatternCellsInMap(
              [
                { y: t.y, x: t.x - 1 },
                { y: t.y, x: t.x },
                { y: t.y, x: t.x + 1 },
              ],
              mapH,
              mapW,
            ),
            filterPatternCellsInMap(
              [
                { y: t.y - 1, x: t.x },
                { y: t.y, x: t.x },
                { y: t.y + 1, x: t.x },
              ],
              mapH,
              mapW,
            ),
          ]
        : null;
    const cellGroups = lineVariants
      ? lineVariants
      : [filterPatternCellsInMap(cellsForPhase4TargetPattern(t.y, t.x, slot.targetRange), mapH, mapW)];
    let hitAny = false;
    for (const cells of cellGroups) {
      const cellKeys = new Set(cells.map((c) => `${c.y},${c.x}`));
      for (const u of battleTroops) {
        if (!u || u.currentTroops <= 0 || !isHostileToActor(actor, u)) continue;
        if (cellKeys.has(`${u.y},${u.x}`)) {
          hitAny = true;
          break;
        }
      }
      if (hitAny) break;
    }
    if (hitAny) out.push(t);
  }
  return out;
}

/**
 * 形状技：锚在敌军 `anchorEnemy` 所在格展开后，所有在形状内且与 actor 敌对的部队（去重）。
 */
export function listPhase4ShapeVictims(actor, anchorEnemy, slot, battleTroops, mapH, mapW) {
  if (!anchorEnemy || !slot) return [];
  const trSlot = String(slot.targetRange || '').toLowerCase();
  const cells =
    trSlot === 'line'
      ? pickPhase4LineCellsForAnchor(anchorEnemy, actor, battleTroops, mapH, mapW)
      : filterPatternCellsInMap(
          cellsForPhase4TargetPattern(anchorEnemy.y, anchorEnemy.x, slot.targetRange),
          mapH,
          mapW,
        );
  const keySet = new Set(cells.map((c) => `${c.y},${c.x}`));
  const seen = new Set();
  const out = [];
  for (const u of battleTroops || []) {
    if (!u || u.currentTroops <= 0 || !isHostileToActor(actor, u)) continue;
    if (!keySet.has(`${u.y},${u.x}`)) continue;
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    out.push(u);
  }
  return out;
}

/**
 * @param {number} maxCastManhattan 与 `listPhase4AnchorEnemyCandidates` 一致
 */
export function pickPhase4RandomVictims(actor, slot, battleTroops, maxCastManhattan, rng = Math.random) {
  const pool = battleTroops.filter(
    (t) =>
      t &&
      t.currentTroops > 0 &&
      isHostileToActor(actor, t) &&
      manhattanDist(actor, t) <= Math.max(1, Math.floor(Number(maxCastManhattan)) || 1),
  );
  const n = Math.max(1, parseInt(String(slot.targetCount), 10) || 1);
  const take = Math.min(n, pool.length);
  const shuffled = [...pool].sort(() => rng() - 0.5);
  return shuffled.slice(0, take);
}

export function getRemainingPhase4DamageCharges(troop, skillId) {
  const m = getSharedActiveSkillRuntimeBag(troop, '_phase4DamageRuntime')?.chargesBySkillId;
  if (!m || skillId == null) return 0;
  const v = m[skillId];
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

export function consumePhase4DamageCharge(troop, skillId) {
  const m = getSharedActiveSkillRuntimeBag(troop, '_phase4DamageRuntime')?.chargesBySkillId;
  if (!m || skillId == null) return false;
  const cur = m[skillId];
  if (!Number.isFinite(cur) || cur <= 0) return false;
  m[skillId] = cur - 1;
  return true;
}

export function initBattlePhase4DamageRuntime(battleTroops, rows, cols) {
  initBattleSharedChargesFromSlots(battleTroops, rows, cols, {
    runtimeProp: '_phase4DamageRuntime',
    getSlots: (t) => t.character?._skillPhase4Damage?.slots,
  });
}

export function applyPhase4CostSelf(actor, costSelf) {
  const c = Math.max(0, Math.floor(Number(costSelf) || 0));
  if (c <= 0) return { paid: 0 };
  const cur = Math.floor(Number(actor.currentTroops) || 0);
  const paid = Math.min(c, Math.max(0, cur - 1));
  actor.currentTroops = cur - paid;
  return { paid };
}
