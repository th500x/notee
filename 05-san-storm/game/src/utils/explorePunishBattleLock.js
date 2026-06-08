/**
 * 探索惩罚战会话锁 · 前端辅助（算法见 shared/utils/explorePunishBattleSessionLock.js）
 */
import { FORTUNE_LEVELS } from '@/components/event/EventConstants';
import {
  parseExplorePunishBattleLock,
  buildExplorePunishBattleLock,
  isPendingPunishRewardRequest,
} from '@shared/utils/explorePunishBattleSessionLock.js';

export {
  parseExplorePunishBattleLock,
  buildExplorePunishBattleLock,
  isPendingPunishRewardRequest,
};

/** @param {import('@shared/utils/explorePunishBattleSessionLock.js').parseExplorePunishBattleLock extends (x: infer _) => infer R ? R : never} lock */
export function fortuneUiFromPunishBattleLock(lock) {
  const lf = lock?.lockedFortune;
  if (!lf) return null;
  const level = FORTUNE_LEVELS.find((f) => f.name === lf.name) || FORTUNE_LEVELS[2];
  return {
    name: level.name,
    emoji: level.emoji,
    color: level.color,
    multiplier: lf.multiplier,
    dice: lf.dice,
    diceMultiplier: lf.diceMultiplier,
    baseScore: lf.baseScore,
    finalRate: lf.finalRate,
  };
}

/** @param {object} event @param {ReturnType<typeof parseExplorePunishBattleLock>} lock */
export function chosenOptionFromPunishLock(event, lock) {
  if (!event || !lock) return null;
  return lock.optionKey === 'B' ? event.option_b : event.option_a;
}
