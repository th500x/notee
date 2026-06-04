/**
 * headless 阵型模型（无 React / DOM / 动画）。
 *
 * 移植自前端：
 *   - `game/src/systems/formationSystem.js`：`FORMATIONS` / `checkFormation`（纯，逐字搬运）。
 *   - `autoSelectFormation` → 泛化为 `selectFormationForTroops(troops, terrain)`（按传入兵组选阵，
 *     不再硬编码 `faction==='player'`）。
 *   - `tacticalBattleEngine.applyFormationBuffs` → 泛化为 `applyFormation(troops, mapResult, opts)`：
 *     选有效中心 → 重排棋子 → 写 `_formationBuffs` / `movement += moveBonus` / archer `range += rangeBonus`；
 *     **丢弃** DOM 高亮与动画。
 *
 * 朝向泛化：阵型 shape 以「dy 负 = 朝敌方（上方）」为约定（前端 player 在南、敌在北）。
 *   本模型按 `enemyDir`（-1 = 敌在北 / 小 y，+1 = 敌在南 / 大 y）将 shape 的 dy 取 `dy * (-enemyDir)`，
 *   使「锋矢前锋」「鹤翼两翼」永远朝向真正的敌方。
 *
 * 单一来源：移动消耗复用 `tacticalGridModel.getMoveCost`、射程复用 `troopAttackRange`。
 *
 * @see game/src/systems/formationSystem.js
 * @see game/src/battle/tacticalBattleEngine.js applyFormationBuffs
 */

import { getMapTerrainDimensions, isInMapGrid } from '../../utils/tacticalBattleGrid.js';
import { getMoveCost, troopAttackRange } from './tacticalGridModel.js';

// ── 阵型定义（逐字搬运 formationSystem.FORMATIONS） ────────────────────────────

// shape: dy 负=朝敌方（上方），dy 正=朝后方（下方）
export const FORMATIONS = [
  {
    id: 'fengshi', name: '锋矢阵', type: 'offensive',
    reqTypes: { cavalry: 1 },
    shape: [{ dx: 0, dy: -1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }],
    effects: { attackBonus: 0.30, defenseBonus: 0, moveBonus: 1 },
    reqTerrain: ['plain', 'hill'], forbidTerrain: ['forest'],
    desc: '攻击+30%，移动+1',
  },
  {
    id: 'heyi', name: '鹤翼阵', type: 'balanced',
    reqTypes: { archer: 1 },
    shape: [{ dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: 0, dy: 0 }],
    effects: { attackBonus: 0.20, defenseBonus: 0.10, rangeBonus: 1 },
    reqTerrain: ['plain', 'hill'], forbidTerrain: [],
    desc: '攻击+20%，防御+10%，弓兵射程+1',
  },
  {
    id: 'yulin', name: '鱼鳞阵', type: 'defensive',
    reqTypes: { infantry: 2 },
    shape: [{ dx: 0, dy: -1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }],
    effects: { attackBonus: 0, defenseBonus: 0.30, moveBonus: -1 },
    reqTerrain: ['plain', 'hill', 'forest'], forbidTerrain: [],
    desc: '防御+30%，移动-1',
  },
];

// ── 阵型检查（逐字搬运 formationSystem.checkFormation） ────────────────────────

/**
 * 检查一组部队能否组成某个阵型。
 * @param {Object} formation
 * @param {Object[]} troops
 * @param {string[][]|null} terrain
 * @returns {{ ok: boolean, reason?: string }}
 */
export function checkFormation(formation, troops, terrain) {
  if (formation.reqTypes) {
    for (const [type, count] of Object.entries(formation.reqTypes)) {
      const have = troops.filter((t) => {
        const wt = t.weaponType || '';
        const troopType = t.troopType || wt.split('_')[0] || '';
        return troopType === type;
      }).length;
      if (have < count) return { ok: false, reason: `需要${count}支${type}` };
    }
  }
  if (terrain && formation.forbidTerrain.length > 0) {
    for (const t of troops) {
      const tile = terrain[t.y]?.[t.x];
      if (tile && formation.forbidTerrain.includes(tile))
        return { ok: false, reason: `禁止地形:${tile}` };
    }
  }
  return { ok: true };
}

