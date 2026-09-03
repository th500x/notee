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

/** @param {string|null|undefined} pendingKey */
export function readPendingEventFromStorage(pendingKey) {
  if (!pendingKey) return null;
  try {
    const raw = localStorage.getItem(pendingKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * 惩罚战续接：从 pending / localStorage / 配置目录还原事件壳。
 * @param {Array<object>|null|undefined} allExploreEvents
 * @param {ReturnType<typeof parseExplorePunishBattleLock>} lock
 * @param {object|null|undefined} pendingEvent
 * @param {string|null|undefined} pendingKey
 */
export function resolveExploreEventForPunishLock(allExploreEvents, lock, pendingEvent, pendingKey) {
  if (!lock?.eventId) return null;
  const lockEventId = String(lock.eventId);

  if (pendingEvent?.event_id === lockEventId) return pendingEvent;

  const fromLs = readPendingEventFromStorage(pendingKey);
  if (fromLs?.event_id === lockEventId) return fromLs;

  const template = Array.isArray(allExploreEvents)
    ? allExploreEvents.find((e) => e?.event_id === lockEventId)
    : null;
  if (!template) return null;

  return {
    ...template,
    explore_anchor_city_id: fromLs?.explore_anchor_city_id ?? null,
    explore_subsidiary_kind: fromLs?.explore_subsidiary_kind ?? null,
    _exploreQuotaConsumed: fromLs?._exploreQuotaConsumed ?? true,
  };
}

/** @param {string|null|undefined} message */
export function isExplorePunishBattleNoticeMessage(message) {
  const t = String(message || '').trim();
  if (!t) return false;
  return t.includes('惩罚战');
}
