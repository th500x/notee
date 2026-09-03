/**
 * 战术格兵力血槽：每 100 兵力一格；满格 / 过半淡红 / 耗尽留空格（不消失）。
 * 布局上最多约 4 格占满瓦片宽度（见 BattleMap.css）。
 */

export const TROOP_HP_BLOCK_SIZE = 100;
/** 格内剩余 ≥ 此值仍算「满格」色；低于则为淡红（消耗过半） */
export const TROOP_HP_BLOCK_HALF = 50;

/**
 * @param {number} currentTroops
 * @param {number} maxTroops
 * @returns {Array<'full'|'low'|'empty'>}
 */
export function buildTroopHpBlockStates(currentTroops, maxTroops) {
  const max = Math.max(0, Number(maxTroops) || 0);
  const cur = Math.max(0, Number(currentTroops) || 0);
  const total = Math.ceil(max / TROOP_HP_BLOCK_SIZE);
  /** @type {Array<'full'|'low'|'empty'>} */
  const states = [];
  for (let b = 0; b < total; b++) {
    const lo = b * TROOP_HP_BLOCK_SIZE;
    // 末格可能不足 100（如 max=220 → 第三格容量 20），过半按该格容量算
    const hi = Math.min(lo + TROOP_HP_BLOCK_SIZE, max);
    const capacity = Math.max(1, hi - lo);
    if (cur >= hi) states.push('full');
    else if (cur <= lo) states.push('empty');
    else {
      const rem = cur - lo;
      const half = capacity >= TROOP_HP_BLOCK_SIZE ? TROOP_HP_BLOCK_HALF : capacity / 2;
      states.push(rem >= half ? 'full' : 'low');
    }
  }
  return states;
}

/**
 * DOM 用 class 列表（含阵营 full-* / 统一 low / empty）
 * @param {string} factionClass player|enemy|ally1|ally2
 */
export function troopHpBlockClassNames(states, factionClass) {
  return states.map((st) => {
    if (st === 'full') return `troop-hp-block full-${factionClass}`;
    if (st === 'low') return 'troop-hp-block low';
    return 'troop-hp-block empty';
  });
}

/** 顶栏血槽 HTML（不再使用右侧溢出列） */
export function troopHpTopHtml(currentTroops, maxTroops, factionClass) {
  const classes = troopHpBlockClassNames(
    buildTroopHpBlockStates(currentTroops, maxTroops),
    factionClass,
  );
  const inner = classes.map((c) => `<div class="${c}"></div>`).join('');
  return `<div class="troop-hp-top">${inner}</div>`;
}
