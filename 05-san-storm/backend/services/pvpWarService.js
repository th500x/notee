/**
 * PVP 势力战事服务（17-3 M2）
 *
 * 职责：
 *   1. 战事生命周期：草案（pending）→ 活跃（active）→ 结算（completed/failed/cancelled）
 *   2. 攻方城外大本营（道路上 1×1 · `camp_01`）选位 + NPC 守军初始化 + 持久化到 `wars_pvp.base_camp` JSON
 *   3. 大本营 NPC 战斗握手：分批输出守军 + 战后写回存活 + 触发胜负
 *   4. 胜负判定与结算（capture_city / eliminate_attacker_base_camp / hold_city / war_morale_race / timeout）
 *   5. 7 日墙钟（与 11-3 协同：阶段表以 11-3 为准；本服务只做整场到点判负）
 *
 * 与 PVE 隔离：本服务不读写 `wars`（PVE）；PVE 路径 `cityService` 也禁止 import 本服务。
 * 共享：复用 `cityService` 的 NPC 生成池逻辑（部队池、稀有度循环），不另写一套数值。
 *
 * @module services/pvpWarService
 */

const path = require('path');
const fs = require('fs');
const { pool } = require('../database/connection');
const WarPvp = require('../models/WarPvp');
const cityService = require('./cityService');
const gameTimeService = require('./gameTimeService');
const warInitiationCostService = require('./warInitiationCostService');
const factionBulletinService = require('./factionBulletinService');
const { loadRoadGrid } = require('../utils/roadGrid');
const { attachSiegeCityDefenseToPayload } = require('../../shared/utils/siegeCityDefenseMult.cjs');
const {
  normalizeRoadCellList,
} = require('../../shared/utils/strategicRoadOverlay.js');

const {
  BASE_CAMP_NPC_RATIO_TO_FULL_GARRISON,
  BASE_CAMP_SIEGE_FOOD_COST_MULTIPLIER,
} = require('../../shared/utils/pvpBaseCampConstants.cjs');

/** 单场 PVP 战事最长时长（自然 24h，17-3 §0 / §6.2）。 */
/** 单场 PVP 战事墙钟上限（17-3：7 天） */
const PVP_WAR_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 同一攻方势力在 `wars_pvp` 上 pending+active 条数上限（与 PVE 合计见 warConcurrencyService，合计至多 1）。
 */
const MAX_CONCURRENT_PVP_WARS_PER_ATTACKER_FACTION = 1;

/** 大本营贴图：单格 1×1，固定 `camp_01`（道路贴城）。 */
const BASE_CAMP_SPRITE_SINGLE = 'camp_01';
const BASE_CAMP_ORIENTATION_SINGLE = 'single';

/** 内存锁键空间，避免同一场战事 / 大本营被并发结算 */
const baseCampLocks = new Map();
const BASE_CAMP_LOCK_TTL_MS = 60_000;

function tryAcquireBaseCampLock(pvpWarId, attackerId) {
  const now = Date.now();
  const cur = baseCampLocks.get(pvpWarId);
  if (cur && now - cur.lockedAt < BASE_CAMP_LOCK_TTL_MS && cur.attackerId !== attackerId) {
    return false;
  }
  baseCampLocks.set(pvpWarId, { attackerId, lockedAt: now });
  return true;
}

function releaseBaseCampLock(pvpWarId, attackerId) {
  const cur = baseCampLocks.get(pvpWarId);
  if (cur && cur.attackerId === attackerId) baseCampLocks.delete(pvpWarId);
}

// ==================== 大本营选位（geometry） ====================

const BASE_CAMP_CITY_NEIGHBOR_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * 在目标城 footprint **四邻接的道路格**上寻找可放下 **1×1** 大本营的合法槽位。
 *
 * 规则（17-3 §6）：
 *   - 单格须在地图内、为道路格（`roadKeys`）
 *   - 不落在城 footprint / 其它战略禁区（`blocked`）内
 *   - 不与本郡已有大本营占格重叠
 *   - 与目标城 footprint **至少一格 4 邻接**（贴城路边）
 *   - **不**拦路：本营叠在道路上，行军仍可正常使用该路格（本营仅为 POI 落点）
 *
 * @param {object} ctx - { mapColumns, mapRows, roadKeys, blocked, cityFootprint, occupiedCamps }
 * @returns {Array<{ anchorOx: number, anchorOy: number, orientation: 'single', cells: string[] }>}
 */
