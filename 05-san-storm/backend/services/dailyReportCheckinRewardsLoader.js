/**
 * 真三日报 · 签到奖励配置加载（public/data/shared/dailyReportCheckinRewards.json）
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../database/connection');
const { parseRewardString } = require('./rewardService');
const {
  CHECKIN_CYCLE_MAX,
  assertCheckinRewardsString,
  assertCheckinParsedRewards,
  formatCheckinRewardDisplayShort,
} = require('../../shared/utils/dailyReportCheckinRewards.cjs');

const JSON_PATH = path.join(
  __dirname,
  '../../public/data/shared/dailyReportCheckinRewards.json',
);

/** @type {{ days: Array<{ cycleDay: number, rewards: string, label: string|null }> }|null} */
let cachedConfig = null;

function loadConfigFromDisk() {
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`签到奖励 JSON 缺失：${JSON_PATH}（请先运行 checkin-rewards-csv-to-json.cjs）`);
  }
  const raw = fs.readFileSync(JSON_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.days) || data.days.length !== CHECKIN_CYCLE_MAX) {
    throw new Error(`dailyReportCheckinRewards.json 须含 ${CHECKIN_CYCLE_MAX} 天`);
  }
  for (const day of data.days) {
    const rewards = assertCheckinRewardsString(day.rewards);
    assertCheckinParsedRewards(parseRewardString(rewards));
  }
  return data;
}

function getConfig() {
  if (!cachedConfig) {
    cachedConfig = loadConfigFromDisk();
  }
  return cachedConfig;
}

/** 开发期热读：文件 mtime 变化时重载（生产仍缓存） */
function getConfigFresh() {
  if (process.env.NODE_ENV === 'production') {
    return getConfig();
  }
  cachedConfig = loadConfigFromDisk();
  return cachedConfig;
}

/**
 * @param {number} cycleDay 1..28
 * @returns {{ cycleDay: number, rewards: string, label: string|null }}
 */
function getDayConfig(cycleDay) {
  const d = Math.floor(Number(cycleDay));
  if (d < 1 || d > CHECKIN_CYCLE_MAX) {
    throw new Error(`cycleDay 越界：${cycleDay}`);
  }
  const row = getConfigFresh().days.find((x) => x.cycleDay === d);
  if (!row) {
    throw new Error(`签到配置缺少第 ${d} 天`);
  }
  return row;
}

/**
 * @param {number} cycleDay
 * @returns {string}
 */
function getRewardsStringForCycleDay(cycleDay) {
  return getDayConfig(cycleDay).rewards;
}

/**
 * @param {Record<string, string>} itemNameById
 */
function buildRewardsByDayPayload(itemNameById = {}) {
  return getConfigFresh().days.map((day) => {
    const parsed = parseRewardString(day.rewards);
    return {
      cycleDay: day.cycleDay,
      rewards: day.rewards,
      label: day.label,
      displayShort: formatCheckinRewardDisplayShort(parsed, itemNameById),
    };
  });
}

/**
 * 批量解析配置中的 item_id → item_name
 * @returns {Promise<Record<string, string>>}
 */
async function loadItemNamesForConfig() {
  const ids = new Set();
  for (const day of getConfigFresh().days) {
    for (const r of parseRewardString(day.rewards)) {
      if (r.type === 'item' && r.itemId) ids.add(r.itemId);
    }
  }
  if (!ids.size) return {};
  const list = [...ids];
  const placeholders = list.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT item_id, item_name FROM config_items WHERE item_id IN (${placeholders})`,
    list,
  );
  /** @type {Record<string, string>} */
  const map = {};
  for (const row of rows) {
    map[row.item_id] = row.item_name || row.item_id;
  }
  return map;
}

function invalidateCache() {
  cachedConfig = null;
}

module.exports = {
  CHECKIN_CYCLE_MAX,
  getRewardsStringForCycleDay,
  buildRewardsByDayPayload,
  loadItemNamesForConfig,
  invalidateCache,
};
