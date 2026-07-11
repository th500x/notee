/**
 * AI 玩家系统 · MVP 配置单一来源。
 *
 * 设计文档：docs/01-jun-exploration/40-ai/42-1-AI_PLAYER_SYSTEM.md、42-2-AI_PLAYER_IMPLEMENTATION.md。
 * 行为编排（窗口/并发）与播种（人数/服务器/elite 基线）集中在此，避免散落到脚本与服务里。
 */

/**
 * 读取正整数环境变量；缺省或非法时回退默认值。
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function readPositiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 行为编排参数（Step 5 起使用；Step 0 先固化常量）。
 * - windowMinutes：把全部 AI 行为铺开到的分钟窗口。
 * - cronEveryMinutes：编排器扫描间隔。
 * - maxConcurrent：同时执行行为链的 AI 上限，其余排队（默认 5，可经环境变量调整）。
 * - behaviorEnabled：行为编排总开关（播种不受其影响）。
 */
const AI_PLAYER_BEHAVIOR = {
  windowMinutes: 20,
  cronEveryMinutes: 1,
  maxConcurrent: readPositiveIntEnv('AI_PLAYER_MAX_CONCURRENT', 5),
  behaviorEnabled: process.env.AI_PLAYER_BEHAVIOR_ENABLED === '1',
};

/**
 * elite AI 写入 ai_players 的行为基线（首批唯一实装类型）。
 * 字段含义见 §3.2.9 ai_players 表设计。
 */
const ELITE_AI_DEFAULTS = {
  aiType: 'elite',
  eventParticipationTypes: 'all',
  pvpParticipation: 'offense_defense',
  chatFrequency: 0.35,
  battleStrategy: 'aggressive',
  resourceStrategy: 'optimal',
};

/**
 * 当前测试阶段的可玩势力白名单：仅这些势力会被铺 AI。
 * 未来开放全势力时，把对应 faction_id 追加进来即可；置为空数组表示「该服全部势力」。
 * - san_1_faction_1001 = 刘备
 * - san_1_faction_6001 = 汉室
 * - san_1_faction_7001 = 黄巾
 */
const AI_PLAYER_SEED_FACTION_IDS = [
  'san_1_faction_1001',
  'san_1_faction_6001',
  'san_1_faction_7001',
];

/**
 * 播种参数。
 * - perFaction：每势力导入的 elite AI 人数（默认 30；当前 3 势力共 90）。
 * - serverId：目标服务器（默认 San_1_Chaos；current_season 由库内读取）。
 * - factionIds：可玩势力白名单（见上）。
 */
const AI_PLAYER_SEED = {
  perFaction: readPositiveIntEnv('AI_PLAYER_SEED_PER_FACTION', 30),
  serverId: process.env.AI_PLAYER_SEED_SERVER_ID || 'San_1_Chaos',
  factionIds: AI_PLAYER_SEED_FACTION_IDS,
  eliteDefaults: ELITE_AI_DEFAULTS,
};

module.exports = {
  AI_PLAYER_BEHAVIOR,
  AI_PLAYER_SEED,
  ELITE_AI_DEFAULTS,
};
