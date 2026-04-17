/**
 * 战略格荒郊/集市：从 `useEventSystem` 写入、`WorldStrategicMapGrid` 在探索 RETURNING→IDLE 后读取，
 * 用于在结算/动画后主动重建城池 portal（不依赖抑制 click/mouseleave，避免环境差异仍关层）。
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
   * @param {'wilderness'|'market'|null|undefined} kind
   */
  setPendingReopen(cityId, kind) {
    if (cityId == null || String(cityId).trim() === '') {
      this.clear();
      return;
    }
    const k = kind != null ? String(kind) : '';
    if (k !== 'wilderness' && k !== 'market') {
      this.clear();
      return;
    }
    this.lastAnchorCityId = String(cityId);
    this.lastSubsidiaryKind = k;
  },
};
