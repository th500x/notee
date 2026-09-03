/**
 * 匪寨「攻打」门闸：每次开战消耗 `item_tactic_token`×1（与旧「郡共用次数 / 8h 档」脱钩）。
 * 个人爬塔进度仍为 `byBanditMapObjectId[<匪寨地图对象 ID>].nextLayer`；通关第 20 层后回到第 1 层可循环。
 * 全服耐久扣尽时由结算侧重生满血（见 17-7）；本门闸对历史「已关」行惰性回满。
 */

const path = require('path');
const { pathToFileURL } = require('url');
const { pool } = require('../database/connection');
const { getPhase1BanditPoiIdsForJun } = require('../../shared/utils/strategicBanditPlaceholderPhase1.js');
const {
  computeBanditBetweenLayerHeal,
  normalizeBanditBetweenLayerHealTier,
} = require('../../shared/utils/banditBetweenLayerHeal.cjs');
const statisticsDeltaService = require('./statisticsDeltaService');

/** 攻打消耗道具（与日俸附赠同源） */
const BANDIT_RAID_COST_ITEM_ID = 'item_tactic_token';
const BANDIT_RAID_COST_PER_BATTLE = 1;

const BANDIT_MAP_OBJECT_ID_RE = /^san_\d+_bandit_[1-9]_[a-z0-9_]+$/i;

/** `bandit_progress` JSON：个人层进度仍按匪寨地图对象 ID */
const BUCKET = 'byBanditMapObjectId';

function parseItemsJson(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw };
  return {};
}

function countTacticTokens(items) {
  return Math.max(0, Math.floor(Number(items?.[BANDIT_RAID_COST_ITEM_ID]) || 0));
}

let rosterEsmPromise = null;
function loadSmallMapEnemyRoster() {
  if (!rosterEsmPromise) {
    const filePath = path.join(__dirname, '../../shared/utils/smallMapEnemyRoster.js');
    rosterEsmPromise = import(pathToFileURL(filePath).href);
  }
  return rosterEsmPromise;
}

/**
 * 历史 `status=closed` / 已耗尽行：惰性重生为满血可攻（无尾刀徽章；尾刀仅结算路径发放）。
 * @param {string} banditPoiId
 * @param {string|null} junId
 */
async function ensureBanditWorldReady(banditPoiId, junId) {
  const id = String(banditPoiId || '').trim();
  if (!BANDIT_MAP_OBJECT_ID_RE.test(id)) return;
  const j = junId != null ? String(junId).trim() : '';
  try {
    if (j) {
      await pool.query(
        `INSERT INTO bandits (bandit_id, jun_id, slot_index, tile_key, max_layers, cleared_layers, status)
         VALUES (?, ?, 0, NULL, 200, 0, 'active')
         ON DUPLICATE KEY UPDATE
           jun_id = IF(COALESCE(jun_id, '') = '', VALUES(jun_id), jun_id),
           max_layers = IF(COALESCE(max_layers, 0) <= 0, 200, max_layers),
           cleared_layers = IF(cleared_layers IS NULL, 0, cleared_layers)`,
        [id, j],
      );
    }
    await pool.query(
      `UPDATE bandits
       SET cleared_layers = 0, status = 'active', closed_at = NULL
       WHERE bandit_id = ?
         AND (status <> 'active' OR cleared_layers >= max_layers)`,
      [id],
    );
  } catch (e) {
    console.error('[playerBanditRaidQuotaService] ensureBanditWorldReady', { id, error: e.message });
  }
}

/**
 * 读 `bandits` 全服累计耗层（见 17-7 §4）；对外 **camelCase** 与列语义对齐：`maxLayers`、`clearedLayers`、`layersRemaining`。
 * 表或行缺失时返回 null，不打断配额接口。
 * @param {string} banditPoiId
 * @returns {Promise<{ maxLayers: number, clearedLayers: number, layersRemaining: number } | null>}
 */
