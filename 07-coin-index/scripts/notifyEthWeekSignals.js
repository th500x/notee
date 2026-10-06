/**
 * 将周指标信号投递到 00（落库 + 按 Plan A/B 推送）。
 *
 * 默认只处理「上一完整周」，避免历史周被刷推。
 * 该周必填指标（含 Ahr999、利率等）缺任一项时不判定、不投递；
 * 采齐后的下一轮才会落库并推送（未投递则 broadcast_done 仍为未推）。
 *
 *   node scripts/notifyEthWeekSignals.js
 *   node scripts/notifyEthWeekSignals.js --weeks=2026-W39,2026-W40
 *   node scripts/notifyEthWeekSignals.js --dry-run
 *
 * 环境变量（与应急 ingest 相同密钥）：
 *   ETH_MA_INGEST_URL  默认 https://notee.vip/api/life-resume/eth-ma-cross/week-signals/ingest
 *   ETH_MA_INGEST_SECRET  须 ≥16 字符
 */

import { loadWeeklyData } from './lib/weeklyDataStore.js'
import { listMissingRequiredFields } from './lib/weekCompleteness.js'
import { getLastCompletedWeek } from './lib/weekSchedule.js'
import { computeT0MustMap } from '../src/utils/t0Must.js'
import { computeT1RecommendMap } from '../src/utils/t1Recommend.js'

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run')
  let weeks = null
  for (const arg of argv) {
    if (arg.startsWith('--weeks=')) {
      weeks = arg
        .slice('--weeks='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }
  return { dryRun, weeks }
}

/** 非中性：|rating| 达到看多/看空门槛（≥4 或 ≤-4，含极度） */
function resolveBias(personalRating) {
  const rating = Number(personalRating)
  if (!Number.isFinite(rating)) return 'neutral'
  if (rating >= 4) return 'long'
  if (rating <= -4) return 'short'
  return 'neutral'
}

function weekOpenTimeMs(week) {
  const start = week?.weekStart
  if (typeof start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
    const [y, m, d] = start.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return null
}

function buildPayload(weekId, week, t0Map, t1Map) {
  const bias = resolveBias(week.personalRating)
  const t0Must = t0Map[weekId] || week.t0Must || null
  const t1Recommend = t1Map[weekId] || week.t1Recommend || null
  if (bias === 'neutral' && !t0Must && !t1Recommend) {
    return null
  }
  return {
    weekId,
    weekOpenTime: weekOpenTimeMs(week),
    bias,
    personalRating: week.personalRating,
    t0Must,
    t1Recommend,
    ethWeekAvg: week.ethWeeklyAvgPrice,
  }
}

async function main() {
  const { dryRun, weeks: weekArg } = parseArgs(process.argv.slice(2))
  const data = loadWeeklyData()
  const t0Map = computeT0MustMap(data)
  const t1Map = computeT1RecommendMap(data)

  let weekIds = weekArg
  if (!weekIds || !weekIds.length) {
    const last = getLastCompletedWeek(new Date())
    if (!last) {
      console.error('没有上一完整周')
      process.exit(1)
    }
    weekIds = [last.id]
  }

  const weeks = []
  for (const weekId of weekIds) {
    const week = data[weekId]
    if (!week) {
      console.warn(`跳过 ${weekId}：weeklyData 无此周`)
      continue
    }
    const missing = listMissingRequiredFields(week)
    if (missing.length > 0) {
      console.log(`${weekId}: 指标未齐（缺 ${missing.join(', ')}），本轮不判定、不通知`)
      continue
    }
    const payload = buildPayload(weekId, week, t0Map, t1Map)
    if (!payload) {
      console.log(`${weekId}: 中性且无必/荐，不投递`)
      continue
    }
    weeks.push(payload)
    console.log(
      `${weekId}: bias=${payload.bias} rating=${payload.personalRating} t0=${payload.t0Must || '-'} t1=${payload.t1Recommend || '-'}`
    )
  }

  if (!weeks.length) {
    console.log('无可投递周信号')
    return
  }

  if (dryRun) {
    console.log(`[dry-run] 将投递 ${weeks.length} 周`)
    return
  }

  const url = String(
    process.env.ETH_MA_INGEST_URL ||
      'https://notee.vip/api/life-resume/eth-ma-cross/week-signals/ingest'
  ).trim()
  const secret = String(process.env.ETH_MA_INGEST_SECRET || '').trim()
  if (!secret || secret.length < 16) {
    console.error('缺少 ETH_MA_INGEST_SECRET（≥16）')
    process.exit(1)
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Eth-Ma-Ingest-Secret': secret,
    },
    body: JSON.stringify({ weeks }),
  })
  const text = await res.text()
  let json = {}
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    console.error('响应非 JSON', res.status, text.slice(0, 200))
    process.exit(1)
  }
  if (!res.ok || !json.success) {
    console.error('投递失败', res.status, json.error || text.slice(0, 200))
    process.exit(1)
  }
  console.log('投递完成', JSON.stringify(json.data, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
