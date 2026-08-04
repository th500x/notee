/**
 * BTC 日 K 序列（Binance 优先，CoinGecko 备选）
 * Mayer(200日) 与四年指数(1460日) 共用
 */
import { REQUEST_DELAY, delay } from './apiDelay.js'

export const MA_WINDOW_MAYER = 200
export const MA_WINDOW_FOUR_YEAR = 1460

const BINANCE_KLINES = 'https://api.binance.com/api/v3/klines'
const COINGECKO_RANGE = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range'
const LOOKBACK_BUFFER_DAYS = 14

function formatDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function datesInRange(startDate, endDate) {
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

async function fetchBinanceChunk(startMs, endMs) {
  const url =
    `${BINANCE_KLINES}?symbol=BTCUSDT&interval=1d` +
    `&startTime=${startMs}&endTime=${endMs}&limit=1000`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`)
  const rows = await res.json()
  if (!Array.isArray(rows)) throw new Error('Binance 响应异常')
  return rows.map((k) => ({
    date: new Date(k[0]).toISOString().slice(0, 10),
    close: parseFloat(k[4]),
  }))
}

/** 分页拉取 Binance 日 K，去重后按日期升序 */
async function fetchBinanceDailySeries(startDate, endDate, lookbackDays) {
  const fetchStart = new Date(startDate)
  fetchStart.setDate(fetchStart.getDate() - lookbackDays - LOOKBACK_BUFFER_DAYS)
  const fetchEnd = new Date(endDate)
  fetchEnd.setDate(fetchEnd.getDate() + 1)

  let cur = fetchStart.getTime()
  const endMs = fetchEnd.getTime()
  const byDate = {}

  while (cur < endMs) {
    const chunk = await fetchBinanceChunk(cur, endMs)
    if (!chunk.length) break
    for (const row of chunk) {
      byDate[row.date] = row.close
    }
    const lastMs = new Date(chunk.at(-1).date).getTime() + 86400000
    if (chunk.length < 1000 || lastMs <= cur) break
    cur = lastMs
  }

  const dates = Object.keys(byDate).sort()
  if (dates.length === 0) throw new Error('Binance 返回空数据')
  return {
    dates,
    closes: dates.map((d) => byDate[d]),
    byDate,
  }
}

function pricesToDailySeries(prices) {
  const byDate = {}
  for (const [ts, p] of prices) {
    const d = new Date(ts).toISOString().slice(0, 10)
    byDate[d] = p
  }
  const dates = Object.keys(byDate).sort()
  return { dates, closes: dates.map((d) => byDate[d]), byDate }
}

async function fetchCoinGeckoDailySeries(startDate, endDate, lookbackDays) {
  const fetchStart = new Date(startDate)
  fetchStart.setDate(fetchStart.getDate() - lookbackDays - LOOKBACK_BUFFER_DAYS)
  const fetchEnd = new Date(endDate)
  fetchEnd.setDate(fetchEnd.getDate() + 1)
  const from = Math.floor(fetchStart.getTime() / 1000)
  const to = Math.floor(fetchEnd.getTime() / 1000)
  const res = await fetch(`${COINGECKO_RANGE}?vs_currency=usd&from=${from}&to=${to}`)
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error.status?.error_message || 'CoinGecko 错误')
  if (!json.prices?.length) throw new Error('CoinGecko 无价格数据')
  return pricesToDailySeries(json.prices)
}

/**
 * @returns {{ dates, closes, byDate, source: string }}
 */
export async function fetchBtcDailySeries(startDate, endDate, lookbackDays = MA_WINDOW_FOUR_YEAR) {
  try {
    const series = await fetchBinanceDailySeries(startDate, endDate, lookbackDays)
    return { ...series, source: 'binance_btcusdt' }
  } catch (err) {
    console.log(`   ⚠️ Binance 失败 (${err.message})，等待 ${REQUEST_DELAY / 1000}s 后改用 CoinGecko…`)
    await delay(REQUEST_DELAY)
    const series = await fetchCoinGeckoDailySeries(startDate, endDate, lookbackDays)
    return { ...series, source: 'coingecko_market_chart_range' }
  }
}

/** 收盘价 ÷ N 日 SMA，写入字段取周均 */
export function computePriceMaRatioWeek(series, startDate, endDate, windowDays) {
  const { dates, closes, byDate } = series
  const weekDates = datesInRange(startDate, endDate)
  const daily = []

  for (const date of weekDates) {
    const idx = dates.indexOf(date)
    if (idx < windowDays - 1) continue
    const ma =
      closes.slice(idx - windowDays + 1, idx + 1).reduce((a, b) => a + b, 0) / windowDays
    const close = byDate[date]
    daily.push({
      date,
      close,
      ma,
      value: parseFloat((close / ma).toFixed(2)),
    })
  }

  if (daily.length === 0) {
    throw new Error(`${windowDays} 日 SMA 历史不足，无法计算该周`)
  }

  const endKey = formatDateKey(endDate)
  const weekEndRow = daily.find((d) => d.date === endKey) || daily.at(-1)
  const weeklyAverage = parseFloat((daily.reduce((s, x) => s + x.value, 0) / daily.length).toFixed(2))

  return {
    weeklyAverage,
    weekEndValue: weekEndRow.value,
    weekEndDate: weekEndRow.date,
    windowDays,
    daily: daily.map(({ date, value, close, ma }) => ({
      date,
      value,
      close: parseFloat(close.toFixed(2)),
      ma: parseFloat(ma.toFixed(2)),
    })),
  }
}

/**
 * 一次拉取日 K，计算 Mayer + 四年指数
 */
export async function fetchMayerAndFourYear(startDate, endDate) {
  const series = await fetchBtcDailySeries(startDate, endDate, MA_WINDOW_FOUR_YEAR)
  const mayer = computePriceMaRatioWeek(series, startDate, endDate, MA_WINDOW_MAYER)
  const fourYear = computePriceMaRatioWeek(series, startDate, endDate, MA_WINDOW_FOUR_YEAR)
  return {
    source: series.source,
    mayer: { ...mayer, source: series.source },
    fourYear: { ...fourYear, source: series.source },
  }
}
