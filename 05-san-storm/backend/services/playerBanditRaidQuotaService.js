/**
 * 匪寨「攻打」次数：与探索配额分立；存 `player_progress.bandit_progress.byBanditMapObjectId[<匪寨地图对象 ID>].raid`。
 * **匪寨地图对象 ID**：`san_{赛季}_bandit_{1～9}_{slug}`（04-1-ID_NAMING_GUIDE §15），与 HTTP **`targetPoiId`** / **`banditPoiId`** 同族，**勿**与「城点」`san_*_city_*` 混淆。
 * 规则：初始 6；每跨越一个日历 8 小时整点窗口 +6；上限 18。
 */

const path = require('path');
const { pathToFileURL } = require('url');
const { pool } = require('../database/connection');

const BANDIT_MAP_OBJECT_ID_RE = /^san_\d+_bandit_[1-9]_[a-z0-9_]+$/i;

/** `bandit_progress` JSON 内按匪寨地图对象 ID 分桶（仅此键，不做旧键兼容） */
const BUCKET = 'byBanditMapObjectId';

const RAID_INITIAL = 6;
const RAID_MAX = 18;
const RAID_PER_WINDOW = 6;

let rosterEsmPromise = null;
function loadSmallMapEnemyRoster() {
  if (!rosterEsmPromise) {
    const filePath = path.join(__dirname, '../../shared/utils/smallMapEnemyRoster.js');
    rosterEsmPromise = import(pathToFileURL(filePath).href);
  }
  return rosterEsmPromise;
}

function banditWindowSerialAt(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const mo = d.getMonth();
  const day = d.getDate();
  const h = d.getHours();
  const midnight = new Date(y, mo, day, 0, 0, 0, 0).getTime();
  const daySerial = Math.floor(midnight / 86400000);
  const widx = h < 8 ? 0 : h < 16 ? 1 : 2;
  return daySerial * 3 + widx;
}

function nextBanditBoundaryMs(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const mo = d.getMonth();
  const day = d.getDate();
  const h = d.getHours();
  if (h < 8) return new Date(y, mo, day, 8, 0, 0, 0).getTime();
  if (h < 16) return new Date(y, mo, day, 16, 0, 0, 0).getTime();
  return new Date(y, mo, day + 1, 0, 0, 0, 0).getTime();
}

