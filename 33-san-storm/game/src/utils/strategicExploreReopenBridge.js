/**
 * 战略格探索：从 `useEventSystem` 写入、`WorldStrategicMapGrid` 在探索 RETURNING→IDLE 后读取，
 * 用于在**整段探索结束**后主动重建战场 portal。
 *
 * 连打续环期间不要登记（否则间隙会先弹回双面板，压住下一环事件 UI）。
 */

export const strategicExploreReopenBridge = {
  lastAnchorCityId: null,
  lastSubsidiaryKind: null,

  clear() {
    this.lastAnchorCityId = null;
    this.lastSubsidiaryKind = null;
  },

  /**
   * @param {string|null|undefined} cityId
   * @param {'wild'|'mini'|'battlefield'|null|undefined} kind
   */
  setPendingReopen(cityId, kind) {
    if (cityId == null || String(cityId).trim() === '') {
      this.clear();
      return;
    }
    const k = kind != null ? String(kind) : '';
    const ok = new Set(['wild', 'mini', 'battlefield']);
    if (!ok.has(k)) {
      this.clear();
      return;
    }
    this.lastAnchorCityId = String(cityId);
    this.lastSubsidiaryKind = k;
  },
};
