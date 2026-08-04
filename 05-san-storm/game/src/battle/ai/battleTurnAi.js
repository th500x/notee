/**
 * 回合制战斗 AI（敌方移动/目标选择、自动战斗决策）
 *
 * 核心实现位于 `systems/battleFlowManager.js`（findBestMoveTarget 等）。
 * 此处作为统一入口，供事件/攻城/章节等战斗壳层按需引用，避免与地图 UI 文件混杂。
 */
export { findBestMoveTarget, dist, getMoveCost, isOccupied, troopAttackRange, hasFireAt, hasUnopenedChestAt } from '@/systems/battleFlowManager';
