/**
 * 美联储 / 日央行政策利率 — 周结束日当天的生效值，每次采集联网读官方时间序列
 * Fed: FRED DFEDTARL（目标区间下限，与历史周 fedRate 字段一致）
 * BOJ: 日本银行时间序列 API。官方没有「政策利率」序列，取基准贷款利率 IR01/MADR1Z@D 减 0.25
 *      （2024-08 起央行每次调息都把基准贷款利率定在政策利率 +0.25），
 *      再用无担保隔夜拆借利率 FM01/STRDCLUCON 核对，对不上就报错，不写入
 * 官方序列有 1～2 天发布延迟：数据没覆盖到周结束日时标记 provisional，collect-missing 下次重取
 */

const FRED_FED_LOWER_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFEDTARL'
const BOJ_API_URL = 'https://www.stat-search.boj.or.jp/api/v1/getDataCode'

const BOJ_LOAN_SPREAD = 0.25
/** 拆借利率实测比政策利率低 1～3 个基点；超出此区间视为利差变了，须人工核对 */
const BOJ_CALL_MIN_DIFF = -0.04
const BOJ_CALL_MAX_DIFF = 0.01
const BOJ_LOOKBACK_DAYS = 45
const DAY_MS = 86400000

export function formatYmd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatYm(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`
}

function round2(value) {
  return Math.round(value * 100) / 100
}

/** series 按日期升序，元素 { date: 'YYYY-MM-DD', value } */
function lastObservationOnOrBefore(series, ymd) {
  let last = null
  for (const row of series) {
    if (row.date > ymd) break
    last = row
  }
  return last
}

let fedSeriesCache = null

async function loadFedSeries() {
  if (fedSeriesCache) return fedSeriesCache

  const response = await fetch(FRED_FED_LOWER_URL)
  if (!response.ok) {
    throw new Error(`FRED DFEDTARL HTTP ${response.status}`)
  }

  const text = await response.text()
  const rows = text
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const [date, value] = line.split(',')
      return { date, value: parseFloat(value) }
    })
    .filter((r) => r.date && !Number.isNaN(r.value))

  fedSeriesCache = rows
  return rows
}

export async function fetchFedRateAsOf(weekEnd) {
  const end = formatYmd(weekEnd)
  const obs = lastObservationOnOrBefore(await loadFedSeries(), end)
  if (!obs) {
    throw new Error(`FRED 无 ${end} 及之前的联邦基金目标区间下限`)
  }
  return { rate: round2(obs.value), asOf: obs.date }
}

async function loadBojDailySeries(db, code, fromDate, toDate) {
  const url =
    `${BOJ_API_URL}?format=json&lang=en&db=${db}&code=${encodeURIComponent(code)}` +
    `&startDate=${formatYm(fromDate)}&endDate=${formatYm(toDate)}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`BOJ ${db}/${code} HTTP ${response.status}`)
  }

  const json = await response.json()
  if (json.STATUS !== 200) {
    throw new Error(`BOJ ${db}/${code} ${json.MESSAGEID} ${json.MESSAGE}`)
  }
  if (json.NEXTPOSITION) {
    throw new Error(`BOJ ${db}/${code} 返回被截断（NEXTPOSITION=${json.NEXTPOSITION}）`)
  }

  const values = json.RESULTSET?.[0]?.VALUES
  if (!values || !Array.isArray(values.SURVEY_DATES) || !Array.isArray(values.VALUES)) {
    throw new Error(`BOJ ${db}/${code} 返回结构异常`)
  }

  const rows = []
  values.SURVEY_DATES.forEach((raw, i) => {
    const value = values.VALUES[i]
    if (value === null || value === undefined || value === '') return
    const s = String(raw)
    rows.push({ date: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`, value: Number(value) })
  })
  return rows
}

export async function fetchBojPolicyRateAsOf(weekEnd) {
  const end = formatYmd(weekEnd)
  const from = new Date(weekEnd.getTime() - BOJ_LOOKBACK_DAYS * DAY_MS)
  const [loanSeries, callSeries] = await Promise.all([
    loadBojDailySeries('IR01', 'MADR1Z@D', from, weekEnd),
    loadBojDailySeries('FM01', 'STRDCLUCON', from, weekEnd),
  ])

  const loan = lastObservationOnOrBefore(loanSeries, end)
  if (!loan) throw new Error(`BOJ 基准贷款利率无 ${end} 及之前的数据`)

  const call = lastObservationOnOrBefore(callSeries, loan.date)
  if (!call) throw new Error(`BOJ 隔夜拆借利率无 ${loan.date} 及之前的数据`)

  const loanAtCall = lastObservationOnOrBefore(loanSeries, call.date)
  if (!loanAtCall) throw new Error(`BOJ 基准贷款利率无 ${call.date} 及之前的数据`)
  const impliedAtCall = round2(loanAtCall.value - BOJ_LOAN_SPREAD)
  const diff = round2(call.value - impliedAtCall)
  if (diff < BOJ_CALL_MIN_DIFF || diff > BOJ_CALL_MAX_DIFF) {
    throw new Error(
      `BOJ 两条官方序列对不上：${call.date} 基准贷款利率 ${loanAtCall.value}% 减 ${BOJ_LOAN_SPREAD} = ${impliedAtCall}%，` +
        `隔夜拆借利率 ${call.value}%。央行可能改了基准贷款利率与政策利率的利差，须人工核对后再采`,
    )
  }

  return {
    rate: round2(loan.value - BOJ_LOAN_SPREAD),
    asOf: loan.date,
    check: { date: call.date, callRate: call.value },
  }
}

export async function fetchMacroRatesForWeek(weekStart, weekEnd) {
  const [fed, boj] = await Promise.all([fetchFedRateAsOf(weekEnd), fetchBojPolicyRateAsOf(weekEnd)])
  const end = formatYmd(weekEnd)

  return {
    fedRate: fed.rate,
    bojRate: boj.rate,
    sources: {
      fedRate: 'FRED:DFEDTARL',
      bojRate: 'BOJ:IR01/MADR1Z@D-0.25',
    },
    asOf: { fedRate: fed.asOf, bojRate: boj.asOf },
    bojCheck: { 'FM01/STRDCLUCON': boj.check.callRate, date: boj.check.date },
    provisional: fed.asOf < end || boj.asOf < end,
  }
}
