/**
 * 探索链、探索事件进度、与 rewards 共用的辅助逻辑
 */

const { pool } = require('../database/connection');

/** 事件 requiredItems 单段解析：无冒号则数量 1 */
function parseEventCostSegment(segment) {
  const s = (segment || '').trim();
  if (!s) return null;
  const i = s.indexOf(':');
  if (i === -1) return { key: s, amount: 1 };
  const n = parseInt(s.slice(i + 1), 10);
  return { key: s.slice(0, i), amount: Number.isFinite(n) && n > 0 ? n : 1 };
}

/** 与前端 playerMeetsEventRequiredItems 一致 */
function playerMeetsExploreChainGateItems(requiredItemsStr, itemsObject) {
  if (!requiredItemsStr || !String(requiredItemsStr).trim()) return true;
  const inv = itemsObject || {};
  const segments = String(requiredItemsStr)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const seg of segments) {
    const colon = seg.indexOf(':');
    const key = colon === -1 ? seg : seg.slice(0, colon);
    const need = colon === -1 ? 1 : Math.max(1, parseInt(seg.slice(colon + 1), 10) || 1);
    if (!key.startsWith('item_') && !key.includes('_item_')) continue;
    if ((Number(inv[key]) || 0) < need) return false;
  }
  return true;
}

/**
 * 探索链：已完成本环但背包没有下一环钥匙道具 → 允许重做本环
 */
async function isExploreChainStrandedRedo(playerId, chainId, chainLevel) {
  const level = Number(chainLevel);
  if (!chainId || !Number.isFinite(level)) return false;
  const [nextRows] = await pool.query(
    'SELECT required_items FROM config_events WHERE chain_id = ? AND chain_level = ? LIMIT 1',
    [chainId, level + 1]
  );
  if (!nextRows?.length) return false;
  const req = nextRows[0].required_items;
  if (!req || !String(req).trim()) return false;
  const [pRows] = await pool.query('SELECT items FROM players WHERE player_id = ?', [playerId]);
  let inv = {};
  if (pRows[0]?.items) {
    inv = typeof pRows[0].items === 'string' ? JSON.parse(pRows[0].items) : pRows[0].items;
  }
  return !playerMeetsExploreChainGateItems(req, inv);
}

/**
 * 探索事件链：参与「按日历日统一重置」的 `chain_id` 列表（与 `public/data/shared/events.json` 等配置一致）。
 * 新链纳入每日重置时在此追加；勿再用地理占位链名。
 */
const EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET = [
  'chain_cunfu_v1',
  'chain_troop_legendary_v1',
  'chain_troop_core_v1',
];

