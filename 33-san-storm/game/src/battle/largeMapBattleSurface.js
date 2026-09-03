/**
 * 大型图格网表面。
 *
 * 与小型地图统一后，每格 `.largemap-tile` 根节点同时承担引擎宿主，
 * 属性 `data-battle-y / data-battle-x` 直接写在格子根节点上（不再嵌套子 div）。
 *
 * @param {React.MutableRefObject<HTMLElement | null>} mapShellRef
 */
export function createLargeMapBattleSurface(mapShellRef) {
  return {
    getTileEl(y, x) {
      const root = mapShellRef?.current;
      if (!root) return null;
      return root.querySelector(`.largemap-tile[data-battle-y="${y}"][data-battle-x="${x}"]`);
    },
    getSurfaceRoot() {
      return mapShellRef?.current ?? null;
    },
  };
}
