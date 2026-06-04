/**
 * PvP 战术对决 · canonical ↔ 观战者视角变换（纯函数，无 React/DOM）
 *
 * canonical 空间（与 `runPvpTacticalDuel` 一致）：side `a` 部署在北带（`ZONE.deployA`，行号小），
 * side `b` 在南带（`ZONE.deployB`，行号大）。观战者习惯「己方在南（便利半场）」：
 *   - viewerSide === 'a' → 纵向翻转（己方从北镜像到南）
 *   - viewerSide === 'b' 或 null（旁观/admin）→ 恒等（直接用 canonical）
 *
 * 仅依赖 mapResult.terrain 的维度，**不** import 别名模块，便于 Node 单测。
 *
 * @see docs/10-core-system/17-5-DUEL_SYSTEM.md §12.4
 */

/**
 * 纵向翻转一张 mapResult（terrain / cellFire 行倒序，objects.y 镜像）。
 * @param {object} mapResult
 * @param {number} [h] 行数（缺省取 terrain.length）
 */
export function flipMapResultVertical(mapResult, h) {
  if (!mapResult || !Array.isArray(mapResult.terrain)) return mapResult;
  const H = h ?? mapResult.terrain.length;
  const terrain = [...mapResult.terrain].reverse().map((row) => [...row]);
  const cellFire = Array.isArray(mapResult.cellFire)
    ? [...mapResult.cellFire].reverse().map((row) => [...row])
    : mapResult.cellFire;
  const objects = Array.isArray(mapResult.objects)
    ? mapResult.objects.map((o) => ({ ...o, y: H - 1 - o.y }))
    : mapResult.objects;
  return { ...mapResult, terrain, cellFire, objects };
}

/**
 * 构建视角变换器。
 * @param {'a'|'b'|null} viewerSide 观战者 canonical side（来自 `GET /:id` 的 view.selfSide）
 * @param {object} mapResult canonical 地图（buildDuelMapFromPreset 输出）
 * @returns {{
 *   viewerSide: 'a'|'b'|null, flip: boolean, h: number, w: number,
 *   coord: (y:number, x:number) => {y:number, x:number},
 *   faction: (side:'a'|'b') => 'player'|'enemy',
 *   mapResult: object,
 * }}
 */
export function makeCanonicalView(viewerSide, mapResult) {
  const h = Array.isArray(mapResult?.terrain) ? mapResult.terrain.length : 0;
  const w = h && Array.isArray(mapResult.terrain[0]) ? mapResult.terrain[0].length : 0;
  const side = viewerSide === 'a' || viewerSide === 'b' ? viewerSide : null;
  const flip = side === 'a';
  const coord = (y, x) => (flip ? { y: h - 1 - y, x } : { y, x });
  const faction = (s) => {
    if (side) return s === side ? 'player' : 'enemy';
    return s === 'a' ? 'player' : 'enemy';
  };
  return {
    viewerSide: side,
    flip,
    h,
    w,
    coord,
    faction,
    mapResult: flip ? flipMapResultVertical(mapResult, h) : mapResult,
  };
}

export default makeCanonicalView;
