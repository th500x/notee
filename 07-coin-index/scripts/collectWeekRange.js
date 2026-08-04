/**
 * 批量采集连续周次
 * node scripts/collectWeekRange.js --from=2026-W08 --to=2026-W25
 */
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { getAllConfiguredWeeks } from './lib/weekSchedule.js'
import { delay } from './lib/apiDelay.js'

const BETWEEN_WEEKS_DELAY = 90000 // 周与周之间额外等待，降低 429

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseArg(name) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.split('=')[1] : null
}

async function main() {
  const fromId = parseArg('from')
  const toId = parseArg('to')
  if (!fromId || !toId) {
    console.error('用法: node scripts/collectWeekRange.js --from=2026-W08 --to=2026-W25')
    process.exit(1)
  }

  const all = getAllConfiguredWeeks()
  const fromIdx = all.findIndex((w) => w.id === fromId)
  const toIdx = all.findIndex((w) => w.id === toId)
  if (fromIdx < 0 || toIdx < 0) {
    console.error(`未知周 ID: from=${fromId} to=${toId}`)
    process.exit(1)
  }
  if (fromIdx > toIdx) {
    console.error('--from 必须早于或等于 --to')
    process.exit(1)
  }

  const weeks = all.slice(fromIdx, toIdx + 1)
  console.log(`\n📦 批量采集 ${weeks.length} 周: ${fromId} → ${toId}\n`)

  for (const week of weeks) {
    console.log(`\n${'#'.repeat(60)}\n# ${week.id}\n${'#'.repeat(60)}`)
    const result = spawnSync(
      process.execPath,
      ['scripts/collectWeek.js', `--week=${week.id}`],
      { cwd: projectRoot, stdio: 'inherit' },
    )
    if (result.status !== 0) {
      console.error(`\n❌ ${week.id} 失败 (exit ${result.status})`)
      process.exit(result.status ?? 1)
    }

    if (week !== weeks[weeks.length - 1]) {
      console.log(`\n⏸️  周间冷却 ${BETWEEN_WEEKS_DELAY / 1000}s…`)
      await delay(BETWEEN_WEEKS_DELAY)
    }
  }

  console.log(`\n✅ 批量完成: ${fromId} → ${toId}（${weeks.length} 周）`)
}

main()
