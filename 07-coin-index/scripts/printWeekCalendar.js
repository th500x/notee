/**
 * 打印周历 — 与 scripts/lib/weekSchedule.js 一致（Agent 采集前必须先核对）
 * node scripts/printWeekCalendar.js
 * node scripts/printWeekCalendar.js --week=2026-W07
 * node scripts/printWeekCalendar.js --year=2026
 */
import { getWeeksInYear, resolveWeekById } from './lib/weekSchedule.js'

function formatRow(week) {
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const display = `${String(week.startDate.getMonth() + 1).padStart(2, '0')}/${String(week.startDate.getDate()).padStart(2, '0')}–${String(week.endDate.getMonth() + 1).padStart(2, '0')}/${String(week.endDate.getDate()).padStart(2, '0')}`
  return { id: week.id, start: fmt(week.startDate), end: fmt(week.endDate), display }
}

function main() {
  const weekArg = process.argv.find((a) => a.startsWith('--week='))
  if (weekArg) {
    const id = weekArg.split('=')[1]
    const week = resolveWeekById(id)
    if (!week) {
      console.error(`❌ 未知周 ID: ${id}`)
      process.exit(1)
    }
    const row = formatRow(week)
    console.log(`${row.id}\t${row.start}\t${row.end}\t(${row.display})`)
    return
  }

  const yearArg = process.argv.find((a) => a.startsWith('--year='))
  const year = yearArg ? parseInt(yearArg.split('=')[1], 10) : 2026

  console.log(`# ${year} 周历 · 权威源 scripts/lib/weekSchedule.js（周一–周日，本地日历日）`)
  console.log('周ID\tweekStart\tweekEnd\t显示')
  for (const week of getWeeksInYear(year)) {
    const row = formatRow(week)
    console.log(`${row.id}\t${row.start}\t${row.end}\t${row.display}`)
  }
}

main()