async function readBanditWorldDurability(banditPoiId) {
  try {
    const [rows] = await pool.query(
      'SELECT max_layers, cleared_layers FROM bandits WHERE bandit_id = ? LIMIT 1',
      [banditPoiId],
    );
    const r = rows[0];
    if (!r) return null;
    const maxLayers = Number(r.max_layers);
    const clearedLayers = Number(r.cleared_layers);
    if (!Number.isFinite(maxLayers) || maxLayers <= 0) return null;
    if (!Number.isFinite(clearedLayers) || clearedLayers < 0) return null;
    const layersRemaining = Math.max(0, maxLayers - clearedLayers);
    return { maxLayers, clearedLayers, layersRemaining };
  } catch {
    return null;
  }
}

function parseBanditProgress(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return o && typeof o === 'object' ? o : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return { ...raw };
  return {};
}

async function ensurePlayerProgressRow(playerId) {
  await pool.query('INSERT IGNORE INTO player_progress (player_id) VALUES (?)', [playerId]);
}

/** 与 `banditRaidLayerRewards.banditCombatLayerFromStoredNext` 同算式（CJS 侧避免循环依赖） */
function combatLayerFromStoredNext(storedNext, maxPersonalLayers) {
  const maxP = Math.max(1, Math.floor(Number(maxPersonalLayers)) || 20);
  const s = Math.floor(Number(storedNext));
  if (!Number.isFinite(s) || s < 1 || s > maxP) return 1;
  return s;
}

function normalizeStoredNextLayer(raw, maxPersonalLayers) {
  const maxP = Math.max(1, Math.floor(Number(maxPersonalLayers)) || 20);
  const s0 = Math.floor(Number(raw));
  if (!Number.isFinite(s0) || s0 < 1 || s0 > maxP) return 1;
  return s0;
}

/**
 * @param {string} banditPoiId
 * @returns {Promise<string|null>}
 */
async function resolveJunIdForBanditPoiId(banditPoiId) {
  const id = String(banditPoiId || '').trim();
  for (const junId of ['san_1_jun_yingchuan', 'san_1_jun_runan']) {
    if (getPhase1BanditPoiIdsForJun(junId).includes(id)) return junId;
  }
  try {
    const [rows] = await pool.query('SELECT jun_id FROM bandits WHERE bandit_id = ? LIMIT 1', [id]);
    if (rows[0]?.jun_id) return String(rows[0].jun_id).trim();
  } catch (_) {}
  const m = id.match(/^san_(\d+)_bandit_[1-9]_([a-z0-9_]+)$/i);
  if (m) return `san_${m[1]}_jun_${m[2]}`;
  return null;
}

/**
 * @param {string} playerId
 * @returns {Promise<number>}
 */
async function readPlayerTacticTokenCount(playerId) {
  const [rows] = await pool.query('SELECT items FROM players WHERE player_id = ? LIMIT 1', [playerId]);
  if (!rows[0]) return 0;
  return countTacticTokens(parseItemsJson(rows[0].items));
}

/**
 * @param {object} bp
 * @param {string} id
 * @param {number} maxPersonalLayers
 * @param {{ maxLayers: number, clearedLayers: number, layersRemaining: number } | null} worldDurability
 */
function buildRaidGatePayload({
  id,
  junId,
  tacticTokens,
  maxPersonalLayers,
  storedNext,
  worldDurability,
  difficultyHint,
}) {
  const combatLayer = combatLayerFromStoredNext(storedNext, maxPersonalLayers);
  const tokens = Math.max(0, Math.floor(Number(tacticTokens) || 0));
  return {
    banditPoiId: id,
    junId,
    /** 持有兵符数（面板「战斗」资源） */
    remaining: tokens,
    tacticTokens: tokens,
    costItemId: BANDIT_RAID_COST_ITEM_ID,
    costPerBattle: BANDIT_RAID_COST_PER_BATTLE,
    /** 旧次数上限字段：兵符无硬顶，回 0 供前端隐藏 x/max */
    max: 0,
    refillPerWindow: 0,
    minutesUntilRefill: 0,
    nextLayer: combatLayer,
    personalTotalLayers: maxPersonalLayers,
    worldDurability,
    difficultyHint,
    /** 已废止「通关卡关」；保留字段恒 false 以免旧前端误判 */
    towerCompleted: false,
    canBattle: tokens >= BANDIT_RAID_COST_PER_BATTLE,
  };
}

