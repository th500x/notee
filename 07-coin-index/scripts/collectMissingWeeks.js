/**
 * 自动补采范围：只处理「上一完整周」+「再上一周」（共两周）。
 * 更早的历史周不再自动重采；也不要因全量重算评级去改它们的 updatedAt。
 *
 * node scripts/collectMissingWeeks.js [--dry-run]
 */
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  getAllConfiguredWeeks,
  getLastCompletedWeek,
  getPreviousWeekId,
  resolveWeekById,
} from './lib/weekSchedule.js'
import { weekIsIncomplete, listMissingRequiredFields } from './lib/weekCompleteness.js'
import { loadWeeklyData } from './lib/weeklyDataStore.js'
import { delay } from './lib/apiDelay.js'

const BETWEEN_WEEKS_DELAY = 90000
const DAY_MS = 86400000
const PROVISIONAL_MAX_DAYS = 14

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function macroIsProvisional(record) {
  return record?.macroSource?.provisional === true
}

/** 自动任务只看最近两周已结束周：lastCompleted + 其上一周 */
export function getAutoCollectScope(referenceDate = new Date()) {
  const last = getLastCompletedWeek(referenceDate)
  if (!last) throw new Error('未找到已结束的完整周')
  const prevId = getPreviousWeekId(last.id)
  const prev = prevId ? resolveWeekById(prevId) : null
  return {
    lastCompleted: last,
    scope: [prev, last].filter(Boolean),
  }
}

function planWeeks(data, referenceDate = new Date()) {
  const { lastCompleted, scope } = getAutoCollectScope(referenceDate)

  const today = new Date(referenceDate)
  today.setHours(12, 0, 0, 0)
  const lagDays = Math.floor((today.getTime() - lastCompleted.endDate.getTime()) / DAY_MS)
  if (lagDays > 7) {
    console.warn(
      `⚠️ 上一完整周 ${lastCompleted.id} 已结束 ${lagDays} 天；自动任务仍只处理最近两周，更早漏周请手工 collect-week`,
    )
  }

  console.log(`🎯 自动采集范围（仅两周）: ${scope.map((w) => w.id).join(', ')}`)

  const collect = scope.filter((week) => weekIsIncomplete(data[week.id], week))
  const refreshMacro = scope.filter(
    (week) => !collect.includes(week) && macroIsProvisional(data[week.id]),
  )
  return { collect, refreshMacro, scope }
}

function runScript(args) {
  const result = spawnSync(process.execPath, args, { cwd: projectRoot, stdio: 'inherit' })
  return result.status
}

function refreshProvisionalMacro(weeks) {
  for (const week of weeks) {
    console.log(`\n${'#'.repeat(60)}\n# ${week.id} 重取利率（定稿）\n${'#'.repeat(60)}`)
    const status = runScript(['scripts/fetchMacroRates.js', `--week=${week.id}`, '--finalize'])
    if (status !== 0) throw new Error(`${week.id} 重取利率失败 (exit ${status})`)
  }
  const weekArgs = weeks.flatMap((week) => [`--week=${week.id}`])
  const status = runScript(['scripts/recalculateRatings.js', ...weekArgs])
  if (status !== 0) throw new Error(`重算 personalRating 失败 (exit ${status})`)
}

async function collectWeeks(weeks) {
  for (const [index, week] of weeks.entries()) {
    if (index > 0) {
      console.log(`\n⏸️  周间冷却 ${BETWEEN_WEEKS_DELAY / 1000}s…`)
      await delay(BETWEEN_WEEKS_DELAY)
    }
    console.log(`\n${'#'.repeat(60)}\n# ${week.id}\n${'#'.repeat(60)}`)
    const status = runScript(['scripts/collectWeek.js', `--week=${week.id}`])
    if (status !== 0) {
      throw new Error(`${week.id} 采集失败 (exit ${status})，后面的周未采集`)
    }
  }
}

function assertNoStaleProvisional(scope) {
  const data = loadWeeklyData()
  const stale = scope.filter(
    (week) =>
      macroIsProvisional(data[week.id]) &&
      Date.now() - week.endDate.getTime() > PROVISIONAL_MAX_DAYS * DAY_MS,
  )
  if (stale.length > 0) {
    throw new Error(
      `${stale.map((w) => w.id).join(', ')} 结束超过 ${PROVISIONAL_MAX_DAYS} 天，` +
        '官方利率数据仍未发布到周结束日，请检查 FRED / 日本央行数据源',
    )
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const { collect, refreshMacro, scope } = planWeeks(loadWeeklyData())

  if (collect.length === 0 && refreshMacro.length === 0) {
    console.log('✅ 最近两周数据齐全、利率已定稿，无需采集')
    return
  }

  if (refreshMacro.length > 0) {
    console.log(`📋 利率暂定、待重取 ${refreshMacro.length} 周: ${refreshMacro.map((w) => w.id).join(', ')}`)
  }
  if (collect.length > 0) {
    console.log(`📋 待采集 ${collect.length} 周: ${collect.map((w) => w.id).join(', ')}`)
  }
  if (dryRun) {
    console.log('🏁 --dry-run：不采集')
    return
  }

  if (refreshMacro.length > 0) refreshProvisionalMacro(refreshMacro)
  await collectWeeks(collect)
  assertNoStaleProvisional(scope)

  const after = loadWeeklyData()
  const stillOpen = planWeeks(after).collect
  if (stillOpen.length > 0) {
    const detail = stillOpen
      .map((week) => {
        const missing = listMissingRequiredFields(after[week.id])
        return `${week.id}（缺 ${missing.join(', ') || '价格不全'}）`
      })
      .join('；')
    throw new Error(`仍有未采齐的周，将按失败重试：${detail}`)
  }

  console.log('\n✅ 采集完成')
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
