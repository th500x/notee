/**
 * 城市服务 - 城市管理、NPC守军生成、攻城归属判定
 * 
 * @module backend/services/cityService
 */

const path = require('path');
const { pathToFileURL } = require('url');
const { pool } = require('../database/connection');
const { applyTroopDurabilityExhaustion } = require('./troopDurabilityService');
const { checkAndApplyVeteran } = require('./veteranService');
const garrisonService = require('./garrisonService');
const statisticsDeltaService = require('./statisticsDeltaService');
const smallMapBattleLootService = require('./smallMapBattleLootService');
const factionBulletinService = require('./factionBulletinService');
const gameTimeService = require('./gameTimeService');
const warInitiationCostService = require('./warInitiationCostService');
const { KILL_SILVER_REWARD } = require('../../shared/utils/siegeKillEconomyByRarity.cjs');
const { isAllowedPlayerCityPoiCityType } = require('../../shared/utils/strategicMarchPoi.js');
const {
  calcHourlyQuotaWithRestWindow,
  EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS,
} = require('../utils/hourlyQuotaWithRestWindow');

function calcSiegeQuotaForPlayer(remaining, lastRefillTs) {
  return calcHourlyQuotaWithRestWindow(
    remaining,
    lastRefillTs,
    new Date(),
    EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS,
  );
}

/**
 * 与 `routes/cities` POST `/siege-quota` 同源：扣 1 次攻城次数（PVP 守方打大本营与攻城共用 `player_events` 桶）。
 * @param {string} playerId
 * @param {import('mysql2/promise').PoolConnection|null} [conn]
 * @returns {Promise<boolean>} 是否成功扣减
 */
async function tryConsumeSiegeQuotaOnce(playerId, conn = null) {
  const runner = conn || pool;
  const pid = String(playerId || '').trim();
  if (!pid) return false;
  await runner.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
  const [rows] = await runner.query(
    'SELECT siege_quota_remaining, siege_quota_refill_ts FROM player_events WHERE player_id = ? FOR UPDATE',
    [pid],
  );
  const row = rows[0] || {};
  const current = calcSiegeQuotaForPlayer(
    row.siege_quota_remaining,
    row.siege_quota_refill_ts ? Number(row.siege_quota_refill_ts) : null,
  );
  if (current.remaining <= 0) return false;
  const newRemaining = current.remaining - 1;
  await runner.query(
    'UPDATE player_events SET siege_quota_remaining = ?, siege_quota_refill_ts = ? WHERE player_id = ?',
    [newRemaining, String(current.lastRefillTs), pid],
  );
  return true;
}

/**
 * 攻城次数 +1（上限封顶）；用于扣次后握手失败回滚。
 * @param {string} playerId
 * @param {import('mysql2/promise').PoolConnection|null} [conn]
 */
async function refundSiegeQuotaOnce(playerId, conn = null) {
  const runner = conn || pool;
  const pid = String(playerId || '').trim();
  if (!pid) return;
  await runner.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
  const [rows] = await runner.query(
    'SELECT siege_quota_remaining, siege_quota_refill_ts FROM player_events WHERE player_id = ? FOR UPDATE',
    [pid],
  );
  const row = rows[0] || {};
  const current = calcSiegeQuotaForPlayer(
    row.siege_quota_remaining,
    row.siege_quota_refill_ts ? Number(row.siege_quota_refill_ts) : null,
  );
  const maxQ = EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS.maxQuota;
  const newRemaining = Math.min(current.remaining + 1, maxQ);
  await runner.query(
    'UPDATE player_events SET siege_quota_remaining = ?, siege_quota_refill_ts = ? WHERE player_id = ?',
    [newRemaining, String(current.lastRefillTs), pid],
  );
}

/**
 * 库列 `city_id` / `player_garrison_capacity` → 对外兼容 `id` / `garrison_capacity`（JSON 与旧前端）
 */
function formatCityRowForApi(row) {
  if (!row) return row;
  const o = { ...row };
  if (o.city_id != null) o.id = o.city_id;
  if (o.player_garrison_capacity != null) {
    o.garrison_capacity = o.player_garrison_capacity;
  }
  if (o.wilderness_enabled !== undefined && o.wilderness_enabled !== null) {
    o.wildernessEnabled = Number(o.wilderness_enabled) === 1;
  }
  if (o.market_enabled !== undefined && o.market_enabled !== null) {
    o.marketEnabled = Number(o.market_enabled) === 1;
  }
  if (o.initial_lord_character_id !== undefined) {
    o.initialLordCharacterId = o.initial_lord_character_id;
  }
  return o;
}

/** 攻城战线占用：同键在 TTL 内不可被第二人（或本人第二开）占用，结算后释放；超时自动失效（毫秒）
 *  1 分钟：与多数自动战斗时长接近，避免 NPC 末档等场景被长时间占线；超长手动局若需占线应另做心跳续期 */
const SIEGE_LOCK_TTL_MS = 1 * 60 * 1000;
const siegeLocks = new Map(); // key -> { attackerId, lockedAt }

function tryAcquireSiegeLock(lockKey, attackerId) {
  const now = Date.now();
  const cur = siegeLocks.get(lockKey);
  // 未过期时：仅阻止「他人」占线；同一人可重占（刷新时间），避免未带 npcBatchIndex 结算/强关页面后把自己锁死
  if (cur && now - cur.lockedAt < SIEGE_LOCK_TTL_MS) {
    if (cur.attackerId !== attackerId) return false;
  }
  siegeLocks.set(lockKey, { attackerId, lockedAt: now });
  return true;
}

function releaseSiegeLock(lockKey, attackerId) {
  const cur = siegeLocks.get(lockKey);
  if (cur && cur.attackerId === attackerId) siegeLocks.delete(lockKey);
}

/** 朝政撤 PVE 攻城：清扫本战事 NPC 批次的内存锁（不依赖占锁玩家 id）。 */
function releaseAllSiegeMemoryLocksForPveWar(warId) {
  const wid = String(warId || '').trim();
  if (!wid) return;
  const prefix = `def|${wid}|`;
  for (const key of Array.from(siegeLocks.keys())) {
    if (String(key).startsWith(prefix)) siegeLocks.delete(key);
  }
}

/** NPC 守军在锁键中使用的伪防守者 ID（与真实 player_id 区分），键格式同驻守：def|warId|防守者|槽位 */
const NPC_SIEGE_LOCK_DEFENDER_ID = '_npc';
/** 与 NPC 分批攻城一致：清扫/释放锁时覆盖的批次上限（每批最多 4 支，略留余量） */
const NPC_LOCK_SWEEP = 16;

// NPC 部队数量 — 已占领城市（有归属势力）；中立城无默认表，支数由管理员生成或沿用既有 `npc_garrison` 槽位数
const NPC_TROOP_COUNT_OWNED = {
  city_small: 200,
  city_medium: 280,
  city_major: 360,
  gate: 360,
  fort: 280,
};

/** M1：已占领城 NPC 在「次日 8:00」**单次恢复支数** = `round(编制上限支数 × 本系数)`；上限为当前 `npc_garrison` 槽位数（如小城 200 支则每次 +100，且 `min(上限, 当前存活 + 恢复量)`）。时间锚点仍按 `ledgerAt` 推算次日 8:00。 */
const NPC_OWNED_DAILY_RECOVERY_RATIO = 0.5;

const { WIN_REPUTATION_REWARD } = smallMapBattleLootService;

