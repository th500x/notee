import { createContext, useContext } from 'react';

/** 无 Provider 时占位，勿写入 */
const defaultReplayBlockingRef = { current: false };

const defaultValue = {
  roadDefenseAlert: false,
  roadAwaitingAuthoritativeOutcome: false,
  roadAuthoritativeOutcomeModal: false,
  /** 守方权威裁定：全屏 `PvpAutoDuelReplay` 与攻方「战场演示」同壳，供退让提示等阻塞判断 */
  roadDefenseAuthoritativeReplayOpen: false,
  roadDefenseOutcomeReplayBlockingRef: defaultReplayBlockingRef,
};

export const RoadDefenseFrictionContext = createContext(defaultValue);

export function useRoadDefenseFriction() {
  return useContext(RoadDefenseFrictionContext);
}
