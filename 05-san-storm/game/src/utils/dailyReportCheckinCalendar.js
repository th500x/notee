/**
 * 真三日报 · 28 日签到日历状态（与 backend/config/dailyReportCheckin.js 首版规则一致）
 */

export const CHECKIN_CYCLE_MAX = 28;
const DEFAULT_SILVER = 50;

/**
 * @param {number} cycleDay 1..28
 * @returns {{ silver: number, food: number }}
 */
export function resolveCheckinReward(cycleDay) {
  void cycleDay;
  return { silver: DEFAULT_SILVER, food: 0 };
}

/** @param {{ silver?: number, food?: number }|null|undefined} reward */
export function formatCheckinRewardShort(reward) {
  if (!reward) return '—';
  if (reward.silver > 0) return `${reward.silver}银`;
  if (reward.food > 0) return `${reward.food}粮`;
  return '—';
}

/**
 * @param {{ cycleDay?: number, cycleMax?: number, canCheckIn?: boolean, checkedInToday?: boolean }|null|undefined} checkIn
 * @returns {Array<{ day: number, reward: object, isChecked: boolean, isTodayClaimable: boolean }>}
 */
export function buildCheckinCalendarDays(checkIn) {
  const max = checkIn?.cycleMax ?? CHECKIN_CYCLE_MAX;
  const nextDay = Math.max(1, Math.min(max, Number(checkIn?.cycleDay) || 1));
  const checkedInToday = !!checkIn?.checkedInToday;
  const canCheckIn = !!checkIn?.canCheckIn;

  /** @type {Set<number>} */
  const checked = new Set();
  if (nextDay > 1) {
    for (let d = 1; d < nextDay; d += 1) checked.add(d);
  }
  if (checkedInToday) {
    if (nextDay === 1) checked.add(max);
    else checked.add(nextDay - 1);
  }

  return Array.from({ length: max }, (_, i) => {
    const day = i + 1;
    return {
      day,
      reward: resolveCheckinReward(day),
      isChecked: checked.has(day),
      isTodayClaimable: canCheckIn && day === nextDay,
    };
  });
}