function mysqlDateToYmd(val) {
  if (val == null) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function chainLevelNum(lv) {
  const n = Number(lv);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 与前端 `getEffectiveExploreChainMaxCompleted`（eventUtils.js）一致：按环序推进，下一环 required_items 未满足则停在当前有效环。
 * @param {Array<{ event_id: string, chain_level: any, required_items: any }>} chainEvents - 单条链上的 config 行
 * @param {Record<string, { status?: string }>} completedEvents - explore_events JSON
 * @param {Record<string, number>} itemCounts - 背包道具数量
 */
function getEffectiveExploreChainMaxCompleted(chainEvents, completedEvents, itemCounts) {
  if (!chainEvents?.length) return 0;
  const sorted = [...chainEvents].sort((a, b) => chainLevelNum(a.chain_level) - chainLevelNum(b.chain_level));
  let effective = 0;
  for (const evt of sorted) {
    const L = chainLevelNum(evt.chain_level);
    if (L !== effective + 1) continue;
    const rec = completedEvents[evt.event_id];
    if (rec?.status !== 'completed') break;

    const next = sorted.find((e) => chainLevelNum(e.chain_level) === L + 1);
    if (!next) {
      effective = L;
      break;
    }
    if (next.required_items && !playerMeetsExploreChainGateItems(next.required_items, itemCounts)) {
      const nextRec = completedEvents[next.event_id];
      if (nextRec?.status !== 'completed') {
        break;
      }
    }
    effective = L;
  }
  return effective;
}

function maxChainLevel(chainEvents) {
  let m = 0;
  for (const e of chainEvents) m = Math.max(m, chainLevelNum(e.chain_level));
  return m;
}

/**
 * 探索事件链是否「进行中途」：有效已完成环数在 (0, maxLevel] 之间且小于 maxLevel（与前端 getActiveExploreChainId 判定一致）。
 * 此种情况不执行每日链进度清空，避免跨日打断未完结链；未开链或已通全链仍按日重置。
 */
async function anyExploreEventChainIncompleteMidProgress(playerId, exploreEventsObj) {
  const ph = EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET.map(() => '?').join(',');
  const [chainRows] = await pool.query(
    `SELECT chain_id, event_id, chain_level, required_items FROM config_events WHERE chain_id IN (${ph}) ORDER BY chain_id, chain_level`,
    EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET
  );
  const byChain = new Map();
  for (const r of chainRows) {
    const cid = r.chain_id;
    if (!byChain.has(cid)) byChain.set(cid, []);
    byChain.get(cid).push(r);
  }

  const [pRows] = await pool.query('SELECT items FROM players WHERE player_id = ?', [playerId]);
  let itemCounts = {};
  if (pRows[0]?.items) {
    const raw = pRows[0].items;
    const inv = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (inv && typeof inv === 'object') itemCounts = inv;
  }

  const completed = exploreEventsObj && typeof exploreEventsObj === 'object' ? exploreEventsObj : {};

  for (const chainId of EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET) {
    const evts = byChain.get(chainId);
    if (!evts?.length) continue;
    const maxLv = maxChainLevel(evts);
    if (maxLv <= 0) continue;
    const eff = getEffectiveExploreChainMaxCompleted(evts, completed, itemCounts);
    if (eff > 0 && eff < maxLv) return true;
  }
  return false;
}

/**
 * 探索事件链按日历日重置：新日且 `explore_chain_reset_date` 早于今日时，清空 `EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET` 所列链在 `explore_events` 中的完成记录并写入今日。
 * 若玩家在任一条配置链上为「中途」（有效已完成环数 ∈ (0, 该链最大环)），则**不**清空、**不**更新日期，链可跨日继续；通全链或未开链的仍按日清空。
 */
async function maybeResetExploreEventChainsDaily(playerId) {
  try {
    await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);
    const [rows] = await pool.query(
      'SELECT explore_events, explore_chain_reset_date FROM player_events WHERE player_id = ?',
      [playerId]
    );
    const row = rows[0];
    if (!row) return;

    const [dr] = await pool.query('SELECT CURDATE() AS d');
    const todayStr = mysqlDateToYmd(dr[0].d);

    const storedStr = mysqlDateToYmd(row.explore_chain_reset_date);

    if (storedStr && storedStr >= todayStr) return;

    let events = {};
    if (row.explore_events) {
      try {
        events =
          typeof row.explore_events === 'string' ? JSON.parse(row.explore_events) : row.explore_events;
      } catch {
        events = {};
      }
    }

    if (await anyExploreEventChainIncompleteMidProgress(playerId, events)) {
      return;
    }

    const ph = EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET.map(() => '?').join(',');
    const [chainRows] = await pool.query(
      `SELECT event_id FROM config_events WHERE chain_id IN (${ph})`,
      EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET
    );
    const ids = new Set(chainRows.map((r) => r.event_id));
    for (const k of Object.keys(events)) {
      if (ids.has(k)) delete events[k];
    }
    await pool.query(
      'UPDATE player_events SET explore_events = ?, explore_chain_reset_date = ? WHERE player_id = ?',
      [JSON.stringify(events), todayStr, playerId]
    );
  } catch (e) {
    if (e.code === 'ER_BAD_FIELD_ERROR') {
      console.warn(
        '[Players] 未迁移 explore_chain_reset_date，探索事件链每日重置已跳过（请执行 add-explore-chain-daily-reset.sql）'
      );
      return;
    }
    throw e;
  }
}

/** 带战斗的选项：整编类道具是否延后到战斗奖励之后（仅选项 A 可能进惩罚战） */
function shouldDeferTroopRepairAfterBattleRewards(option, battleResult, fortune, optionKey) {
  if (optionKey === 'B') return false;
  if (!option.triggerBattle) return false;
  if (battleResult === 'victory' || battleResult === 'defeat') return true;
  const n = fortune?.fortuneName;
  return n === '凶' || n === '大凶';
}

/**
 * 在 /rewards 成功发放后立即写入 explore_events（与前端 closeReward 的 POST /events 一致）。
 * 否则仅依赖客户端关面板后再上报 → 玩家在关闭前可再次探索并重复领取同一链环奖励。
 */
async function recordExploreChainEventCompleted(playerId, eventId, chainId, chainLevel) {
  if (!eventId || !chainId) return;
  await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);
  const [rows] = await pool.query('SELECT explore_events FROM player_events WHERE player_id = ?', [
    playerId,
  ]);
  let events = {};
  if (rows[0]?.explore_events) {
    try {
      events =
        typeof rows[0].explore_events === 'string'
          ? JSON.parse(rows[0].explore_events)
          : rows[0].explore_events;
    } catch {
      events = {};
    }
  }
  events[eventId] = {
    status: 'completed',
    chainId,
    chainLevel: chainLevel != null ? chainLevel : null,
    updated_at: new Date().toISOString(),
  };
  await pool.query('UPDATE player_events SET explore_events = ? WHERE player_id = ?', [
    JSON.stringify(events),
    playerId,
  ]);
}

