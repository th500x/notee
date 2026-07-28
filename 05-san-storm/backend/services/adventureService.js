/**
 * 探险系统（Extra 挂机派遣）
 * 与手动事件系统独立；派遣锁定 Extra 槽；到期结算为 ready，领取才入账。
 *
 * @module backend/services/adventureService
 */

const path = require('path');
const { pathToFileURL } = require('url');
const { pool } = require('../database/connection');
const lineupExtraService = require('./lineupExtraService');
const garrisonBuildService = require('./garrisonBuildService');
const { configTroopToSiegeNpc } = require('./aiConscriptLegionService');
const { runPvpAutoDuel } = require('./pvp/auto-duel/pvpAutoDuelSim');
const { executeRewards } = require('./rewardService');
const { buildAdventureStoryFromFact } = require('./adventureStoryTemplate');
const {
  tryConsumeTacticTokenOnce,
  refundTacticTokenOnce,
  getTacticTokenCount,
} = require('./tacticTokenService');

const LOG = '[adventure]';
const STATUS_DISPATCHED = 'dispatched';
const STATUS_READY = 'ready';
const STATUS_CLAIMED = 'claimed';
/** 同时最多 4 路（Extra A–D 各一路） */
const MAX_CONCURRENT = 4;
/** 每次派遣消耗兵符（与探索开链 / 匪寨同源） */
const TACTIC_TOKEN_COST_PER_DISPATCH = 1;

const SLOT_LABELS = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };

let _rosterEsm = null;
function loadRosterEsm() {
  if (!_rosterEsm) {
    const fp = path.join(__dirname, '../../shared/utils/smallMapEnemyRoster.js');
    _rosterEsm = import(pathToFileURL(fp).href);
  }
  return _rosterEsm;
}

function formatThemeRow(row) {
  if (!row) return null;
  return {
    id: row.theme_id,
    season: row.season,
    name: row.theme_name,
    tone: row.tone,
    description: row.description || '',
    durationHours: Number(row.duration_hours),
    encounterRate: Number(row.encounter_rate),
    enemyTier: row.enemy_tier,
    rewardSilverMin: Number(row.reward_silver_min),
    rewardSilverMax: Number(row.reward_silver_max),
    rewardFoodMin: Number(row.reward_food_min),
    rewardFoodMax: Number(row.reward_food_max),
    sortOrder: Number(row.sort_order),
  };
}

