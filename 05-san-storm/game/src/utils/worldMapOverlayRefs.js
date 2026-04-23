/**
 * 供 `RoadEncounterDefenseRoot`（GamePage 常驻）读取 `WorldMap` 内的互斥状态，
 * 避免「大地图未挂载」或攻城遇袭弹窗打开时仍叠道路遇袭。
 * `worldMapMounted`：子页签卸载 `WorldMap` 后为 false，守方道路遇袭 **不得** 再被 `siegeRoadEncounterId` 等陈旧 ref 误压。
 */
export const worldMapOverlayRefs = {
  /** 仅在为 true 时，`siegeRoadEncounterId` / `pvpDefenseAlertActive` 才用于压制守方道路遇袭（子页签卸载 WorldMap 后勿误用陈旧 ref） */
  worldMapMounted: false,
  pvpDefenseAlertActive: false,
  /** 当前 WorldMap 内道路遭遇 BattleArena 的 encounterId，与遇袭提示去重 */
  siegeRoadEncounterId: null,
};

const gateListeners = new Set();
let gateEpoch = 0;

/** WorldMap 在互斥字段变化后调用，使 Root 立刻重算道路遇袭弹窗是否显示 */
export function notifyWorldMapOverlayGate() {
  gateEpoch += 1;
  gateListeners.forEach((fn) => fn());
}

export function subscribeWorldMapOverlayGate(fn) {
  gateListeners.add(fn);
  return () => gateListeners.delete(fn);
}

export function getWorldMapOverlayGateEpoch() {
  return gateEpoch;
}
