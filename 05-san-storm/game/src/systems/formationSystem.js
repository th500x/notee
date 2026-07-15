/**
 * 阵型系统
 *
 * 负责：阵型定义、阵型检查、自动选择最优阵型
 * 从 demo/map-generator-demo.html 提取，逻辑完全一致
 *
 * @see docs/10-core-system/17-2-FORMATION_SYSTEM.md
 */

// ── 阵型定义 ──────────────────────────────────────────────────────────────────

// shape: dy负=朝敌方（上方），dy正=朝后方（下方）
export const FORMATIONS = [
  {
    id: 'fengshi', name: '锋矢阵', type: 'offensive',
    reqTypes: { cavalry: 1 },
    // 前锋在前，两翼在后
    shape: [{ dx: 0, dy: -1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }],
    effects: { attackBonus: 0.30, defenseBonus: 0, moveBonus: 1 },
    reqTerrain: ['plain', 'hill'], forbidTerrain: ['forest'],
    desc: '攻击+30%，移动+1',
  },
  {
    id: 'heyi', name: '鹤翼阵', type: 'balanced',
    reqTypes: { archer: 1 },
    // 两翼在前展开，中军在后
    shape: [{ dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: 0, dy: 0 }],
    // rangeBonus 在 tacticalBattleEngine.applyFormationBuffs 中仅叠加给 archer 武器类型
    effects: { attackBonus: 0.20, defenseBonus: 0.10, rangeBonus: 1 },
    reqTerrain: ['plain', 'hill'], forbidTerrain: [],
    desc: '攻击+20%，防御+10%，弓兵射程+1',
  },
  {
    id: 'yulin', name: '鱼鳞阵', type: 'defensive',
    reqTypes: { infantry: 2 },
    // 前排盾墙，后排两翼护卫
    shape: [{ dx: 0, dy: -1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }],
    effects: { attackBonus: 0, defenseBonus: 0.30, moveBonus: -1 },
    reqTerrain: ['plain', 'hill', 'forest'], forbidTerrain: [],
    desc: '防御+30%，移动-1',
  },
];

// ── 阵型检查 ──────────────────────────────────────────────────────────────────

/**
 * 检查一组部队能否组成某个阵型
 * @param {Object} formation - 阵型定义
 * @param {Object[]} troops - 部队列表
 * @param {string[][]|null} terrain - 地形二维数组
 * @returns {{ ok: boolean, reason?: string }}
 */
export function checkFormation(formation, troops, terrain) {
  // 兵种检查
  if (formation.reqTypes) {
    for (const [type, count] of Object.entries(formation.reqTypes)) {
      const have = troops.filter(t => {
        const wt = t.weaponType || '';
        const troopType = t.troopType || wt.split('_')[0] || '';
        return troopType === type;
      }).length;
      if (have < count) return { ok: false, reason: `需要${count}支${type}` };
    }
  }
  // 地形检查（部署区地形）
  if (terrain && formation.forbidTerrain.length > 0) {
    for (const t of troops) {
      const tile = terrain[t.y]?.[t.x];
      if (tile && formation.forbidTerrain.includes(tile))
        return { ok: false, reason: `禁止地形:${tile}` };
    }
  }
  return { ok: true };
}

// ── 自动选择最优阵型 ──────────────────────────────────────────────────────────

/**
 * 从我方存活部队中自动选择最优阵型
 * @param {Object[]} battleTroops - 全部战场部队
 * @param {string[][]|null} terrain - 地形二维数组
 * @returns {Object|null} 选中的阵型定义，或 null
 */
export function autoSelectFormation(battleTroops, terrain) {
  const playerTroops = battleTroops.filter(t => t.faction === 'player' && t.currentTroops > 0);
  if (playerTroops.length < 3) return null;
  // 按优先级：进攻>平衡>防御；同档内优先「禁止地形」更少的阵型（部署区更不易踩雷），再按 id 稳定排序
  const priority = ['offensive', 'balanced', 'defensive'];
  for (const pType of priority) {
    const okList = FORMATIONS.filter((f) => f.type === pType).filter(
      (f) => checkFormation(f, playerTroops, terrain).ok,
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
