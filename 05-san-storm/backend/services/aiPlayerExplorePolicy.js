/**
 * AI 玩家探索策略（42-1 §5.2 / 42-2 Step 3）
 *
 * 职责：让一个 AI 玩家在指定探索点 **选事件 → 选安全选项 → 领奖 + 扣配额**，
 * 行为与真人共用同一套后端：
 *   - 事件池筛选/抽取：`@shared/utils/exploreEventPool.js`（前后端单一来源，dynamic import 加载 ESM）
 *   - 选项分流：同上 `getExploreOptionResolution` / `exploreOptionTriggerBattle`
 *   - 领奖：`playerEventRewardsService.executeEventRewards`（后端重算运势、发奖、记链进度）
 *   - 配额：`playerExploreQuotaService.applyExploreQuotaAction('consume'|'refund')`
 *
 * **安全选项**（42-1 §5.2 玩法决策「固定选安全选项」）：
 *   - `always`：必吉，无风险；
 *   - `luck` 且**无** `triggerBattle`：失败仅降运势倍率领奖，不进战斗；
 *   - 排除 `minigame` 与任何 `triggerBattle`（凶/大凶会进惩罚战）。
 *   一个事件两个选项皆不安全 → **跳过该事件**（不随机硬选，遵守「禁止静默兜底」：宁可不做也不冒进战斗）。
 *
 * **惩罚战说明**：安全选项不会触发探索惩罚战，故本步骤不含 `runPvpAutoDuel` PVE 推演；
 * AI 的 PVE 自动推演在匪寨（Step 5）落地（照抄 `aiConscriptLegionService` 模式）。
 *
 * @module services/aiPlayerExplorePolicy
 */

const path = require('path');
const { pathToFileURL } = require('url');
const { pool } = require('../database/connection');
const configService = require('./configService');
const playerExploreEventService = require('./playerExploreEventService');
const playerExploreQuotaService = require('./playerExploreQuotaService');
const playerEventRewardsService = require('./playerEventRewardsService');

/**
 * 探索相关 `trigger_context`：与前端 `game/src/utils/eventExplorePersistence.js`
 * 的 `EXPLORE_RELATED_TRIGGER_CONTEXTS` 同口径（explore/wilderness/market/mystery/tutorial）。
 * 改动须前后端同步。
 */
const EXPLORE_RELATED_TRIGGER_CONTEXTS = ['explore', 'wilderness', 'market', 'mystery', 'tutorial'];

let _exploreEventPoolEsm = null;
/** 与 `smallMapEnemyRoster` 同模式：CJS 后端 dynamic import 加载 ESM 单一来源 */
async function loadExploreEventPoolEsm() {
  if (_exploreEventPoolEsm) return _exploreEventPoolEsm;
  const filePath = path.join(__dirname, '../../shared/utils/exploreEventPool.js');
  _exploreEventPoolEsm = await import(pathToFileURL(filePath).href);
  return _exploreEventPoolEsm;
}

/** `san_1_faction_1001` → `san_1`（事件/城表 season 维度） */
function seasonFromFactionId(factionId) {
  const parts = String(factionId || '').split('_');
  return parts.length >= 2 ? `${parts[0]}_${parts[1]}` : 'san_1';
}

/**
 * 合并各探索 `trigger_context` 的 config 事件（与前端 `fetchExploreEventsCatalog` 同口径），按 `event_id` 去重。
 * 返回的事件为 `configService.formatEventData` 形态：顶层 snake_case、`option_a`/`option_b` 为已解析对象。
 */
async function loadExploreEventCatalog() {
  const byId = new Map();
  for (const ctx of EXPLORE_RELATED_TRIGGER_CONTEXTS) {
    const events = await configService.getEvents({ triggerContext: ctx });
    for (const e of events) {
      if (e?.event_id) byId.set(e.event_id, e);
    }
  }
  return [...byId.values()];
}

/** 探索点匹配所需的城表（city_id / city_type / 荒郊集市开关），与 `/api/cities` 同源 */
async function loadCitiesForExplore(season) {
  const [rows] = await pool.query(
    'SELECT city_id, city_type, wilderness_enabled, market_enabled FROM cities WHERE season = ?',
    [season],
  );
  return rows;
}

/**
 * 读取一个 AI 玩家的探索上下文：势力、声望、背包道具数、已完成事件进度。
 * @returns {Promise<{ factionId: string, reputation: number, itemCounts: Record<string, number>, completedEvents: object }|null>}
 */
async function loadPlayerExploreContext(playerId) {
  const [pRows] = await pool.query(
    'SELECT faction_id, reputation, items FROM players WHERE player_id = ?',
    [playerId],
  );
  if (!pRows.length) return null;
  let itemCounts = {};
  if (pRows[0].items) {
    try {
      const inv = typeof pRows[0].items === 'string' ? JSON.parse(pRows[0].items) : pRows[0].items;
      if (inv && typeof inv === 'object') itemCounts = inv;
    } catch {
      itemCounts = {};
    }
  }
  const { events: completedEvents } = await playerExploreEventService.getExploreEvents(playerId);
  return {
    factionId: pRows[0].faction_id,
    reputation: Number(pRows[0].reputation) || 0,
    itemCounts,
    completedEvents: completedEvents || {},
  };
}

/**
 * 单个选项对 AI 是否「安全」。
 * @returns {{ safe: boolean, resolution: 'minigame'|'always'|'luck'|null }}
 */
function classifyOptionSafety(option, poolEsm) {
  if (!option || typeof option !== 'object') return { safe: false, resolution: null };
  const resolution = poolEsm.getExploreOptionResolution(option);
  if (resolution === 'minigame') return { safe: false, resolution };
  if (poolEsm.exploreOptionTriggerBattle(option)) return { safe: false, resolution };
  if (resolution === 'always' || resolution === 'luck') return { safe: true, resolution };
  return { safe: false, resolution };
}