function minutesUntilNextBanditBoundary() {
  return Math.max(0, Math.ceil((nextBanditBoundaryMs() - Date.now()) / 60000));
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

function accrueRaidQuota(raid, currentSerial) {
  let remaining = Number.isFinite(Number(raid?.remaining)) ? Number(raid.remaining) : RAID_INITIAL;
  let lastSerial =
    raid?.lastAccruedSerial != null && Number.isFinite(Number(raid.lastAccruedSerial))
      ? Number(raid.lastAccruedSerial)
      : null;

  if (lastSerial == null) {
    const r0 = Math.min(RAID_MAX, Math.max(0, RAID_INITIAL));
    return { remaining: r0, lastAccruedSerial: currentSerial, changed: true };
  }

  let changed = false;
  while (lastSerial < currentSerial) {
    lastSerial += 1;
    remaining = Math.min(RAID_MAX, remaining + RAID_PER_WINDOW);
    changed = true;
  }

  const clamped = Math.min(RAID_MAX, Math.max(0, remaining));
  if (clamped !== remaining) {
    remaining = clamped;
    changed = true;
  }

  return { remaining, lastAccruedSerial: lastSerial, changed };
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
  const roster = await loadSmallMapEnemyRoster();
  const maxPersonalLayers = Number(roster.BANDIT_PERSONAL_TOTAL_LAYERS) || 20;

  const [rows] = await pool.query('SELECT bandit_progress FROM player_progress WHERE player_id = ?', [
    playerId,
  ]);
  const row = rows[0] || {};
  const bp = parseBanditProgress(row.bandit_progress);
  if (!bp[BUCKET] || typeof bp[BUCKET] !== 'object') bp[BUCKET] = {};

  const currentSerial = banditWindowSerialAt();
  const prevEntry = bp[BUCKET][id] && typeof bp[BUCKET][id] === 'object' ? { ...bp[BUCKET][id] } : {};
  const prevRaid = prevEntry.raid && typeof prevEntry.raid === 'object' ? { ...prevEntry.raid } : {};

  const acc = accrueRaidQuota(prevRaid, currentSerial);
  const storedNext = normalizeStoredNextLayer(prevEntry.nextLayer, maxPersonalLayers);
  const combatLayer = combatLayerFromStoredNext(storedNext, maxPersonalLayers);
  const towerCompleted = combatLayer == null;
  const nextLayer = towerCompleted ? maxPersonalLayers : combatLayer;

  const mergedEntry = {
    ...prevEntry,
    nextLayer: storedNext,
    raid: {
      remaining: acc.remaining,
      lastAccruedSerial: acc.lastAccruedSerial,
    },
  };

  if (acc.changed) {
    bp[BUCKET][id] = mergedEntry;
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
 * 战败结算「放弃」：本匪寨 **`nextLayer` → 1**（从第 1 层重打），**不**返还已消耗的攻打次数。
 * @param {string} playerId
 * @param {string} banditPoiId
 */
async function resetBanditRaidTowerProgress(playerId, banditPoiId) {
  const id = String(banditPoiId || '').trim();
  if (!BANDIT_MAP_OBJECT_ID_RE.test(id)) {
    return { ok: false, status: 400, error: '无效的匪寨地图对象 ID' };
  }

  await ensurePlayerProgressRow(playerId);
  const roster = await loadSmallMapEnemyRoster();
  const maxPersonalLayers = Number(roster.BANDIT_PERSONAL_TOTAL_LAYERS) || 20;

  const [rows] = await pool.query('SELECT bandit_progress FROM player_progress WHERE player_id = ?', [playerId]);
  const row = rows[0] || {};
  const bp = parseBanditProgress(row.bandit_progress);
  if (!bp[BUCKET] || typeof bp[BUCKET] !== 'object') bp[BUCKET] = {};

  const currentSerial = banditWindowSerialAt();
  const prevEntry = bp[BUCKET][id] && typeof bp[BUCKET][id] === 'object' ? { ...bp[BUCKET][id] } : {};
  const prevRaid = prevEntry.raid && typeof prevEntry.raid === 'object' ? { ...prevEntry.raid } : {};
  const acc = accrueRaidQuota(prevRaid, currentSerial);

  bp[BUCKET][id] = {
    ...prevEntry,
    nextLayer: 1,
    raid: {
      remaining: acc.remaining,
      lastAccruedSerial: acc.lastAccruedSerial,
    },
  };

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
  const roster = await loadSmallMapEnemyRoster();
  const maxPersonalLayers = Number(roster.BANDIT_PERSONAL_TOTAL_LAYERS) || 20;

  const [rows] = await pool.query('SELECT bandit_progress FROM player_progress WHERE player_id = ?', [
    playerId,
  ]);
  const row = rows[0] || {};
  const bp = parseBanditProgress(row.bandit_progress);
  if (!bp[BUCKET] || typeof bp[BUCKET] !== 'object') bp[BUCKET] = {};

  const currentSerial = banditWindowSerialAt();
  const prevEntry = bp[BUCKET][id] && typeof bp[BUCKET][id] === 'object' ? { ...bp[BUCKET][id] } : {};
  const prevRaid = prevEntry.raid && typeof prevEntry.raid === 'object' ? { ...prevEntry.raid } : {};
  const acc = accrueRaidQuota(prevRaid, currentSerial);
  if (acc.remaining <= 0) {
    return { ok: false, status: 400, error: '攻打次数不足' };
  }

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
  bp[BUCKET][id] = {
    ...prevEntry,
    nextLayer: storedNext,
    raid: {
      remaining: newRemaining,
      lastAccruedSerial: acc.lastAccruedSerial,
    },
  };

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
  RAID_INITIAL,
  RAID_MAX,
  RAID_PER_WINDOW,
};
