/**
 * 探索惩罚战会话锁（`player_events.explore_session_lock` JSON · kind=punish_battle）
 * 凶/大凶首次判定后锁定运势，禁止无 battleResult 的重复 POST /rewards 重掷骰子。
 *
 * 前端 ESM 入口；算法须与 `explorePunishBattleSessionLock.cjs` 一致，改逻辑时请同步两处。
 */

export const EXPLORE_PUNISH_BATTLE_LOCK_KIND = 'punish_battle';

/**
 * @param {unknown} sessionLock
 * @returns {null | { kind: string, eventId: string, optionKey: 'A'|'B', lockedFortune: object }}
 */
export function parseExplorePunishBattleLock(sessionLock) {
  if (!sessionLock || typeof sessionLock !== 'object' || Array.isArray(sessionLock)) return null;
  if (sessionLock.kind !== EXPLORE_PUNISH_BATTLE_LOCK_KIND) return null;
  const eventId = sessionLock.eventId != null ? String(sessionLock.eventId).trim() : '';
  const optionKey = sessionLock.optionKey === 'A' || sessionLock.optionKey === 'B' ? sessionLock.optionKey : '';
  const lf = sessionLock.lockedFortune;
  if (!eventId || !optionKey || !lf || typeof lf !== 'object') return null;
  const name = lf.name != null ? String(lf.name).trim() : '';
  if (!name) return null;
  return {
    kind: EXPLORE_PUNISH_BATTLE_LOCK_KIND,
    eventId,
    optionKey,
    lockedFortune: {
      name,
      multiplier: Number(lf.multiplier) || 1,
      dice: Number.isFinite(Number(lf.dice)) ? Number(lf.dice) : 4,
      diceMultiplier: lf.diceMultiplier != null ? Number(lf.diceMultiplier) : undefined,
      baseScore: lf.baseScore != null ? Number(lf.baseScore) : undefined,
      finalRate: lf.finalRate != null ? Number(lf.finalRate) : undefined,
    },
  };
}

/**
 * @param {{ eventId: string, optionKey: 'A'|'B', lockedFortune: object }} params
 */
export function buildExplorePunishBattleLock({ eventId, optionKey, lockedFortune }) {
  const lf = lockedFortune || {};
  return {
    kind: EXPLORE_PUNISH_BATTLE_LOCK_KIND,
    eventId: String(eventId),
    optionKey,
    lockedFortune: {
      name: lf.fortuneName || lf.name,
      multiplier: lf.multiplier,
      dice: lf.dice,
      diceMultiplier: lf.diceMultiplier,
      baseScore: lf.baseScore,
      finalRate: lf.finalRate,
    },
  };
}

/**
 * @param {ReturnType<typeof parseExplorePunishBattleLock>} lock
 * @param {string} eventId
 * @param {string} optionKey
 * @param {string|undefined} battleResult
 */
export function isPendingPunishRewardRequest(lock, eventId, optionKey, battleResult) {
  if (!lock || battleResult) return false;
  return lock.eventId === String(eventId) && lock.optionKey === optionKey;
}

/** API lockedFortune → rewardService 内部 fortune 形 */
export function lockedFortuneToInternal(lockedFortune) {
  return {
    fortuneName: lockedFortune.name,
    multiplier: lockedFortune.multiplier,
    dice: lockedFortune.dice,
    diceMultiplier: lockedFortune.diceMultiplier,
    baseScore: lockedFortune.baseScore,
    finalRate: lockedFortune.finalRate,
  };
}

export function fortuneToApiPayload(fortune) {
  return {
    name: fortune.fortuneName || fortune.name,
    multiplier: fortune.multiplier,
    dice: fortune.dice,
    diceMultiplier: fortune.diceMultiplier,
    baseScore: fortune.baseScore,
    finalRate: fortune.finalRate,
  };
}
