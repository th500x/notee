/**
 * 个人评级分档与配色（全站统一）
 *
 * | 总分范围      | 档位           | 文字色 Tailwind   | 日历点 CSS 修饰符      |
 * | +10 ~ +16    | 极度看多       | text-green-800   | extreme-bullish       |
 * | +4 ~ +9      | 看多           | text-green-400   | bullish（淡绿）       |
 * | -3 ~ +3      | 中性           | text-gray-900    | neutral               |
 * | -9 ~ -4      | 看空           | text-red-400     | bearish（淡红）       |
 * | -16 ~ -10    | 极度看空       | text-red-800     | extreme-bearish       |
 */
import { RATING_LEVELS } from '../constants'

export const RATING_TIERS = {
  EXTREME_BULLISH: 'extreme-bullish',
  BULLISH: 'bullish',
  NEUTRAL: 'neutral',
  BEARISH: 'bearish',
  EXTREME_BEARISH: 'extreme-bearish',
}

const TIER_TEXT_CLASS = {
  [RATING_TIERS.EXTREME_BULLISH]: 'text-green-800',
  [RATING_TIERS.BULLISH]: 'text-green-400',
  [RATING_TIERS.NEUTRAL]: 'text-gray-900',
  [RATING_TIERS.BEARISH]: 'text-red-400',
  [RATING_TIERS.EXTREME_BEARISH]: 'text-red-800',
}

const TIER_LABEL = {
  [RATING_TIERS.EXTREME_BULLISH]: '极度看多',
  [RATING_TIERS.BULLISH]: '看多',
  [RATING_TIERS.NEUTRAL]: '中性',
  [RATING_TIERS.BEARISH]: '看空',
  [RATING_TIERS.EXTREME_BEARISH]: '极度看空',
}

/** @returns {string|null} CSS 修饰符，供 week-indicator--* 使用 */
export function getRatingTier(rating) {
  if (rating === null || rating === undefined || Number.isNaN(rating)) return null
  if (rating >= RATING_LEVELS.EXTREME_BULLISH) return RATING_TIERS.EXTREME_BULLISH
  if (rating >= RATING_LEVELS.BULLISH) return RATING_TIERS.BULLISH
  if (rating >= RATING_LEVELS.NEUTRAL_LOW) return RATING_TIERS.NEUTRAL
  if (rating >= RATING_LEVELS.BEARISH) return RATING_TIERS.BEARISH
  return RATING_TIERS.EXTREME_BEARISH
}

export function getRatingLabel(rating) {
  const tier = getRatingTier(rating)
  return tier ? TIER_LABEL[tier] : '暂无评级'
}

export function getRatingTextClass(rating) {
  const tier = getRatingTier(rating)
  return tier ? TIER_TEXT_CLASS[tier] : 'text-gray-500'
}

/** 模拟演练 BUY / SELL 方向色（随评级深浅） */
export function getTradeDirectionTextClass(direction, rating) {
  if (direction === 'BUY') {
    return rating >= RATING_LEVELS.EXTREME_BULLISH
      ? TIER_TEXT_CLASS[RATING_TIERS.EXTREME_BULLISH]
      : TIER_TEXT_CLASS[RATING_TIERS.BULLISH]
  }
  if (direction === 'SELL') {
    return rating <= RATING_LEVELS.EXTREME_BEARISH
      ? TIER_TEXT_CLASS[RATING_TIERS.EXTREME_BEARISH]
      : TIER_TEXT_CLASS[RATING_TIERS.BEARISH]
  }
  return 'text-gray-500'
}
