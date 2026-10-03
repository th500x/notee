/**
 * 周指标信号展示 / 推送文案（与均线 formatSignal 并列）。
 */

const { ETH_MA_CROSS } = require('../../constants/ethMaCross');
const { ETH_SIGNAL_SOURCE, ETH_WEEK_BIAS } = require('../../constants/ethSubscribe');
const { formatPrice, toNumberOrNull } = require('./formatSignal');

function weekTradeCross(signal) {
  if (!signal) return null;
  if (signal.t0Must === 'buy' || signal.t1Recommend === 'buy' || signal.bias === ETH_WEEK_BIAS.LONG) {
    return 'golden';
  }
  if (signal.t0Must === 'sell' || signal.t1Recommend === 'sell' || signal.bias === ETH_WEEK_BIAS.SHORT) {
    return 'death';
  }
  return null;
}

function weekKindBiasLabels(signal) {
  if (signal.t0Must === 'buy') return { kindLabel: '必买', biasLabel: '看多' };
  if (signal.t0Must === 'sell') return { kindLabel: '必卖', biasLabel: '看空' };
  if (signal.t1Recommend === 'buy') return { kindLabel: '荐买', biasLabel: '看多' };
  if (signal.t1Recommend === 'sell') return { kindLabel: '荐卖', biasLabel: '看空' };
  if (signal.bias === ETH_WEEK_BIAS.LONG) return { kindLabel: '周指标', biasLabel: '看多' };
  if (signal.bias === ETH_WEEK_BIAS.SHORT) return { kindLabel: '周指标', biasLabel: '看空' };
  return { kindLabel: '周指标', biasLabel: '中性' };
}

function formatWeekSignalRow(row, extra = {}) {
  if (!row) return null;
  const signal = {
    weekId: String(row.week_id || row.weekId || ''),
    openTime: Number(row.week_open_time != null ? row.week_open_time : row.openTime) || 0,
    closeTime: Number(row.week_open_time != null ? row.week_open_time : row.openTime) || 0,
    bias: row.bias || null,
    personalRating: toNumberOrNull(row.personal_rating != null ? row.personal_rating : row.personalRating),
    t0Must: row.t0_must != null ? row.t0_must : row.t0Must || null,
    t1Recommend: row.t1_recommend != null ? row.t1_recommend : row.t1Recommend || null,
    ethWeekAvg: toNumberOrNull(row.eth_week_avg != null ? row.eth_week_avg : row.ethWeekAvg),
  };
  const labels = weekKindBiasLabels(signal);
  const cross = weekTradeCross(signal);
  return {
    source: ETH_SIGNAL_SOURCE.WEEK,
    weekId: signal.weekId,
    openTime: signal.openTime,
    closeTime: signal.closeTime,
    cross,
    kindLabel: labels.kindLabel,
    biasLabel: labels.biasLabel,
    close: signal.ethWeekAvg,
    personalRating: signal.personalRating,
    t0Must: signal.t0Must,
    t1Recommend: signal.t1Recommend,
    bias: signal.bias,
    at: signal.openTime ? new Date(signal.openTime).toISOString() : null,
    ...extra,
  };
}

function formatWeekPushPayload(signal, plan) {
  const labels = weekKindBiasLabels(signal);
  const rating =
    signal.personalRating != null && Number.isFinite(Number(signal.personalRating))
      ? ` · ${Number(signal.personalRating)}★`
      : '';
  const avg =
    signal.ethWeekAvg != null ? ` · 周均 ${formatPrice(signal.ethWeekAvg)}` : '';
  const planHint = plan === 'plan_b' ? '必荐' : '指标';
  return {
    title: `ETH ${planHint} · ${labels.kindLabel}`,
    body: `${signal.weekId} ${labels.biasLabel}${rating}${avg}`,
    url: ETH_MA_CROSS.OPEN_URL,
    tag: `eth-week-${signal.weekId}`,
    topic: ETH_MA_CROSS.TOPIC,
    source: ETH_SIGNAL_SOURCE.WEEK,
    weekId: signal.weekId,
    kindLabel: labels.kindLabel,
    biasLabel: labels.biasLabel,
  };
}

module.exports = {
  weekTradeCross,
  weekKindBiasLabels,
  formatWeekSignalRow,
  formatWeekPushPayload,
};
