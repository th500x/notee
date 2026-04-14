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

// 击杀 NPC 银两奖励（按稀有度）
const KILL_SILVER_REWARD = {
  core: 50,
  legendary: 40,
  epic: 30,
  rare: 20,
  common: 10,
};

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

/**
 * 发起攻城战（创建 war 记录，返回 NPC 守军供前端战斗）
 */
async function initiateSiege(cityId, playerId) {
  const city = await getCityInfo(cityId);
  if (!city) throw new Error('城市不存在');

  // 获取玩家势力
  const [playerRows] = await pool.query('SELECT faction_id FROM players WHERE player_id = ?', [playerId]);
  if (!playerRows.length) throw new Error('玩家不存在');
  const playerFaction = playerRows[0].faction_id;

  // 如果城市已被自己势力占领，不能攻打
  if (city.faction_id && city.faction_id === playerFaction) {
    throw new Error('不能攻打己方城市');
  }

  const attackerLineupTroops = await garrisonService.sumMainLineupEquippedTroopTroops(pool, playerId);
  if (attackerLineupTroops < garrisonService.MIN_MAIN_LINEUP_TROOPS_BATTLE) {
    throw new Error(
      `开战需上阵编组总兵力≥${garrisonService.MIN_MAIN_LINEUP_TROOPS_BATTLE}（当前 ${attackerLineupTroops}）`
    );
  }

  // ── 已占领城市：先查玩家防守者 ──
  // 防守顺序：① 披挂上阵玩家（on_duty=TRUE）→ ② 普通驻守玩家 → ③ NPC守军
  if (isCityOccupiedForNpcGarrison(city)) {
    // 按顺序构建防守者队列：先 on_duty，再普通驻守
    const onDutyDefenders = await garrisonService.getCityOnDutyDefenders(cityId, city.faction_id);
    const garrisonDefenders = await garrisonService.getCityGarrisonDefenders(cityId, city.faction_id);
    const onDutyPlayerIds = new Set(onDutyDefenders.map((d) => d.player_id));
    const garrisonOnly = garrisonDefenders.filter((d) => !onDutyPlayerIds.has(d.player_id));
    const allDefenders = [...onDutyDefenders, ...garrisonOnly];

    for (const def of allDefenders) {
      if (def.player_id === playerId) continue; // 跳过攻城方自己

      const units =
        def.defense_source === 'main_lineup'
          ? await garrisonService.buildDefenseUnitsFromMainLineup(def.player_id)
          : await garrisonService.buildDefenseUnits(def);
      // 总兵力达下限才作为有效防守者（披挂上阵 PVP 与普通驻守异步一致，均适用）
      const totalTroops = units.reduce((sum, u) => sum + u.currentTroops, 0);
      if (totalTroops < garrisonService.MIN_GARRISON_TOTAL_TROOPS) continue;

      const war = await getOrCreateWar(cityId, city);
      const defLockKey = `def|${war.war_id}|${def.player_id}|${def.garrison_slot}`;
      if (!tryAcquireSiegeLock(defLockKey, playerId)) continue;

      // 构建防守单位（BattleArena格式：属性×10）
      const garrisonUnits = garrisonService.mapBuiltUnitsToSiegeNpcFormat(units);

      const isOnDuty = def.defense_source === 'main_lineup' || !!def.on_duty;

      // 披挂上阵：待战方用上阵编组，与驻地编组无关；一律走实时 PVP 挑战（接受/超时自动战）。
      if (isOnDuty) {
        return {
          warId: war.war_id, cityId, cityName: city.city_name, cityType: city.city_type,
          npcGarrison: garrisonUnits, npcAlive: garrisonUnits.length, npcTotal: garrisonUnits.length,
          playerFaction, defenderType: 'pvp_online',
          defenderName: def.character_name, defenderPlayerId: def.player_id,
          defenderGarrisonSlot: def.garrison_slot,
        };
      }

      // 普通驻守玩家 → 异步PVE（驻守卡池作为NPC）
      return {
        warId: war.war_id, cityId, cityName: city.city_name, cityType: city.city_type,
        npcGarrison: garrisonUnits, npcAlive: garrisonUnits.length, npcTotal: garrisonUnits.length,
        playerFaction, defenderType: 'player_garrison',
        defenderName: def.character_name, defenderPlayerId: def.player_id,
        defenderGarrisonSlot: def.garrison_slot,
      };
    }
    // 所有玩家防守者总兵力不足 → 继续到 NPC 守军
  }

  // ── NPC 守军逻辑（中立城市 或 玩家防守者全部跳过） ──
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

  let war;
  if (existingWar.length > 0) {
    war = existingWar[0];
  } else {
    const warId = `war_${cityId}_${Date.now()}`;
    await pool.query(
      `INSERT INTO wars (war_id, war_name, war_type, target_city_id, target_city_name,
        faction_kills, status, npc_total, npc_killed)
       VALUES (?, ?, 'siege', ?, ?, '{}', 'active', ?, 0)`,
      [warId, `${city.city_name}攻城战`, cityId, city.city_name, city.npc_garrison_alive]
    );
    war = { war_id: warId, faction_kills: {} };
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
 * 记录攻城战斗结果（玩家打完一场后调用）
 * 
 * @param {string} warId - 战事ID
 * @param {string} playerId - 玩家ID
 * @param {string} factionId - 玩家势力ID
 * @param {Array<number>} killedIndices - 本场战斗消灭的 NPC 索引列表
 * @param {string} result - 战斗结果 win/lose
 * @param {number} silverSpent - 战斗中消耗的银两（自动战斗费用）
 * @param {object} defenderInfo - 防守者信息
 */
async function recordSiegeResult(warId, playerId, factionId, killedIndices, result, silverSpent = 0, defenderInfo = {}) {
  const {
    defenderType, defenderPlayerId, garrisonUnits, defenderGarrisonSlot, npcBatchIndex,
    battleScore, battleReportSaved,
    /** 披挂权威结算：按推演结果写回防守方各部队兵力（含战损未全灭） */
    defenderLineupTroopUpdates,
  } = defenderInfo || {};
  const shouldFallbackAddBattleScore = Number(battleScore) > 0 && battleReportSaved === false;

  const defSlotForLock =
    defenderGarrisonSlot != null
      ? Number(defenderGarrisonSlot)
      : (Array.isArray(garrisonUnits) ? garrisonUnits.find(u => u && u._garrisonSlot != null)?._garrisonSlot : null);
  let defLockReleased = false;
  const releaseDefenderSiegeLockIfNeeded = () => {
    if (defLockReleased) return;
    if (defenderType === 'npc') {
      if (npcBatchIndex != null && !Number.isNaN(Number(npcBatchIndex))) {
        releaseSiegeLock(`def|${warId}|${NPC_SIEGE_LOCK_DEFENDER_ID}|${Number(npcBatchIndex)}`, playerId);
      } else {
        // 前端未传批次时仍要释放，否则内存锁永久占用该战事
        for (let b = 0; b < NPC_LOCK_SWEEP; b++) {
          releaseSiegeLock(`def|${warId}|${NPC_SIEGE_LOCK_DEFENDER_ID}|${b}`, playerId);
        }
      }
      defLockReleased = true;
      return;
    }
    if (!['player_garrison', 'pvp_online'].includes(defenderType || '')) return;
    if (defenderPlayerId == null || defSlotForLock == null || Number.isNaN(Number(defSlotForLock))) return;
    releaseSiegeLock(`def|${warId}|${defenderPlayerId}|${Number(defSlotForLock)}`, playerId);
    defLockReleased = true;
  };

  try {
  // ── 玩家防守者：更新驻守部队兵力 + 耐久度 + 驻守状态（含在线 PVP 异步结算，需带 garrisonUnits） ──
  if ((defenderType === 'player_garrison' || defenderType === 'pvp_online') && garrisonUnits && Array.isArray(garrisonUnits)) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [warRows] = await conn.query("SELECT * FROM wars WHERE war_id = ? AND status = 'active' FOR UPDATE", [warId]);
      if (!warRows.length) throw new Error('战事不存在或已结束');
      const war = warRows[0];
      let factionKills = war.faction_kills ? (typeof war.faction_kills === 'string' ? JSON.parse(war.faction_kills) : war.faction_kills) : {};
      let killCount = 0;
      let silverReward = 0;

      // 收集参战的所有部队实例ID（用于更新 battle_count）
      const allTroopInstanceIds = garrisonUnits
        .filter(u => u && u._troopInstanceId)
        .map(u => u._troopInstanceId);

      const useLineupUpdates =
        Array.isArray(defenderLineupTroopUpdates) && defenderLineupTroopUpdates.length > 0;

      if (useLineupUpdates) {
        for (const u of defenderLineupTroopUpdates) {
          if (!u?.instanceId || !defenderPlayerId) continue;
          const maxT = u.maxTroops != null ? Number(u.maxTroops) : 9999;
          const cur = Math.max(0, Math.min(maxT, Math.round(Number(u.currentTroops) || 0)));
          await conn.query(
            `UPDATE player_cards SET current_troops = ?, last_troops_lost_at = ? WHERE instance_id = ? AND player_id = ?`,
            [cur, cur < maxT ? new Date() : null, u.instanceId, defenderPlayerId],
          );
        }
        for (const idx of killedIndices) {
          const unit = garrisonUnits[idx];
          if (!unit) continue;
          killCount++;
          silverReward += KILL_SILVER_REWARD[unit.rarity] || 10;
        }
      } else {
        for (const idx of killedIndices) {
          const unit = garrisonUnits[idx];
          if (!unit || !unit._troopInstanceId) continue;
          await conn.query('UPDATE player_cards SET current_troops = 0, last_troops_lost_at = NOW() WHERE instance_id = ?', [unit._troopInstanceId]);
          killCount++;
          silverReward += KILL_SILVER_REWARD[unit.rarity] || 10;
        }
      }

      // 所有参战部队卡的 battle_count + 1（耐久度消耗），同步递增 lifetime_battle_count
      if (allTroopInstanceIds.length > 0) {
        const ph = allTroopInstanceIds.map(() => '?').join(',');
        await conn.query(
          `UPDATE player_cards SET battle_count = LEAST(
             GREATEST(COALESCE(battle_count, 0), 0) + 1,
             COALESCE(max_battle_count, 60)
           ),
           lifetime_battle_count = COALESCE(lifetime_battle_count, 0) + 1
           WHERE instance_id IN (${ph})`,
          allTroopInstanceIds
        );
      }

      // 与上阵结算一致：用尽的金/白/蓝/紫处理 + 从驻守槽强制清空（橙 legendary 保留在槽内）
      const defenderPlayerIds = [
        ...new Set(garrisonUnits.map((u) => u && u._garrisonPlayerId).filter(Boolean)),
      ];
      const runQ = (sql, params) => conn.query(sql, params);
      for (const defPid of defenderPlayerIds) {
        await applyTroopDurabilityExhaustion(runQ, defPid);
      }

      // Bug fix: 检查该驻守槽位是否所有部队都被消灭（兵力=0），如果是则 is_active=FALSE
      const siegeTargetCityId = war.target_city_id;
      // 收集本次防守涉及的 player_id + city_id + garrison_slot 组合
      const garrisonKeys = new Map(); // key: "playerId|cityId|slot" → value: { playerId, slot, garrisonCityId }
      for (const unit of garrisonUnits) {
        if (!unit || !unit._garrisonPlayerId || unit._garrisonSlot == null) continue;
        const gc = unit._garrisonCityId || siegeTargetCityId;
        const key = `${unit._garrisonPlayerId}|${gc}|${unit._garrisonSlot}`;
        if (!garrisonKeys.has(key)) {
          garrisonKeys.set(key, {
            playerId: unit._garrisonPlayerId,
            slot: unit._garrisonSlot,
            garrisonCityId: unit._garrisonCityId || null,
          });
        }
      }
      for (const { playerId: gPlayerId, slot, garrisonCityId } of garrisonKeys.values()) {
        const rowCityId = garrisonCityId || siegeTargetCityId;
        const [slotRows] = await conn.query(
          'SELECT char1_troop1, char1_troop2, char2_troop1, char2_troop2 FROM player_garrison WHERE player_id = ? AND city_id = ? AND garrison_slot = ?',
          [gPlayerId, rowCityId, slot]
        );
        if (!slotRows.length) continue;
        const troopIds = [slotRows[0].char1_troop1, slotRows[0].char1_troop2, slotRows[0].char2_troop1, slotRows[0].char2_troop2].filter(Boolean);
        if (troopIds.length === 0) {
          await conn.query(
            'UPDATE player_garrison SET is_active = FALSE WHERE player_id = ? AND city_id = ? AND garrison_slot = ?',
            [gPlayerId, rowCityId, slot]
          );
          continue;
        }
        const totalTroopsLeft = await garrisonService.sumTroopInstancesTotalTroops(conn, gPlayerId, troopIds);
        if (totalTroopsLeft < garrisonService.MIN_GARRISON_TOTAL_TROOPS) {
          await conn.query(
            'UPDATE player_garrison SET is_active = FALSE WHERE player_id = ? AND city_id = ? AND garrison_slot = ?',
            [gPlayerId, rowCityId, slot]
          );
        }
      }

      factionKills[factionId] = (factionKills[factionId] || 0) + killCount;
      const netSilver = silverReward - (silverSpent > 0 ? silverSpent : 0);
      if (netSilver !== 0) {
        await conn.query('UPDATE players SET silver = GREATEST(0, silver + ?) WHERE player_id = ?', [netSilver, playerId]);
      }
      let reputationReward = 0;
      if (result === 'win' && killCount > 0) {
        const killedRarities = killedIndices.map(i => garrisonUnits[i]?.rarity).filter(Boolean);
        const rarityOrder = ['common', 'rare', 'epic', 'legendary', 'core'];
        const bestRarity = killedRarities.sort((a, b) => rarityOrder.indexOf(b) - rarityOrder.indexOf(a))[0] || 'common';
        reputationReward = WIN_REPUTATION_REWARD[bestRarity] || 5;
        await conn.query('UPDATE players SET reputation = reputation + ? WHERE player_id = ?', [reputationReward, playerId]);
      }
      // 仅累计势力击杀；勿写入 wars.npc_killed（该字段语义为「NPC 守军消灭数」，与披挂/驻地战果混加会导致 NPC 线误判易主）
      await conn.query('UPDATE wars SET faction_kills = ? WHERE war_id = ?', [JSON.stringify(factionKills), warId]);

      // 披挂上阵：攻城方胜利时解除待战状态（列表人数与状态同步）
      if (defenderType === 'pvp_online' && result === 'win' && defenderPlayerId) {
        await conn.query(
          'UPDATE players SET on_duty = FALSE, on_duty_city_id = NULL WHERE player_id = ?',
          [defenderPlayerId]
        );
      }

      // 兜底：当前端战报未落库时，在攻城结算阶段补记活动战斗积分（避免排行榜漏加）
      if (shouldFallbackAddBattleScore) {
        await conn.query(
          'UPDATE statistics SET total_battle_score = total_battle_score + ? WHERE player_id = ?',
          [Number(battleScore), playerId]
        );
        console.log(
          `[siege-score-fallback] ${JSON.stringify({
            warId,
            playerId,
            battleScore: Number(battleScore),
            defenderType: defenderType || 'unknown',
            source: 'recordSiegeResult.player_defender',
          })}`
        );
      }

      await conn.commit();
      const siegeSilverSpent = Math.max(0, Math.floor(Number(silverSpent) || 0));
      if (siegeSilverSpent > 0) {
        await statisticsDeltaService.incrementSpent(playerId, { silver: siegeSilverSpent });
      }
      await statisticsDeltaService.recordEarned(playerId, {
        ...(silverReward > 0 ? { silver: silverReward } : {}),
        ...(reputationReward > 0 ? { reputation: reputationReward } : {}),
      });

      // 老兵系统：检查防守方参战部队是否达到晋升阈值
      let defenderVeteranPromotions = [];
      if (defenderPlayerId) {
        try {
          defenderVeteranPromotions = await checkAndApplyVeteran((sql, params) => pool.query(sql, params), defenderPlayerId);
          if (defenderVeteranPromotions.length > 0) {
            console.log(`[cityService] 老兵晋升(守方): player=${defenderPlayerId}, ${defenderVeteranPromotions.length}张卡`);
          }
        } catch (vetErr) {
          console.error('[cityService] 老兵检查(守方)失败:', vetErr);
        }
      }

      return {
        warId, factionKills, npcKilled: killCount, npcTotal: garrisonUnits.length, siegeCompleted: false, winnerFaction: null,
        silverReward, reputationReward, equipmentDrop: null,
        defenderType: defenderType === 'pvp_online' ? 'pvp_online' : 'player_garrison',
        defenderVeteranPromotions,
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  // ── NPC 守军：原有逻辑 ──
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

module.exports = {
  formatCityRowForApi,
  listCitiesForApi,
  generateNpcGarrison,
  getCityInfo,
  initiateSiege,
  recordSiegeResult,
  getWarStatus,
  parseNpcGarrisonStored,
  NPC_TROOP_COUNT_OWNED,
};