function parseResolveJson(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

function formatAdventureRow(row) {
  if (!row) return null;
  const endsAt = row.ends_at instanceof Date ? row.ends_at : new Date(row.ends_at);
  const dispatchedAt =
    row.dispatched_at instanceof Date ? row.dispatched_at : new Date(row.dispatched_at);
  const now = Date.now();
  const endsMs = endsAt.getTime();
  return {
    adventureId: Number(row.adventure_id),
    playerId: row.player_id,
    extraSlot: Number(row.extra_slot),
    extraSlotLabel: SLOT_LABELS[row.extra_slot] || String(row.extra_slot),
    themeId: row.theme_id,
    status: row.status,
    dispatchedAt: dispatchedAt.toISOString(),
    endsAt: endsAt.toISOString(),
    remainingMs: row.status === STATUS_DISPATCHED ? Math.max(0, endsMs - now) : 0,
    canSettle: row.status === STATUS_DISPATCHED && now >= endsMs,
    canClaim: row.status === STATUS_READY,
    resolve: parseResolveJson(row.resolve_json),
    storyText: row.story_text || null,
    claimedAt: row.claimed_at
      ? (row.claimed_at instanceof Date ? row.claimed_at : new Date(row.claimed_at)).toISOString()
      : null,
  };
}

function randIntInclusive(min, max) {
  const a = Math.floor(Number(min) || 0);
  const b = Math.floor(Number(max) || 0);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function resolveDurationMs(themeRow) {
  const devSec = Number(process.env.ADVENTURE_DEV_DURATION_SECONDS);
  if (Number.isFinite(devSec) && devSec > 0) {
    return Math.floor(devSec * 1000);
  }
  const hours = Number(themeRow.duration_hours);
  const h = Number.isFinite(hours) && hours > 0 ? hours : 4;
  return Math.floor(h * 3600 * 1000);
}

/**
 * @param {string} playerId
 * @param {number} extraSlot
 * @returns {Promise<boolean>}
 */
async function isExtraSlotLocked(playerId, extraSlot) {
  const n = Math.floor(Number(extraSlot));
  if (!Number.isFinite(n) || n < 1 || n > 4) return false;
  const [rows] = await pool.query(
    `SELECT adventure_id FROM player_adventures
     WHERE player_id = ? AND extra_slot = ? AND status IN (?, ?)
     LIMIT 1`,
    [playerId, n, STATUS_DISPATCHED, STATUS_READY],
  );
  return rows.length > 0;
}

/**
 * 派遣中或可领期间占用的 Extra 槽集合
 * @returns {Promise<number[]>}
 */
async function getLockedExtraSlots(playerId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT extra_slot FROM player_adventures
     WHERE player_id = ? AND status IN (?, ?)`,
    [playerId, STATUS_DISPATCHED, STATUS_READY],
  );
  return rows.map((r) => Number(r.extra_slot));
}

async function listActiveThemes(season = 'san_1') {
  const [rows] = await pool.query(
    `SELECT * FROM config_adventure_themes
     WHERE season = ? AND is_active = 1
     ORDER BY sort_order ASC, theme_id ASC`,
    [season],
  );
  return rows.map(formatThemeRow);
}

async function getThemeById(themeId) {
  const [rows] = await pool.query(
    `SELECT * FROM config_adventure_themes WHERE theme_id = ? AND is_active = 1 LIMIT 1`,
    [themeId],
  );
  return rows[0] || null;
}

async function getOpenAdventures(playerId) {
  const [rows] = await pool.query(
    `SELECT * FROM player_adventures
     WHERE player_id = ? AND status IN (?, ?)
     ORDER BY extra_slot ASC, adventure_id ASC`,
    [playerId, STATUS_DISPATCHED, STATUS_READY],
  );
  return rows;
}

/** @deprecated 单条查询；多并发请用 getOpenAdventures */
async function getOpenAdventure(playerId) {
  const rows = await getOpenAdventures(playerId);
  return rows[0] || null;
}

/**
 * 从 Extra 槽构建攻方（复用驻地构建字段口径；不静默改走 Main）
 */
async function buildAttackerFromExtraSlot(playerId, extraSlot) {
  const row = await lineupExtraService.getSlot(playerId, extraSlot);
  if (!row) {
    return { ok: false, error: '该 Extra 编组为空，请先配置将领与部队', units: [] };
  }
  const hasChar = !!(row.char1_card || row.char2_card);
  const hasTroop = !!(
    row.char1_troop1 ||
    row.char1_troop2 ||
    row.char2_troop1 ||
    row.char2_troop2
  );
  if (!hasChar || !hasTroop) {
    return { ok: false, error: 'Extra 编组缺将或缺兵，无法出征', units: [] };
  }
  const raw = await garrisonBuildService.buildDefenseUnits({
    ...row,
    player_id: playerId,
  });
  const units = garrisonBuildService.mapBuiltUnitsToSiegeNpcFormat(raw);
  if (!units.length) {
    return { ok: false, error: 'Extra 部队兵力不足，无法出征', units: [] };
  }
  return { ok: true, units, row };
}

async function buildEnemyDefenders(enemyTier, season = 'san_1') {
  const roster = await loadRosterEsm();
  const tier = String(enemyTier || 'normal').toLowerCase();
  const slotRarities = roster.BANDIT_NPC_SLOTS_BY_TIER[tier] || roster.BANDIT_NPC_SLOTS_BY_TIER.normal;
  // 抽样仍走四槽稀有度表；探险遇敌只取前 2 队参战（略轻于全匪寨）
  const [troops] = await pool.query('SELECT * FROM config_troops WHERE season = ?', [season]);
  const [chars] = await pool.query('SELECT * FROM config_characters WHERE season = ?', [season]);
  const troopPool = roster.filterTroopsForSmallMapPveEnemy(troops);
  const charPool = roster.filterCharactersByFactionId(chars, roster.PVE_NPC_DEFAULT_FACTION_ID);
  const picks = roster.buildSmallMapEnemyRosterPicks(troopPool, charPool, slotRarities);
  const defenders = [];
  const take = Math.min(2, picks.troops.length);
  for (let i = 0; i < take; i++) {
    const ch = i < 2 ? picks.pairChars[0] : picks.pairChars[1];
    if (!picks.troops[i]) continue;
    const npc = configTroopToSiegeNpc(picks.troops[i], ch || null, i);
    // 库列为 `range`，configTroopToSiegeNpc 读 attack_range；此处补齐以免射程落空
    if (npc.attackRange == null && picks.troops[i].range != null) {
      npc.attackRange = picks.troops[i].range;
    }
    defenders.push(npc);
  }
  return defenders;
}

function rollRewards(themeRow, { encounter, won }) {
  let silver = randIntInclusive(themeRow.reward_silver_min, themeRow.reward_silver_max);
  let food = randIntInclusive(themeRow.reward_food_min, themeRow.reward_food_max);
  if (encounter && won === false) {
    silver = Math.floor(silver * 0.4);
    food = Math.floor(food * 0.4);
  } else if (!encounter) {
    // 平安归来：略减银两、略增粮（主题本身已偏粮则不变）
    silver = Math.floor(silver * 0.85);
  }
  return { silver: Math.max(0, silver), food: Math.max(0, food) };
}

function rewardsToStr({ silver, food }) {
  const parts = [];
  if (silver > 0) parts.push(`silver:${silver}`);
  if (food > 0) parts.push(`food:${food}`);
  return parts.join(';') || '';
}

/**
 * 到期结算：写事实卡 / 战报 / 模板剧情，状态 → ready（不入账）
 */
async function settleAdventureIfDue(adventureRow) {
  if (!adventureRow || adventureRow.status !== STATUS_DISPATCHED) {
    return formatAdventureRow(adventureRow);
  }
  const endsAt =
    adventureRow.ends_at instanceof Date
      ? adventureRow.ends_at
      : new Date(adventureRow.ends_at);
  if (Date.now() < endsAt.getTime()) {
    return formatAdventureRow(adventureRow);
  }

  const themeRow = await getThemeById(adventureRow.theme_id);
  if (!themeRow) {
    console.error(
      `${LOG} settle 主题缺失 adventure=${adventureRow.adventure_id} theme=${adventureRow.theme_id}`,
    );
    throw new Error('探险主题配置缺失，无法结算');
  }

  const season = themeRow.season || 'san_1';
  const encounterRate = Math.min(1, Math.max(0, Number(themeRow.encounter_rate) || 0));
  const encounter = Math.random() < encounterRate;

  let won = null;
  let battleSummary = null;
  let enemyLabel = null;
  let enemyNames = [];

  if (encounter) {
    const atk = await buildAttackerFromExtraSlot(
      adventureRow.player_id,
      adventureRow.extra_slot,
    );
    if (!atk.ok || !atk.units.length) {
      console.error(
        `${LOG} settle 攻方构建失败 adventure=${adventureRow.adventure_id}: ${atk.error}`,
      );
      throw new Error(atk.error || '出征部队不可用，无法结算遇敌');
    }
    const defenders = await buildEnemyDefenders(themeRow.enemy_tier, season);
    if (!defenders.length) {
      throw new Error('敌方部队生成失败，无法结算遇敌');
    }
    enemyNames = defenders.map((d) => d.troopName).filter(Boolean);
    enemyLabel = enemyNames.slice(0, 2).join('、') || '流寇';
    const seed = `adventure|${adventureRow.adventure_id}|${adventureRow.player_id}|${Date.now()}`;
    let sim;
    try {
      sim = runPvpAutoDuel(atk.units, defenders, seed);
    } catch (e) {
      console.error(
        `${LOG} runPvpAutoDuel 失败 adventure=${adventureRow.adventure_id}: ${e.message}`,
      );
      throw e;
    }
    won = !!sim.attackerWon;
    const atkLoss = (sim.attackerTroopsEnd || []).reduce((s, t) => {
      const max = Number(t.initialTroops ?? t.maxTroops) || 0;
      const cur = Number(t.currentTroops) || 0;
      return s + Math.max(0, max - cur);
    }, 0);
    const defLoss = (sim.defenderTroopsEnd || []).reduce((s, t) => {
      const max = Number(t.initialTroops ?? t.maxTroops) || 0;
      const cur = Number(t.currentTroops) || 0;
      return s + Math.max(0, max - cur);
    }, 0);
    battleSummary = {
      attackerWon: won,
      rounds: sim.rounds,
      enemyNames,
      enemyLabel,
      attackerCasualties: atkLoss,
      defenderCasualties: defLoss,
      logTail: Array.isArray(sim.battleLog) ? sim.battleLog.slice(-8) : [],
    };
  }

  const rewards = rollRewards(themeRow, { encounter, won });
  const fact = {
    themeId: themeRow.theme_id,
    themeName: themeRow.theme_name,
    tone: themeRow.tone,
    encounter,
    won,
    enemyLabel,
    enemyNames,
    silver: rewards.silver,
    food: rewards.food,
    injury: 'none',
    rounds: battleSummary?.rounds ?? null,
    extraSlotLabel: SLOT_LABELS[adventureRow.extra_slot] || String(adventureRow.extra_slot),
  };
  const storyText = buildAdventureStoryFromFact(fact);
  const resolve = {
    fact,
    rewards,
    rewardStr: rewardsToStr(rewards),
    battle: battleSummary,
    settledAt: new Date().toISOString(),
  };

  await pool.query(
    `UPDATE player_adventures
     SET status = ?, resolve_json = ?, story_text = ?
     WHERE adventure_id = ? AND status = ?`,
    [STATUS_READY, JSON.stringify(resolve), storyText, adventureRow.adventure_id, STATUS_DISPATCHED],
  );

  const [fresh] = await pool.query(
    `SELECT * FROM player_adventures WHERE adventure_id = ?`,
    [adventureRow.adventure_id],
  );
  return formatAdventureRow(fresh[0]);
}

async function ensureSettledOpenAll(playerId) {
  const openRows = await getOpenAdventures(playerId);
  if (!openRows.length) return [];
  const out = [];
  for (const open of openRows) {
    if (open.status === STATUS_DISPATCHED) {
      out.push(await settleAdventureIfDue(open));
    } else {
      out.push(formatAdventureRow(open));
    }
  }
  return out.filter(Boolean);
}

/** @deprecated 请用 ensureSettledOpenAll */
async function ensureSettledOpen(playerId) {
  const list = await ensureSettledOpenAll(playerId);
  return list[0] || null;
}

async function getStatus(playerId) {
  const pid = String(playerId || '').trim();
  const themes = await listActiveThemes('san_1');
  const adventures = await ensureSettledOpenAll(pid);
  const lockedSlots = await getLockedExtraSlots(pid);
  const tacticTokenRemaining = await getTacticTokenCount(pid);
  return {
    success: true,
    themes,
    adventures,
    /** 兼容旧客户端：优先可领，否则第一条进行中 */
    adventure:
      adventures.find((a) => a.status === STATUS_READY) ||
      adventures.find((a) => a.status === STATUS_DISPATCHED) ||
      null,
    lockedExtraSlots: lockedSlots,
    maxConcurrent: MAX_CONCURRENT,
    costPerDispatch: TACTIC_TOKEN_COST_PER_DISPATCH,
    costKind: 'tactic_token',
    tacticTokenRemaining,
  };
}

async function dispatch(playerId, { extraSlot, themeId }) {
  const pid = String(playerId || '').trim();
  const slot = Math.floor(Number(extraSlot));
  const tid = String(themeId || '').trim();
  if (!pid) return { success: false, error: '缺少 playerId' };
  if (!Number.isFinite(slot) || slot < 1 || slot > 4) {
    return { success: false, error: 'Extra 槽须为 1–4（A–D）' };
  }
  if (!tid) return { success: false, error: '请选择探险主题' };

  // 先 settle 到期行，再计并发
  await ensureSettledOpenAll(pid);

  if (await isExtraSlotLocked(pid, slot)) {
    return { success: false, error: '该 Extra 槽已在探险中或有报告待领' };
  }

  const openRows = await getOpenAdventures(pid);
  if (openRows.length >= MAX_CONCURRENT) {
    return {
      success: false,
      error: `最多同时派遣 ${MAX_CONCURRENT} 套 Extra（A–D），请先领取归来报告`,
    };
  }

  const themeRow = await getThemeById(tid);
  if (!themeRow) return { success: false, error: '主题不存在或已停用' };

  const atk = await buildAttackerFromExtraSlot(pid, slot);
  if (!atk.ok) return { success: false, error: atk.error };

  const consumed = await tryConsumeTacticTokenOnce(pid, null, TACTIC_TOKEN_COST_PER_DISPATCH);
  if (!consumed) {
    return { success: false, error: '兵符不足，无法派遣' };
  }

  const durationMs = resolveDurationMs(themeRow);
  const dispatchedAt = new Date();
  const endsAt = new Date(dispatchedAt.getTime() + durationMs);

  let insertId;
  try {
    const [result] = await pool.query(
      `INSERT INTO player_adventures
        (player_id, extra_slot, theme_id, status, dispatched_at, ends_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [pid, slot, tid, STATUS_DISPATCHED, dispatchedAt, endsAt],
    );
    insertId = result.insertId;
  } catch (e) {
    console.error(`${LOG} dispatch INSERT 失败，退还兵符:`, e.message);
    try {
      await refundTacticTokenOnce(pid, null, TACTIC_TOKEN_COST_PER_DISPATCH);
    } catch (re) {
      console.error(`${LOG} 退还兵符失败:`, re.message);
    }
    return { success: false, error: '派遣写入失败，请稍后重试' };
  }

  const [rows] = await pool.query(
    `SELECT * FROM player_adventures WHERE adventure_id = ?`,
    [insertId],
  );
  const tacticTokenRemaining = await getTacticTokenCount(pid);
  return {
    success: true,
    adventure: formatAdventureRow(rows[0]),
    adventures: await ensureSettledOpenAll(pid),
    costPerDispatch: TACTIC_TOKEN_COST_PER_DISPATCH,
    tacticTokenRemaining,
    message: `编组${SLOT_LABELS[slot] || slot}已出征「${themeRow.theme_name}」（消耗兵符×${TACTIC_TOKEN_COST_PER_DISPATCH}）`,
  };
}

async function claim(playerId, adventureId) {
  const pid = String(playerId || '').trim();
  const aid = Math.floor(Number(adventureId));
  if (!pid || !Number.isFinite(aid)) {
    return { success: false, error: '参数无效' };
  }

  let [rows] = await pool.query(
    `SELECT * FROM player_adventures WHERE adventure_id = ? AND player_id = ? LIMIT 1`,
    [aid, pid],
  );
  let row = rows[0];
  if (!row) return { success: false, error: '探险记录不存在' };

  if (row.status === STATUS_DISPATCHED) {
    await settleAdventureIfDue(row);
    [rows] = await pool.query(
      `SELECT * FROM player_adventures WHERE adventure_id = ? AND player_id = ? LIMIT 1`,
      [aid, pid],
    );
    row = rows[0];
  }

  if (row.status === STATUS_CLAIMED) {
    return { success: false, error: '该探险报告已领取' };
  }
  if (row.status !== STATUS_READY) {
    return { success: false, error: '探险尚未结束，暂不可领取' };
  }

  const resolve = parseResolveJson(row.resolve_json);
  if (!resolve?.rewardStr && !resolve?.rewards) {
    return { success: false, error: '结算数据缺失，请联系管理员' };
  }

  const [pRows] = await pool.query(
    `SELECT faction_id FROM players WHERE player_id = ? LIMIT 1`,
    [pid],
  );
  const factionId = pRows[0]?.faction_id || null;
  const rewardStr =
    resolve.rewardStr ||
    rewardsToStr(resolve.rewards || { silver: 0, food: 0 });

  let grantResult = null;
  if (rewardStr) {
    grantResult = await executeRewards(pid, rewardStr, 1.0, factionId);
  }

  await pool.query(
    `UPDATE player_adventures SET status = ?, claimed_at = NOW()
     WHERE adventure_id = ? AND status = ?`,
    [STATUS_CLAIMED, aid, STATUS_READY],
  );

  const [fresh] = await pool.query(
    `SELECT * FROM player_adventures WHERE adventure_id = ?`,
    [aid],
  );

  return {
    success: true,
    adventure: formatAdventureRow(fresh[0]),
    storyText:
      fresh[0]?.story_text ||
      (resolve?.fact ? buildAdventureStoryFromFact(resolve.fact) : null),
    resolve,
    grantResult,
  };
}

module.exports = {
  STATUS_DISPATCHED,
  STATUS_READY,
  STATUS_CLAIMED,
  MAX_CONCURRENT,
  TACTIC_TOKEN_COST_PER_DISPATCH,
  isExtraSlotLocked,
  getLockedExtraSlots,
  getOpenAdventures,
  getStatus,
  dispatch,
  claim,
  settleAdventureIfDue,
  ensureSettledOpen,
  ensureSettledOpenAll,
  buildAttackerFromExtraSlot,
  formatAdventureRow,
};