/** npc_garrison 存库仅支持 { units: Array, ledgerAt?: string }；根级 JSON 数组不再解析（须先跑 wrap-* 迁移） */
function parseNpcGarrisonStored(raw) {
  if (raw == null || raw === '') return { units: null, ledgerAt: null };
  const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (Array.isArray(v)) return { units: null, ledgerAt: null };
  if (v && typeof v === 'object' && Array.isArray(v.units)) {
    const la = v.ledgerAt;
    if (la == null) return { units: v.units, ledgerAt: null };
    const d = la instanceof Date ? la : new Date(la);
    return { units: v.units, ledgerAt: Number.isNaN(d.getTime()) ? null : d };
  }
  return { units: null, ledgerAt: null };
}

function serializeNpcGarrisonStored(units, ledgerAt = new Date()) {
  if (units == null) return null;
  return JSON.stringify({
    units,
    ledgerAt: ledgerAt != null ? new Date(ledgerAt).toISOString() : null,
  });
}

/**
 * 已占领城：在「次日 8:00」窗口内按 **编制上限**（`units.length`）的 `NPC_OWNED_DAILY_RECOVERY_RATIO` 计算**本日恢复支数**，
 * 将存活数提升至 `min(上限, 当前存活 + round(上限×系数))`（按索引顺序复活 dead 槽位），不整表重掷。
 * `city` 须为 `getCityInfo` 结果，`npc_garrison` 已为 units 数组。
 */
async function applyOwnedCityNpcPartialDailyRecovery(cityId, city) {
  const raw = city.npc_garrison;
  const units = Array.isArray(raw) ? raw.map((u) => (u && typeof u === 'object' ? { ...u } : u)) : null;
  if (!units || units.length === 0) {
    await generateNpcGarrison(cityId);
    return;
  }
  const cap = units.length;
  const recoverAdd = Math.round(cap * NPC_OWNED_DAILY_RECOVERY_RATIO);
  let aliveCount = 0;
  const deadIndices = [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u && u.alive) aliveCount += 1;
    else if (!u || u.alive === false) deadIndices.push(i);
  }
  const targetAlive = Math.min(cap, aliveCount + recoverAdd);
  const needResurrect = Math.min(deadIndices.length, Math.max(0, targetAlive - aliveCount));
  for (let k = 0; k < needResurrect; k++) {
    const idx = deadIndices[k];
    if (units[idx]) units[idx].alive = true;
  }
  let alive = 0;
  for (const u of units) {
    if (u && u.alive) alive += 1;
  }
  const ledgerAt = new Date();
  await pool.query(
    `UPDATE cities SET npc_garrison = ?, npc_garrison_alive = ? WHERE city_id = ?`,
    [serializeNpcGarrisonStored(units, ledgerAt), alive, cityId]
  );
}

/**
 * 是否按「已占领势力」档生成 NPC 守军（支数少），并参与 initiateSiege 内「仅已占城」的次日 8:00 损兵恢复分支。
 * 须 **同时** `faction_id` 非空且 `status === 'owned'`；避免仅有 `faction_id` 或过渡数据却按占领档生成（测试期曾出现非占领态错误支数）。
 */
function isCityOccupiedForNpcGarrison(city) {
  return !!(city && city.faction_id && city.status === 'owned');
}

/** 与 `shared/utils/smallMapEnemyRoster.js` 同步（匪寨难度档 + 势力池）；CJS 下用 dynamic import 加载 ESM */
let smallMapEnemyRosterEsmPromise = null;
function loadSmallMapEnemyRosterEsm() {
  if (!smallMapEnemyRosterEsmPromise) {
    const filePath = path.join(__dirname, '../../shared/utils/smallMapEnemyRoster.js');
    smallMapEnemyRosterEsmPromise = import(pathToFileURL(filePath).href);
  }
  return smallMapEnemyRosterEsmPromise;
}

/**
 * 为城市生成 NPC 守军
 * 稀有度槽位与匪寨 `BANDIT_NPC_SLOTS_BY_TIER` 一致；部队/将领池见 `resolveSiegeNpcFactionIdForTroopPool`（中立→北疆，有主→该势力段）
 * 
 * @param {string} cityId
 * @param {{ troopCountOverride?: number }} [opts] 强制守军支数；中立城无库表默认时亦须此或已有 `npc_garrison` 编制
 * @returns {Object} { npcGarrison, npcCount }
 */
async function generateNpcGarrison(cityId, opts = {}) {
  // 1. 获取城市信息
  const [cityRows] = await pool.query('SELECT * FROM cities WHERE city_id = ?', [cityId]);
  if (!cityRows.length) throw new Error(`城市不存在: ${cityId}`);
  const city = cityRows[0];

  const sm = await loadSmallMapEnemyRosterEsm();
  const banditTier = sm.resolveCityBanditTier(city.city_type, city.city_id);
  const poolFaction = sm.resolveSiegeNpcFactionIdForTroopPool(city);
  const isOwned = isCityOccupiedForNpcGarrison(city);
  const override = opts?.troopCountOverride;
  const { units: existingUnits } = parseNpcGarrisonStored(city.npc_garrison);
  const existingSlotCount =
    Array.isArray(existingUnits) && existingUnits.length > 0 ? existingUnits.length : 0;
  let troopCount;
  if (override != null && Number(override) > 0) {
    troopCount = Math.min(2000, Math.floor(Number(override)));
  } else if (isOwned) {
    troopCount = NPC_TROOP_COUNT_OWNED[city.city_type] || 200;
  } else if (existingSlotCount > 0) {
    troopCount = existingSlotCount;
  } else {
    throw new Error(
      '中立城 NPC 守军须由管理员配置并生成（或调用时传入 troopCountOverride）；当前无编制数据。',
    );
  }

  // 2. 从配置表加载部队和将领池
  const [troops] = await pool.query('SELECT * FROM config_troops WHERE season = ?', [city.season]);
  const [chars] = await pool.query('SELECT * FROM config_characters WHERE season = ?', [city.season]);

  const troopPool = sm.filterTroopsByFactionId(troops, poolFaction);
  const charPool = sm.filterCharactersByFactionId(chars, poolFaction);

  // 3. 生成 NPC 部队（每支槽位稀有度按匪寨四槽循环）
  const npcUnits = [];
  for (let i = 0; i < troopCount; i++) {
    const rarity = sm.siegeNpcRarityAtTroopIndex(i, banditTier);
    let troop = sm.pickRandomTroopByRarity(troopPool, rarity);
    if (!troop) troop = sm.pickRandomTroopByRarity(troops, rarity);
    if (!troop && troops.length) troop = troops[Math.floor(Math.random() * troops.length)];

    let character = null;
    if (i % 2 === 0) {
      const charRarity = sm.siegeNpcCharRarityForPair(i, banditTier);
      let ch = sm.pickRandomCharacterByRarity(charPool, charRarity);
      if (!ch) ch = sm.pickRandomCharacterByRarity(chars, charRarity);
      character = ch;
    } else if (npcUnits.length > 0) {
      character = npcUnits[npcUnits.length - 1].character;
    }

    npcUnits.push({
      index: i,
      troopId: troop.troop_id,
      troopName: troop.troop_name,
      rarity: troop.rarity,
      maxTroops: troop.max_troops,
      attack: troop.attack,
      defense: troop.defense,
      speed: troop.speed,
      movement: troop.movement,
      attackRange: troop.attack_range,
      troopType: troop.troop_type,
      weaponType: troop.weapon_type,
      character: character ? {
        characterId: character.character_id,
        name: character.character_name || character.courtesy_name || '守军将领',
        courtesyName: (character.courtesy_name || character.character_name || '守军将领'),
        rarity: character.rarity,
        luck: character.luck,
        courage: character.courage,
        combat: character.combat,
        command: character.command,
        intelligence: character.intelligence,
        politics: character.politics,
        charm: character.charm,
        traitModifier: character.trait_modifier || 0,
      } : null,
      alive: true,
    });
  }

  // 4. 更新城市 NPC 守军
  await pool.query(
    `UPDATE cities SET npc_garrison = ?, npc_garrison_alive = ? WHERE city_id = ?`,
    [serializeNpcGarrisonStored(npcUnits, new Date()), troopCount, cityId]
  );

  return { npcGarrison: npcUnits, npcCount: troopCount };
}