// ── 事件进度查询与记录 ─────────────────────────────────────────────────────────

/** 事件类型 → player_events 列名映射 */
const EVENT_TYPE_FIELD_MAP = {
  1: 'historical_events',
  2: 'fictional_events',
  3: 'daily_events',
  4: 'weekly_events',
  5: 'mini_events',
  6: 'explore_events',
  7: 'reward_events',
};

/**
 * 获取玩家探索事件进度（GET /events/explore）。
 * 同时执行探索链每日重置检查。
 * @returns {{ events: object }}
 */
function parseExploreSessionLock(raw) {
  if (raw == null || raw === '') return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

/**
 * @returns {{ events: object, sessionLock: object|null }}
 */
async function getExploreEvents(playerId) {
  await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);
  await maybeResetExploreEventChainsDaily(playerId);
  const [rows] = await pool.query(
    'SELECT explore_events, explore_session_lock FROM player_events WHERE player_id = ?',
    [playerId],
  );
  let events = {};
  if (rows[0]?.explore_events) {
    events = typeof rows[0].explore_events === 'string'
      ? JSON.parse(rows[0].explore_events)
      : rows[0].explore_events;
  }
  const sessionLock = parseExploreSessionLock(rows[0]?.explore_session_lock);
  return { events, sessionLock };
}

/**
 * 写入探索会话锁（链未完结前由 M2/大地图逻辑置位，链结束或显式放弃时传 null）
 * @param {string} playerId
 * @param {object|null} sessionLock
 */
async function setExploreSessionLock(playerId, sessionLock) {
  await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);
  const val = sessionLock == null ? null : JSON.stringify(sessionLock);
  await pool.query('UPDATE player_events SET explore_session_lock = ? WHERE player_id = ?', [val, playerId]);
  return { ok: true };
}

/**
 * 记录任意类型事件进度（POST /events）。
 * @param {{ eventId: string, eventType: number, status?: string, data?: object }} params
 * @returns {{ ok: true, eventId, field, status } | { badRequest: string }}
 */
async function recordEventProgress(playerId, { eventId, eventType, status = 'completed', data = {} }) {
  const field = EVENT_TYPE_FIELD_MAP[eventType];
  if (!field) return { badRequest: '无效的事件类型' };

  await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);

  const [rows] = await pool.query(
    `SELECT ${field} FROM player_events WHERE player_id = ?`,
    [playerId],
  );
  let events = {};
  if (rows[0]?.[field]) {
    events = typeof rows[0][field] === 'string'
      ? JSON.parse(rows[0][field])
      : rows[0][field];
  }

  events[eventId] = {
    status,
    ...data,
    updated_at: new Date().toISOString(),
  };

  await pool.query(
    `UPDATE player_events SET ${field} = ? WHERE player_id = ?`,
    [JSON.stringify(events), playerId],
  );

  return { ok: true, eventId, field, status };
}

module.exports = {
  parseEventCostSegment,
  playerMeetsExploreChainGateItems,
  isExploreChainStrandedRedo,
  maybeResetExploreEventChainsDaily,
  shouldDeferTroopRepairAfterBattleRewards,
  recordExploreChainEventCompleted,
  getExploreEvents,
  setExploreSessionLock,
  recordEventProgress,
  EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET,
};