function findBaseCampCandidatePlacements(ctx) {
  const { mapColumns, mapRows, roadKeys, blocked, cityFootprint, occupiedCamps } = ctx;
  if (!cityFootprint?.size || !roadKeys?.size) return [];

  const occupiedKeys = new Set();
  for (const k of occupiedCamps) occupiedKeys.add(k);

  const candidates = [];
  const seen = new Set();

  for (const ck of cityFootprint) {
    const parts = String(ck)
      .split(',')
      .map((s) => Number(String(s).trim()));
    const cx = parts[0];
    const cy = parts[1];
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
    for (const [dx, dy] of BASE_CAMP_CITY_NEIGHBOR_OFFSETS) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= mapColumns || y >= mapRows) continue;
      const k = `${x},${y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (!roadKeys.has(k)) continue;
      if (cityFootprint.has(k)) continue;
      if (blocked.has(k)) continue;
      if (occupiedKeys.has(k)) continue;
      candidates.push({
        anchorOx: x,
        anchorOy: y,
        orientation: BASE_CAMP_ORIENTATION_SINGLE,
        cells: [k],
      });
    }
  }
  return candidates;
}

/**
 * 候选锚点择一：按 (anchorOy, anchorOx) 字典升序取首个（确定性）。
 * 签名保留 `pickerSeed` 供日后固定随机。
 */
function pickBaseCampPlacement(candidates, pickerSeed = 0) {
  if (!candidates?.length) return null;
  void pickerSeed;
  const sorted = [...candidates].sort((a, b) =>
    a.anchorOy !== b.anchorOy ? a.anchorOy - b.anchorOy : a.anchorOx - b.anchorOx,
  );
  return sorted[0];
}

/**
 * 收集本郡内所有 active / pending PVP 战事 + active PVE `wars.attacker_base_camps` 的大本营占格（用于避让）。
 */
async function collectOccupiedCampCellsInJun(junId, excludePvpWarId = null, excludePveWarId = null) {
  const occupied = new Set();
  const wars = await WarPvp.listWars({ status: ['pending', 'active'], limit: 200 });
  for (const w of wars) {
    if (excludePvpWarId && w.pvpWarId === excludePvpWarId) continue;
    if (!w.baseCamp || !Array.isArray(w.baseCamp.cells)) continue;
    if (w.baseCamp.junId && junId && w.baseCamp.junId !== junId) continue;
    for (const k of w.baseCamp.cells) occupied.add(k);
  }
  const [pveRows] = await pool.query(
    `SELECT war_id, attacker_base_camps FROM wars
     WHERE status = 'active' AND war_type = 'siege' AND attacker_base_camps IS NOT NULL
     LIMIT 200`,
  );
  for (const row of pveRows || []) {
    if (excludePveWarId && row.war_id === excludePveWarId) continue;
    let camps = row.attacker_base_camps;
    if (typeof camps === 'string') {
      try {
        camps = JSON.parse(camps);
      } catch {
        camps = null;
      }
    }
    if (!camps || typeof camps !== 'object') continue;
    for (const bc of Object.values(camps)) {
      if (!bc || !Array.isArray(bc.cells)) continue;
      if (bc.junId && junId && bc.junId !== junId) continue;
      for (const k of bc.cells) occupied.add(k);
    }
  }
  return occupied;
}

/**
 * 为目标城生成攻方大本营 JSON（不写库；PVP 落营与 PVE `wars.attacker_base_camps` 共用）。
 *
 * @param {object} targetCity - `cityService.getCityInfo` 行
 * @param {string} pickerSeed - 选位确定性种子（如 pvpWarId 或 `warId:factionId`）
 * @param {{ excludePvpWarId?: string, excludePveWarId?: string }} [opts]
 * @returns {Promise<object>} baseCamp 形（与 `wars_pvp.base_camp` 一致）
 */
async function createBaseCampJsonForCity(targetCity, pickerSeed, opts = {}) {
  if (!targetCity) throw new Error('[baseCamp] 目标城不存在');
  const junId = targetCity.jun_id;
  if (!junId) throw new Error('[baseCamp] 目标城缺 jun_id，无法定位战略格网');

  const grid = await loadRoadGrid(targetCity.season || 'san_1', junId);
  if (grid.source === 'none' || !grid.rawCells?.length) {
    throw new Error(`[baseCamp] 目标郡 ${junId} 缺合并地图；请先生成 worldmap merged JSON`);
  }
  const roadKeys = new Set();
  for (const k of grid.cells.keys()) roadKeys.add(k);

  const cityFootprint = (() => {
    const fp = new Set();
    const px = Number(targetCity.position_x);
    const py = Number(targetCity.position_y);
    if (Number.isFinite(px) && Number.isFinite(py)) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const x = px + dx;
          const y = py + dy;
          if (x >= 0 && y >= 0 && x < grid.mapColumns && y < grid.mapRows) {
            fp.add(`${x},${y}`);
          }
        }
      }
    }
    return fp;
  })();
  if (!cityFootprint.size) {
    throw new Error(
      `[baseCamp] 目标城 ${targetCity.city_id} 在地图无 footprint（position_x/y 越界或缺失）`,
    );
  }

  const occupied = await collectOccupiedCampCellsInJun(
    junId,
    opts.excludePvpWarId || null,
    opts.excludePveWarId || null,
  );

  const candidates = findBaseCampCandidatePlacements({
    rawCells: grid.rawCells,
    mapColumns: grid.mapColumns,
    mapRows: grid.mapRows,
    roadKeys,
    blocked: grid.blocked,
    cityFootprint,
    occupiedCamps: occupied,
  });
  if (!candidates.length) {
    throw new Error(
      `[baseCamp] 目标城 ${targetCity.city_id} 贴城路边无可用道路格放置 1×1 大本营`,
    );
  }
  const pick = pickBaseCampPlacement(candidates, pickerSeed);

  const gridCoords = require('../../shared/utils/strategicGridCoordinates.js');
  const worldCellKeys = pick.cells
    .map((cellKey) => {
      const parts = String(cellKey)
        .split(',')
        .map((s) => Number(String(s).trim()));
      const lx = parts[0];
      const ly = parts[1];
      return gridCoords.worldMapCellKeyFromPlayerRoadLocal(junId, lx, ly);
    })
    .filter(Boolean);

  const npcCount = computeBaseCampNpcCount(targetCity);
  const npcUnits = await generateBaseCampNpcUnits(targetCity, npcCount);

  return {
    junId,
    anchorOx: pick.anchorOx,
    anchorOy: pick.anchorOy,
    orientation: BASE_CAMP_ORIENTATION_SINGLE,
    cells: pick.cells,
    worldCellKeys,
    spriteKey: BASE_CAMP_SPRITE_SINGLE,
    npcTotal: npcCount,
    npcAlive: npcCount,
    npcUnits,
    placedAt: new Date().toISOString(),
  };
}

// ==================== NPC 守军生成（大本营） ====================

/**
 * 大本营 NPC 守军支数：目标城「人口×1%」满编 × `BASE_CAMP_NPC_RATIO_TO_FULL_GARRISON`（17-3）。
 * 不读取 city 的当前 `npc_garrison_alive`（残余），改用人口推导满编；这也避免战时残余传染。
 */
function computeBaseCampNpcCount(cityRow) {
  const fullCount = cityService.resolveNpcGarrisonCapFromPopulation(cityRow?.population);
  if (!fullCount || fullCount < 1) {
    throw new Error(`[pvpWar] 无法由目标城人口推导大本营 NPC 支数: population=${cityRow?.population}`);
  }
  return Math.max(1, Math.round(fullCount * BASE_CAMP_NPC_RATIO_TO_FULL_GARRISON));
}

/**
 * 复用 cityService 的 NPC 生成逻辑，写回到 `wars_pvp.base_camp.npcUnits`；
 * **不**读写 `cities.npc_garrison`（大本营编制与城防编制分离）。
 */
async function generateBaseCampNpcUnits(targetCity, npcCount) {
  const cityId = String(targetCity?.city_id || '').trim();
  if (!cityId) throw new Error('[pvpWar] 目标城不存在');
  const [cityRows] = await pool.query('SELECT * FROM cities WHERE city_id = ? LIMIT 1', [cityId]);
  if (!cityRows.length) throw new Error(`[pvpWar] 目标城不存在: ${cityId}`);
  const { npcGarrison } = await cityService.buildNpcUnitsForCityRow(cityRows[0], {
    troopCountOverride: npcCount,
  });
  return npcGarrison.map((u, idx) => ({
    ...u,
    index: idx,
    alive: true,
  }));
}

// ==================== 战事生命周期 ====================

/**
 * 创建战事草案（pending）。
 * 调用方应已通过 AI 君主被动审批（passiveApprovalService.resolvePassiveApproval）。
 *
 * @param {object} input
 * @param {string} input.season - 如 'san_1'
 * @param {string} input.attackerFactionId
 * @param {string} input.targetCityId
 * @param {string} [input.serverId]
 * @param {string} [input.warName]
 * @param {{ kind: 'player'|'ai_king', displayName: string, playerId?: string|null }|null|undefined} [input.proposer] - 写入 `side_stats.proposer`，供大本营 tooltip「长官」
 * @returns {Promise<object>} formatted pvp war
 */
async function createPvpWarDraft(input) {
  const { season, attackerFactionId, targetCityId, serverId, warName, proposer } = input;
  if (!season || !attackerFactionId || !targetCityId) {
    throw new Error('[pvpWar] createPvpWarDraft 缺参数 season/attackerFactionId/targetCityId');
  }

  const city = await cityService.getCityInfo(targetCityId);
  if (!city) throw new Error(`[pvpWar] 目标城不存在: ${targetCityId}`);

  // 中立城走 PVE；已占城可建 PVP
  if (!city.faction_id) {
    throw new Error('[pvpWar] 目标城为中立城，应走 PVE wars 流程，不可创建 PVP 战事');
  }
  if (city.faction_id === attackerFactionId) {
    throw new Error('[pvpWar] 不能向己方城市宣战');
  }

  const strategicWarTargetProximityService = require('./strategicWarTargetProximityService');
  const mapSeason = String(city.season || season || 'san_1').trim() || 'san_1';
  await strategicWarTargetProximityService.assertHostilePvpTargetInMapRange(
    attackerFactionId,
    targetCityId,
    mapSeason,
  );

  const existing = await WarPvp.getActiveByCity(targetCityId);
  if (existing) {
    throw new Error(
      `[pvpWar] 目标城已有进行中 PVP 战事：${existing.pvpWarId}（同城仅一场，17-3 §1.4）`,
    );
  }

  const attackerWarCount = await WarPvp.countActiveOrPendingByAttackerFaction(attackerFactionId);
  if (attackerWarCount >= MAX_CONCURRENT_PVP_WARS_PER_ATTACKER_FACTION) {
    throw new Error(
      `[pvpWar] 攻方势力同时进行中的 PVP 战事已达上限（${MAX_CONCURRENT_PVP_WARS_PER_ATTACKER_FACTION}），无法新建`,
    );
  }

  const warConcurrencyService = require('./warConcurrencyService');
  await warConcurrencyService.assertCanOpenNewWar(attackerFactionId, {
    season: mapSeason,
  });

  const { resolveFactionDisplayName } = require('./factionDisplayName');
  const attackerFactionName = await resolveFactionDisplayName(attackerFactionId);
  const defenderFactionName = await resolveFactionDisplayName(city.faction_id);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const pvpWarId = await WarPvp.generateNextPvpWarId(season, conn);
    await WarPvp.insertPvpWar(
      {
        pvpWarId,
        season,
        serverId: serverId || null,
        warName: warName || `${city.city_name}之战`,
        warType: 'siege',
        targetCityId,
        targetCityName: city.city_name,
        attackerFactionId,
        attackerFactionName,
        defenderFactionId: city.faction_id,
        defenderFactionName,
        status: WarPvp.WAR_PVP_STATUS.PENDING,
        winnerFactionId: null,
        victoryCondition: null,
        sideStats: {
          proposer: proposer && typeof proposer === 'object' ? proposer : null,
          attacker: { battles: 0, wins: 0, losses: 0, npcKills: 0 },
          defender: { battles: 0, wins: 0, losses: 0, baseCampNpcKills: 0 },
        },
        settlementPhase: WarPvp.SETTLEMENT_PHASE.NONE,
      },
      conn,
    );
    await conn.commit();
    console.log(
      `[pvpWar] createPvpWarDraft ok: ${pvpWarId} attacker=${attackerFactionId} target=${targetCityId}`,
    );
    return WarPvp.getById(pvpWarId);
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 创建草案后立即落攻方大本营并 **pending → active**（AI 君主 / 被动提案等无人手点「放置大本营」的场景）。
 * 若选位或地图数据失败：取消该草案并抛出原错误，避免库里堆积「待发兵」僵尸行。
 *
 * @param {object} input - 同 {@link createPvpWarDraft}，可附加 `transientPolicies`：
 *        `{ frontAssault: boolean, rearAssault: boolean, imperialMarch: boolean }`
 *        （合意 · 2026-05-25 · 11-3 §7.1：战事提案 + 临时政策合并审批/扣费/激活）。
 * @returns {Promise<object>} 已 active 且含 baseCamp 的战事
 */
async function createPvpWarDraftAndActivate(input) {
  const draft = await createPvpWarDraft(input);
  try {
    return await placeAttackerBaseCampAndActivate(draft.pvpWarId, {
      transientPolicies: input && input.transientPolicies ? input.transientPolicies : null,
    });
  } catch (err) {
    try {
      await cancelPvpWar(draft.pvpWarId, {
        reason: `activate_after_draft_failed: ${err.message}`,
        silentBulletin: true,
      });
    } catch (ce) {
      console.error('[pvpWar] cancel after activate failed:', ce.message);
    }
    throw err;
  }
}

/**
 * 扫描所有 **pending** 战事并尝试自动落大本营；失败则取消该行。
 * 由 `tickActivePvpWars` 每轮开头调用，消化历史僵尸草案 + 兜底异步创建路径。
 *
 * @returns {Promise<{ processed: number, activated: number, cancelled: number }>}
 */
async function activatePendingPvpDrafts() {
  const pending = await WarPvp.listWars({ status: [WarPvp.WAR_PVP_STATUS.PENDING], limit: 200 });
  let activated = 0;
  let cancelled = 0;
  for (const war of pending) {
    try {
      await placeAttackerBaseCampAndActivate(war.pvpWarId);
      activated += 1;
    } catch (err) {
      console.error(`[pvpWar] pending auto-activate failed ${war.pvpWarId}: ${err.message}`);
      try {
        await cancelPvpWar(war.pvpWarId, {
          reason: `pending_auto_activate_failed: ${err.message}`,
          silentBulletin: true,
        });
        cancelled += 1;
      } catch (ce) {
        console.error(`[pvpWar] cancel pending after activate fail: ${ce.message}`);
      }
    }
  }
  if (activated > 0 || cancelled > 0) {
    console.log(
      `[pvpWar] activatePendingPvpDrafts processed=${pending.length} activated=${activated} cancelled=${cancelled}`,
    );
  }
  return { processed: pending.length, activated, cancelled };
}

/**
 * 在目标城外放置攻方大本营 + 生成 NPC 守军 + 战事 pending → active。
 * 落地：写入 `wars_pvp.base_camp` JSON，包含锚格、朝向、占用格、NPC 总支/存活、贴图键、junId。
 *
 * **临时政策（11-3 §4 / §5 / §6 · 实装段3）**：
 *   若入参传入 `transientPolicies`，在 **同一事务** 内追加：① 扣临时政策费；② 写
 *   `wars_pvp_policies` 行（含 phase_snapshot_json、imperial_march_expires_at）。任一失败
 *   整事务回滚 → 战事不激活 / 政策不写入 / 资源不扣（合意 · 2026-05-25）。
 *
 * @param {string} pvpWarId
 * @param {object} [opts]
 * @param {{ frontAssault: boolean, rearAssault: boolean, imperialMarch: boolean }} [opts.transientPolicies]
 *        来自路由层规整后的临时政策开关；缺省 = 三项全 OFF（不写 `wars_pvp_policies` 行）。
 * @returns {Promise<object>} formatted pvp war（含 base_camp、status=active）
 */
async function placeAttackerBaseCampAndActivate(pvpWarId, opts = {}) {
  const war = await WarPvp.getById(pvpWarId);
  if (!war) throw new Error(`[pvpWar] 战事不存在: ${pvpWarId}`);
  if (war.status !== WarPvp.WAR_PVP_STATUS.PENDING) {
    throw new Error(
      `[pvpWar] 仅 pending 状态可放置大本营（当前 ${war.status}）`,
    );
  }
  if (war.baseCamp && Array.isArray(war.baseCamp.cells) && war.baseCamp.cells.length) {
    throw new Error('[pvpWar] 该战事已生成过大本营');
  }

  const targetCity = await cityService.getCityInfo(war.targetCityId);
  if (!targetCity) throw new Error('[pvpWar] 目标城不存在');

  const baseCamp = await createBaseCampJsonForCity(targetCity, pvpWarId, {
    excludePvpWarId: pvpWarId,
  });

  const now = new Date();
  const endTime = new Date(now.getTime() + PVP_WAR_DURATION_MS);

  const gameTime =
    (await gameTimeService.loadGameTimeForFaction(war.attackerFactionId)) || null;

  const warPolicyTransientService = require('./warPolicyTransientService');
  const normalizedPolicies = warPolicyTransientService.normalizeTransientPolicies(
    opts.transientPolicies,
  );
  // 入事务前做无副作用的政策合法性校验（避免无意义事务开销）；后军禁开等业务级 4xx 在此抛出
  warPolicyTransientService.validateTransientPolicies(normalizedPolicies, now, endTime);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const paid = await warInitiationCostService.assertAndDeductInTransaction(
      conn,
      war.attackerFactionId,
      targetCity.city_type,
      gameTime,
    );
    // 临时政策费（11-3 §4 固定价，不随档位/月倍率）— 与发动费同事务；任一不足 → 整体回滚
    const policyFeesPaid = await warPolicyTransientService.assertAndDeductPolicyFeesInTransaction(
      conn,
      war.attackerFactionId,
      normalizedPolicies,
    );
    const prevSide =
      war.sideStats && typeof war.sideStats === 'object' && !Array.isArray(war.sideStats)
        ? { ...war.sideStats }
        : {};
    const mergedSide = {
      ...prevSide,
      warInitiationCostPaid: {
        silver: paid.silver,
        food: paid.food,
        monthOrdinal: paid.monthOrdinal,
        multiplierPercent: paid.multiplierPercent,
        cityType: paid.cityType,
        baselineSilver: paid.baselineSilver,
        baselineFood: paid.baselineFood,
      },
    };
    const warMoraleService = require('./warMoraleService');
    const moraleInit = await warMoraleService.initWarMoraleOnActivate(conn, war);
    mergedSide.warMoraleInit = moraleInit.warMoraleInit;
    await WarPvp.updatePvpWar(
      pvpWarId,
      {
        baseCamp,
        status: WarPvp.WAR_PVP_STATUS.ACTIVE,
        startTime: now,
        endTime,
        sideStats: mergedSide,
        attackerWarMorale: moraleInit.attackerWarMorale,
        defenderWarMorale: moraleInit.defenderWarMorale,
      },
      conn,
    );
    // 仅当至少一项 ON 才写 `wars_pvp_policies` 行（全 OFF 时无需占行）
    const anyOn =
      normalizedPolicies.frontAssault ||
      normalizedPolicies.rearAssault ||
      normalizedPolicies.imperialMarch;
    if (anyOn) {
      await warPolicyTransientService.writePoliciesAndSnapshot(
        conn,
        pvpWarId,
        normalizedPolicies,
        now,
        endTime,
        policyFeesPaid,
      );
    }
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

  console.log(
    `[pvpWar] placeAttackerBaseCampAndActivate ok: ${pvpWarId} junId=${baseCamp.junId} ` +
      `anchor=(${baseCamp.anchorOx},${baseCamp.anchorOy}) orient=${baseCamp.orientation} npc=${baseCamp.npcTotal}`,
  );
  const activated = await WarPvp.getById(pvpWarId);
  await factionBulletinService.logPvpWarStarted(activated);
  return activated;
}

/**
 * 取消战事（pending 或 active 状态可取消）；清空 base_camp，回收地图物件。
 * 与超时 / 攻方主动放弃 / 异常修复路径共用。
 *
 * @param {string} pvpWarId
 * @param {{ reason?: string, byAdmin?: boolean, endedByOfficial?: boolean, silentBulletin?: boolean }} [opts]
 */
async function cancelPvpWar(pvpWarId, opts = {}) {
  const war = await WarPvp.getById(pvpWarId);
  if (!war) throw new Error(`[pvpWar] 战事不存在: ${pvpWarId}`);
  if (
    war.status === WarPvp.WAR_PVP_STATUS.COMPLETED ||
    war.status === WarPvp.WAR_PVP_STATUS.FAILED ||
    war.status === WarPvp.WAR_PVP_STATUS.CANCELLED
  ) {
    return war;
  }
  const wasPending = war.status === WarPvp.WAR_PVP_STATUS.PENDING;
  const hadBaseCamp = !!(war.baseCamp && Array.isArray(war.baseCamp.cells) && war.baseCamp.cells.length);

  const pvpService = require('./pvpService');
  releaseAllPvpWarMemoryLocks(pvpWarId);
  if (typeof pvpService.removeChallengesForPvpWar === 'function') {
    pvpService.removeChallengesForPvpWar(pvpWarId);
  }

  await WarPvp.updatePvpWar(pvpWarId, {
    status: WarPvp.WAR_PVP_STATUS.CANCELLED,
    baseCamp: null,
    endTime: new Date(),
    settledAt: new Date(),
    settlementPhase: WarPvp.SETTLEMENT_PHASE.PLACEHOLDER,
  });
  console.log(
    `[pvpWar] cancelPvpWar ok: ${pvpWarId} reason=${opts.reason || ''} byAdmin=${!!opts.byAdmin}`,
  );

  // TODO(17-3 结算): 主动撤战 / cancel 的势力与个人统计、奖惩与战报摘要（当前仅终局库状态 + 势力公告）。

  if (!opts.silentBulletin) {
    const neverActivated = wasPending && !hadBaseCamp;
    factionBulletinService.logPvpWarEnded(war, {
      status: 'cancelled',
      endedByOfficial: !!opts.endedByOfficial,
      cancelReason: opts.reason || '',
      neverActivated,
    });
  }

  return WarPvp.getById(pvpWarId);
}

const {
  assertChaoZhengPositionLevel,
} = require('../../shared/utils/sanGongPositionGates.cjs');

function sanGongClientError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

/**
 * 校验玩家可访问「三公府 · 朝政 · 势力战事」列表与撤战。
 * @param {string} playerId
 * @returns {Promise<{ factionId: string, positionLevel: number }>}
 */
async function assertSanGongChaoZhengPvpWarGate(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) throw sanGongClientError('缺少玩家 ID');

  const [pRows] = await pool.query(
    'SELECT player_id, faction_id, position_level FROM players WHERE player_id = ? LIMIT 1',
    [pid],
  );
  if (!pRows.length) throw sanGongClientError('玩家不存在');

  const pl = Number(pRows[0].position_level);
  try {
    assertChaoZhengPositionLevel(pl);
  } catch (e) {
    throw sanGongClientError(e.message);
  }
  const factionId = String(pRows[0].faction_id || '').trim();
  if (!factionId) throw sanGongClientError('玩家未加入势力，无法操作势力战事');

  return { factionId, positionLevel: pl };
}

/**
 * 本势力作为攻方、进行中的攻城类（siege）PVP 战事列表（供三公府朝政 UI）。
 * @param {string} playerId
 * @returns {Promise<{ wars: object[] }>}
 */
async function listSanGongAttackingSiegeWarsForPlayer(playerId) {
  const { factionId } = await assertSanGongChaoZhengPvpWarGate(playerId);
  const wars = await WarPvp.listWars({
    status: [WarPvp.WAR_PVP_STATUS.PENDING, WarPvp.WAR_PVP_STATUS.ACTIVE],
    attackerFactionId: factionId,
    limit: 50,
  });
  const siege = wars.filter((w) => String(w.warType || 'siege').toLowerCase() === 'siege');
  return { wars: siege };
}

/**
 * 攻方势力高级官职经朝政入口主动撤战（仅 siege、pending/active）。
 * @param {string} playerId
 * @param {string} pvpWarId
 * @param {{ reason?: string }} [body]
 */
async function cancelAttackingSiegeWarViaSanGongChaoZheng(playerId, pvpWarId, body = {}) {
  const { factionId } = await assertSanGongChaoZhengPvpWarGate(playerId);
  const wid = String(pvpWarId || '').trim();
  if (!wid) throw sanGongClientError('缺少战事 ID');

  const war = await WarPvp.getById(wid);
  if (!war) throw sanGongClientError('战事不存在');
  if (String(war.attackerFactionId || '') !== factionId) {
    throw sanGongClientError('仅本势力作为攻方发起的攻城战事可从此入口结束');
  }
  if (String(war.warType || 'siege').toLowerCase() !== 'siege') {
    throw sanGongClientError('仅攻城类（siege）战事可从此入口结束');
  }
  if (
    war.status !== WarPvp.WAR_PVP_STATUS.PENDING &&
    war.status !== WarPvp.WAR_PVP_STATUS.ACTIVE
  ) {
    throw sanGongClientError(`战事已结束（${war.status}），无法撤销`);
  }

  const reason =
    String(body?.reason || '').trim() || '攻方势力高级官职主动撤战（三公府·朝政）';
  const next = await cancelPvpWar(wid, {
    reason,
    endedByOfficial: false,
    silentBulletin: false,
  });
  return { war: next };
}

// ==================== 大本营 NPC 战斗握手 ====================

/**
 * 玩家（守方）发起对攻方大本营的攻击：取出当前一批存活 NPC（最多 4 支）。
 * 与 cityService NPC 攻城分批一致；锁键单独以 pvpWarId 命名空间，不与城战锁冲突（17-3 §1.7）。
 *
 * @param {string} pvpWarId
 * @param {string} playerId - 守方玩家
 * @returns {Promise<{ pvpWarId: string, baseCampSlice: object[], baseCampAlive: number, baseCampTotal: number, batchIndex: number }>}
 */
async function initiateBaseCampSiege(pvpWarId, playerId, options = {}) {
  const continueChain = options.continueChain === true;
  const cityService = require('./cityService');
  const garrisonService = require('./garrisonService');

  const war = await WarPvp.getById(pvpWarId);
  if (!war) throw new Error('[pvpWar] 战事不存在');
  if (war.status !== WarPvp.WAR_PVP_STATUS.ACTIVE) {
    throw new Error(`[pvpWar] 战事未进行中（${war.status}）`);
  }
  const camp = war.baseCamp;
  if (!camp || !Array.isArray(camp.npcUnits) || camp.npcUnits.length === 0) {
    throw new Error('[pvpWar] 战事大本营尚未生成');
  }

  const [pRows] = await pool.query(
    'SELECT player_id, faction_id FROM players WHERE player_id = ? LIMIT 1',
    [playerId],
  );
  if (!pRows.length) throw new Error('[pvpWar] 玩家不存在');
  if (String(pRows[0].faction_id || '') !== String(war.defenderFactionId || '')) {
    throw new Error('[pvpWar] 仅守方阵营玩家可攻打攻方大本营');
  }

  const lineupTroops = await garrisonService.sumMainLineupEquippedTroopTroops(pool, playerId);
  if (lineupTroops < garrisonService.MIN_MAIN_LINEUP_TROOPS_BATTLE) {
    throw new Error(
      `开战需上阵编组总兵力≥${garrisonService.MIN_MAIN_LINEUP_TROOPS_BATTLE}（当前 ${lineupTroops}）`,
    );
  }

  const aliveEntries = [];
  for (let i = 0; i < camp.npcUnits.length; i++) {
    const u = camp.npcUnits[i];
    if (u && u.alive) aliveEntries.push({ u, idx: i });
  }
  if (!aliveEntries.length) {
    throw new Error('[pvpWar] 大本营守军已全灭');
  }

  const didConsumeToken = await cityService.consumeSiegeQuotaForBattleStart(playerId, null, {
    continueChain,
  });
  if (!tryAcquireBaseCampLock(pvpWarId, playerId)) {
    if (didConsumeToken) await cityService.refundSiegeQuotaOnce(playerId);
    throw new Error('[pvpWar] 大本营当前有友军在交战，请稍后再试');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const gate = await garrisonService.validateMainLineupBattleGateOnConn(conn, playerId, {
      foodCostMultiplier: BASE_CAMP_SIEGE_FOOD_COST_MULTIPLIER,
    });
    if (!gate.ok) {
      await conn.rollback();
      releaseBaseCampLock(pvpWarId, playerId);
      if (didConsumeToken) await cityService.refundSiegeQuotaOnce(playerId);
      throw new Error(gate.error);
    }
    await garrisonService.deductMainLineupBattleFoodDeployCostOnConn(conn, playerId, {
      foodCostMultiplier: BASE_CAMP_SIEGE_FOOD_COST_MULTIPLIER,
      foodNeed: gate.foodNeed,
    });
    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {}
    releaseBaseCampLock(pvpWarId, playerId);
    if (didConsumeToken) await cityService.refundSiegeQuotaOnce(playerId);
    throw e;
  } finally {
    conn.release();
  }

  const [cityRows] = await pool.query('SELECT * FROM cities WHERE city_id = ? LIMIT 1', [
    war.targetCityId,
  ]);
  const targetCity = cityRows[0] || null;

  const maxBatch = Math.ceil(aliveEntries.length / 4);
  const batchIndex = 0;
  const slice = aliveEntries.slice(batchIndex * 4, batchIndex * 4 + 4);
  void maxBatch;

  // 大本营守军为被攻击方：叠目标城 `cities.defense` 城防倍率（与攻城同口径）
  return attachSiegeCityDefenseToPayload(
    {
      pvpWarId,
      targetCityId: war.targetCityId,
      targetCityName: war.targetCityName,
      attackerFactionId: war.attackerFactionId,
      defenderFactionId: war.defenderFactionId,
      baseCampSlice: slice.map(({ u, idx }) => ({ ...u, index: idx })),
      baseCampAlive: aliveEntries.length,
      baseCampTotal: camp.npcUnits.length,
      batchIndex,
      siegeTokenConsumed: didConsumeToken,
      pvpDefenderBaseCampSiege: true,
      defenderType: 'npc',
    },
    targetCity,
  );
}

/**
 * 写入大本营 NPC 战斗结果：将 killedIndices 翻为 alive=false；触发胜负检查。
 * 奖励口径对齐 `cityService.recordSiegeResult`（PVE 攻城 NPC）：按击杀稀有度银两、扣本场消耗、
 * 净银两经 **守方势力** `siege_reward` 政策拆分个人 / 势力池；
 * 胜利时有击杀则贡献 + 装备掷骰（`smallMapBattleLootService.grantWinContributionAndEquipment`）。
 *
 * @param {string} pvpWarId
 * @param {string} playerId 参战的守方玩家（领奖对象）
 * @param {{
 *   killedIndices: number[],
 *   result: 'win'|'lose',
 *   silverSpent?: number,
 *   battleScore?: number,
 *   battleReportSaved?: boolean,
 * }} payload
 */
async function recordBaseCampSiegeResult(pvpWarId, playerId, payload) {
  const {
    killedIndices = [],
    result = 'win',
    silverSpent = 0,
    battleScore = 0,
    battleReportSaved,
  } = payload || {};
  const smallMapBattleLootService = require('./smallMapBattleLootService');
  const statisticsDeltaService = require('./statisticsDeltaService');
  const { KILL_SILVER_REWARD } = require('../../shared/utils/siegeKillEconomyByRarity.cjs');
  const shouldFallbackBattleScore = Number(battleScore) > 0 && battleReportSaved === false;

  let releasedLock = false;
  const releaseLock = () => {
    if (!releasedLock) {
      releaseBaseCampLock(pvpWarId, playerId);
      releasedLock = true;
    }
  };

  const conn = await pool.getConnection();
  let silverReward = 0;
  let reputationReward = 0;
  let contributionReward = 0;
  let equipmentDrop = null;
  let actualKillCount = 0;
  let aliveAfter = 0;
  let npcEliminatedTotal = 0;
  let campTotal = 0;
  let winnerFactionId = null;
  let victoryCondition = null;
  let nextStatus = WarPvp.WAR_PVP_STATUS.ACTIVE;

  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT * FROM wars_pvp WHERE pvp_war_id = ? AND status = 'active' FOR UPDATE",
      [pvpWarId],
    );
    if (!rows.length) throw new Error('[pvpWar] 战事不存在或已结束');
    const war = WarPvp.formatPvpWarRow(rows[0]);
    const camp = war.baseCamp;
    if (!camp?.npcUnits) throw new Error('[pvpWar] 大本营数据缺失');
    const baseCampSnapshotForReloc =
      camp && typeof camp === 'object' ? JSON.parse(JSON.stringify(camp)) : null;

    const killRaritiesThisRound = [];
    for (const idx of killedIndices) {
      const u = camp.npcUnits[idx];
      if (u && u.alive) {
        u.alive = false;
        actualKillCount += 1;
        silverReward += KILL_SILVER_REWARD[u.rarity] || 10;
        killRaritiesThisRound.push(u.rarity || 'common');
      }
    }
    aliveAfter = camp.npcUnits.filter((u) => u.alive).length;
    camp.npcAlive = aliveAfter;
    campTotal = camp.npcUnits.length;
    npcEliminatedTotal = camp.npcUnits.filter((u) => u && !u.alive).length;

    const siegeSilverSpent = Math.max(0, Math.floor(Number(silverSpent) || 0));
    const netSilver = silverReward - (siegeSilverSpent > 0 ? siegeSilverSpent : 0);
    const { creditSiegeNetSilverOnConnection } = require('../utils/siegeRewardSettlement');
    const siegeSplit = await creditSiegeNetSilverOnConnection(conn, {
      playerId,
      beneficiaryFactionId: war.defenderFactionId,
      netSilver,
    });

    if (result === 'win' && actualKillCount > 0 && killRaritiesThisRound.length > 0) {
      const loot = await smallMapBattleLootService.grantWinContributionAndEquipment(
        conn, playerId, killRaritiesThisRound,
      );
      contributionReward = loot.contributionReward;
      equipmentDrop = loot.equipmentDrop;
    }

    const sideStats = war.sideStats || {
      attacker: { battles: 0, wins: 0, losses: 0, npcKills: 0 },
      defender: { battles: 0, wins: 0, losses: 0, baseCampNpcKills: 0 },
    };
    sideStats.attacker = sideStats.attacker || { battles: 0, wins: 0, losses: 0, npcKills: 0 };
    sideStats.defender = sideStats.defender || { battles: 0, wins: 0, losses: 0, baseCampNpcKills: 0 };
    sideStats.defender.battles = (sideStats.defender.battles || 0) + 1;
    if (result === 'win') sideStats.defender.wins = (sideStats.defender.wins || 0) + 1;
    else sideStats.defender.losses = (sideStats.defender.losses || 0) + 1;
    sideStats.defender.baseCampNpcKills =
      (sideStats.defender.baseCampNpcKills || 0) + actualKillCount;

    winnerFactionId = null;
    victoryCondition = null;
    nextStatus = WarPvp.WAR_PVP_STATUS.ACTIVE;
    if (aliveAfter === 0) {
      winnerFactionId = war.defenderFactionId;
      victoryCondition = WarPvp.WAR_PVP_VICTORY_CONDITIONS.ELIMINATE_BASE_CAMP;
      nextStatus = WarPvp.WAR_PVP_STATUS.FAILED;
    }

    if (shouldFallbackBattleScore) {
      await conn.query(
        'UPDATE player_statistics SET total_battle_score = total_battle_score + ? WHERE player_id = ?',
        [Number(battleScore), playerId],
      );
    }

    if (aliveAfter === 0 && baseCampSnapshotForReloc) {
      const reloc = require('./pvpWarPlayerRelocationService');
      await reloc.relocateAttackersOffPvpBaseCamp(conn, war, baseCampSnapshotForReloc);
    }

    const baseCampSqlValue = aliveAfter === 0 ? null : JSON.stringify(camp);
    await conn.query(
      `UPDATE wars_pvp SET base_camp = ?, side_stats = ?, status = ?,
         winner_faction_id = ?, victory_condition = ?,
         end_time = CASE WHEN ? IS NOT NULL THEN NOW() ELSE end_time END,
         settled_at = CASE WHEN ? IS NOT NULL THEN NOW() ELSE settled_at END,
         settlement_phase = CASE WHEN ? IS NOT NULL THEN 'placeholder' ELSE settlement_phase END
       WHERE pvp_war_id = ?`,
      [
        baseCampSqlValue,
        JSON.stringify(sideStats),
        nextStatus,
        winnerFactionId,
        victoryCondition,
        winnerFactionId,
        winnerFactionId,
        winnerFactionId,
        pvpWarId,
      ],
    );

    await conn.commit();
    releaseLock();

    if (siegeSilverSpent > 0) {
      await statisticsDeltaService.incrementSpent(playerId, { silver: siegeSilverSpent });
    }
    await statisticsDeltaService.recordEarned(playerId, {
      ...(silverReward > 0 ? { silver: silverReward } : {}),
      ...(reputationReward > 0 ? { reputation: reputationReward } : {}),
      ...(contributionReward > 0 ? { contribution: contributionReward } : {}),
    });

    if (winnerFactionId) {
      console.log(
        `[pvpWar] base_camp eliminated: ${pvpWarId} winner=${winnerFactionId} cond=${victoryCondition}`,
      );
      factionBulletinService.logPvpWarEnded(war, {
        status: nextStatus,
        winnerFactionId,
        victoryCondition,
      });
    }

    // 大本营守战无参战部队 instance 回传，跳过老兵（避免军营卡误晋升）
    const veteranPromotions = [];

    return {
      pvpWarId,
      defenderType: 'npc',
      killCount: actualKillCount,
      npcKilled: npcEliminatedTotal,
      npcAlive: aliveAfter,
      npcTotal: campTotal,
      baseCampAlive: aliveAfter,
      baseCampTotal: campTotal,
      siegeCompleted: !!winnerFactionId,
      winnerFactionId,
      victoryCondition,
      silverReward,
      personalSilverEarned: siegeSplit.personalSilverEarned,
      factionSilverToPool: siegeSplit.factionSilverToPool,
      siegeRewardPersonalSharePct: siegeSplit.siegeRewardPersonalSharePct,
      siegeRewardPolicySource: siegeSplit.siegeRewardPolicySource,
      reputationReward,
      contributionReward,
      equipmentDrop,
      veteranPromotions,
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    releaseLock();
    throw err;
  } finally {
    conn.release();
  }
}

// ==================== 攻方对目标城出击（PVP 专属，独立于 PVE） ====================
//
// 语义对齐 17-3 / 17-4（玩法1重构后）：
//   1) 普通驻守玩家（player_garrison）
//   2) NPC 守军（npc）
// 披挂上阵（pvp_online / on_duty）已移除。
//
// 物理分流：仅写 `wars_pvp.side_stats.attacker`，**不** 写 `wars` / 不走 PVE faction_kills 抢桶；
// 锁键命名空间 `pvp-city|...` 与 cityService 的 PVE `def|warId|...` 完全独立。

const PVP_CITY_LOCK_NS = 'pvp-city';
const PVP_CITY_NPC_LOCK_NS_SUFFIX = '_npc';
const PVP_CITY_LOCK_TTL_MS = 60_000;
const PVP_CITY_LOCK_BATCH_SWEEP = 16;
const pvpCityLocks = new Map();

function buildPvpCityNpcLockKey(pvpWarId, batchIndex) {
  return `${PVP_CITY_LOCK_NS}|${pvpWarId}|${PVP_CITY_NPC_LOCK_NS_SUFFIX}|${batchIndex}`;
}

function buildPvpCityPlayerLockKey(pvpWarId, defenderPlayerId, garrisonSlot) {
  return `${PVP_CITY_LOCK_NS}|${pvpWarId}|${defenderPlayerId}|${garrisonSlot}`;
}

function tryAcquirePvpCityLock(lockKey, attackerPlayerId) {
  const now = Date.now();
  const cur = pvpCityLocks.get(lockKey);
  if (cur && now - cur.lockedAt < PVP_CITY_LOCK_TTL_MS) {
    if (cur.attackerPlayerId !== attackerPlayerId) return false;
  }
  pvpCityLocks.set(lockKey, { attackerPlayerId, lockedAt: now });
  return true;
}

function releasePvpCityLock(lockKey, attackerPlayerId) {
  const cur = pvpCityLocks.get(lockKey);
  if (cur && cur.attackerPlayerId === attackerPlayerId) pvpCityLocks.delete(lockKey);
}

/** 终局 / 取消时清掉该战事在进程内的城战锁与大本营锁，避免悬挂。 */
function releaseAllPvpWarMemoryLocks(pvpWarId) {
  const id = String(pvpWarId || '').trim();
  if (!id) return;
  baseCampLocks.delete(id);
  const prefix = `${PVP_CITY_LOCK_NS}|${id}|`;
  for (const k of [...pvpCityLocks.keys()]) {
    if (k.startsWith(prefix)) pvpCityLocks.delete(k);
  }
}

/**
 * 发起一场对目标城的攻城战斗（PVP 战事内攻方主动出击）。
 *
 * 防守者优先级（玩法1重构后）：
 *   ① 普通驻守玩家（player_garrison）
 *   ② NPC 守军（npc）
 *
 * 与 cityService.initiateSiege 物理分流：仅在 `wars_pvp.status='active'` 下成立，**不** 写 `wars` 表。
 *
 * @param {string} pvpWarId
 * @param {string} attackerPlayerId
 * @returns {Promise<object>}
 */
async function initiateAttackerCitySiege(pvpWarId, attackerPlayerId, options = {}) {
  const continueChain = options.continueChain === true;
  const garrisonService = require('./garrisonService');
  const cityService = require('./cityService');

  const war = await WarPvp.getById(pvpWarId);
  if (!war) throw new Error('[pvpWar] 战事不存在');
  if (war.status !== WarPvp.WAR_PVP_STATUS.ACTIVE) {
    throw new Error(`[pvpWar] 战事未进行中（${war.status}）`);
  }

  // 阶段门禁（11-3 §5 实装段3 · 2026-05-25）：
  //   仅当本场战事存在 `wars_pvp_policies` 行（即提案时勾选了任一临时政策）才启用阶段机；
  //   否则保持现行兼容（无通知期 / 全程可攻）。门禁覆盖：通知期 / 前军期 / 后军窗。
  const warPolicyTransientService = require('./warPolicyTransientService');
  const warPhaseService = require('./warPhaseService');
  const policiesRow = await warPolicyTransientService.getPoliciesForWar(pvpWarId);
  if (policiesRow) {
    warPhaseService.assertPlayerSiegeAllowed(war, policiesRow);
  }

  const [pRows] = await pool.query(
    'SELECT player_id, faction_id FROM players WHERE player_id = ?',
    [attackerPlayerId],
  );
  if (!pRows.length) throw new Error('[pvpWar] 玩家不存在');
  if (pRows[0].faction_id !== war.attackerFactionId) {
    throw new Error('[pvpWar] 仅攻方阵营玩家可对该战事目标城出击');
  }

  const lineupTroops = await garrisonService.sumMainLineupEquippedTroopTroops(
    pool, attackerPlayerId,
  );
  if (lineupTroops < garrisonService.MIN_MAIN_LINEUP_TROOPS_BATTLE) {
    throw new Error(
      `开战需上阵编组总兵力≥${garrisonService.MIN_MAIN_LINEUP_TROOPS_BATTLE}（当前 ${lineupTroops}）`,
    );
  }

  const city = await cityService.getCityInfo(war.targetCityId);
  if (!city) throw new Error('[pvpWar] 目标城不存在');

  // 结算「继续」连打不扣兵符（与匪寨同口径）；大地图再次发起仍扣
  const didConsumeToken = await cityService.consumeSiegeQuotaForBattleStart(attackerPlayerId, null, {
    continueChain,
  });

  // ── 1) 普通驻守玩家：按位置等级 / 槽位顺序匹配（披挂 on_duty 已移除） ──
  const playerDefenders = await garrisonService.getCityGarrisonDefenders(
    war.targetCityId, war.defenderFactionId,
  );

  for (const def of playerDefenders) {
    if (!def.player_id || def.player_id === attackerPlayerId) continue;
    const { units, meetsStationedTroopGate } =
      await garrisonService.buildDefenderLineupForCityDefense(def);
    if (!meetsStationedTroopGate) continue;

    const lockKey = buildPvpCityPlayerLockKey(
      pvpWarId, def.player_id, def.garrison_slot ?? 1,
    );
    if (!tryAcquirePvpCityLock(lockKey, attackerPlayerId)) continue;

    try {
      const garrisonUnits = garrisonService.mapBuiltUnitsToSiegeNpcFormat(units);
      const garrisonPayload = attachSiegeCityDefenseToPayload({
        pvpWarId,
        cityId: city.city_id,
        cityName: city.city_name,
        cityType: city.city_type,
        npcGarrison: garrisonUnits,
        npcAlive: garrisonUnits.length,
        npcTotal: garrisonUnits.length,
        attackerFactionId: war.attackerFactionId,
        defenderFactionId: war.defenderFactionId,
        defenderType: 'player_garrison',
        defenderName: def.character_name || null,
        defenderPlayerId: def.player_id,
        defenderGarrisonSlot: def.garrison_slot ?? 1,
        siegeTokenConsumed: didConsumeToken,
      }, city);
      if (policiesRow) {
        const imperialMarchService = require('./imperialMarchService');
        return await imperialMarchService.attachImperialMarchToSiegePayload(
          garrisonPayload,
          war,
          policiesRow,
        );
      }
      return garrisonPayload;
    } catch (playerDefenderErr) {
      releasePvpCityLock(lockKey, attackerPlayerId);
      if (didConsumeToken) await cityService.refundSiegeQuotaOnce(attackerPlayerId);
      throw playerDefenderErr;
    }
  }

  // ── 2) 玩家防御链全跳过 → NPC 守军（按 4 支一批顺位抢锁） ──
  const fullG = Array.isArray(city.npc_garrison) ? city.npc_garrison : [];
  const aliveEntries = [];
  for (let gi = 0; gi < fullG.length; gi++) {
    const u = fullG[gi];
    if (u && u.alive) aliveEntries.push({ u, gi });
  }
  if (aliveEntries.length === 0) {
    if (didConsumeToken) await cityService.refundSiegeQuotaOnce(attackerPlayerId);
    throw new Error('[pvpWar] 目标城暂无可攻打守军');
  }

  const maxBatches = Math.ceil(aliveEntries.length / 4);
  let npcBatchIndex = null;
  let battleSlice = null;
  const tryPickBatch = () => {
    for (let b = 0; b < maxBatches; b++) {
      const lockKey = buildPvpCityNpcLockKey(pvpWarId, b);
      if (!tryAcquirePvpCityLock(lockKey, attackerPlayerId)) continue;
      const slice = aliveEntries.slice(b * 4, b * 4 + 4);
      if (!slice.length) {
        releasePvpCityLock(lockKey, attackerPlayerId);
        continue;
      }
      npcBatchIndex = b;
      battleSlice = slice;
      break;
    }
  };
  tryPickBatch();
  if (battleSlice == null) {
    for (let b = 0; b < PVP_CITY_LOCK_BATCH_SWEEP; b++) {
      releasePvpCityLock(buildPvpCityNpcLockKey(pvpWarId, b), attackerPlayerId);
    }
    tryPickBatch();
  }
  if (battleSlice == null) {
    if (didConsumeToken) await cityService.refundSiegeQuotaOnce(attackerPlayerId);
    throw new Error('[pvpWar] 当前各战线均有友军交战中，请稍后再试');
  }

  try {
    const payload = attachSiegeCityDefenseToPayload({
      pvpWarId,
      cityId: city.city_id,
      cityName: city.city_name,
      cityType: city.city_type,
      npcGarrison: battleSlice.map(({ u, gi }) => ({ ...u, index: gi })),
      npcAlive: aliveEntries.length,
      npcTotal: fullG.length,
      attackerFactionId: war.attackerFactionId,
      defenderFactionId: war.defenderFactionId,
      defenderType: 'npc',
      npcBatchIndex,
      siegeTokenConsumed: didConsumeToken,
    }, city);

    if (policiesRow) {
      const imperialMarchService = require('./imperialMarchService');
      return await imperialMarchService.attachImperialMarchToSiegePayload(payload, war, policiesRow);
    }

    return payload;
  } catch (npcSiegeErr) {
    if (npcBatchIndex != null) {
      releasePvpCityLock(buildPvpCityNpcLockKey(pvpWarId, npcBatchIndex), attackerPlayerId);
    }
    if (didConsumeToken) await cityService.refundSiegeQuotaOnce(attackerPlayerId);
    throw npcSiegeErr;
  }
}

/**
 * PVP 攻城终局：目标城易主 + 清披挂/非胜方驻地 + 守方道坐标迁离 + 清空 `wars_pvp.base_camp`。
 * 与 `recordAttackerCitySiegeResult` 内 `captured` 分支同事务语义；供 tick 兜底复用。
 *
 * @param {*} conn
 * @param {object} war - `WarPvp.formatPvpWarRow` 结果
 */
async function applyPvpTargetCityOwnershipHandoff(conn, war) {
  const garrisonService = require('./garrisonService');
  const cityService = require('./cityService');
  const reloc = require('./pvpWarPlayerRelocationService');
  await conn.query(
    'UPDATE players SET on_duty = FALSE, on_duty_city_id = NULL WHERE on_duty_city_id = ?',
    [war.targetCityId],
  );
  const [cityGarrisonPlayers] = await conn.query(
    "SELECT DISTINCT player_id FROM player_lineup_sets WHERE lineup_scope = 'garrison' AND city_id = ?",
    [war.targetCityId],
  );
  const ids = (cityGarrisonPlayers || []).map((r) => r.player_id);
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    await conn.query(
      `UPDATE players SET on_duty = FALSE, on_duty_city_id = NULL WHERE player_id IN (${ph}) AND on_duty = TRUE`,
      ids,
    );
  }
  await garrisonService.stripGarrisonOnCityConquest(conn, war.targetCityId, war.attackerFactionId);
  await cityService.applyCityOwnershipHandoff(conn, war.targetCityId, war.attackerFactionId);
  await reloc.relocateDefendersOffPvpTargetCity(conn, war, war.targetCityId);
  await conn.query('UPDATE wars_pvp SET base_camp = NULL WHERE pvp_war_id = ?', [war.pvpWarId]);
}

/**
 * 战事士气竞态终局地图/handoff（17-3 §7.4）：攻方胜等同 captureCity 易主；守方胜迁离攻方。
 * 战事行 status / base_camp 由调用方在同一事务内写回。
 *
 * @param {*} conn
 * @param {object} war
 * @param {{ winnerSide: 'attacker'|'defender' }} raceResult
 * @returns {Promise<{ captured: boolean }>}
 */
async function applyWarMoraleRaceHandoff(conn, war, raceResult) {
  const isAttackerWin = raceResult.winnerSide === 'attacker';
  if (isAttackerWin) {
    await applyPvpTargetCityOwnershipHandoff(conn, war);
  } else if (war.baseCamp) {
    const snap = JSON.parse(JSON.stringify(war.baseCamp));
    const reloc = require('./pvpWarPlayerRelocationService');
    await reloc.relocateAttackersOffPvpBaseCamp(conn, war, snap);
  }
  return { captured: isAttackerWin };
}

/**
 * 写回攻方对目标城战斗结果（PVP 专属，三类防守者通用）。
 *
 * 物理分流：仅写 `wars_pvp.side_stats.attacker`；城 NPC 减员、玩家防守者部队耐久 / 驻地 is_active 重置、
 * 披挂解除、易主与战利品 / 老兵 / 统计回写均在本路径完成；与 cityService.recordSiegeResult 互不干扰。
 *
 * @param {string} pvpWarId
 * @param {string} attackerPlayerId
 * @param {object} payload
 *   - 通用：{ result, silverSpent, battleScore, battleReportSaved }
 *   - 玩家防守者分支（pvp_online / player_garrison）：
 *       { defenderType, defenderPlayerId, defenderGarrisonSlot, garrisonUnits,
 *         killedIndices, defenderLineupTroopUpdates }
 *   - NPC 分支（npc）：{ defenderType:'npc', killedIndices, npcBatchIndex }
 */
async function recordAttackerCitySiegeResult(pvpWarId, attackerPlayerId, payload = {}) {
  const cityService = require('./cityService');
  const garrisonService = require('./garrisonService');
  const smallMapBattleLootService = require('./smallMapBattleLootService');
  const statisticsDeltaService = require('./statisticsDeltaService');
  const { checkAndApplyVeteran } = require('./veteranService');
  const { applyTroopDurabilityExhaustion } = require('./troopDurabilityService');
  const { KILL_SILVER_REWARD } = require('../../shared/utils/siegeKillEconomyByRarity.cjs');

  const {
    defenderType = 'npc',
    defenderPlayerId = null,
    defenderGarrisonSlot = null,
    garrisonUnits = [],
    defenderLineupTroopUpdates = null,
    killedIndices = [],
    result = 'win',
    silverSpent = 0,
    battleScore,
    battleReportSaved,
    npcBatchIndex,
  } = payload || {};
  const shouldFallbackBattleScore = Number(battleScore) > 0 && battleReportSaved === false;
  const isPlayerDefender = defenderType === 'pvp_online' || defenderType === 'player_garrison';

  let releasedLock = false;
  const releaseLock = () => {
    if (releasedLock) return;
    if (isPlayerDefender && defenderPlayerId) {
      releasePvpCityLock(
        buildPvpCityPlayerLockKey(pvpWarId, defenderPlayerId, defenderGarrisonSlot ?? 0),
        attackerPlayerId,
      );
    } else if (npcBatchIndex != null && !Number.isNaN(Number(npcBatchIndex))) {
      releasePvpCityLock(
        buildPvpCityNpcLockKey(pvpWarId, Number(npcBatchIndex)),
        attackerPlayerId,
      );
    } else {
      for (let b = 0; b < PVP_CITY_LOCK_BATCH_SWEEP; b++) {
        releasePvpCityLock(buildPvpCityNpcLockKey(pvpWarId, b), attackerPlayerId);
      }
    }
    releasedLock = true;
  };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [warRows] = await conn.query(
      "SELECT * FROM wars_pvp WHERE pvp_war_id = ? AND status = 'active' FOR UPDATE",
      [pvpWarId],
    );
    if (!warRows.length) throw new Error('[pvpWar] 战事不存在或已结束');
    const war = WarPvp.formatPvpWarRow(warRows[0]);
    if (war.attackerFactionId == null) throw new Error('[pvpWar] 战事 attacker_faction_id 缺失');

    const sideStats = war.sideStats || {
      attacker: { battles: 0, wins: 0, losses: 0, npcKills: 0 },
      defender: { battles: 0, wins: 0, losses: 0, baseCampNpcKills: 0 },
    };
    sideStats.attacker = sideStats.attacker || { battles: 0, wins: 0, losses: 0, npcKills: 0 };

    let actualKillCount = 0;
    let silverReward = 0;
    let reputationReward = 0;
    let contributionReward = 0;
    let equipmentDrop = null;
    let aliveAfter = null;
    let unitArrLength = null;
    /** NPC 守军：JSON 内累计阵亡支数（对齐 cityService.recordSiegeResult 的 npcKilled；本场用 killCount） */
    let npcEliminatedCumulative = null;
    let captured = false;
    let defenderParticipantIds = [];

    // ──────── A) 玩家防守者分支：披挂上阵 / 普通驻守 ────────
    if (isPlayerDefender) {
      defenderParticipantIds = (garrisonUnits || [])
        .filter((u) => u && u._troopInstanceId)
        .map((u) => u._troopInstanceId);

      const useLineupUpdates =
        Array.isArray(defenderLineupTroopUpdates) && defenderLineupTroopUpdates.length > 0;

      if (useLineupUpdates) {
        for (const u of defenderLineupTroopUpdates) {
          if (!u?.instanceId || !defenderPlayerId) continue;
          const maxT = u.maxTroops != null ? Number(u.maxTroops) : 9999;
          const cur = Math.max(0, Math.min(maxT, Math.round(Number(u.currentTroops) || 0)));
          await conn.query(
            `UPDATE player_cards SET current_troops = ?, last_troops_lost_at = ?
             WHERE instance_id = ? AND player_id = ?`,
            [cur, cur < maxT ? new Date() : null, u.instanceId, defenderPlayerId],
          );
        }
        for (const idx of killedIndices) {
          const unit = garrisonUnits[idx];
          if (!unit) continue;
          actualKillCount += 1;
          silverReward += KILL_SILVER_REWARD[unit.rarity] || 10;
        }
      } else {
        for (const idx of killedIndices) {
          const unit = garrisonUnits[idx];
          if (!unit || !unit._troopInstanceId) continue;
          await conn.query(
            'UPDATE player_cards SET current_troops = 0, last_troops_lost_at = NOW() WHERE instance_id = ?',
            [unit._troopInstanceId],
          );
          actualKillCount += 1;
          silverReward += KILL_SILVER_REWARD[unit.rarity] || 10;
        }
      }

      // 参战部队耐久度（与 cityService PVE NPC 分支同步策略）
      if (defenderParticipantIds.length > 0) {
        const ph = defenderParticipantIds.map(() => '?').join(',');
        await conn.query(
          `UPDATE player_cards SET battle_count = LEAST(
             GREATEST(COALESCE(battle_count, 0), 0) + 1,
             COALESCE(max_battle_count, 60)
           ),
           lifetime_battle_count = COALESCE(lifetime_battle_count, 0) + 1
           WHERE instance_id IN (${ph})`,
          defenderParticipantIds,
        );
      }

      // 用尽部队（金/白/蓝/紫）从驻地槽强制清空（橙 legendary 保留）
      const defenderPlayerIds = [
        ...new Set((garrisonUnits || []).map((u) => u && u._garrisonPlayerId).filter(Boolean)),
      ];
      const runQ = (sql, params) => conn.query(sql, params);
      for (const defPid of defenderPlayerIds) {
        await applyTroopDurabilityExhaustion(runQ, defPid);
      }

      if (defenderPlayerId && defenderParticipantIds.length > 0) {
        const { consumeTreasuresAfterBattle } = require('./treasureUseService');
        let garrisonRow = null;
        if (defenderGarrisonSlot != null && war.targetCityId) {
          const [gRows] = await conn.query(
            "SELECT * FROM player_lineup_sets WHERE lineup_scope = 'garrison' AND player_id = ? AND city_id = ? AND lineup_slot = ? LIMIT 1",
            [defenderPlayerId, war.targetCityId, defenderGarrisonSlot],
          );
          const { mapGarrisonApiRow } = require('../constants/lineupSets');
          garrisonRow = mapGarrisonApiRow(gRows[0] || null);
        }
        await consumeTreasuresAfterBattle(
          runQ,
          defenderPlayerId,
          defenderParticipantIds,
          garrisonRow,
        );
      }

      // 驻守槽 is_active 重置（参战槽位若全部耗尽则置 FALSE）
      const garrisonKeys = new Map();
      for (const unit of garrisonUnits || []) {
        if (!unit || !unit._garrisonPlayerId || unit._garrisonSlot == null) continue;
        const gc = unit._garrisonCityId || war.targetCityId;
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
        const rowCityId = garrisonCityId || war.targetCityId;
        const [slotRows] = await conn.query(
          "SELECT char1_troop1, char1_troop2, char2_troop1, char2_troop2 FROM player_lineup_sets WHERE lineup_scope = 'garrison' AND player_id = ? AND city_id = ? AND lineup_slot = ?",
          [gPlayerId, rowCityId, slot],
        );
        if (!slotRows.length) continue;
        const troopIds = [
          slotRows[0].char1_troop1, slotRows[0].char1_troop2,
          slotRows[0].char2_troop1, slotRows[0].char2_troop2,
        ].filter(Boolean);
        if (troopIds.length === 0) {
          await conn.query(
            "UPDATE player_lineup_sets SET is_active = FALSE WHERE lineup_scope = 'garrison' AND player_id = ? AND city_id = ? AND lineup_slot = ?",
            [gPlayerId, rowCityId, slot],
          );
          continue;
        }
        const totalTroopsLeft = await garrisonService.sumTroopInstancesTotalTroops(
          conn, gPlayerId, troopIds,
        );
        if (totalTroopsLeft < garrisonService.MIN_GARRISON_TOTAL_TROOPS) {
          await conn.query(
            "UPDATE player_lineup_sets SET is_active = FALSE WHERE lineup_scope = 'garrison' AND player_id = ? AND city_id = ? AND lineup_slot = ?",
            [gPlayerId, rowCityId, slot],
          );
        }
      }

      // 声望 + 装备掷骰（与贡献封装对称；仅玩家守军胜利且有击杀）
      if (result === 'win' && actualKillCount > 0) {
        const killedRarities = killedIndices
          .map((i) => garrisonUnits[i]?.rarity)
          .filter(Boolean);
        const bestRarity = smallMapBattleLootService.pickBestRarityFromKills(killedRarities);
        const repLoot = await smallMapBattleLootService.grantWinReputationAndEquipment(
          conn,
          attackerPlayerId,
          bestRarity,
        );
        reputationReward = repLoot.reputationReward;
        if (!equipmentDrop) equipmentDrop = repLoot.equipmentDrop;
      }

      // 披挂上阵：攻方胜利则解除待战状态
      if (defenderType === 'pvp_online' && result === 'win' && defenderPlayerId) {
        await conn.query(
          'UPDATE players SET on_duty = FALSE, on_duty_city_id = NULL WHERE player_id = ?',
          [defenderPlayerId],
        );
      }
    } else {
      // ──────── B) NPC 守军分支 ────────
      const [cityRows] = await conn.query(
        'SELECT npc_garrison, npc_garrison_alive FROM cities WHERE city_id = ? FOR UPDATE',
        [war.targetCityId],
      );
      if (!cityRows.length) throw new Error('[pvpWar] 目标城不存在');
      const { units: unitArr } = cityService.parseNpcGarrisonStored(cityRows[0].npc_garrison);
      if (!unitArr || !unitArr.length) {
        throw new Error('[pvpWar] 目标城 NPC 守军数据缺失');
      }
      unitArrLength = unitArr.length;

      const killRarities = [];
      for (const idx of killedIndices) {
        const u = unitArr[idx];
        if (u && u.alive) {
          u.alive = false;
          actualKillCount += 1;
          silverReward += KILL_SILVER_REWARD[u.rarity] || 10;
          killRarities.push(u.rarity || 'common');
        }
      }
      aliveAfter = unitArr.filter((u) => u.alive).length;
      npcEliminatedCumulative = unitArr.filter((u) => !u.alive).length;
      await conn.query(
        'UPDATE cities SET npc_garrison = ?, npc_garrison_alive = ? WHERE city_id = ?',
        [
          cityService.serializeNpcGarrisonStored(unitArr, new Date()),
          aliveAfter,
          war.targetCityId,
        ],
      );

      if (result === 'win' && actualKillCount > 0 && killRarities.length > 0) {
        const loot = await smallMapBattleLootService.grantWinContributionAndEquipment(
          conn, attackerPlayerId, killRarities,
        );
        contributionReward = loot.contributionReward;
        equipmentDrop = loot.equipmentDrop;
      }

      captured = aliveAfter === 0;
    }

    // ──────── 通用：sideStats 累计 / 银两 / wars_pvp 写回 ────────
    sideStats.attacker.battles = (sideStats.attacker.battles || 0) + 1;
    if (result === 'win') sideStats.attacker.wins = (sideStats.attacker.wins || 0) + 1;
    else sideStats.attacker.losses = (sideStats.attacker.losses || 0) + 1;
    // npcKills：保持现有字段名，语义为「攻方对目标城所有守军（NPC + 玩家披挂 + 普通驻守）的累计击杀」
    sideStats.attacker.npcKills = (sideStats.attacker.npcKills || 0) + actualKillCount;

    // 银两净值（毛 − silverSpent），按 11-3 §3.2 城战奖赏政策拆分个人 / 攻方势力池。
    // 粮草端当前结算无产生（净粮 = 0）；策略函数支持但本路径不入账。
    // 无 DB 行时 `getEffectiveSiegeReward` → 默认 80/20（11-3 §2.2）；谏言仅改比例。
    const netSilver = silverReward - (silverSpent > 0 ? silverSpent : 0);
    const { creditSiegeNetSilverOnConnection } = require('../utils/siegeRewardSettlement');
    const siegeSplit = await creditSiegeNetSilverOnConnection(conn, {
      playerId: attackerPlayerId,
      beneficiaryFactionId: war.attackerFactionId,
      netSilver,
    });

    const warMoraleService = require('./warMoraleService');
    let attackerWarMorale = war.attackerWarMorale;
    let defenderWarMorale = war.defenderWarMorale;
    let moraleRaceResult = null;

    if (isPlayerDefender && warMoraleService.warHasActiveMorale(war)) {
      const delta = warMoraleService.applyPvpAutoDuelDeltaForWar(war, result === 'win');
      if (delta) {
        attackerWarMorale = delta.attackerWarMorale;
        defenderWarMorale = delta.defenderWarMorale;
        moraleRaceResult = warMoraleService.checkRaceTermination(
          attackerWarMorale,
          defenderWarMorale,
          war,
        );
      }
    }

    let nextStatus = war.status;
    let winnerFactionId = war.winnerFactionId || null;
    let victoryCondition = war.victoryCondition || null;
    let moraleCaptured = false;

    if (captured) {
      nextStatus = WarPvp.WAR_PVP_STATUS.COMPLETED;
      winnerFactionId = war.attackerFactionId;
      victoryCondition = WarPvp.WAR_PVP_VICTORY_CONDITIONS.CAPTURE_CITY;
    } else if (moraleRaceResult) {
      nextStatus = WarPvp.WAR_PVP_STATUS.COMPLETED;
      winnerFactionId = moraleRaceResult.winnerFactionId;
      victoryCondition = moraleRaceResult.victoryCondition;
      moraleCaptured = moraleRaceResult.winnerSide === 'attacker';
    }

    await conn.query(
      `UPDATE wars_pvp SET side_stats = ?, status = ?, winner_faction_id = ?, victory_condition = ?,
         attacker_war_morale = ?, defender_war_morale = ?,
         end_time = CASE WHEN ? <> ? THEN NOW() ELSE end_time END,
         settled_at = CASE WHEN ? <> ? THEN NOW() ELSE settled_at END,
         settlement_phase = CASE WHEN ? <> ? THEN 'placeholder' ELSE settlement_phase END,
         base_camp = CASE WHEN ? <> ? AND ? = 'completed' THEN NULL ELSE base_camp END
       WHERE pvp_war_id = ?`,
      [
        JSON.stringify(sideStats),
        nextStatus,
        winnerFactionId,
        victoryCondition,
        attackerWarMorale,
        defenderWarMorale,
        nextStatus,
        war.status,
        nextStatus,
        war.status,
        nextStatus,
        war.status,
        nextStatus,
        war.status,
        nextStatus,
        war.pvpWarId,
      ],
    );

    if (captured) {
      await applyPvpTargetCityOwnershipHandoff(conn, war);
    } else if (moraleRaceResult) {
      await applyWarMoraleRaceHandoff(conn, war, moraleRaceResult);
    }

    if (shouldFallbackBattleScore) {
      await conn.query(
        'UPDATE player_statistics SET total_battle_score = total_battle_score + ? WHERE player_id = ?',
        [Number(battleScore), attackerPlayerId],
      );
    }

    await conn.commit();
    releaseLock();

    const siegeSilverSpent = Math.max(0, Math.floor(Number(silverSpent) || 0));
    if (siegeSilverSpent > 0) {
      await statisticsDeltaService.incrementSpent(attackerPlayerId, { silver: siegeSilverSpent });
    }
    await statisticsDeltaService.recordEarned(attackerPlayerId, {
      ...(silverReward > 0 ? { silver: silverReward } : {}),
      ...(reputationReward > 0 ? { reputation: reputationReward } : {}),
      ...(contributionReward > 0 ? { contribution: contributionReward } : {}),
    });

    if (captured || moraleCaptured) {
      try {
        await cityService.generateNpcGarrison(war.targetCityId);
      } catch (e) {
        console.error('[pvpWar] 攻破后刷新 NPC 失败:', e.message);
      }
    }
    if (captured) {
      console.log(
        `[pvpWar] capture_city: ${war.pvpWarId} winner=${winnerFactionId} city=${war.targetCityId}`,
      );
    } else if (moraleRaceResult) {
      console.log(
        `[pvpWar] war_morale_race: ${war.pvpWarId} winner=${winnerFactionId} ` +
          `morale=${attackerWarMorale}/${defenderWarMorale}`,
      );
    }
    if (captured || moraleRaceResult) {
      factionBulletinService.logPvpWarEnded(war, {
        status: WarPvp.WAR_PVP_STATUS.COMPLETED,
        winnerFactionId,
        victoryCondition,
      });
    }

    let attackerVeteranPromotions = [];
    let defenderVeteranPromotions = [];
    // 攻方参战计数由 POST /api/battles 写回；此处不重复扫描全卡池
    if (isPlayerDefender && defenderPlayerId && defenderParticipantIds.length > 0) {
      try {
        defenderVeteranPromotions = await checkAndApplyVeteran(
          (sql, params) => pool.query(sql, params),
          defenderPlayerId,
          { instanceIds: defenderParticipantIds },
        );
      } catch (vetErr) {
        console.error('[pvpWar] 老兵检查(守方)失败:', vetErr.message);
      }
    }

    return {
      pvpWarId,
      defenderType,
      defenderPlayerId,
      /** 本场从 alive→dead 的守军支数（与 cityService siege-result 的 killCount 一致） */
      killCount: actualKillCount,
      /** NPC：累计阵亡支数；玩家守军：无编制总槽时同本场击杀 */
      npcKilled: npcEliminatedCumulative != null ? npcEliminatedCumulative : actualKillCount,
      npcAlive: aliveAfter,
      npcTotal: unitArrLength,
      siegeCompleted: captured || moraleCaptured,
      winnerFactionId,
      victoryCondition,
      attackerWarMorale,
      defenderWarMorale,
      silverReward,
      personalSilverEarned: siegeSplit.personalSilverEarned,
      factionSilverToPool: siegeSplit.factionSilverToPool,
      siegeRewardPersonalSharePct: siegeSplit.siegeRewardPersonalSharePct,
      siegeRewardPolicySource: siegeSplit.siegeRewardPolicySource,
      reputationReward,
      contributionReward,
      equipmentDrop,
      veteranPromotions: attackerVeteranPromotions,
      defenderVeteranPromotions,
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    releaseLock();
    throw err;
  } finally {
    conn.release();
  }
}

/** 战术内核动态加载（缓存；与 `pvpGarrisonAutoDuelResolveService` / 道路同源）。 */
let _siegeKernelPromise = null;
function loadSiegeTacticalKernel() {
  if (!_siegeKernelPromise) {
    _siegeKernelPromise = import('../../shared/battle/tacticalSim/runPvpTacticalDuel.js');
  }
  return _siegeKernelPromise;
}

/**
 * 释放某场攻城 payload 对应的城战锁（与 `recordAttackerCitySiegeResult` 内 `releaseLock` 同语义）。
 * 用于「`initiateAttackerCitySiege` 已抢锁，但 record 之前异常」的兜底；`releasePvpCityLock` 幂等。
 */
function releaseSiegePayloadLock(pvpWarId, attackerPlayerId, payload) {
  const isPlayerDefender =
    payload?.defenderType === 'pvp_online' || payload?.defenderType === 'player_garrison';
  if (isPlayerDefender && payload?.defenderPlayerId) {
    releasePvpCityLock(
      buildPvpCityPlayerLockKey(pvpWarId, payload.defenderPlayerId, payload.defenderGarrisonSlot ?? 0),
      attackerPlayerId,
    );
  } else if (payload?.npcBatchIndex != null && !Number.isNaN(Number(payload.npcBatchIndex))) {
    releasePvpCityLock(buildPvpCityNpcLockKey(pvpWarId, Number(payload.npcBatchIndex)), attackerPlayerId);
  } else {
    for (let b = 0; b < PVP_CITY_LOCK_BATCH_SWEEP; b++) {
      releasePvpCityLock(buildPvpCityNpcLockKey(pvpWarId, b), attackerPlayerId);
    }
  }
}

/**
 * 服务端权威「一场攻城」：把真人攻城的「客户端中段战斗」搬到服务端，**完全复用**真人入口与结算：
 *   `initiateAttackerCitySiege`（扣攻城次数 + 选防守者/抢锁，三类防守者同真人优先级）
 *   → `runPvpTacticalDuel`（与披挂同一战术内核，守城方享城防加成）
 *   → `recordAttackerCitySiegeResult`（写 side_stats / 守军减员 / 易主 handoff / 释放锁）
 *   → `applyAuthoritativePvpAutoDuelAttackerLineupCasualties`（攻方兵力回写）。
 *
 * 锁/配额安全：`initiate` 自身失败已内部退配额/释放锁（本函数原样返回 `stop`，不重复释放）；
 * `initiate` 成功后到 `record` 成功之间任何异常 → 兜底释放该场锁 + 退 1 次攻城配额（`record`
 * 成功后 `recorded=true`，post-record（攻方兵力回写）异常仅记日志、**不**误退配额/释放锁）。
 *
 * 与真人无实质区别：唯一差异是「中段战斗」在服务端推演而非客户端 BattleArena。
 *
 * @param {string} pvpWarId
 * @param {string} attackerPlayerId
 * @returns {Promise<
 *   | { ok:true, attackerWon:boolean, siegeCompleted:boolean, defenderType:string, killCount:number, record:object }
 *   | { ok:false, stop?:boolean, reason?:string, error?:string }
 * >}
 */
async function resolveAuthoritativeAttackerCitySiege(pvpWarId, attackerPlayerId, options = {}) {
  const garrisonService = require('./garrisonService');
  const { hashSeed } = require('./pvp/auto-duel/pvpAutoDuelSim');
  const { tacticalToAutoDuelResult } = require('./pvp/tactical/tacticalToAutoDuelResult');
  const roomService = require('./pvp/tactical/pvpTacticalRoomService');

  // 1) 发起攻城：扣配额 + 选防守者/抢锁。失败（次数不足/无守军/阶段门禁/上阵不足/各线交战中）= 正常停。
  let payload;
  try {
    payload = await initiateAttackerCitySiege(pvpWarId, attackerPlayerId, options);
  } catch (e) {
    return { ok: false, stop: true, reason: e.message };
  }

  let recorded = false;
  try {
    const defenderNpcs = Array.isArray(payload.npcGarrison) ? payload.npcGarrison : [];
    if (!defenderNpcs.length) throw new Error('[pvpWar] 攻城防守批次为空');

    const rawAttacker = await garrisonService.buildDefenseUnitsFromMainLineup(attackerPlayerId);
    const attackerNpcs = garrisonService.mapBuiltUnitsToSiegeNpcFormat(rawAttacker);
    if (!attackerNpcs.length) throw new Error('[pvpWar] 攻方上阵编组无可战部队');

    // 2) 战术内核推演（守城方 side b 享城防加成；与披挂 PVP 同源）。
    const seedKey = payload.defenderPlayerId || `npc${payload.npcBatchIndex ?? 0}`;
    const seed = hashSeed([pvpWarId, attackerPlayerId, seedKey, Date.now()]);
    const duelMapId = await roomService.pickDuelMapIdForSeed(seed);
    const kernel = await loadSiegeTacticalKernel();
    const tactical = kernel.runPvpTacticalDuel({
      duelMapId,
      lineupSnapshots: { a: attackerNpcs, b: defenderNpcs },
      battleSeed: seed,
      sideLabels: { a: '攻方', b: '守军' },
      defenseBonus: { b: payload.cityDefense ?? 100 },
    });
    const adapted = tacticalToAutoDuelResult({
      winnerSide: tactical.winnerSide,
      finalState: tactical.finalState,
      attackerSnapshot: attackerNpcs,
      defenderSnapshot: defenderNpcs,
    });
    const result = adapted.attackerWon ? 'win' : 'lose';
    const {
      snapshotSiegeUnitsForCinematic,
      mapEndTroopsForCinematic,
      alignCinematicEndByWinner,
      collectSiegeKilledIndices,
      saveAuthoritativeSiegeAttackerBattleReport,
    } = require('./pvp/siegeCinematicTroops');

    // 3) 组 record payload（玩家驻地用本地下标；NPC 用全局 .index —— 勿把全局下标当成本批下标过滤）
    const isPlayerDefender =
      payload.defenderType === 'pvp_online' || payload.defenderType === 'player_garrison';
    const killedIndices = collectSiegeKilledIndices(
      defenderNpcs,
      adapted.defenderTroopsEnd,
      isPlayerDefender ? 'local' : 'npc_global',
    );
    const recordPayload = {
      defenderType: payload.defenderType,
      result,
      silverSpent: 0,
      battleScore: 0,
      battleReportSaved: true,
    };
    if (isPlayerDefender) {
      recordPayload.defenderPlayerId = payload.defenderPlayerId;
      recordPayload.defenderGarrisonSlot = payload.defenderGarrisonSlot;
      recordPayload.garrisonUnits = defenderNpcs;
      recordPayload.killedIndices = killedIndices;
      recordPayload.defenderLineupTroopUpdates = defenderNpcs
        .map((npc, i) => ({
          instanceId: npc._troopInstanceId,
          maxTroops: npc.maxTroops,
          currentTroops: Math.max(0, Math.round(Number(adapted.defenderTroopsEnd[i]?.currentTroops) || 0)),
        }))
        .filter((u) => u.instanceId);
    } else {
      recordPayload.npcBatchIndex = payload.npcBatchIndex;
      recordPayload.killedIndices = killedIndices;
    }

    // 4) 写回（释放锁在 record 内部完成）。
    const record = await recordAttackerCitySiegeResult(pvpWarId, attackerPlayerId, recordPayload);
    recorded = true;

    // 5) 攻方兵力回写（post-record；失败仅记日志，不回退本场战果/配额）。
    try {
      await garrisonService.applyAuthoritativePvpAutoDuelAttackerLineupCasualties(
        attackerPlayerId,
        attackerNpcs,
        adapted.attackerTroopsEnd,
      );
    } catch (e) {
      console.error(
        `[pvpWar] AI 攻城攻方兵力回写失败 war=${pvpWarId} player=${attackerPlayerId}: ${e.message}`,
      );
    }

    const battleLog =
      Array.isArray(tactical.battleLog) ? tactical.battleLog.join('\n') : String(tactical.battleLog || '');
    await saveAuthoritativeSiegeAttackerBattleReport({
      playerId: attackerPlayerId,
      battleType: 'pvp_siege',
      pvpWarId,
      opponentType: isPlayerDefender ? 'player' : 'npc',
      opponentId: isPlayerDefender ? payload.defenderPlayerId : null,
      opponentName: payload.cityName
        ? `${payload.cityName}守军`
        : isPlayerDefender
          ? '驻地守军'
          : '守军',
      result,
      attackerNpcs,
      defenderNpcs,
      attackerTroopsEnd: adapted.attackerTroopsEnd,
      defenderTroopsEnd: adapted.defenderTroopsEnd,
      defenderType: payload.defenderType || 'npc',
      battleLog,
      totalKills: killedIndices.length,
      rounds: tactical.rounds || 0,
    });

    const initialAttackerTroops = snapshotSiegeUnitsForCinematic(attackerNpcs);
    const initialDefenderTroops = snapshotSiegeUnitsForCinematic(defenderNpcs);
    const aligned = alignCinematicEndByWinner(
      adapted.attackerWon,
      mapEndTroopsForCinematic(initialAttackerTroops, adapted.attackerTroopsEnd),
      mapEndTroopsForCinematic(initialDefenderTroops, adapted.defenderTroopsEnd),
    );

    return {
      ok: true,
      attackerWon: adapted.attackerWon,
      siegeCompleted: !!record.siegeCompleted,
      defenderType: payload.defenderType,
      killCount: record.killCount ?? 0,
      record,
      initialAttackerTroops,
      initialDefenderTroops,
      attackerTroopsEnd: aligned.attackerTroopsEnd,
      defenderTroopsEnd: aligned.defenderTroopsEnd,
      battleLog,
      cityName: payload.cityName || payload.targetCityName || null,
      cityId: payload.cityId || payload.targetCityId || null,
      warId: payload.warId || null,
      pvpWarId,
      npcBatchIndex: payload.npcBatchIndex ?? null,
      npcAlive: record.npcAlive ?? null,
      npcTotal: record.npcTotal ?? null,
      npcKilled: record.npcKilled ?? record.killCount ?? 0,
    };
  } catch (e) {
    if (!recorded) {
      // initiate 已抢锁/扣配额，record 未成功 → 兜底释放锁 + 退配额（幂等）。
      releaseSiegePayloadLock(pvpWarId, attackerPlayerId, payload);
      try {
        if (payload?.siegeTokenConsumed) {
          await cityService.refundSiegeQuotaOnce(attackerPlayerId);
        }
      } catch (_) {
        /* ignore refund failure */
      }
    }
    console.error(`[pvpWar] AI 攻城推演失败 war=${pvpWarId} player=${attackerPlayerId}: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

/**
 * 守方对攻方大本营：权威一场（initiate → 战术内核 → record → 攻方伤亡回写）。
 * 与 `resolveAuthoritativeAttackerCitySiege` 同形，供玩家 HTTP 与冲锋动画。
 *
 * @param {string} pvpWarId
 * @param {string} defenderPlayerId - 守方玩家（攻打大本营者）
 */
async function resolveAuthoritativeBaseCampSiege(pvpWarId, defenderPlayerId, options = {}) {
  const garrisonService = require('./garrisonService');
  const { hashSeed } = require('./pvp/auto-duel/pvpAutoDuelSim');
  const { tacticalToAutoDuelResult } = require('./pvp/tactical/tacticalToAutoDuelResult');
  const roomService = require('./pvp/tactical/pvpTacticalRoomService');

  let payload;
  try {
    payload = await initiateBaseCampSiege(pvpWarId, defenderPlayerId, options);
  } catch (e) {
    return { ok: false, stop: true, reason: e.message };
  }

  let recorded = false;
  try {
    const defenderNpcs = Array.isArray(payload.baseCampSlice) ? payload.baseCampSlice : [];
    if (!defenderNpcs.length) throw new Error('[pvpWar] 大本营守军批次为空');

    const rawAttacker = await garrisonService.buildDefenseUnitsFromMainLineup(defenderPlayerId);
    const attackerNpcs = garrisonService.mapBuiltUnitsToSiegeNpcFormat(rawAttacker);
    if (!attackerNpcs.length) throw new Error('[pvpWar] 守方上阵编组无可战部队');

    const seed = hashSeed([pvpWarId, defenderPlayerId, 'base_camp', payload.batchIndex ?? 0, Date.now()]);
    const duelMapId = await roomService.pickDuelMapIdForSeed(seed);
    const kernel = await loadSiegeTacticalKernel();
    const tactical = kernel.runPvpTacticalDuel({
      duelMapId,
      lineupSnapshots: { a: attackerNpcs, b: defenderNpcs },
      battleSeed: seed,
      sideLabels: { a: '守方', b: '大本营' },
      // 大本营 NPC（side b）被攻击时叠目标城防守系数
      defenseBonus: { b: payload.cityDefense ?? 100 },
    });
    const adapted = tacticalToAutoDuelResult({
      winnerSide: tactical.winnerSide,
      finalState: tactical.finalState,
      attackerSnapshot: attackerNpcs,
      defenderSnapshot: defenderNpcs,
    });
    const result = adapted.attackerWon ? 'win' : 'lose';
    const {
      snapshotSiegeUnitsForCinematic,
      mapEndTroopsForCinematic,
      alignCinematicEndByWinner,
      collectSiegeKilledIndices,
      saveAuthoritativeSiegeAttackerBattleReport,
    } = require('./pvp/siegeCinematicTroops');
    const killedIndices = collectSiegeKilledIndices(
      defenderNpcs,
      adapted.defenderTroopsEnd,
      'npc_global',
    );

    const record = await recordBaseCampSiegeResult(pvpWarId, defenderPlayerId, {
      killedIndices,
      result,
      silverSpent: 0,
      battleScore: 0,
      battleReportSaved: true,
    });
    recorded = true;

    try {
      await garrisonService.applyAuthoritativePvpAutoDuelAttackerLineupCasualties(
        defenderPlayerId,
        attackerNpcs,
        adapted.attackerTroopsEnd,
      );
    } catch (e) {
      console.error(
        `[pvpWar] 大本营权威攻方兵力回写失败 war=${pvpWarId} player=${defenderPlayerId}: ${e.message}`,
      );
    }

    const battleLog =
      Array.isArray(tactical.battleLog) ? tactical.battleLog.join('\n') : String(tactical.battleLog || '');
    await saveAuthoritativeSiegeAttackerBattleReport({
      playerId: defenderPlayerId,
      battleType: 'pvp_siege',
      pvpWarId,
      opponentType: 'npc',
      opponentName: payload.targetCityName
        ? `${payload.targetCityName}·大本营`
        : '攻方大本营守军',
      result,
      attackerNpcs,
      defenderNpcs,
      attackerTroopsEnd: adapted.attackerTroopsEnd,
      defenderTroopsEnd: adapted.defenderTroopsEnd,
      defenderType: 'npc',
      battleLog,
      totalKills: killedIndices.length,
      rounds: tactical.rounds || 0,
    });

    const initialAttackerTroops = snapshotSiegeUnitsForCinematic(attackerNpcs);
    const initialDefenderTroops = snapshotSiegeUnitsForCinematic(defenderNpcs);
    const aligned = alignCinematicEndByWinner(
      adapted.attackerWon,
      mapEndTroopsForCinematic(initialAttackerTroops, adapted.attackerTroopsEnd),
      mapEndTroopsForCinematic(initialDefenderTroops, adapted.defenderTroopsEnd),
    );

    return {
      ok: true,
      attackerWon: adapted.attackerWon,
      siegeCompleted: !!record.siegeCompleted,
      defenderType: 'npc',
      killCount: record.killCount ?? 0,
      record,
      initialAttackerTroops,
      initialDefenderTroops,
      attackerTroopsEnd: aligned.attackerTroopsEnd,
      defenderTroopsEnd: aligned.defenderTroopsEnd,
      battleLog,
      cityName: payload.targetCityName || null,
      cityId: payload.targetCityId || null,
      pvpWarId,
      pvpDefenderBaseCampSiege: true,
      npcBatchIndex: payload.batchIndex ?? 0,
      npcAlive: record.baseCampAlive ?? record.npcAlive ?? null,
      npcTotal: record.baseCampTotal ?? record.npcTotal ?? null,
      npcKilled: record.npcKilled ?? record.killCount ?? 0,
      baseCampAlive: record.baseCampAlive ?? null,
      baseCampTotal: record.baseCampTotal ?? null,
    };
  } catch (e) {
    if (!recorded) {
      releaseBaseCampLock(pvpWarId, defenderPlayerId);
      try {
        if (payload?.siegeTokenConsumed) {
          await cityService.refundSiegeQuotaOnce(defenderPlayerId);
        }
      } catch (_) {
        /* ignore */
      }
    }
    console.error(
      `[pvpWar] 大本营权威推演失败 war=${pvpWarId} player=${defenderPlayerId}: ${e.message}`,
    );
    return { ok: false, error: e.message };
  }
}

// ==================== 胜负判定与 Tick ====================

/**
 * 周期检查 active 战事：到点判负 / 攻占胜利 / 大本营清零等。
 * 仅写库 / 派发结算；不做战斗推演。
 */
async function tickActivePvpWars() {
  await activatePendingPvpDrafts();
  try {
    const { tickWarPhasePolicies } = require('./aiConscriptLegionService');
    await tickWarPhasePolicies();
  } catch (e) {
    console.error('[pvpWar] tickWarPhasePolicies:', e.message);
  }
  const cityService = require('./cityService');
  const wars = await WarPvp.listWars({ status: ['active'], limit: 200 });
  const now = Date.now();
  let completed = 0;
  for (const war of wars) {
    try {
      // 1) 24h 超时 → 守方坚守胜（hold_city / timeout）
      if (war.endTime && new Date(war.endTime).getTime() <= now) {
        await WarPvp.updatePvpWar(
          war.pvpWarId,
          {
            status: WarPvp.WAR_PVP_STATUS.COMPLETED,
            winnerFactionId: war.defenderFactionId,
            victoryCondition: WarPvp.WAR_PVP_VICTORY_CONDITIONS.HOLD_CITY,
            settledAt: new Date(),
            settlementPhase: WarPvp.SETTLEMENT_PHASE.PLACEHOLDER,
            baseCamp: null,
          },
          null,
        );
        console.log(
          `[pvpWar] tick: ${war.pvpWarId} 24h timeout → defender hold_city win`,
        );
        factionBulletinService.logPvpWarEnded(war, {
          status: WarPvp.WAR_PVP_STATUS.COMPLETED,
          winnerFactionId: war.defenderFactionId,
          victoryCondition: WarPvp.WAR_PVP_VICTORY_CONDITIONS.HOLD_CITY,
        });
        completed += 1;
        continue;
      }
      // 2) 战事士气竞态 → 先达 120 者胜（17-3 §7.4）
      const warMoraleService = require('./warMoraleService');
      if (warMoraleService.warHasActiveMorale(war)) {
        const race = warMoraleService.checkRaceTermination(
          war.attackerWarMorale,
          war.defenderWarMorale,
          war,
        );
        if (race) {
          const conn = await pool.getConnection();
          try {
            await conn.beginTransaction();
            await WarPvp.updatePvpWar(
              war.pvpWarId,
              {
                status: WarPvp.WAR_PVP_STATUS.COMPLETED,
                winnerFactionId: race.winnerFactionId,
                victoryCondition: race.victoryCondition,
                settledAt: new Date(),
                settlementPhase: WarPvp.SETTLEMENT_PHASE.PLACEHOLDER,
                baseCamp: null,
              },
              conn,
            );
            await applyWarMoraleRaceHandoff(conn, war, race);
            await conn.commit();
          } catch (e) {
            await conn.rollback();
            throw e;
          } finally {
            conn.release();
          }
          if (race.winnerSide === 'attacker') {
            try {
              await cityService.generateNpcGarrison(war.targetCityId);
            } catch (e) {
              console.error('[pvpWar] tick morale 攻胜后刷新 NPC 失败:', e.message);
            }
          }
          console.log(
            `[pvpWar] tick: ${war.pvpWarId} war_morale_race → winner=${race.winnerFactionId}`,
          );
          factionBulletinService.logPvpWarEnded(war, {
            status: WarPvp.WAR_PVP_STATUS.COMPLETED,
            winnerFactionId: race.winnerFactionId,
            victoryCondition: race.victoryCondition,
          });
          completed += 1;
          continue;
        }
      }
      // 3) 大本营 NPC 全灭 → 守方胜（攻方失败）
      if (war.baseCamp?.npcAlive === 0) {
        const snap = war.baseCamp ? JSON.parse(JSON.stringify(war.baseCamp)) : null;
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          if (snap) {
            const reloc = require('./pvpWarPlayerRelocationService');
            await reloc.relocateAttackersOffPvpBaseCamp(conn, war, snap);
          }
          await WarPvp.updatePvpWar(
            war.pvpWarId,
            {
              status: WarPvp.WAR_PVP_STATUS.FAILED,
              winnerFactionId: war.defenderFactionId,
              victoryCondition: WarPvp.WAR_PVP_VICTORY_CONDITIONS.ELIMINATE_BASE_CAMP,
              settledAt: new Date(),
              settlementPhase: WarPvp.SETTLEMENT_PHASE.PLACEHOLDER,
              baseCamp: null,
            },
            conn,
          );
          await conn.commit();
        } catch (e) {
          await conn.rollback();
          throw e;
        } finally {
          conn.release();
        }
        factionBulletinService.logPvpWarEnded(war, {
          status: WarPvp.WAR_PVP_STATUS.FAILED,
          winnerFactionId: war.defenderFactionId,
          victoryCondition: WarPvp.WAR_PVP_VICTORY_CONDITIONS.ELIMINATE_BASE_CAMP,
        });
        completed += 1;
        continue;
      }
      // 4) 目标城 NPC 已空而战事仍 active（异常/竞态兜底）→ 与攻城战果路径一致：易主 + 终局
      const city = await cityService.getCityInfo(war.targetCityId);
      if (city && Number(city.npc_garrison_alive) === 0) {
        let closedCaptureTick = false;
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          const [cLock] = await conn.query(
            'SELECT faction_id, npc_garrison_alive FROM cities WHERE city_id = ? FOR UPDATE',
            [war.targetCityId],
          );
          const crow = cLock[0];
          if (!crow) {
            await conn.rollback();
          } else if (
            String(crow.faction_id || '') === String(war.defenderFactionId || '') &&
            Number(crow.npc_garrison_alive) === 0
          ) {
            await applyPvpTargetCityOwnershipHandoff(conn, war);
            await WarPvp.updatePvpWar(
              war.pvpWarId,
              {
                status: WarPvp.WAR_PVP_STATUS.COMPLETED,
                winnerFactionId: war.attackerFactionId,
                victoryCondition: WarPvp.WAR_PVP_VICTORY_CONDITIONS.CAPTURE_CITY,
                settledAt: new Date(),
                settlementPhase: WarPvp.SETTLEMENT_PHASE.PLACEHOLDER,
                baseCamp: null,
              },
              conn,
            );
            await conn.commit();
            closedCaptureTick = true;
            try {
              await cityService.generateNpcGarrison(war.targetCityId);
            } catch (e) {
              console.error('[pvpWar] tick capture 后刷新 NPC 失败:', e.message);
            }
          } else if (
            String(crow.faction_id || '') === String(war.attackerFactionId || '') &&
            Number(crow.npc_garrison_alive) === 0
          ) {
            await WarPvp.updatePvpWar(
              war.pvpWarId,
              {
                status: WarPvp.WAR_PVP_STATUS.COMPLETED,
                winnerFactionId: war.attackerFactionId,
                victoryCondition: WarPvp.WAR_PVP_VICTORY_CONDITIONS.CAPTURE_CITY,
                settledAt: new Date(),
                settlementPhase: WarPvp.SETTLEMENT_PHASE.PLACEHOLDER,
                baseCamp: null,
              },
              conn,
            );
            await conn.commit();
            closedCaptureTick = true;
          } else {
            await conn.rollback();
          }
        } catch (e) {
          await conn.rollback();
          throw e;
        } finally {
          conn.release();
        }
        if (closedCaptureTick) {
          factionBulletinService.logPvpWarEnded(war, {
            status: WarPvp.WAR_PVP_STATUS.COMPLETED,
            winnerFactionId: war.attackerFactionId,
            victoryCondition: WarPvp.WAR_PVP_VICTORY_CONDITIONS.CAPTURE_CITY,
          });
          completed += 1;
        }
        continue;
      }
    } catch (err) {
      console.error(`[pvpWar] tick error ${war.pvpWarId}:`, err.message);
    }
  }
  if (completed > 0) {
    console.log(`[pvpWar] tickActivePvpWars completed=${completed}`);
  }
  return { checked: wars.length, completed };
}

