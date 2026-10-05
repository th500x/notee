/**
 * 已结束周是否采齐（缺任一项 → 未完成，整轮应失败以触发 2h 重试）
 */
import { weekNeedsPriceCollection } from './weekSchedule.js'

export const REQUIRED_WEEK_FIELDS = [
  'btcWeeklyAvgPrice',
  'ethWeeklyAvgPrice',
  'btcWeeklyChange',
  'ethBtcRatio',
  'fearGreedIndex',
  'mayerMultiple',
  'ahr999',
  'btcFourYearIndex',
  'fedRate',
  'bojRate',
  'personalRating',
]

export function listMissingRequiredFields(record) {
  if (!record) return [...REQUIRED_WEEK_FIELDS]
  return REQUIRED_WEEK_FIELDS.filter((field) => typeof record[field] !== 'number')
}

export function weekIsIncomplete(record, week) {
  if (!record) return true
  if (week && weekNeedsPriceCollection(record, week)) return true
  return listMissingRequiredFields(record).length > 0
}