/** 城市 + 州/郡显示名 + 长官角色名（与 config_* 同 season 联表）— 供单城详情与列表接口共用 */
const CITIES_REGION_JOIN_SQL = `
FROM cities c
LEFT JOIN config_zhou z ON z.zhou_id = c.zhou_id AND z.season = c.season
LEFT JOIN config_jun j ON j.jun_id = c.jun_id AND j.season = c.season
LEFT JOIN players _lord_p ON _lord_p.player_id = c.lord_player_id
LEFT JOIN config_characters _lord_cfg
  ON _lord_cfg.character_id = c.initial_lord_character_id AND _lord_cfg.season = c.season
`;

function peelRegionJoinFromRow(raw) {
  if (!raw) return { base: null, zhouName: null, junName: null, lordCharacterName: null };
  const zhouName = raw._cfg_zhou_name ?? null;
  const junName = raw._cfg_jun_name ?? null;

  const trimName = (v) =>
    v != null && String(v).trim() !== '' ? String(v).trim() : null;
  const playerLordName = trimName(raw._lord_character_name);
  const initialLordName = trimName(raw._initial_lord_character_name);

  const hasPlayerLord =
    raw.lord_player_id != null && String(raw.lord_player_id).trim() !== '';
  /** 已任命玩家长官 → 用玩家角色名；缺名时回退种子默认。未任命 → 用 initial_lord_character_id 对应配置名 */
  const lordCharacterName = hasPlayerLord ? playerLordName || initialLordName : initialLordName;

  const {
    _cfg_zhou_name,
    _cfg_jun_name,
    _lord_character_name,
    _initial_lord_character_name,
    ...base
  } = raw;
  return { base, zhouName, junName, lordCharacterName };
}

/**
 * 城市列表（与 getCityInfo 一致含 zhouName / junName，供战略大地图 GET /api/cities 等）
 * @param {{ season?: string, junId?: string }} filters
 */