/**
 * @param {string} playerId
 * @param {string} banditPoiId - 匪寨地图对象 ID `san_*_bandit_*`（04-1 §15）
 */
async function getRaidQuotaState(playerId, banditPoiId) {
  const id = String(banditPoiId || '').trim();
  if (!BANDIT_MAP_OBJECT_ID_RE.test(id)) {
    return { ok: false, status: 400, error: '无效的匪寨地图对象 ID' };
  }

  await ensurePlayerProgressRow(playerId);
  const junId = await resolveJunIdForBanditPoiId(id);
  if (!junId) {
    return { ok: false, status: 400, error: '无法解析匪寨所属郡' };
  }

  await ensureBanditWorldReady(id, junId);

  const roster = await loadSmallMapEnemyRoster();
  const maxPersonalLayers = Number(roster.BANDIT_PERSONAL_TOTAL_LAYERS) || 20;

  const [rows] = await pool.query('SELECT bandit_progress FROM player_progress WHERE player_id = ?', [
    playerId,
  ]);
  const row = rows[0] || {};
  const bp = parseBanditProgress(row.bandit_progress);
  if (!bp[BUCKET] || typeof bp[BUCKET] !== 'object') bp[BUCKET] = {};

  const prevEntry = bp[BUCKET][id] && typeof bp[BUCKET][id] === 'object' ? { ...bp[BUCKET][id] } : {};
  const storedNext = normalizeStoredNextLayer(prevEntry.nextLayer, maxPersonalLayers);

  const cleanEntry = { ...prevEntry, nextLayer: storedNext };
  delete cleanEntry.raid;
  delete cleanEntry.postTowerStallCompletedAtMs;
  const needsWrite =
    Number(prevEntry.nextLayer) !== storedNext ||
    prevEntry.raid != null ||
    prevEntry.postTowerStallCompletedAtMs != null;
  if (Object.keys(cleanEntry).length) bp[BUCKET][id] = cleanEntry;
  else delete bp[BUCKET][id];

  if (needsWrite) {
    await pool.query('UPDATE player_progress SET bandit_progress = ? WHERE player_id = ?', [
      JSON.stringify(bp),
      playerId,
    ]);
  }

  const combatLayer = combatLayerFromStoredNext(storedNext, maxPersonalLayers);
  const difficultyHint = roster.banditNpcTroopDifficultyHintFromLayer(combatLayer);
  const worldDurability = await readBanditWorldDurability(id);
  const tacticTokens = await readPlayerTacticTokenCount(playerId);

  return {
    ok: true,
    data: buildRaidGatePayload({
      id,
      junId,
      tacticTokens,
      maxPersonalLayers,
      storedNext,
      worldDurability,
      difficultyHint,
    }),
  };
}

/**
 * 战败结算「放弃」：本匪寨 **`nextLayer` → 1**（从第 1 层重打），**不**退还已消耗兵符。
 * @param {string} playerId
 * @param {string} banditPoiId
 */
