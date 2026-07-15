/**
 * 单周全量采集：价格 → 情绪 → 宏观利率 → 重算评级
 * node scripts/collectWeek.js --week=2026-W07
 */
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveWeekById, getLastCompletedWeek } from './lib/weekSchedule.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function weekArgFromArgv(argv) {
  const explicit = argv.find((a) => a.startsWith('--week='))
  if (explicit) return explicit
  const last = getLastCompletedWeek()
  if (!last) throw new Error('未找到已结束的完整周')
  return `--week=${last.id}`
}

function runStep(label, script, extraArgs = []) {
  console.log(`\n${'='.repeat(60)}\n▶ ${label}\n${'='.repeat(60)}`)
  const result = spawnSync(process.execPath, [script, ...extraArgs], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
  })
  if (result.status !== 0) {
    throw new Error(`${label} 失败 (exit ${result.status})`)
  }
}

function main() {
  const weekArg = weekArgFromArgv(process.argv)
  const weekId = weekArg.split('=')[1]
  const week = resolveWeekById(weekId)
  if (!week) throw new Error(`未知周 ID: ${weekId}`)

  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  console.log(`\n🗓️  采集 ${week.id} · ${fmt(week.startDate)} – ${fmt(week.endDate)}`)

  const pass = [weekArg]
  if (process.argv.includes('--dry-run')) pass.push('--dry-run')

  runStep('1/4 价格 (CoinGecko)', 'scripts/collectWeeklyDataV2.js', pass)
  runStep('2/4 情绪指标', 'scripts/fetchSentimentIndicators.js', pass)
  runStep('3/4 宏观利率', 'scripts/fetchMacroRates.js', pass)

  if (!process.argv.includes('--dry-run')) {
    runStep('4/4 重算 personalRating', 'scripts/recalculateRatings.js', [])
  }

  console.log('\n✅ collect-week 完成')
}

main()
