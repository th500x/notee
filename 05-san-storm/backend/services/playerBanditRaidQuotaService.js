/**
 * 匪寨「攻打」次数：与探索配额分立；存 `player_progress.bandit_progress.byJunRaidQuota[<jun_id>]`。
 * 同一郡内多座匪寨（阶段一各 2 枚）**共用**剩余次数；**个人爬塔进度**仍为 `byBanditMapObjectId[<匪寨地图对象 ID>].nextLayer`。
 * 档序列与补点算法见 `backend/utils/banditRaidQuotaAccrual.js`（单源）。
 */

const path = require('path');
const { pathToFileURL } = require('url');
const { pool } = require('../database/connection');
const { getPhase1BanditPoiIdsForJun } = require('../../shared/utils/strategicBanditPlaceholderPhase1.js');
const {
  BANDIT_RAID_QUOTA_DEFAULTS,
  banditWindowSerialAt,
  msUntilNextBanditQuotaBoundary,
  accrueBanditRaidQuota,
} = require('../utils/banditRaidQuotaAccrual');

const RAID_INITIAL = BANDIT_RAID_QUOTA_DEFAULTS.initial;
const RAID_MAX = BANDIT_RAID_QUOTA_DEFAULTS.max;
const RAID_PER_WINDOW = BANDIT_RAID_QUOTA_DEFAULTS.perWindow;

const BANDIT_MAP_OBJECT_ID_RE = /^san_\d+_bandit_[1-9]_[a-z0-9_]+$/i;

/** `bandit_progress` JSON：个人层进度仍按匪寨地图对象 ID */
const BUCKET = 'byBanditMapObjectId';
/** 攻打次数按郡共享（`config_jun.jun_id`） */
const JUN_RAID_BUCKET = 'byJunRaidQuota';