async function resetBanditRaidTowerProgress(playerId, banditPoiId) {
  const id = String(banditPoiId || '').trim();
  if (!BANDIT_MAP_OBJECT_ID_RE.test(id)) {
    return { ok: false, status: 400, error: '无效的匪寨地图对象 ID' };
  }

  await ensurePlayerProgressRow(playerId);
  const junId = await resolveJunIdForBanditPoiId(id);
  if (!junId) {
    return { ok: false, status: 400, error: '无法解析匪寨所属郡' };
  }

  const [rows] = await pool.query('SELECT bandit_progress FROM player_progress WHERE player_id = ?', [playerId]);
  const row = rows[0] || {};
  const bp = parseBanditProgress(row.bandit_progress);
  if (!bp[BUCKET] || typeof bp[BUCKET] !== 'object') bp[BUCKET] = {};

  const prevEntry = bp[BUCKET][id] && typeof bp[BUCKET][id] === 'object' ? { ...bp[BUCKET][id] } : {};
  delete prevEntry.raid;
  delete prevEntry.postTowerStallCompletedAtMs;
  bp[BUCKET][id] = { ...prevEntry, nextLayer: 1 };

  await pool.query('UPDATE player_progress SET bandit_progress = ? WHERE player_id = ?', [
    JSON.stringify(bp),
    playerId,
  ]);

  return getRaidQuotaState(playerId, id);
}

/**
 * @param {string} playerId
 * @param {string} banditPoiId
 * @param {'consume'|'reset_tower'} action
 */
async function applyRaidQuotaAction(playerId, banditPoiId, action) {
  if (action === 'reset_tower') {
    return resetBanditRaidTowerProgress(playerId, banditPoiId);
  }
  if (action !== 'consume') {
    return { ok: false, status: 400, error: '无效的 action' };
  }
  const id = String(banditPoiId || '').trim();
  if (!BANDIT_MAP_OBJECT_ID_RE.test(id)) {
    return { ok: false, status: 400, error: '无效的匪寨地图对象 ID' };
  }

  await ensurePlayerProgressRow(playerId);
  const junId = await resolveJunIdForBanditPoiId(id);
  if (!junId) {
    return { ok: false, status: 400, error: '无法解析匪寨所属郡' };
  }

  await ensureBanditWorldReady(id, junId);

  const roster = await loadSmallMapEnemyRoster();
  const maxPersonalLayers = Number(roster.BANDIT_PERSONAL_TOTAL_LAYERS) || 20;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT bandit_progress FROM player_progress WHERE player_id = ? FOR UPDATE',
      [playerId],
    );
    const row = rows[0] || {};
    const bp = parseBanditProgress(row.bandit_progress);
    if (!bp[BUCKET] || typeof bp[BUCKET] !== 'object') bp[BUCKET] = {};

    const prevEntry = bp[BUCKET][id] && typeof bp[BUCKET][id] === 'object' ? { ...bp[BUCKET][id] } : {};
    const storedNext = normalizeStoredNextLayer(prevEntry.nextLayer, maxPersonalLayers);
    const combatLayer = combatLayerFromStoredNext(storedNext, maxPersonalLayers);

    const [pRows] = await conn.query('SELECT items FROM players WHERE player_id = ? FOR UPDATE', [
      playerId,
    ]);
    if (!pRows[0]) {
      await conn.rollback();
      return { ok: false, status: 404, error: '玩家不存在' };
    }
    const items = parseItemsJson(pRows[0].items);
    const have = countTacticTokens(items);
    if (have < BANDIT_RAID_COST_PER_BATTLE) {
      await conn.rollback();
      return { ok: false, status: 400, error: '兵符不足，无法攻打匪寨' };
    }

    items[BANDIT_RAID_COST_ITEM_ID] = have - BANDIT_RAID_COST_PER_BATTLE;
    if (items[BANDIT_RAID_COST_ITEM_ID] <= 0) delete items[BANDIT_RAID_COST_ITEM_ID];
    await conn.query('UPDATE players SET items = ? WHERE player_id = ?', [
      JSON.stringify(items),
      playerId,
    ]);

    const nextEntry = { ...prevEntry, nextLayer: storedNext };
    delete nextEntry.raid;
    delete nextEntry.postTowerStallCompletedAtMs;
    bp[BUCKET][id] = nextEntry;
    await conn.query('UPDATE player_progress SET bandit_progress = ? WHERE player_id = ?', [
      JSON.stringify(bp),
      playerId,
    ]);

    await conn.commit();

    const difficultyHint = roster.banditNpcTroopDifficultyHintFromLayer(combatLayer);
    const worldDurability = await readBanditWorldDurability(id);
    const tacticTokens = countTacticTokens(items);

    return {
      ok: true,
      data: buildRaidGatePayload({
        id,
        junId,
        tacticTokens,
        maxPersonalLayers,
        storedNext,
        worldDurability,
        difficultyHint,
      }),
    };
  } catch (e) {
    await conn.rollback();
    console.error('[playerBanditRaidQuotaService] consume', e);
    return { ok: false, status: 500, error: '攻打消耗失败' };
  } finally {
    conn.release();
  }
}

