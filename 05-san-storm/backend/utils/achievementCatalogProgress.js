/**
 * 成就目录 API：进度字段计算（与 unlockConditionEvaluator 口径一致）
 */

const { parseUnlockConditionsJson } = require('../../shared/utils/unlockConditionEvaluator.js');
const { ACHIEVEMENT_METRIC_KEYS } = require('../../shared/utils/unlockConditionKeys.js');

const METRIC_KEY_SET = new Set(Object.values(ACHIEVEMENT_METRIC_KEYS));

/**
 * @param {unknown} raw
 * @returns {{ metricKey: string, target: number }|null}
 */
function parsePrimaryMetricThreshold(raw) {
  const parsed = parseUnlockConditionsJson(raw);
  if (!parsed || parsed.type) return null;
  const keys = Object.keys(parsed).filter((k) => METRIC_KEY_SET.has(k));
  if (!keys.length) return null;
  const metricKey = keys[0];
  const target = Number(parsed[metricKey]);
  if (!Number.isFinite(target) || target < 0) return null;
  return { metricKey, target: Math.trunc(target) };
}

/**
 * @param {object} row - config_achievements 行（含 unlock_conditions / chain_*）
 * @param {object} snapshot - buildPlayerProgressSnapshot 产出
 * @param {boolean} owned
 */
function buildAchievementCatalogProgress(row, snapshot, owned) {
  const chainId = row.chain_id ? String(row.chain_id) : null;
  const chainLevelRaw = row.chain_level;
  const chainLevel = chainLevelRaw == null || chainLevelRaw === ''
    ? null
    : Math.trunc(Number(chainLevelRaw));

  if (owned) {
    return {
      chainId,
      chainLevel,
      progressCurrent: null,
      progressTarget: null,
      progressLabel: '已完成',
    };
  }

  const thresh = parsePrimaryMetricThreshold(row.unlock_conditions);
  if (!thresh) {
    return {
      chainId,
      chainLevel,
      progressCurrent: null,
      progressTarget: null,
      progressLabel: '—',
    };
  }

  const current = Number(snapshot?.metrics?.[thresh.metricKey]) || 0;
  const target = thresh.target;
  const shown = Math.min(Math.max(0, Math.trunc(current)), target);
  return {
    chainId,
    chainLevel,
    progressCurrent: Math.max(0, Math.trunc(current)),
    progressTarget: target,
    progressLabel: `${shown.toLocaleString('zh-CN')}/${target.toLocaleString('zh-CN')}`,
  };
}

module.exports = {
  buildAchievementCatalogProgress,
  parsePrimaryMetricThreshold,
};