// ── 自动选阵（泛化 autoSelectFormation：按传入兵组选阵） ────────────────────────

/**
 * 从一组存活部队中选最优阵型（不再硬编码 faction）。
 * 优先级：进攻>平衡>防御；同档内禁止地形更少 → shape 更长 → id 字典序（确定性）。
 * @param {Object[]} troops - 该侧存活部队
 * @param {string[][]|null} terrain - 地形二维数组
 * @returns {Object|null}
 */
export function selectFormationForTroops(troops, terrain) {
  const alive = troops.filter((t) => t.currentTroops > 0);
  if (alive.length < 3) return null;
  const priority = ['offensive', 'balanced', 'defensive'];
  for (const pType of priority) {
    const okList = FORMATIONS.filter((f) => f.type === pType).filter(
      (f) => checkFormation(f, alive, terrain).ok,
    );
    if (okList.length === 0) continue;
    okList.sort((a, b) => {
      const na = (a.forbidTerrain || []).length;
      const nb = (b.forbidTerrain || []).length;
      if (na !== nb) return na - nb;
      const la = a.shape?.length || 0;
      const lb = b.shape?.length || 0;
      if (la !== lb) return lb - la;
      return String(a.id).localeCompare(String(b.id));
    });
    return okList[0];
  }
  return null;
}

// ── 补位（泛化 collectExtraDeployPositions：用传入 deployRows） ────────────────

function collectExtraDeployPositions(needed, occupiedKeys, mapResult, enemyUnits, formation, cy, cx, deployRows, objMap) {
  if (needed <= 0) return [];
  if (!deployRows.length) return [];
  const yLo = deployRows[0];
  const yHi = deployRows[deployRows.length - 1];
  const { w: mapW } = getMapTerrainDimensions(mapResult);
  const forbid = formation.forbidTerrain || [];
  const occupied = new Set(occupiedKeys);
  const candidates = [];
  for (let y = yLo; y <= yHi; y++) {
    for (let x = 0; x < mapW; x++) {
      const k = `${y},${x}`;
      if (occupied.has(k)) continue;
      if (!isInMapGrid(y, x, mapResult)) continue;
      if (getMoveCost(y, x, mapResult, objMap) === Infinity) continue;
      if (enemyUnits.some((t) => t.currentTroops > 0 && t.y === y && t.x === x)) continue;
      if (mapResult && forbid.length > 0) {
        const tile = mapResult.terrain[y]?.[x];
        if (forbid.includes(tile)) continue;
      }
      const d = Math.abs(y - cy) + Math.abs(x - cx);
      candidates.push({ y, x, dist: d });
    }
  }
  candidates.sort((a, b) => a.dist - b.dist || a.y - b.y || a.x - b.x);
  const out = [];
  for (const c of candidates) {
    if (out.length >= needed) break;
    const k = `${c.y},${c.x}`;
    if (occupied.has(k)) continue;
    occupied.add(k);
    out.push({ y: c.y, x: c.x });
  }
  return out;
}

/**
 * 头无关地应用阵型：在 `deployRows` 内选有效中心，重排 `troops` 棋子并写入加成。
 * 不做 DOM/动画；不写日志（由内核发 FORMATION_APPLIED 事件）。
 *
 * @param {Object[]} troops - 该侧存活部队（会被原地改 y/x/movement/range/_formationBuffs）
 * @param {Object} mapResult
 * @param {Object} opts
 * @param {Object} opts.formation - selectFormationForTroops 选中的阵型
 * @param {number[]} opts.deployRows - 该侧部署行（如 ZONE.deployA / deployB）
 * @param {number} opts.enemyDir - 敌方朝向：-1=敌在小 y（北），+1=敌在大 y（南）
 * @param {Object[]} opts.enemyUnits - 对侧部队（用于避免与敌占位重叠）
 * @param {Map<string,Object>} [opts.objMap]
 * @returns {{ formation: Object, positions: Array<{y,x}> } | null} 成功返回落位；无有效中心返回 null
 */
