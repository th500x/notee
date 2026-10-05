/**
 * 补采所有已结束、但没有记录或指标不全的周（含上一完整周），按时间先后逐周跑 collect-week；
 * 利率为暂定值（官方数据当时没发布到周结束日）的周，只重取利率并重算评级。
 * 曼谷机每周一 UTC 00:05 由 systemd 定时器经 scripts/weekly-auto-collect.sh 调用。
 *
 * node scripts/collectMissingWeeks.js [--dry-run]
 */
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { getAllConfiguredWeeks, getLastCompletedWeek } from './lib/weekSchedule.js'
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

function planWeeks(data, referenceDate = new Date()) {
  const last = getLastCompletedWeek(referenceDate)
  if (!last) throw new Error('未找到已结束的完整周')

  // 周历由算法随年份自动延伸；若上一完整周距今过远，多半是定时器长期未跑，仍继续补采已结束周。
  const today = new Date(referenceDate)
  today.setHours(12, 0, 0, 0)
  const lagDays = Math.floor((today.getTime() - last.endDate.getTime()) / DAY_MS)
  if (lagDays > 7) {
    console.warn(
      `⚠️ 上一完整周 ${last.id} 已结束 ${lagDays} 天（自动周历应已覆盖新年）；将补采所有已结束且缺数的周`,
    )
  }

  const ended = getAllConfiguredWeeks(referenceDate).filter((week) => week.endDate <= last.endDate)
  const collect = ended.filter((week) => weekIsIncomplete(data[week.id], week))
  const refreshMacro = ended.filter(
    (week) => !collect.includes(week) && macroIsProvisional(data[week.id]),
  )
  return { collect, refreshMacro }
}

function runScript(args) {
  const result = spawnSync(process.execPath, args, { cwd: projectRoot, stdio: 'inherit' })
  return result.status
}

function refreshProvisionalMacro(weeks) {
  for (const week of weeks) {
    console.log(`\n${'#'.repeat(60)}\n# ${week.id} 重取利率（定稿）\n${'#'.repeat(60)}`)
    // --finalize：只拉该周真实利率，不用「复用上周」模式
    const status = runScript(['scripts/fetchMacroRates.js', `--week=${week.id}`, '--finalize'])
    if (status !== 0) throw new Error(`${week.id} 重取利率失败 (exit ${status})`)
  }
  const status = runScript(['scripts/recalculateRatings.js'])
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

function assertNoStaleProvisional() {
  const data = loadWeeklyData()
  const stale = getAllConfiguredWeeks().filter(
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
  const { collect, refreshMacro } = planWeeks(loadWeeklyData())

  if (collect.length === 0 && refreshMacro.length === 0) {
    console.log('✅ 已结束的周都有完整数据、利率均已定稿，无需采集')
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
  assertNoStaleProvisional()

  // 情绪可部分写入，但任一项仍缺 → 整轮失败，systemd 每 2h 重试直到采齐
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
