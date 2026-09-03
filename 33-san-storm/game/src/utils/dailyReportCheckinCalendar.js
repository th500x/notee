/**
 * 真三日报 · 28 日签到日历状态（奖励来自 API checkIn.rewardsByDay）
 */

export const CHECKIN_CYCLE_MAX = 28;

/** @param {{ displayShort?: string, rewards?: string }|null|undefined} reward */
export function formatCheckinRewardShort(reward) {
  if (!reward) return '—';
  if (reward.displayShort) return reward.displayShort;
  return '—';
}

/**
 * @param {{ cycleDay?: number, cycleMax?: number, canCheckIn?: boolean, checkedInToday?: boolean, rewardsByDay?: Array<{ cycleDay: number, displayShort?: string, rewards?: string, label?: string|null }> }|null|undefined} checkIn
 * @returns {Array<{ day: number, reward: object, isChecked: boolean, isTodayClaimable: boolean, label: string|null }>}
 */
export function buildCheckinCalendarDays(checkIn) {
  const max = checkIn?.cycleMax ?? CHECKIN_CYCLE_MAX;
  const nextDay = Math.max(1, Math.min(max, Number(checkIn?.cycleDay) || 1));
  const checkedInToday = !!checkIn?.checkedInToday;
  const canCheckIn = !!checkIn?.canCheckIn;
  const byDay = Array.isArray(checkIn?.rewardsByDay) ? checkIn.rewardsByDay : [];

  /** @type {Set<number>} */
  const checked = new Set();
  if (nextDay > 1) {
    for (let d = 1; d < nextDay; d += 1) checked.add(d);
  }
  if (checkedInToday) {
    if (nextDay === 1) checked.add(max);
    else checked.add(nextDay - 1);
  }

  const factionBonusDisplayShort =
    checkIn?.factionBonus?.displayShort ||
    byDay.find((r) => r?.factionBonusDisplayShort)?.factionBonusDisplayShort ||
    null;

  return Array.from({ length: max }, (_, i) => {
    const day = i + 1;
    const row = byDay.find((r) => Number(r.cycleDay) === day);
    return {
      day,
      reward: {
        displayShort: row?.displayShort ?? '—',
        rewards: row?.rewards ?? null,
      },
      factionBonusDisplayShort: row?.factionBonusDisplayShort || factionBonusDisplayShort,
      label: row?.label ?? null,
      isChecked: checked.has(day),
      isTodayClaimable: canCheckIn && day === nextDay,
    };
  });
}