/**
 * 匪寨胜利结算「继续」前：按档扣粮草快补连战兵力（权威在客户端 inflight；本接口只扣粮并回传 updates）。
 * @param {string} playerId
 * @param {{ tier: 'light'|'heavy', troops: Array<{ instanceId: string, currentTroops: number, maxTroops: number }> }} body
 */
async function applyBetweenLayerHeal(playerId, body = {}) {
  const pid = playerId != null ? String(playerId).trim() : '';
  if (!pid) {
    return { ok: false, status: 400, error: '缺少玩家 ID' };
  }
  const tier = normalizeBanditBetweenLayerHealTier(body.tier);
  if (!tier) {
    return { ok: false, status: 400, error: '无效的补兵档位' };
  }
  const computed = computeBanditBetweenLayerHeal({
    troops: Array.isArray(body.troops) ? body.troops : [],
    tier,
  });
  if (!computed.ok) {
    return { ok: false, status: 400, error: computed.error || '无法计算补兵' };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT food FROM players WHERE player_id = ? FOR UPDATE',
      [pid],
    );
    if (!rows?.length) {
      await conn.rollback();
      return { ok: false, status: 404, notFound: true, error: '玩家不存在' };
    }
    const food = Math.max(0, Math.floor(Number(rows[0].food) || 0));
    const cost = Math.max(0, Math.floor(Number(computed.foodCost) || 0));
    if (food < cost) {
      await conn.rollback();
      return {
        ok: false,
        status: 400,
        error: `粮草不足，需要 ${cost}（当前 ${food}）`,
        code: 'INSUFFICIENT_FOOD',
      };
    }
    if (cost > 0) {
      await conn.query('UPDATE players SET food = GREATEST(0, food - ?) WHERE player_id = ?', [
        cost,
        pid,
      ]);
    }
    await conn.commit();
    if (cost > 0) {
      await statisticsDeltaService.incrementSpent(pid, { food: cost });
    }
    return {
      ok: true,
      data: {
        tier,
        foodCost: cost,
        foodRemaining: food - cost,
        healAmount: computed.healAmount,
        foodPerBenefitingTroop: computed.foodPerBenefitingTroop,
        updates: computed.updates,
      },
    };
  } catch (e) {
    await conn.rollback();
    console.error('[playerBanditRaidQuotaService] between-layer-heal', e);
    return { ok: false, status: 500, error: '粮草补兵失败' };
  } finally {
    conn.release();
  }
}

module.exports = {
  getRaidQuotaState,
  applyRaidQuotaAction,
  applyBetweenLayerHeal,
  resolveJunIdForBanditPoiId,
  BANDIT_RAID_COST_ITEM_ID,
  BANDIT_RAID_COST_PER_BATTLE,
  /** @deprecated 旧次数制常量；保留避免外部 require 崩 */
  RAID_INITIAL: 0,
  RAID_MAX: 0,
  RAID_PER_WINDOW: 0,
};