/**
 * 选 AI 安全选项 key：优先 `always`（必吉），其次 `luck` 无战斗；皆不安全返回 null。
 * @returns {'A'|'B'|null}
 */
function chooseSafeOptionKey(event, poolEsm) {
  const candidates = [
    { key: 'A', opt: event.option_a },
    { key: 'B', opt: event.option_b },
  ].filter((c) => c.opt && typeof c.opt === 'object');

  let luckSafeKey = null;
  for (const c of candidates) {
    const { safe, resolution } = classifyOptionSafety(c.opt, poolEsm);
    if (!safe) continue;
    if (resolution === 'always') return c.key;
    if (!luckSafeKey) luckSafeKey = c.key;
  }
  return luckSafeKey;
}

/**
 * 在指定探索点筛出有安全选项的事件并抽一个。
 * @returns {Promise<{ event: object, optionKey: 'A'|'B' }|null>}
 */
async function selectExploreEvent({ allEvents, completedEvents, locationId, itemCounts, citiesList, reputation }) {
  const poolEsm = await loadExploreEventPoolEsm();
  const candidatePool = poolEsm.filterExploreEventsPool(
    allEvents,
    completedEvents,
    locationId,
    itemCounts,
    citiesList,
    null,
    reputation,
  );
  if (!candidatePool.length) return null;

  const safe = [];
  for (const evt of candidatePool) {
    const optionKey = chooseSafeOptionKey(evt, poolEsm);
    if (optionKey) safe.push({ event: evt, optionKey });
  }
  if (!safe.length) return null;

  const chosen = poolEsm.pickRandomEvent(safe.map((s) => s.event));
  if (!chosen) return safe[0];
  return safe.find((s) => s.event.event_id === chosen.event_id) || safe[0];
}

/**
 * 让一个 AI 玩家在指定探索点执行一次探索（选事件 → 安全选项 → 扣配额 → 领奖）。
 *
 * @param {string} playerId
 * @param {{ locationId: string, citiesList?: Array<object>|null }} opts
 * @returns {Promise<
 *   | { ok: true, explored: false, reason: 'no_safe_event'|'no_quota', locationId: string }
 *   | { ok: true, explored: true, locationId: string, eventId: string, optionKey: 'A'|'B', fortune: string|null, rewards: object[] }
 *   | { ok: false, explored?: false, error: string, code?: string|null, reason?: string, locationId: string }
 * >}
 */
async function runAiExploreOnce(playerId, { locationId, citiesList = null } = {}) {
  const loc = locationId != null ? String(locationId).trim() : '';
  if (!loc) return { ok: false, error: '缺少 locationId', locationId: '' };

  const ctx = await loadPlayerExploreContext(playerId);
  if (!ctx) return { ok: false, error: '玩家不存在', locationId: loc };

  const season = seasonFromFactionId(ctx.factionId);
  const cities = citiesList || (await loadCitiesForExplore(season));
  const allEvents = await loadExploreEventCatalog();

  const selection = await selectExploreEvent({
    allEvents,
    completedEvents: ctx.completedEvents,
    locationId: loc,
    itemCounts: ctx.itemCounts,
    citiesList: cities,
    reputation: ctx.reputation,
  });
  if (!selection) {
    return { ok: true, explored: false, reason: 'no_safe_event', locationId: loc };
  }

  const { event, optionKey } = selection;
  const skipsQuota = String(event.trigger_context || '').trim() === 'tutorial';

  let consumed = false;
  if (!skipsQuota) {
    const q = await playerExploreQuotaService.applyExploreQuotaAction(playerId, 'consume');
    if (!q.ok) return { ok: true, explored: false, reason: 'no_quota', locationId: loc };
    consumed = true;
  }

  let rewardRes;
  try {
    rewardRes = await playerEventRewardsService.executeEventRewards(playerId, {
      eventId: event.event_id,
      optionKey,
    });
  } catch (e) {
    if (consumed) await playerExploreQuotaService.applyExploreQuotaAction(playerId, 'refund');
    console.error(
      `[aiPlayer][explore] executeEventRewards 抛错 player=${playerId} event=${event.event_id}:`,
      e.message,
    );
    return { ok: false, error: e.message, locationId: loc };
  }

  if (!rewardRes.ok) {
    // 失败退还配额（与真人前端失败退次数一致），并把后端 error 上抛，不静默吞错
    if (consumed) await playerExploreQuotaService.applyExploreQuotaAction(playerId, 'refund');
    return {
      ok: false,
      explored: false,
      reason: 'reward_rejected',
      error: rewardRes.json?.error || '领奖失败',
      code: rewardRes.json?.code || null,
      locationId: loc,
    };
  }

  // 非链事件：补记 explore_events 完成（与前端 closeReward 的 POST /events eventType=6 一致；
  // 链事件已在 executeEventRewards 内 recordExploreChainEventCompleted）
  if (!event.chain_id) {
    await playerExploreEventService.recordEventProgress(playerId, {
      eventId: event.event_id,
      eventType: 6,
      status: 'completed',
    });
  }

  return {
    ok: true,
    explored: true,
    locationId: loc,
    eventId: event.event_id,
    optionKey,
    fortune: rewardRes.data?.fortune?.name ?? null,
    rewards: rewardRes.data?.rewards ?? [],
  };
}

module.exports = {
  EXPLORE_RELATED_TRIGGER_CONTEXTS,
  seasonFromFactionId,
  loadExploreEventCatalog,
  loadCitiesForExplore,
  loadPlayerExploreContext,
  classifyOptionSafety,
  chooseSafeOptionKey,
  selectExploreEvent,
  runAiExploreOnce,
};