module.exports = {
  // 常量
  PVP_WAR_DURATION_MS,
  BASE_CAMP_NPC_RATIO_TO_FULL_GARRISON,
  BASE_CAMP_SIEGE_FOOD_COST_MULTIPLIER,
  MAX_CONCURRENT_PVP_WARS_PER_ATTACKER_FACTION,
  BASE_CAMP_SPRITE_SINGLE,
  BASE_CAMP_ORIENTATION_SINGLE,
  // 选位（暴露用于测试）
  findBaseCampCandidatePlacements,
  pickBaseCampPlacement,
  computeBaseCampNpcCount,
  createBaseCampJsonForCity,
  collectOccupiedCampCellsInJun,
  // 生命周期
  createPvpWarDraft,
  createPvpWarDraftAndActivate,
  activatePendingPvpDrafts,
  placeAttackerBaseCampAndActivate,
  cancelPvpWar,
  listSanGongAttackingSiegeWarsForPlayer,
  cancelAttackingSiegeWarViaSanGongChaoZheng,
  // 战斗握手
  initiateBaseCampSiege,
  recordBaseCampSiegeResult,
  initiateAttackerCitySiege,
  recordAttackerCitySiegeResult,
  resolveAuthoritativeAttackerCitySiege,
  resolveAuthoritativeBaseCampSiege,
  // Tick
  tickActivePvpWars,
};