export function applyFormation(troops, mapResult, opts) {
  const { formation, deployRows, enemyDir, enemyUnits = [], objMap } = opts || {};
  if (!formation) return null;
  const alive = troops.filter((t) => t.currentTroops > 0);
  if (alive.length < 3) return null;
  if (!deployRows || !deployRows.length) return null;

  const shape = formation.shape;
  const dySign = -enemyDir; // shape 以「敌在北(-1)」为基准；其余朝向翻转 dy
  const yLo = deployRows[0];
  const yHi = deployRows[deployRows.length - 1];
  const { w: mapW } = getMapTerrainDimensions(mapResult);
  const midX = (mapW - 1) / 2;

  const candidateCenters = [];
  for (let y = yLo; y <= yHi; y++) {
    for (let x = 1; x <= mapW - 2; x++) candidateCenters.push({ y, x });
  }
  const n = alive.length;
  const pcY = alive.reduce((s, t) => s + t.y, 0) / n;
  const pcX = alive.reduce((s, t) => s + t.x, 0) / n;
  candidateCenters.sort((a, b) => {
    const da = Math.abs(a.y - pcY) + Math.abs(a.x - pcX);
    const db = Math.abs(b.y - pcY) + Math.abs(b.x - pcX);
    if (da !== db) return da - db;
    return (a.y - b.y) || (Math.abs(a.x - midX) - Math.abs(b.x - midX));
  });

  const forbid = formation.forbidTerrain || [];
  let bestCenter = null;
  for (const center of candidateCenters) {
    const basePositions = shape.map((s) => ({ y: center.y + s.dy * dySign, x: center.x + s.dx }));
    const baseValid = basePositions.every((p) => {
      if (!isInMapGrid(p.y, p.x, mapResult)) return false;
      if (getMoveCost(p.y, p.x, mapResult, objMap) === Infinity) return false;
      if (enemyUnits.some((t) => t.currentTroops > 0 && t.y === p.y && t.x === p.x)) return false;
      if (mapResult && forbid.length > 0) {
        const tile = mapResult.terrain[p.y]?.[p.x];
        if (forbid.includes(tile)) return false;
      }
      return true;
    });
    const baseKeys = basePositions.map((p) => `${p.y},${p.x}`);
    if (!baseValid || new Set(baseKeys).size !== baseKeys.length) continue;

    let positions;
    if (n <= basePositions.length) {
      positions = basePositions.slice(0, n);
    } else {
      const extraNeeded = n - basePositions.length;
      const extras = collectExtraDeployPositions(
        extraNeeded, baseKeys, mapResult, enemyUnits, formation, center.y, center.x, deployRows, objMap,
      );
      if (extras.length < extraNeeded) continue;
      positions = basePositions.concat(extras);
    }
    const allKeys = positions.map((p) => `${p.y},${p.x}`);
    if (new Set(allKeys).size !== allKeys.length) continue;
    bestCenter = { center, positions };
    break;
  }
  if (!bestCenter) return null;

  const { positions } = bestCenter;
  for (let i = 0; i < alive.length; i++) {
    const troop = alive[i];
    const target = positions[i];
    troop.y = target.y;
    troop.x = target.x;
  }
  for (const t of alive) {
    t._formationBuffs = formation.effects;
    if (formation.effects.moveBonus) {
      t._origMovement = t.movement;
      t.movement = Math.max(1, (t.movement || 3) + formation.effects.moveBonus);
    }
    if (formation.effects.rangeBonus) {
      const wt = t.weaponType || '';
      if (wt.startsWith('archer')) {
        t._origRange = t.range;
        t.range = troopAttackRange(t) + formation.effects.rangeBonus;
      }
    }
  }
  return { formation, positions };
}
