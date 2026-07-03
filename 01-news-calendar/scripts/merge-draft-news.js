/**
 * 草稿 → public 合并（带 .bak，去 link）
 * node scripts/merge-draft-news.js 202602
 * node scripts/merge-draft-news.js 202602 --dry-run
 */
import fs from 'fs'
import {
  publicMonthPath,
  draftPath,
  loadJson,
  stripLinksFromMonthData,
  countGroupTotals,
  GROUPS,
  parseYyyymm,
} from './lib/newsMonthCommon.js'
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2).filter((a) => a !== '--dry-run')
const dryRun = process.argv.includes('--dry-run')

if (args.length === 0) {
  console.error('用法: node scripts/merge-draft-news.js <YYYYMM> [--dry-run]')
  process.exit(1)
}

const yyyymm = parseYyyymm(args[0])
const draftFile = draftPath(yyyymm)
const publicFile = publicMonthPath(yyyymm)

if (!fs.existsSync(draftFile)) {
  console.error(`❌ 草稿不存在: ${draftFile}`)
  process.exit(1)
}

let draft = loadJson(draftFile)
draft = stripLinksFromMonthData(draft)

const totals = countGroupTotals(draft)
for (const [groupKey, group] of Object.entries(GROUPS)) {
  const t = totals[groupKey]
  if (t.total !== group.quota) {
    console.error(`❌ ${group.label} ${t.total}/${group.quota}，请先 validate 草稿`)
    process.exit(1)
  }
}

console.log(`📋 草稿: ${draftFile}`)
console.log(`📂 目标: ${publicFile}`)

if (dryRun) {
  console.log('🏁 --dry-run：未写入')
  process.exit(0)
}

if (fs.existsSync(publicFile)) {
  fs.copyFileSync(publicFile, `${publicFile}.bak`)
  console.log(`💾 已备份 → ${path.basename(publicFile)}.bak`)
}

fs.writeFileSync(publicFile, JSON.stringify(draft, null, 2), 'utf8')
console.log(`✅ 已合并 ${Object.keys(draft).filter((k) => !k.startsWith('_')).length} 天`)

const validateScript = path.join(__dirname, 'validate-news-month.js')
const result = spawnSync(process.execPath, [validateScript, yyyymm], { stdio: 'inherit' })
process.exit(result.status ?? 1)
