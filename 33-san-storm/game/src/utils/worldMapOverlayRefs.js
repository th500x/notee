/**
 * `WorldMap` 对外暴露的少量命令式入口。
 *
 * 原用于与守方道路遇袭弹窗互斥（`worldMapMounted` / `pvpDefenseAlertActive` /
 * `siegeRoadEncounterId` + gate 订阅），道路遭遇战归档后已无消费方，仅留提示入队。
 */
export const worldMapOverlayRefs = {
  /** 由 `WorldMap` 注册：战败/退让提示入队（结算关闭后显式入队，不依赖轮询竞态） */
  enqueueRoadGateNotice: null,
};
