/**
 * Phase 2：恐惧&贪婪、Ahr999、梅耶倍数、BTC四年指数
 */
import { REQUEST_DELAY, delay } from './apiDelay.js'
import { fetchMayerAndFourYear } from './btcDailySeries.js'

const FNG_API = 'https://api.alternative.me/fng/'
const AHR999_API = 'https://ahr999.aix4u.com/datasets/ahr999.json'

function formatDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function datesInRange(startDate, endDate) {
  const keys = []
  const cur = new Date(startDate)
  cur.setHours(12, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(12, 0, 0, 0)
  while (cur <= end) {
    keys.push(formatDateKey(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return keys
}

function fngLimitForWeek(startDate) {
  const daysBack = Math.ceil((Date.now() - startDate.getTime()) / 86400000) + 14
  return Math.min(Math.max(daysBack, 30), 3072)
}

/**
 * @returns {{ weeklyAverage: number, daily: Array<{date:string,value:number}>, source: string }}
 */
export async function fetchFearGreedWeeklyAverage(startDate, endDate) {
  const weekDates = datesInRange(startDate, endDate)
  const limit = fngLimitForWeek(startDate)

  const res = await fetch(`${FNG_API}?limit=${limit}&format=json`)
  if (!res.ok) throw new Error(`FNG API HTTP ${res.status}`)

  const json = await res.json()
  const byDate = {}
  for (const item of json.data || []) {
    const key = new Date(Number(item.timestamp) * 1000).toISOString().slice(0, 10)
    byDate[key] = Number(item.value)
  }

  const daily = weekDates
    .filter((d) => byDate[d] !== undefined)
    .map((d) => ({ date: d, value: byDate[d] }))

  if (daily.length === 0) {
    throw new Error(`FNG 无 ${weekDates[0]}–${weekDates.at(-1)} 数据（limit=${limit}）`)
  }

  const avg = daily.reduce((s, x) => s + x.value, 0) / daily.length
  return {
    weeklyAverage: Math.round(avg),
    daily,
    source: 'alternative.me_fng',
  }
}

/**
 * 按文档取周末（weekEnd）当日 ahr999
 * @returns {{ value: number, date: string, source: string }}
 */
export async function fetchAhr999WeekEnd(endDate) {
  const endKey = formatDateKey(endDate)
  const res = await fetch(AHR999_API)
  if (!res.ok) throw new Error(`Ahr999 API HTTP ${res.status}`)

  const arr = await res.json()
  if (!Array.isArray(arr)) throw new Error('Ahr999 响应格式异常')

  const row = arr.find((x) => x.date === endKey)
  if (!row) throw new Error(`Ahr999 无 ${endKey} 数据`)

  return {
    value: parseFloat(Number(row.ahr999).toFixed(2)),
    date: endKey,
    source: 'ahr999.aix4u.com',
  }
}

/** 顺序拉取，两次请求之间等待 REQUEST_DELAY */
export async function fetchWeekSentiment(startDate, endDate) {
  console.log(`📡 恐惧&贪婪: ${formatDateKey(startDate)} – ${formatDateKey(endDate)}`)
  const fearGreed = await fetchFearGreedWeeklyAverage(startDate, endDate)
  console.log(
    `   ✅ 周均 ${fearGreed.weeklyAverage}（${fearGreed.daily.length} 天: ${fearGreed.daily.map((d) => d.value).join(', ')}）`,
  )

  console.log(`⏳ 等待 ${REQUEST_DELAY / 1000}s 后请求 Ahr999…`)
  await delay(REQUEST_DELAY)

  console.log(`📡 Ahr999 周末值: ${formatDateKey(endDate)}`)
  const ahr999 = await fetchAhr999WeekEnd(endDate)
  console.log(`   ✅ ${ahr999.date} = ${ahr999.value}`)

  console.log(`⏳ 等待 ${REQUEST_DELAY / 1000}s 后计算梅耶倍数 & BTC四年指数…`)
  await delay(REQUEST_DELAY)

  console.log(`📡 梅耶倍数 & BTC四年指数: ${formatDateKey(startDate)} – ${formatDateKey(endDate)}`)
  const { mayer, fourYear, source } = await fetchMayerAndFourYear(startDate, endDate)
  console.log(
    `   ✅ 梅耶 周均 ${mayer.weeklyAverage}（${mayer.daily.map((d) => d.value).join(', ')}）`,
  )
  console.log(
    `   ✅ 四年 周均 ${fourYear.weeklyAverage}（${fourYear.daily.map((d) => d.value).join(', ')}，${source}）`,
  )

  return { fearGreed, ahr999, mayer, fourYear }
}
