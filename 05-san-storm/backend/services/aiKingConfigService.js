/**
 * AI 君主配置加载服务（M2 · 不入库 · JSON 固化）
 *
 * 数据源：`public/data/shared/ai-kings.json`（与 41-AI_KING_SYSTEM 形状一致）。
 * 加载策略：进程启动后惰性加载并缓存；JSON 校验失败 / 关键字段缺失 → 早失败抛错（禁止静默兜底默认君主）。
 *
 * @module services/aiKingConfigService
 */

const fs = require('fs');
const path = require('path');

const AI_KINGS_JSON_PATH = path.join(__dirname, '../../public/data/shared/ai-kings.json');

/** `speechStyle` 闭集（与 41-AI_KING_SYSTEM.md「speechStyle 定稿」一致） */
const SPEECH_STYLE_KEYS = new Set(['overlord', 'benevolent', 'moderate', 'decadent', 'tyrant']);

/** factionId → king 配置 */
let cachedKingsByFaction = null;
/** 整份配置（含 season / metadata） */
let cachedRawConfig = null;

/**
 * 校验单个君主条目；缺字段或类型不对 ⇒ 抛错（不要静默忽略以免运行期才暴露）。
 */
function validateKingEntry(entry, idx) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`[aiKingConfig] kings[${idx}] 不是对象`);
  }
  const required = ['factionId', 'characterId', 'characterName', 'personality', 'speechStyle'];
  for (const key of required) {
    if (entry[key] == null) throw new Error(`[aiKingConfig] kings[${idx}] 缺字段 ${key}`);
  }
  if (typeof entry.speechStyle !== 'string' || !SPEECH_STYLE_KEYS.has(entry.speechStyle)) {
    throw new Error(
      `[aiKingConfig] kings[${idx}] speechStyle 非法（须为 overlord|benevolent|moderate|decadent|tyrant，当前 ${entry.speechStyle}）`,
    );
  }
  const p = entry.personality;
  for (const k of ['aggression', 'caution', 'evolution', 'excitation', 'ambition']) {
    const v = Number(p[k]);
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      throw new Error(`[aiKingConfig] kings[${idx}] personality.${k} 非法（须 0..1，当前 ${p[k]}）`);
    }
  }
}

function loadConfigFromDisk() {
  let raw;
  try {
    raw = fs.readFileSync(AI_KINGS_JSON_PATH, 'utf8');
  } catch (err) {
    throw new Error(`[aiKingConfig] 读取 ai-kings.json 失败: ${err.message}`);
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(`[aiKingConfig] ai-kings.json JSON 解析失败: ${err.message}`);
  }
  if (!json || !Array.isArray(json.kings) || json.kings.length === 0) {
    throw new Error('[aiKingConfig] ai-kings.json 内 kings 数组缺失或为空');
  }
  const byFaction = new Map();
  json.kings.forEach((entry, idx) => {
    validateKingEntry(entry, idx);
    if (byFaction.has(entry.factionId)) {
      throw new Error(`[aiKingConfig] kings 内 factionId 重复: ${entry.factionId}`);
    }
    byFaction.set(entry.factionId, Object.freeze({ ...entry }));
  });
  cachedRawConfig = json;
  cachedKingsByFaction = byFaction;
}

function ensureLoaded() {
  if (cachedKingsByFaction == null) loadConfigFromDisk();
}

/**
 * 获取指定势力的 AI 君主配置；不存在抛错。
 * @param {string} factionId
 * @returns {object} 冻结的君主对象
 */
function getKingByFactionId(factionId) {
  ensureLoaded();
  if (!factionId) throw new Error('[aiKingConfig] factionId 必填');
  const k = cachedKingsByFaction.get(factionId);
  if (!k) {
    throw new Error(`[aiKingConfig] 势力 ${factionId} 未配置 AI 君主（M2 仅汉室/黄巾/刘备三家）`);
  }
  return k;
}

/**
 * 是否已配置该势力的 AI 君主（用于兼容性 / 路由 if-guard）。
 */
function hasKingForFaction(factionId) {
  ensureLoaded();
  return !!factionId && cachedKingsByFaction.has(factionId);
}

/** 获取全部君主列表（只读） */
function listAllKings() {
  ensureLoaded();
  return Array.from(cachedKingsByFaction.values());
}

/**
 * 测试 / 配置热重载使用：清空缓存（生产 server 启动后无需调用）。
 */
function reloadForTests() {
  cachedRawConfig = null;
  cachedKingsByFaction = null;
}

module.exports = {
  getKingByFactionId,
  hasKingForFaction,
  listAllKings,
  reloadForTests,
  AI_KINGS_JSON_PATH,
};