/** @returns {number} 距下一 8 小时档边界的整分钟数（≥0） */
function minutesUntilNextBanditBoundary() {
  return Math.ceil(msUntilNextBanditQuotaBoundary() / 60000);
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
 * 读 `bandits` 全服累计耗层（见 17-6 §4）；对外 **camelCase** 与列语义对齐：`maxLayers`、`clearedLayers`、`layersRemaining`。
 * 表或行缺失时返回 null，不打断配额接口。
 * @param {string} banditPoiId
 * @returns {Promise<{ maxLayers: number, clearedLayers: number, layersRemaining: number } | null>}
 */
async function readBanditWorldDurability(banditPoiId) {
  try {
    const [rows] = await pool.query(
      'SELECT max_layers, cleared_layers FROM bandits WHERE bandit_id = ? LIMIT 1',
      [banditPoiId]
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
  if (!Number.isFinite(s) || s < 1) return 1;
  if (s > maxP) return null;
  return s;
}

function normalizeStoredNextLayer(raw, maxPersonalLayers) {
  const maxP = Math.max(1, Math.floor(Number(maxPersonalLayers)) || 20);
  const s0 = Math.floor(Number(raw));
  if (!Number.isFinite(s0) || s0 < 1) return 1;
  return Math.min(maxP + 1, s0);
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
 * 从旧版「每匪寨 `raid`」合并为 **`byJunRaidQuota[junId]`** 一次；并去掉各匪寨条目上的 `raid`。
 * @returns {boolean} 是否改写了 `bp`（需要落库）
 */
function migrateJunRaidFromLegacyIfNeeded(bp, junId, currentSerial) {
  if (!bp[JUN_RAID_BUCKET] || typeof bp[JUN_RAID_BUCKET] !== 'object') bp[JUN_RAID_BUCKET] = {};
  const cur = bp[JUN_RAID_BUCKET][junId];
  if (cur && typeof cur === 'object' && Number.isFinite(Number(cur.remaining))) {
    return false;
  }
  const pidList = getPhase1BanditPoiIdsForJun(junId);
  if (!pidList.length) return false;
  if (!bp[BUCKET] || typeof bp[BUCKET] !== 'object') bp[BUCKET] = {};
  const collected = [];
  for (const pid of pidList) {
    const prevEntry = bp[BUCKET][pid] && typeof bp[BUCKET][pid] === 'object' ? { ...bp[BUCKET][pid] } : {};
    const prevRaid = prevEntry.raid && typeof prevEntry.raid === 'object' ? { ...prevEntry.raid } : {};
    collected.push(accrueBanditRaidQuota(prevRaid, currentSerial));
  }
  let remaining;
  let lastAccruedSerial;
  if (!collected.length) {
    const a = accrueBanditRaidQuota({}, currentSerial);
    remaining = a.remaining;
    lastAccruedSerial = a.lastAccruedSerial;
  } else {
    remaining = Math.min(...collected.map((c) => c.remaining));
    lastAccruedSerial = Math.max(...collected.map((c) => c.lastAccruedSerial));
  }
  bp[JUN_RAID_BUCKET][junId] = { remaining, lastAccruedSerial };
  for (const pid of pidList) {
    if (!bp[BUCKET][pid] || typeof bp[BUCKET][pid] !== 'object') continue;
    const { raid: _r, ...rest } = bp[BUCKET][pid];
    if (Object.keys(rest).length) bp[BUCKET][pid] = rest;
    else delete bp[BUCKET][pid];
  }
  return true;
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

  const roster = await loadSmallMapEnemyRoster();
  const maxPersonalLayers = Number(roster.BANDIT_PERSONAL_TOTAL_LAYERS) || 20;

  const [rows] = await pool.query('SELECT bandit_progress FROM player_progress WHERE player_id = ?', [
    playerId,
  ]);
  const row = rows[0] || {};
  const bp = parseBanditProgress(row.bandit_progress);
  if (!bp[BUCKET] || typeof bp[BUCKET] !== 'object') bp[BUCKET] = {};
  if (!bp[JUN_RAID_BUCKET] || typeof bp[JUN_RAID_BUCKET] !== 'object') bp[JUN_RAID_BUCKET] = {};

  const currentSerial = banditWindowSerialAt();
  const migrated = migrateJunRaidFromLegacyIfNeeded(bp, junId, currentSerial);

  const junRaidPrev =
    bp[JUN_RAID_BUCKET][junId] && typeof bp[JUN_RAID_BUCKET][junId] === 'object'
      ? { ...bp[JUN_RAID_BUCKET][junId] }
      : {};
  const acc = accrueBanditRaidQuota(junRaidPrev, currentSerial);
  bp[JUN_RAID_BUCKET][junId] = {
    remaining: acc.remaining,
    lastAccruedSerial: acc.lastAccruedSerial,
  };

  const prevEntry = bp[BUCKET][id] && typeof bp[BUCKET][id] === 'object' ? { ...bp[BUCKET][id] } : {};
  const storedNext = normalizeStoredNextLayer(prevEntry.nextLayer, maxPersonalLayers);
  const combatLayer = combatLayerFromStoredNext(storedNext, maxPersonalLayers);
  const towerCompleted = combatLayer == null;
  const nextLayer = towerCompleted ? maxPersonalLayers : combatLayer;

  const cleanEntry = { ...prevEntry, nextLayer: storedNext };
  delete cleanEntry.raid;
  if (Object.keys(cleanEntry).length) bp[BUCKET][id] = cleanEntry;
  else delete bp[BUCKET][id];

  const dirty = migrated || acc.changed;

  if (dirty) {
    await pool.query('UPDATE player_progress SET bandit_progress = ? WHERE player_id = ?', [
      JSON.stringify(bp),
      playerId,
    ]);
  }

  const difficultyHint = towerCompleted
    ? '已全部通关'
    : roster.banditNpcTroopDifficultyHintFromLayer(nextLayer);
  const worldDurability = await readBanditWorldDurability(id);
  const worldDepleted =
    worldDurability != null &&
    Number.isFinite(Number(worldDurability.layersRemaining)) &&
    Number(worldDurability.layersRemaining) <= 0;

  return {
    ok: true,
    data: {
      banditPoiId: id,
      junId,
      remaining: acc.remaining,
      max: RAID_MAX,
      refillPerWindow: RAID_PER_WINDOW,
      minutesUntilRefill: minutesUntilNextBanditBoundary(),
      nextLayer,
      personalTotalLayers: maxPersonalLayers,
      worldDurability,
      difficultyHint,
      towerCompleted,
      canBattle: acc.remaining > 0 && !towerCompleted && !worldDepleted,
    },
  };
}

/**
 * 战败结算「放弃」：本匪寨 **`nextLayer` → 1**（从第 1 层重打），**不**返还已消耗的攻打次数（郡池不变）。
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

  const roster = await loadSmallMapEnemyRoster();
  const maxPersonalLayers = Number(roster.BANDIT_PERSONAL_TOTAL_LAYERS) || 20;

  const [rows] = await pool.query('SELECT bandit_progress FROM player_progress WHERE player_id = ?', [playerId]);
  const row = rows[0] || {};
  const bp = parseBanditProgress(row.bandit_progress);
  if (!bp[BUCKET] || typeof bp[BUCKET] !== 'object') bp[BUCKET] = {};
  if (!bp[JUN_RAID_BUCKET] || typeof bp[JUN_RAID_BUCKET] !== 'object') bp[JUN_RAID_BUCKET] = {};

  const currentSerial = banditWindowSerialAt();
  migrateJunRaidFromLegacyIfNeeded(bp, junId, currentSerial);
  const junRaidPrev =
    bp[JUN_RAID_BUCKET][junId] && typeof bp[JUN_RAID_BUCKET][junId] === 'object'
      ? { ...bp[JUN_RAID_BUCKET][junId] }
      : {};
  const acc = accrueBanditRaidQuota(junRaidPrev, currentSerial);
  bp[JUN_RAID_BUCKET][junId] = {
    remaining: acc.remaining,
    lastAccruedSerial: acc.lastAccruedSerial,
  };

  const prevEntry = bp[BUCKET][id] && typeof bp[BUCKET][id] === 'object' ? { ...bp[BUCKET][id] } : {};
  bp[BUCKET][id] = { ...prevEntry, nextLayer: 1 };
  delete bp[BUCKET][id].raid;

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

  const roster = await loadSmallMapEnemyRoster();
  const maxPersonalLayers = Number(roster.BANDIT_PERSONAL_TOTAL_LAYERS) || 20;

  const [rows] = await pool.query('SELECT bandit_progress FROM player_progress WHERE player_id = ?', [
    playerId,
  ]);
  const row = rows[0] || {};
  const bp = parseBanditProgress(row.bandit_progress);
  if (!bp[BUCKET] || typeof bp[BUCKET] !== 'object') bp[BUCKET] = {};
  if (!bp[JUN_RAID_BUCKET] || typeof bp[JUN_RAID_BUCKET] !== 'object') bp[JUN_RAID_BUCKET] = {};

  const currentSerial = banditWindowSerialAt();
  migrateJunRaidFromLegacyIfNeeded(bp, junId, currentSerial);

  const junRaidPrev =
    bp[JUN_RAID_BUCKET][junId] && typeof bp[JUN_RAID_BUCKET][junId] === 'object'
      ? { ...bp[JUN_RAID_BUCKET][junId] }
      : {};
  const acc = accrueBanditRaidQuota(junRaidPrev, currentSerial);
  if (acc.remaining <= 0) {
    return { ok: false, status: 400, error: '攻打次数不足' };
  }

  const prevEntry = bp[BUCKET][id] && typeof bp[BUCKET][id] === 'object' ? { ...bp[BUCKET][id] } : {};
  const storedNext = normalizeStoredNextLayer(prevEntry.nextLayer, maxPersonalLayers);
  const combatLayer = combatLayerFromStoredNext(storedNext, maxPersonalLayers);
  if (combatLayer == null) {
    return { ok: false, status: 400, error: '匪寨个人进度已通关' };
  }
  const worldDurabilityPre = await readBanditWorldDurability(id);
  if (
    worldDurabilityPre != null &&
    Number.isFinite(Number(worldDurabilityPre.layersRemaining)) &&
    Number(worldDurabilityPre.layersRemaining) <= 0
  ) {
    return { ok: false, status: 400, error: '匪寨耐久已耗尽' };
  }

  const nextLayer = combatLayer;
  const newRemaining = acc.remaining - 1;
  bp[JUN_RAID_BUCKET][junId] = {
    remaining: newRemaining,
    lastAccruedSerial: acc.lastAccruedSerial,
  };

  bp[BUCKET][id] = { ...prevEntry, nextLayer: storedNext };
  delete bp[BUCKET][id].raid;

  await pool.query('UPDATE player_progress SET bandit_progress = ? WHERE player_id = ?', [
    JSON.stringify(bp),
    playerId,
  ]);

  const difficultyHint = roster.banditNpcTroopDifficultyHintFromLayer(nextLayer);
  const worldDurability = await readBanditWorldDurability(id);
  const towerCompleted = storedNext > maxPersonalLayers;
  const worldDepleted =
    worldDurability != null &&
    Number.isFinite(Number(worldDurability.layersRemaining)) &&
    Number(worldDurability.layersRemaining) <= 0;

  return {
    ok: true,
    data: {
      banditPoiId: id,
      junId,
      remaining: newRemaining,
      max: RAID_MAX,
      refillPerWindow: RAID_PER_WINDOW,
      minutesUntilRefill: minutesUntilNextBanditBoundary(),
      nextLayer,
      personalTotalLayers: maxPersonalLayers,
      worldDurability,
      difficultyHint,
      towerCompleted,
      canBattle: newRemaining > 0 && !towerCompleted && !worldDepleted,
    },
  };
}

module.exports = {
  getRaidQuotaState,
  applyRaidQuotaAction,
  resolveJunIdForBanditPoiId,
  RAID_INITIAL,
  RAID_MAX,
  RAID_PER_WINDOW,
};
