/**
 * weeklyData.json 读写 — 以 public/ 为权威源，禁止意外缩库
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

export const PUBLIC_DATA_PATH = path.join(projectRoot, 'public/weeklyData.json')
export const SRC_DATA_PATH = path.join(projectRoot, 'src/data/weeklyData.json')
export const MANUAL_CSV_PATH = path.join(projectRoot, 'docs/tools/data-import.csv')

const MANUAL_FIELDS = [
  'fearGreedIndex',
  'mayerMultiple',
  'ahr999',
  'btcFourYearIndex',
  'fedRate',
  'bojRate',
  'personalRating',
  'indicatorScores',
  'totalScore',
]

const COLLECTOR_DEFAULTS = {
  fearGreedIndex: 50,
  mayerMultiple: 1.5,
  ahr999: 1.0,
  btcFourYearIndex: 0.8,
  personalRating: 3,
}

export function loadWeeklyData() {
  const filePath = fs.existsSync(PUBLIC_DATA_PATH) ? PUBLIC_DATA_PATH : SRC_DATA_PATH
  if (!fs.existsSync(filePath)) {
    console.log('📖 无现有 weeklyData.json，从空对象开始')
    return {}
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  console.log(`📖 读取 ${path.relative(projectRoot, filePath)}: ${Object.keys(data).length} 周`)
  return data
}

/** 合并单周：只更新价格/API 字段，保留已填写的手工指标 */
export function mergeWeekRecord(existingWeek, incomingWeek) {
  if (!existingWeek) return incomingWeek

  const merged = { ...existingWeek, ...incomingWeek }

  for (const field of MANUAL_FIELDS) {
    const prev = existingWeek[field]
    if (prev === undefined || prev === null) continue
    const isDefaultPlaceholder =
      COLLECTOR_DEFAULTS[field] !== undefined && prev === COLLECTOR_DEFAULTS[field]
    if (!isDefaultPlaceholder || field === 'fedRate' || field === 'bojRate') {
      merged[field] = prev
    }
  }

  if (existingWeek.indicatorScores && incomingWeek.indicatorScores) {
    merged.indicatorScores = existingWeek.indicatorScores
    merged.totalScore = existingWeek.totalScore
    merged.personalRating = existingWeek.personalRating
  }

  return merged
}

export function mergeWeeklyData(existingData, newWeeksById) {
  const merged = { ...existingData }
  for (const [weekId, incoming] of Object.entries(newWeeksById)) {
    merged[weekId] = mergeWeekRecord(existingData[weekId], incoming)
  }
  return merged
}

export function saveWeeklyData(data, { force = false } = {}) {
  const beforeCount = fs.existsSync(PUBLIC_DATA_PATH)
    ? Object.keys(JSON.parse(fs.readFileSync(PUBLIC_DATA_PATH, 'utf8'))).length
    : 0
  const afterCount = Object.keys(data).length

  if (beforeCount > 0 && afterCount < beforeCount && !force) {
    throw new Error(
      `拒绝写入：周数 ${beforeCount} → ${afterCount}（疑似清空历史）。` +
        '若确需覆盖请加 --force',
    )
  }

  if (fs.existsSync(PUBLIC_DATA_PATH)) {
    fs.copyFileSync(PUBLIC_DATA_PATH, `${PUBLIC_DATA_PATH}.bak`)
    console.log(`💾 已备份 → public/weeklyData.json.bak`)
  }

  const json = JSON.stringify(data, null, 2)
  fs.writeFileSync(PUBLIC_DATA_PATH, json, 'utf8')
  fs.mkdirSync(path.dirname(SRC_DATA_PATH), { recursive: true })
  fs.writeFileSync(SRC_DATA_PATH, json, 'utf8')

  console.log(`💾 已写入 public/ + src/data/（${afterCount} 周）`)
}
