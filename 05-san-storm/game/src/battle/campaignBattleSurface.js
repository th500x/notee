/**
 * 战役整图格网表面。
 *
 * 与小型地图统一后，每格 `.campaign-tile` 根节点同时承担引擎宿主，
 * 属性 `data-battle-y / data-battle-x` 直接写在格子根节点上（不再嵌套子 div）。
 *
 * @param {React.MutableRefObject<HTMLElement | null>} campaignShellRef
 */
export function createCampaignBattleSurface(campaignShellRef) {
  return {
    getTileEl(y, x) {
      const root = campaignShellRef?.current;
      if (!root) return null;
      return root.querySelector(`.campaign-tile[data-battle-y="${y}"][data-battle-x="${x}"]`);
    },
    getSurfaceRoot() {
      return campaignShellRef?.current ?? null;
    },
  };
}