async function listCitiesForApi(filters = {}) {
  const conditions = [];
  const params = [];
  if (filters.season) {
    conditions.push('c.season = ?');
    params.push(filters.season);
  }
  if (filters.junId) {
    conditions.push('c.jun_id = ?');
    params.push(filters.junId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT c.*, z.zhou_name AS _cfg_zhou_name, j.jun_name AS _cfg_jun_name,
            _lord_p.character_name AS _lord_character_name,
            _lord_cfg.character_name AS _initial_lord_character_name
     ${CITIES_REGION_JOIN_SQL}
     ${where}
     ORDER BY c.city_type, c.city_name`,
    params
  );
  return rows.map((raw) => {
    const { base, zhouName, junName, lordCharacterName } = peelRegionJoinFromRow(raw);
    const c = formatCityRowForApi(base);
    const { units } = parseNpcGarrisonStored(c.npc_garrison);
    return {
      ...c,
      npc_garrison: units,
      zhouName,
      junName,
      lordCharacterName,
      lord_character_name: lordCharacterName,
    };
  });
}

/**
 * 获取城市信息（含 NPC 守军、州郡显示名：联表 config_zhou / config_jun）
 */
async function getCityInfo(cityId) {
  const [rows] = await pool.query(
    `SELECT c.*, z.zhou_name AS _cfg_zhou_name, j.jun_name AS _cfg_jun_name,
            _lord_p.character_name AS _lord_character_name,
            _lord_cfg.character_name AS _initial_lord_character_name
     ${CITIES_REGION_JOIN_SQL}
     WHERE c.city_id = ?`,
    [cityId]
  );
  if (!rows.length) return null;
  const { base, zhouName, junName, lordCharacterName } = peelRegionJoinFromRow(rows[0]);
  const city = formatCityRowForApi(base);
  const { units, ledgerAt } = parseNpcGarrisonStored(city.npc_garrison);
  return {
    ...city,
    npc_garrison: units,
    npcGarrisonLedgerAt: ledgerAt,
    zhouName,
    junName,
    lordCharacterName,
    lord_character_name: lordCharacterName,
  };
}

/** 同一势力在 `wars`（PVE 中立城攻城）进行中战事条数上限；与 `pvpWarService` 的 PVP 上限并列（每类各 1）。 */
const MAX_CONCURRENT_PVE_WARS_PER_ATTACKER_FACTION = 1;

function parseFactionKillsColumn(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw };
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  return {};
}

async function playerHasPveSiegeBattleForWar(playerId, warId) {
  const pid = String(playerId || '').trim();
  const wid = String(warId || '').trim();
  if (!pid || !wid) return false;
  const [rows] = await pool.query(
    "SELECT 1 FROM battles WHERE player_id = ? AND battle_type = 'pve_siege' AND war_id = ? LIMIT 1",
    [pid, wid],
  );
  return rows.length > 0;
}

async function factionParticipatesInPveWarRow(warRow, factionId, playerId) {
  const fid = String(factionId || '').trim();
  if (!fid || !warRow) return false;
  const fk = parseFactionKillsColumn(warRow.faction_kills);
  if (Object.prototype.hasOwnProperty.call(fk, fid)) return true;
  return playerHasPveSiegeBattleForWar(playerId, warRow.war_id);
}

/**
 * 本势力在指定赛季下「占用 PVE 攻城槽」的进行中 `wars` 列表（去重 `war_id`）。
 * 参与判定：`faction_kills` 含该势力键，或 **当前**归属该势力的成员存在 `battles.pve_siege` 且 `war_id` 命中 **同季 active siege**。
 *
 * **与旧版 `countActivePveSiegeWarsForFaction` 的差异**：`battles` 侧必须通过 `wars`+`cities.season` 约束，
 * 不得仅 `SELECT DISTINCT war_id FROM battles WHERE player_id IN (...)`，否则会把已结束或其它语境下的
 * `war_id` 混入集合，造成「界面无战事仍 atPveCap」的假阳性。
 *
 * @param {string} factionId
 * @param {{ excludeWarId?: string, season?: string }} [opts]
 * @returns {Promise<{ count: number, wars: Array<{ warId: string, targetCityId: string, targetCityName: string|null, via: 'faction_kills'|'battle' }> }>}
 */
async function getActivePveSiegeParticipationForFaction(factionId, opts = {}) {
  const fid = String(factionId || '').trim();
  if (!fid) return { count: 0, wars: [] };
  const excludeWarId = opts.excludeWarId ? String(opts.excludeWarId).trim() : '';
  const season = String(opts.season || 'san_1').trim() || 'san_1';

  const [warRows] = await pool.query(
    `SELECT w.war_id, w.faction_kills, w.target_city_id, w.target_city_name
       FROM wars w
       INNER JOIN cities c ON c.city_id = w.target_city_id
       WHERE w.status = 'active' AND w.war_type = 'siege' AND c.season = ?`,
    [season],
  );

  const [battleRows] = await pool.query(
    `SELECT DISTINCT b.war_id AS warId
       FROM battles b
       INNER JOIN players p ON p.player_id = b.player_id AND p.faction_id = ?
       INNER JOIN wars w ON w.war_id = b.war_id AND w.status = 'active' AND w.war_type = 'siege'
       INNER JOIN cities c ON c.city_id = w.target_city_id AND c.season = ?
       WHERE b.battle_type = 'pve_siege' AND b.war_id IS NOT NULL`,
    [fid, season],
  );
  const battleWarIds = new Set(battleRows.map((r) => r.warId).filter(Boolean));

  const wars = [];
  const seen = new Set();
  for (const row of warRows) {
    if (excludeWarId && row.war_id === excludeWarId) continue;
    const fk = parseFactionKillsColumn(row.faction_kills);
    const inFk = Object.prototype.hasOwnProperty.call(fk, fid);
    const inBattle = battleWarIds.has(row.war_id);
    if (!inFk && !inBattle) continue;
    if (seen.has(row.war_id)) continue;
    seen.add(row.war_id);
    wars.push({
      warId: row.war_id,
      targetCityId: row.target_city_id,
      targetCityName: row.target_city_name || null,
      via: inFk ? 'faction_kills' : 'battle',
    });
  }
  return { count: wars.length, wars };
}

/**
 * 数 `wars` 中 active 的 siege 行（同 `getActivePveSiegeParticipationForFaction`）。
 *
 * @param {string} factionId
 * @param {{ excludeWarId?: string, season?: string }} [opts]
 *   - `season`：仅计 **目标城** `cities.season` 匹配的 active 攻城行；缺省 `san_1`。
 */
async function countActivePveSiegeWarsForFaction(factionId, opts = {}) {
  const { count } = await getActivePveSiegeParticipationForFaction(factionId, opts);
  return count;
}

/**
 * 发起攻城战（**仅中立城 PVE**；已占领的敌对势力城走 `pvpWarService.initiateAttackerCitySiege`）。
 *
 * 17-2 §1.4 / §1.9 / IMPLEMENTATION-PLAN §1.9：cityService 不处理 PVP 战事；
 * 中立城 → `wars` + `faction_kills` 抢桶；占领城 → `wars_pvp` + 大本营 + 攻占即归属。
 */
async function initiateSiege(cityId, playerId) {
  const city = await getCityInfo(cityId);
  if (!city) throw new Error('城市不存在');

  const [playerRows] = await pool.query('SELECT faction_id FROM players WHERE player_id = ?', [playerId]);
  if (!playerRows.length) throw new Error('玩家不存在');
  const playerFaction = playerRows[0].faction_id;

  if (city.faction_id && city.faction_id === playerFaction) {
    throw new Error('不能攻打己方城市');
  }

  if (!city.faction_id && !isAllowedPlayerCityPoiCityType(city.city_type)) {
    throw new Error('中立 PVE 攻城仅针对大城/中城/小城，不含关隘、据点等');
  }

  if (isCityOccupiedForNpcGarrison(city)) {
    throw new Error(
      '该城已被势力占领，请通过势力战事路径攻打（需先由君主宣战、放置攻方大本营）',
    );
  }

  const attackerLineupTroops = await garrisonService.sumMainLineupEquippedTroopTroops(pool, playerId);
  if (attackerLineupTroops < garrisonService.MIN_MAIN_LINEUP_TROOPS_BATTLE) {
    throw new Error(
      `开战需上阵编组总兵力≥${garrisonService.MIN_MAIN_LINEUP_TROOPS_BATTLE}（当前 ${attackerLineupTroops}）`
    );
  }

  // ── NPC 守军逻辑（仅中立城；已占领城此前已抛错） ──
  // 无编制 / 全灭 → 整表生成；已占领且损兵 → 仅次日 8:00 起按缺额比例恢复（M1：50% 缺额）
  let needRefresh = false;
  if (!city.npc_garrison || city.npc_garrison_alive <= 0) {
    needRefresh = true;
  } else if (isCityOccupiedForNpcGarrison(city)) {
    // 仅已占领城市（与 generateNpcGarrison 占用档判定一致）：检查是否需要每日8点恢复（NPC有损耗时）
    const totalNpc = city.npc_garrison.length;
    if (city.npc_garrison_alive < totalNpc) {
      const now = new Date();
      const anchor = city.npcGarrisonLedgerAt ? new Date(city.npcGarrisonLedgerAt) : new Date(0);
      const next8am = new Date(anchor);
      next8am.setHours(8, 0, 0, 0);
      if (next8am <= anchor) next8am.setDate(next8am.getDate() + 1);
      if (now >= next8am) needRefresh = true;
    }
  }
  if (needRefresh) {
    if (
      isCityOccupiedForNpcGarrison(city) &&
      Array.isArray(city.npc_garrison) &&
      city.npc_garrison.length > 0 &&
      city.npc_garrison_alive > 0
    ) {
      await applyOwnedCityNpcPartialDailyRecovery(cityId, city);
    } else {
      await generateNpcGarrison(cityId);
    }
    const refreshed = await getCityInfo(cityId);
    city.npc_garrison = refreshed.npc_garrison;
    city.npc_garrison_alive = refreshed.npc_garrison_alive;
    city.npcGarrisonLedgerAt = refreshed.npcGarrisonLedgerAt;
  }

  // 查找或创建活跃的 war 记录
  const [existingWar] = await pool.query(
    "SELECT * FROM wars WHERE target_city_id = ? AND status = 'active'",
    [cityId]
  );

  if (!city.faction_id && !existingWar.length) {
    const strategicWarTargetProximityService = require('./strategicWarTargetProximityService');
    await strategicWarTargetProximityService.assertNeutralPveTargetInMapRange(
      playerFaction,
      cityId,
      String(city.season || 'san_1').trim() || 'san_1',
    );
  }

  let war;
  if (existingWar.length > 0) {
    war = existingWar[0];
    if (!(await factionParticipatesInPveWarRow(war, playerFaction, playerId))) {
      const siegeSeason = String(city.season || 'san_1').trim() || 'san_1';
      const other = await countActivePveSiegeWarsForFaction(playerFaction, {
        excludeWarId: war.war_id,
        season: siegeSeason,
      });
      if (other >= MAX_CONCURRENT_PVE_WARS_PER_ATTACKER_FACTION) {
        throw new Error(
          `贵方势力已有一场进行中的中立城攻城战事（PVE，上限 ${MAX_CONCURRENT_PVE_WARS_PER_ATTACKER_FACTION}），请先告捷或结束他处战事后再攻此城`,
        );
      }
    }
  } else {
    const siegeSeason = String(city.season || 'san_1').trim() || 'san_1';
    const existingOther = await countActivePveSiegeWarsForFaction(playerFaction, { season: siegeSeason });
    if (existingOther >= MAX_CONCURRENT_PVE_WARS_PER_ATTACKER_FACTION) {
      throw new Error(
        `贵方势力已有一场进行中的中立城攻城战事（PVE，上限 ${MAX_CONCURRENT_PVE_WARS_PER_ATTACKER_FACTION}），请先告捷后再开新城`,
      );
    }
    const warId = `war_${cityId}_${Date.now()}`;
    const fkSeed = JSON.stringify({ [playerFaction]: 0 });
    await pool.query(
      `INSERT INTO wars (war_id, war_name, war_type, target_city_id, target_city_name,
        faction_kills, status, npc_total, npc_killed)
       VALUES (?, ?, 'siege', ?, ?, ?, 'active', ?, 0)`,
      [warId, `${city.city_name}攻城战`, cityId, city.city_name, fkSeed, city.npc_garrison_alive],
    );
    war = { war_id: warId, faction_kills: JSON.parse(fkSeed) };
    factionBulletinService.logPveWarStarted(playerFaction, city.city_name, cityId);
  }

  // NPC 守军：与驻守相同逻辑——按「顺位批次」分配，每批最多 4 支；def|warId|_npc|批次 被占用则自动试下一批
  const fullG = city.npc_garrison || [];
  const aliveEntries = [];
  for (let gi = 0; gi < fullG.length; gi++) {
    const u = fullG[gi];
    if (u && u.alive) aliveEntries.push({ u, gi });
  }

  if (aliveEntries.length === 0) {
    throw new Error('该城暂无可攻打守军');
  }

  const maxBatches = Math.ceil(aliveEntries.length / 4);
  let npcBatchIndex = null;
  let battleSlice = null;
  const tryPickNpcBatch = () => {
    for (let b = 0; b < maxBatches; b++) {
      const lockKey = `def|${war.war_id}|${NPC_SIEGE_LOCK_DEFENDER_ID}|${b}`;
      if (!tryAcquireSiegeLock(lockKey, playerId)) continue;
      const slice = aliveEntries.slice(b * 4, b * 4 + 4);
      if (slice.length === 0) {
        releaseSiegeLock(lockKey, playerId);
        continue;
      }
      npcBatchIndex = b;
      battleSlice = slice;
      break;
    }
  };

  tryPickNpcBatch();

  // 各批次均被占且含本人残留锁时：先按 playerId 清扫本战事 NPC 锁再试一轮（不误删他人锁）
  if (battleSlice == null) {
    for (let b = 0; b < NPC_LOCK_SWEEP; b++) {
      releaseSiegeLock(`def|${war.war_id}|${NPC_SIEGE_LOCK_DEFENDER_ID}|${b}`, playerId);
    }
    npcBatchIndex = null;
    battleSlice = null;
    tryPickNpcBatch();
  }

  if (battleSlice == null) {
    throw new Error('当前各战线均有友军交战中，请稍后再试');
  }

  const battleNpc = battleSlice.map(({ u, gi }) => ({
    ...u,
    index: gi,
  }));

  return {
    warId: war.war_id,
    cityId,
    cityName: city.city_name,
    cityType: city.city_type,
    npcGarrison: battleNpc,
    npcAlive: aliveEntries.length,
    npcTotal: fullG.length,
    playerFaction,
    defenderType: 'npc',
    npcBatchIndex,
  };
}

/**
 * 记录攻城战斗结果（仅 PVE 中立城 NPC 守军）。
 *
 * 17-2 §1.4 / §1.9：占领城的玩家披挂 / 驻守 / NPC 守军走 `pvpWarService.recordAttackerCitySiegeResult`；
 * 本函数仅服务 `wars` (PVE) 表 + `faction_kills` 多势力抢桶。
 *
 * @param {string} warId
 * @param {string} playerId
 * @param {string} factionId
 * @param {Array<number>} killedIndices
 * @param {string} result - win / lose
 * @param {number} silverSpent
 * @param {object} defenderInfo - 仅 `npcBatchIndex` / `battleScore` / `battleReportSaved` 在 PVE 路径生效
 */
async function recordSiegeResult(warId, playerId, factionId, killedIndices, result, silverSpent = 0, defenderInfo = {}) {
  const {
    defenderType,
    npcBatchIndex,
    battleScore,
    battleReportSaved,
  } = defenderInfo || {};
  if (defenderType && defenderType !== 'npc') {
    throw new Error(
      `[cityService] PVE 路径仅支持 NPC 守军（defenderType=${defenderType}）；玩家披挂/驻守战果请走 PVP 路径`,
    );
  }
  const shouldFallbackAddBattleScore = Number(battleScore) > 0 && battleReportSaved === false;

  let defLockReleased = false;
  const releaseDefenderSiegeLockIfNeeded = () => {
    if (defLockReleased) return;
    if (npcBatchIndex != null && !Number.isNaN(Number(npcBatchIndex))) {
      releaseSiegeLock(`def|${warId}|${NPC_SIEGE_LOCK_DEFENDER_ID}|${Number(npcBatchIndex)}`, playerId);
    } else {
      for (let b = 0; b < NPC_LOCK_SWEEP; b++) {
        releaseSiegeLock(`def|${warId}|${NPC_SIEGE_LOCK_DEFENDER_ID}|${b}`, playerId);
      }
    }
    defLockReleased = true;
  };

  try {
  // ── 仅 PVE 中立城 NPC 守军：玩家披挂 / 驻守 → pvpWarService.recordAttackerCitySiegeResult ──
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. 获取 war 记录
    const [warRows] = await connection.query(
      "SELECT * FROM wars WHERE war_id = ? AND status = 'active' FOR UPDATE",
      [warId]
    );
    if (!warRows.length) throw new Error('战事不存在或已结束');
    let war = warRows[0];

    // 1b. 与本城当前 NPC 编制对齐 wars.npc_total（旧逻辑用 npc_garrison_alive，已占领城常为 40、
    //     与 JSON 支数 400 不一致时，累计 npc_killed 会大于 npc_total，结算 UI 出现 52/40）
    const [citySlotRows] = await connection.query(
      'SELECT npc_garrison FROM cities WHERE city_id = ? FOR UPDATE',
      [war.target_city_id]
    );
    if (citySlotRows.length) {
      const { units: slotUnits } = parseNpcGarrisonStored(citySlotRows[0].npc_garrison);
      const slotTotal = Array.isArray(slotUnits) ? slotUnits.length : 0;
      if (slotTotal > 0 && slotTotal > (Number(war.npc_total) || 0)) {
        await connection.query('UPDATE wars SET npc_total = ? WHERE war_id = ?', [slotTotal, warId]);
        war = { ...war, npc_total: slotTotal };
      }
    }

    // 2. 更新势力击杀统计
    let factionKills = {};
    if (war.faction_kills) {
      factionKills = typeof war.faction_kills === 'string' ? JSON.parse(war.faction_kills) : war.faction_kills;
    }
    // 3. 更新城市 NPC 守军状态 + 计算银两奖励 + 统计实际击杀数
    let silverReward = 0;
    let actualKillCount = 0;
    /** 与 actualKillCount 一致：仅本次从 alive→dead 的槽位，用于按支累加贡献 */
    const npcKillRaritiesThisRound = [];
    /** 本场结算后 NPC 守军 JSON 中仍存活支数；易主判定以之为准（勿仅用 wars.npc_killed >= npc_total） */
    let npcAliveAfterUpdate = null;
    /** 与主界面「NPC守军：alive/total」一致：累计已消灭 = 阵亡支数（勿仅依赖 wars.npc_killed 历史累加，曾出现与 JSON 脱节） */
    let authoritativeNpcEliminated = null;
    let npcGarrisonSlotCount = null;
    const [cityRows] = await connection.query(
      'SELECT npc_garrison, npc_garrison_alive FROM cities WHERE city_id = ? FOR UPDATE',
      [war.target_city_id]
    );
    if (cityRows.length) {
      const { units: unitArr } = parseNpcGarrisonStored(cityRows[0].npc_garrison);
      if (unitArr && unitArr.length) {
        npcGarrisonSlotCount = unitArr.length;
        for (const idx of killedIndices) {
          if (unitArr[idx] && unitArr[idx].alive) {
            unitArr[idx].alive = false;
            silverReward += KILL_SILVER_REWARD[unitArr[idx].rarity] || 10;
            actualKillCount++;
            npcKillRaritiesThisRound.push(unitArr[idx].rarity || 'common');
          }
        }
        const aliveCount = unitArr.filter(u => u.alive).length;
        npcAliveAfterUpdate = aliveCount;
        authoritativeNpcEliminated = unitArr.filter((u) => !u.alive).length;
        await connection.query(
          'UPDATE cities SET npc_garrison = ?, npc_garrison_alive = ? WHERE city_id = ?',
          [serializeNpcGarrisonStored(unitArr, new Date()), aliveCount, war.target_city_id]
        );
      }
    }

    // 势力击杀只计算实际从alive变dead的数量（防止重复上报）
    factionKills[factionId] = (factionKills[factionId] || 0) + actualKillCount;

    // 4. 发放银两奖励（扣除战斗消耗后的净值）
    const netSilver = silverReward - (silverSpent > 0 ? silverSpent : 0);
    if (netSilver !== 0) {
      await connection.query(
        'UPDATE players SET silver = GREATEST(0, silver + ?) WHERE player_id = ?',
        [netSilver, playerId]
      );
    }

    // 4.5 胜利额外奖励：贡献 + 装备掉落（NPC 守军线）
    let reputationReward = 0;
    let contributionReward = 0;
    let equipmentDrop = null;
    if (result === 'win' && actualKillCount > 0 && npcKillRaritiesThisRound.length > 0) {
      const loot = await smallMapBattleLootService.grantWinContributionAndEquipment(
        connection,
        playerId,
        npcKillRaritiesThisRound,
      );
      contributionReward = loot.contributionReward;
      equipmentDrop = loot.equipmentDrop;
    }

    // 4. 更新 war 击杀数：以守军 JSON 为准同步（累计阵亡支数），修复历史误累加导致的结算 UI 与「alive/total」不符
    const npcKilledToStore =
      authoritativeNpcEliminated != null
        ? authoritativeNpcEliminated
        : (war.npc_killed || 0) + actualKillCount;
    await connection.query(
      'UPDATE wars SET faction_kills = ?, npc_killed = ? WHERE war_id = ?',
      [JSON.stringify(factionKills), npcKilledToStore, warId]
    );

    // 5. 检查是否攻破（NPC 守军 JSON 中已无存活）
    // 旧逻辑用 newNpcKilled >= war.npc_total，但 wars.npc_killed 曾误累加披挂/驻地消灭数，导致「NPC 仍有残余却已易主」
    let siegeCompleted = false;
    let winnerFaction = null;
    if (npcAliveAfterUpdate === 0) {
      // 找出击杀最多的势力
      let maxKills = 0;
      for (const [fid, kills] of Object.entries(factionKills)) {
        if (kills > maxKills) { maxKills = kills; winnerFaction = fid; }
      }

      // 更新 war 为完成
      await connection.query(
        "UPDATE wars SET status = 'completed', winner_faction_id = ?, end_time = NOW() WHERE war_id = ?",
        [winnerFaction, warId]
      );

      // 易主：清除待战本城的「披挂上阵」标记（与是否保存驻地编组无关）
      await connection.query(
        'UPDATE players SET on_duty = FALSE, on_duty_city_id = NULL WHERE on_duty_city_id = ?',
        [war.target_city_id]
      );

      // 兼容旧数据：曾在本城有驻守行、但 on_duty_city_id 未写入的玩家
      const [allCityGarrisonPlayers] = await connection.query(
        `SELECT DISTINCT g.player_id FROM player_garrison g WHERE g.city_id = ?`,
        [war.target_city_id]
      );
      const allGarrisonPlayerIds = allCityGarrisonPlayers.map(r => r.player_id);
      if (allGarrisonPlayerIds.length > 0) {
        const phAll = allGarrisonPlayerIds.map(() => '?').join(',');
        await connection.query(
          `UPDATE players SET on_duty = FALSE, on_duty_city_id = NULL WHERE player_id IN (${phAll}) AND on_duty = TRUE`,
          allGarrisonPlayerIds
        );
      }

      await garrisonService.stripGarrisonOnCityConquest(connection, war.target_city_id, winnerFaction);

      // 更新城市归属
      await connection.query(
        "UPDATE cities SET faction_id = ?, status = 'owned', npc_garrison = NULL, npc_garrison_alive = 0 WHERE city_id = ?",
        [winnerFaction, war.target_city_id]
      );

      siegeCompleted = true;
    }

    // 兜底：当前端战报未落库时，在攻城结算阶段补记活动战斗积分（避免排行榜漏加）
    if (shouldFallbackAddBattleScore) {
      await connection.query(
        'UPDATE statistics SET total_battle_score = total_battle_score + ? WHERE player_id = ?',
        [Number(battleScore), playerId]
      );
      console.log(
        `[siege-score-fallback] ${JSON.stringify({
          warId,
          playerId,
          battleScore: Number(battleScore),
          defenderType: defenderType || 'npc',
          source: 'recordSiegeResult.npc_defender',
        })}`
      );
    }

    await connection.commit();

    if (siegeCompleted && winnerFaction) {
      const cityLabel = war.target_city_name || war.target_city_id || '城池';
      factionBulletinService.logPveWarSiegeCompleted(winnerFaction, cityLabel, war.target_city_id);
    }

    const siegeSilverSpentNpc = Math.max(0, Math.floor(Number(silverSpent) || 0));
    if (siegeSilverSpentNpc > 0) {
      await statisticsDeltaService.incrementSpent(playerId, { silver: siegeSilverSpentNpc });
    }
    await statisticsDeltaService.recordEarned(playerId, {
      ...(silverReward > 0 ? { silver: silverReward } : {}),
      ...(contributionReward > 0 ? { contribution: contributionReward } : {}),
    });

    // 攻破后立即刷新 NPC 守军（在事务外执行，城市已归属新势力）
    if (siegeCompleted) {
      try {
        await generateNpcGarrison(war.target_city_id);
      } catch (e) {
        console.error('[CityService] 攻破后刷新NPC失败:', e);
      }
    }

    // PVP 战事旁路：若该城存在 attackerFaction 匹配的 active wars_pvp，则把 attacker.npcKills/.battles/.wins/.losses
    // 写回 side_stats；攻破时同时把 wars_pvp 标记 capture_city（兜底于 tick 检测）。lazy require 以避免循环依赖。
    try {
      const pvpWarService = require('./pvpWarService');
      await pvpWarService.notifyAttackerCityCombat({
        targetCityId: war.target_city_id,
        attackerFactionId: factionId,
        result,
        npcKilled: actualKillCount,
        cityCaptured: siegeCompleted,
      });
    } catch (notifyErr) {
      console.error('[CityService] notifyAttackerCityCombat 失败（不影响 PVE 主路径）:', notifyErr.message);
    }

    return {
      warId,
      factionKills,
      npcKilled: npcKilledToStore,
      npcTotal:
        npcGarrisonSlotCount != null
          ? npcGarrisonSlotCount
          : Number(war.npc_total) || 0,
      killCount: actualKillCount,
      siegeCompleted,
      winnerFaction,
      silverReward,
      reputationReward,
      contributionReward,
      equipmentDrop,
      defenderType: 'npc',
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  } finally {
    releaseDefenderSiegeLockIfNeeded();
  }
};

/**
 * 查找或创建活跃的 war 记录
 */
async function getOrCreateWar(cityId, city) {
  const [existingWar] = await pool.query(
    "SELECT * FROM wars WHERE target_city_id = ? AND status = 'active'",
    [cityId]
  );
  if (existingWar.length > 0) return existingWar[0];
  const warId = `war_${cityId}_${Date.now()}`;
  /** 战事「编制」与界面 NPC 守军 x/y 一致：优先 JSON 支数，避免仅用 npc_garrison_alive（已占领城 40 vs 中立 400） */
  let npcTotalSlots = 0;
  if (Array.isArray(city.npc_garrison) && city.npc_garrison.length > 0) {
    npcTotalSlots = city.npc_garrison.length;
  } else {
    const { units } = parseNpcGarrisonStored(city.npc_garrison);
    if (units && units.length) npcTotalSlots = units.length;
  }
  if (!npcTotalSlots) npcTotalSlots = Number(city.npc_garrison_alive) || 0;
  await pool.query(
    `INSERT INTO wars (war_id, war_name, war_type, target_city_id, target_city_name,
      faction_kills, status, npc_total, npc_killed)
     VALUES (?, ?, 'siege', ?, ?, '{}', 'active', ?, 0)`,
    [warId, `${city.city_name}攻城战`, cityId, city.city_name, npcTotalSlots]
  );
  return { war_id: warId, faction_kills: {} };
}

/**
 * 获取战事状态
 */
async function getWarStatus(warId) {
  const [rows] = await pool.query('SELECT * FROM wars WHERE war_id = ?', [warId]);
  if (!rows.length) return null;
  const war = rows[0];
  let factionKills = {};
  if (war.faction_kills) {
    factionKills = typeof war.faction_kills === 'string' ? JSON.parse(war.faction_kills) : war.faction_kills;
  }
  return { ...war, faction_kills: factionKills };
}

/**
 * AI 君主主动开启 PVE 战事（白色 NPC 中立城）。
 *
 * 与 `initiateSiege` 同口径：相同 `wars` 行结构（`war_type='siege'`、`faction_kills` 见下、
 * `npc_total = npc_garrison_alive`），玩家随后通过 `initiateSiege` / 大地图入口加入即可。
 * 区别是：本入口 **不需要攻方玩家**，由 AI 君主在 `aiKingActiveDecisionService.decide()`
 * 内部调用；不调度具体战斗、不写其它表。
 *
 * 校验 / 行为：
 *   1. 城存在、faction_id IS NULL（中立白城）、未进入 `isCityOccupiedForNpcGarrison`；
 *   2. 若 NPC 守军未生成（`npc_garrison_alive <= 0` / 无编制）→ 调 `generateNpcGarrison`；
 *   3. 同城唯一：已存在 active `wars` 行 → 返回该行，**不**新建（幂等）；
 *   4. 否则插入 `wars` 行；`bulletinFactionId` 有值时写入 `faction_kills` 该键（初值 0）以占用 PVE 并发槽；
 *      无 `bulletinFactionId` 时仍为 `'{}'`（系统路径不设势力上限）；
 *   5. 有 `bulletinFactionId` 且新建前：该势力进行中 PVE 已达上限则拒绝；**新建 `wars` 行**时同事务内自 `factions.reserve_silver` / `reserve_food` 按 17-2 §3.2 扣发动消耗（储备不足则整单失败）。
 *
 * **不写**：不在 `wars` 上加 attacker_player_id / proposer_player_id（表无此列）；
 * AI 君主 `character_id` 仅落 `[aiKing][active]` 审计日志（由调用方负责）。
 *
 * @param {string} cityId
 * @param {{ openedByCharacterId?: string, bulletinFactionId?: string }} [opts] - 仅用于日志；`bulletinFactionId` 有值且新建 wars 行时写入势力公告
 * @returns {Promise<{ warId: string, created: boolean, war: object, npcAlive: number, openedByCharacterId: string|null }>}
 */
async function openPveWarOnNeutralCity(cityId, opts = {}) {
  const openedByCharacterId = opts.openedByCharacterId || null;
  const bulletinFactionId = opts.bulletinFactionId || null;
  const city = await getCityInfo(cityId);
  if (!city) throw new Error('城市不存在');
  if (city.faction_id) {
    throw new Error('目标城非中立城（已有归属），不能走 PVE 路径开战');
  }
  if (!isAllowedPlayerCityPoiCityType(city.city_type)) {
    throw new Error('PVE 中立城攻城仅针对大城/中城/小城，不含关隘、据点等');
  }
  if (isCityOccupiedForNpcGarrison(city)) {
    throw new Error('该城已被势力占领，请通过 PVP 战事路径');
  }

  // 同城唯一：已有 active wars 行 → 幂等返回（即便 NPC 守军已半灭，玩家仍可加入该 wars 行）
  const [existingWars] = await pool.query(
    "SELECT * FROM wars WHERE target_city_id = ? AND status = 'active'",
    [cityId],
  );
  if (existingWars.length > 0) {
    return {
      warId: existingWars[0].war_id,
      created: false,
      war: existingWars[0],
      npcAlive: Number(city.npc_garrison_alive || 0),
      openedByCharacterId,
    };
  }

  if (bulletinFactionId && String(bulletinFactionId).trim()) {
    const strategicWarTargetProximityService = require('./strategicWarTargetProximityService');
    await strategicWarTargetProximityService.assertNeutralPveTargetInMapRange(
      String(bulletinFactionId).trim(),
      cityId,
      String(city.season || 'san_1').trim() || 'san_1',
    );
  }

  // 确保 NPC 守军已生成（与 initiateSiege 同口径）
  let cityRefreshed = city;
  if (!cityRefreshed.npc_garrison || Number(cityRefreshed.npc_garrison_alive) <= 0) {
    await generateNpcGarrison(cityId);
    cityRefreshed = await getCityInfo(cityId);
  }
  const npcAlive = Number(cityRefreshed.npc_garrison_alive || 0);
  if (npcAlive <= 0) {
    throw new Error(`目标城 ${cityId} 无 NPC 守军可生成`);
  }

  if (bulletinFactionId) {
    const bf = String(bulletinFactionId).trim();
    const siegeSeason = String(cityRefreshed.season || 'san_1').trim() || 'san_1';
    const existingOther = await countActivePveSiegeWarsForFaction(bf, { season: siegeSeason });
    if (existingOther >= MAX_CONCURRENT_PVE_WARS_PER_ATTACKER_FACTION) {
      throw new Error(
        `[cityService] 势力 ${bf} 进行中的 PVE 攻城战事已达上限（${MAX_CONCURRENT_PVE_WARS_PER_ATTACKER_FACTION}），无法新建`,
      );
    }
  }

  const warId = `war_${cityId}_${Date.now()}`;
  const fkInsert =
    bulletinFactionId && String(bulletinFactionId).trim()
      ? JSON.stringify({ [String(bulletinFactionId).trim()]: 0 })
      : '{}';

  if (bulletinFactionId && String(bulletinFactionId).trim()) {
    const bf = String(bulletinFactionId).trim();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [ex2] = await conn.query(
        "SELECT * FROM wars WHERE target_city_id = ? AND status = 'active' LIMIT 1",
        [cityId],
      );
      if (ex2.length > 0) {
        await conn.rollback();
        return {
          warId: ex2[0].war_id,
          created: false,
          war: ex2[0],
          npcAlive: Number(cityRefreshed.npc_garrison_alive || 0),
          openedByCharacterId,
        };
      }
      const gt = await gameTimeService.loadGameTimeForFaction(bf);
      await warInitiationCostService.assertAndDeductInTransaction(
        conn,
        bf,
        cityRefreshed.city_type,
        gt,
      );
      await conn.query(
        `INSERT INTO wars (war_id, war_name, war_type, target_city_id, target_city_name,
           faction_kills, status, npc_total, npc_killed)
         VALUES (?, ?, 'siege', ?, ?, ?, 'active', ?, 0)`,
        [warId, `${cityRefreshed.city_name}攻城战`, cityId, cityRefreshed.city_name, fkInsert, npcAlive],
      );
      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch (_) {
        /* ignore */
      }
      throw e;
    } finally {
      conn.release();
    }
  } else {
    await pool.query(
      `INSERT INTO wars (war_id, war_name, war_type, target_city_id, target_city_name,
         faction_kills, status, npc_total, npc_killed)
       VALUES (?, ?, 'siege', ?, ?, ?, 'active', ?, 0)`,
      [warId, `${cityRefreshed.city_name}攻城战`, cityId, cityRefreshed.city_name, fkInsert, npcAlive],
    );
  }

  console.log(
    `[cityService] openPveWarOnNeutralCity created warId=${warId} cityId=${cityId} ` +
      `cityName=${cityRefreshed.city_name} npcAlive=${npcAlive} ` +
      `openedBy=${openedByCharacterId || 'system'}`,
  );

  if (bulletinFactionId) {
    factionBulletinService.logPveWarStarted(bulletinFactionId, cityRefreshed.city_name, cityId);
  }

  return {
    warId,
    created: true,
    war: { war_id: warId, status: 'active', target_city_id: cityId },
    npcAlive,
    openedByCharacterId,
  };
}

/**
 * 大地图「攻城」进度钮：玩家有参与的 **PVE `wars`**（`active`）。
 * 参与判定：`faction_kills` 含本势力键，或 `battles` 存在本人 `pve_siege` 且 `war_id` 命中。
 * 与 `wars_pvp` 共用同一套 **攻城次数**（`player_events.siege_quota_*`）；本列表仅用于滚屏定位。
 *
 * @param {{ playerId: string, factionId: string, season: string }} p
 * @returns {Promise<Array<{ warId: string, targetCityId: string, targetCityName: string|null, createdAt: string|null }>>}
 */
async function listActivePveSiegeTargetsForMap({ playerId, factionId, season }) {
  const sid = String(season || '').trim();
  const fid = String(factionId || '').trim();
  const pid = String(playerId || '').trim();
  if (!sid || !fid || !pid) return [];

  const [warRows] = await pool.query(
    `SELECT w.war_id AS warId, w.target_city_id AS targetCityId, w.target_city_name AS targetCityName,
            w.created_at AS createdAt, w.faction_kills AS factionKillsRaw
     FROM wars w
     INNER JOIN cities c ON c.city_id = w.target_city_id
     WHERE w.status = 'active' AND w.war_type = 'siege' AND c.season = ?`,
    [sid],
  );

  const [battleRows] = await pool.query(
    `SELECT DISTINCT b.war_id AS warId
       FROM battles b
       INNER JOIN wars w ON w.war_id = b.war_id AND w.status = 'active' AND w.war_type = 'siege'
       INNER JOIN cities c ON c.city_id = w.target_city_id AND c.season = ?
       WHERE b.player_id = ? AND b.battle_type = 'pve_siege' AND b.war_id IS NOT NULL`,
    [sid, pid],
  );
  const battleWarIds = new Set(battleRows.map((r) => r.warId).filter(Boolean));

  const out = [];
  for (const row of warRows) {
    let fk = row.factionKillsRaw;
    if (typeof fk === 'string') {
      try {
        fk = JSON.parse(fk);
      } catch {
        fk = {};
      }
    }
    if (!fk || typeof fk !== 'object') fk = {};
    const inFk = Object.prototype.hasOwnProperty.call(fk, fid);
    const inBattle = battleWarIds.has(row.warId);
    if (!inFk && !inBattle) continue;
    out.push({
      warId: row.warId,
      targetCityId: row.targetCityId,
      targetCityName: row.targetCityName || null,
      createdAt: row.createdAt || null,
    });
  }
  return out;
}

/** 与 `pvpWarService.assertSanGongChaoZhengPvpWarGate` 一致：朝政势力战事品阶门闸。 */
const MAX_POSITION_LEVEL_SANGONG_CHAOZHENG_WAR = 3;

function sanGongChaoZhengClientError(message) {
  const e = new Error(message);
  e.statusCode = 400;
  return e;
}

async function assertSanGongChaoZhengWarGate(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) throw sanGongChaoZhengClientError('缺少玩家 ID');
  const [pRows] = await pool.query(
    'SELECT player_id, faction_id, position_level FROM players WHERE player_id = ? LIMIT 1',
    [pid],
  );
  if (!pRows.length) throw sanGongChaoZhengClientError('玩家不存在');
  const pl = Number(pRows[0].position_level);
  if (!Number.isFinite(pl) || pl > MAX_POSITION_LEVEL_SANGONG_CHAOZHENG_WAR) {
    throw sanGongChaoZhengClientError('需三阶及以上官职（朝政品阶 Lv≤3）方可操作势力战事');
  }
  const factionId = String(pRows[0].faction_id || '').trim();
  if (!factionId) throw sanGongChaoZhengClientError('玩家未加入势力，无法操作势力战事');
  return { factionId, positionLevel: pl };
}

/**
 * 三公府 · 朝政：结束本势力有参与的 **进行中** 中立城 PVE（`wars` active siege）。
 * 将战事标记为 `completed`（`winner_faction_id` 置空），清内存 NPC 攻城锁，写势力公告。
 *
 * @param {string} playerId
 * @param {string} warId
 * @param {{ reason?: string }} [body]
 */
async function cancelActivePveSiegeWarViaSanGongChaoZheng(playerId, warId, body = {}) {
  const pid = String(playerId || '').trim();
  const wid = String(warId || '').trim();
  if (!pid || !wid) throw sanGongChaoZhengClientError('缺少玩家或战事 ID');

  const { factionId } = await assertSanGongChaoZhengWarGate(pid);

  const [warRows] = await pool.query(
    `SELECT w.war_id, w.target_city_id, w.target_city_name, c.season AS _city_season
       FROM wars w
       INNER JOIN cities c ON c.city_id = w.target_city_id
       WHERE w.war_id = ? AND w.status = 'active' AND w.war_type = 'siege'`,
    [wid],
  );
  if (!warRows.length) throw sanGongChaoZhengClientError('战事不存在或已结束');

  const season = String(warRows[0]._city_season || 'san_1').trim() || 'san_1';
  const part = await getActivePveSiegeParticipationForFaction(factionId, { season });
  const hit = (part.wars || []).some((x) => String(x.warId) === wid);
  if (!hit) throw sanGongChaoZhengClientError('本势力未参与该中立城攻城，无法从此入口结束');

  const reason =
    String(body?.reason || '').trim() || '三阶及以上官职主动撤战（三公府·朝政）';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [locked] = await conn.query(
      "SELECT war_id FROM wars WHERE war_id = ? AND status = 'active' FOR UPDATE",
      [wid],
    );
    if (!locked.length) {
      await conn.rollback();
      throw sanGongChaoZhengClientError('战事不存在或已结束');
    }
    await conn.query(
      `UPDATE wars SET status = 'completed', winner_faction_id = NULL, end_time = NOW() WHERE war_id = ?`,
      [wid],
    );
    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    throw e;
  } finally {
    conn.release();
  }

  releaseAllSiegeMemoryLocksForPveWar(wid);

  const cityLabel =
    String(warRows[0].target_city_name || '').trim() ||
    String(warRows[0].target_city_id || '').trim() ||
    '中立城';
  factionBulletinService.appendSafe(
    factionId,
    `PVE 战事结束：朝政撤战，已中止对「${cityLabel}」的攻城（${reason}）`.slice(0, 512),
  );

  return { warId: wid, status: 'completed', targetCityId: warRows[0].target_city_id, targetCityName: warRows[0].target_city_name };
}

module.exports = {
  formatCityRowForApi,
  listCitiesForApi,
  generateNpcGarrison,
  getCityInfo,
  initiateSiege,
  openPveWarOnNeutralCity,
  recordSiegeResult,
  getWarStatus,
  parseNpcGarrisonStored,
  serializeNpcGarrisonStored,
  NPC_TROOP_COUNT_OWNED,
  listActivePveSiegeTargetsForMap,
  getActivePveSiegeParticipationForFaction,
  cancelActivePveSiegeWarViaSanGongChaoZheng,
  tryConsumeSiegeQuotaOnce,
  refundSiegeQuotaOnce,
  countActivePveSiegeWarsForFaction,
  MAX_CONCURRENT_PVE_WARS_PER_ATTACKER_FACTION,
  /** 供 `pvpWarService` 等复用：据点 PVP 目标须与此口径一致 */
  isCityOccupiedForNpcGarrison,
};
