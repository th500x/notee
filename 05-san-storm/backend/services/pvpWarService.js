/**
 * PVP 势力战事服务（17-2 M2）
 *
 * 职责：
 *   1. 战事生命周期：草案（pending）→ 活跃（active）→ 结算（completed/failed/cancelled）
 *   2. 攻方城外大本营（1×2 / 2×1）选位 + NPC 守军初始化 + 持久化到 `wars_pvp.base_camp` JSON
 *   3. 大本营 NPC 战斗握手：分批输出守军 + 战后写回存活 + 触发胜负
 *   4. 胜负判定与结算（capture_city / eliminate_attacker_base_camp / hold_city / timeout）
 *   5. 24h 时钟（与 11-3 协同：阶段表以 11-3 为准；本服务只做整场到点判负）
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
const {
  normalizeRoadCellList,
} = require('../../shared/utils/strategicRoadOverlay.js');

/** 大本营 NPC 守军 = 目标城满编 NPC 总支数 × 80%（17-2 §1.6 / 实现计划 §1.5）。 */
const BASE_CAMP_NPC_RATIO_TO_FULL_GARRISON = 0.8;

/** 单场 PVP 战事最长时长（自然 24h，17-2 §0 / §6.2）。 */
const PVP_WAR_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * 同一攻方势力在 `wars_pvp` 上 **pending + active** 条数上限（与 PVE `wars` 分列：每势力 PVP 至多 1、PVE 至多 1，合计至多 2）。
 */
const MAX_CONCURRENT_PVP_WARS_PER_ATTACKER_FACTION = 1;

/** 大本营贴图键（与 `public/.../tile_3_object` 像素比一致：`camp_02` 64×128 竖、`camp_01` 128×64 横）。 */
const BASE_CAMP_SPRITE_VERTICAL = 'camp_02';
const BASE_CAMP_SPRITE_HORIZONTAL = 'camp_01';

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

const BASE_CAMP_ROAD_NEIGHBOR_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * 骨牌两格是否至少有一格与道路格 **4-邻接**（本营须在路旁，与离路出发「首跳须邻接道路」一致）。
 * @param {string[]} cellKeys - `["gx,gy", ...]`
 * @param {Set<string>} roadKeys
 */
function dominoTouchesRoadFourWay(cellKeys, roadKeys) {
  if (!roadKeys?.size || !cellKeys?.length) return false;
  for (const k of cellKeys) {
    const parts = String(k)
      .split(',')
      .map((s) => Number(String(s).trim()));
    const x = parts[0];
    const y = parts[1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    for (const [dx, dy] of BASE_CAMP_ROAD_NEIGHBOR_OFFSETS) {
      if (roadKeys.has(`${x + dx},${y + dy}`)) return true;
    }
  }
  return false;
}

/**
 * 在目标城 footprint 边相邻的范围内寻找可放下 1×2 / 2×1 大本营的合法槽位。
 *
 * 规则（与 17-2 §1.6 / 实现计划一致，并叠 **邻路** 约束）：
 *   - 两格均在地图内、不在 `blocked`（其它城/关/匪寨 footprint）、不在道路集合
 *   - 不与本郡内已有 active PVP 战事的大本营 footprint 重叠
 *   - 至少一格与目标城 footprint 4 邻接（"贴城"），且不落在 footprint 内
 *   - **至少一格与某道路格 4 邻接**（本营必须紧靠路网，禁止「贴城但隔城/隔格才到路」）
 *
 * @param {object} ctx - { rawCells, mapColumns, mapRows, roadKeys, blocked, cityFootprint, occupiedCamps }
 * @returns {Array<{ anchorOx: number, anchorOy: number, orientation: 'vertical'|'horizontal', cells: string[] }>}
 */
function findBaseCampCandidatePlacements(ctx) {
  const { mapColumns, mapRows, roadKeys, blocked, cityFootprint, occupiedCamps } = ctx;
  if (!cityFootprint?.size) return [];

  const occupiedKeys = new Set();
  for (const k of occupiedCamps) occupiedKeys.add(k);

  const cityKeys = cityFootprint;

  const candidates = [];
  for (let gy = 0; gy < mapRows; gy++) {
    for (let gx = 0; gx < mapColumns; gx++) {
      for (const orientation of ['vertical', 'horizontal']) {
        const cells =
          orientation === 'vertical'
            ? [
                { x: gx, y: gy },
                { x: gx, y: gy + 1 },
              ]
            : [
                { x: gx, y: gy },
                { x: gx + 1, y: gy },
              ];
        let inBounds = true;
        let touchesCity = false;
        const keys = [];
        for (const { x, y } of cells) {
          if (x < 0 || y < 0 || x >= mapColumns || y >= mapRows) {
            inBounds = false;
            break;
          }
          const k = `${x},${y}`;
          keys.push(k);
          if (cityKeys.has(k)) {
            inBounds = false;
            break;
          }
          if (blocked.has(k)) {
            inBounds = false;
            break;
          }
          if (roadKeys.has(k)) {
            inBounds = false;
            break;
          }
          if (occupiedKeys.has(k)) {
            inBounds = false;
            break;
          }
          for (const ck of cityKeys) {
            const [cx, cy] = ck.split(',').map(Number);
            if (Math.abs(cx - x) + Math.abs(cy - y) === 1) {
              touchesCity = true;
              break;
            }
          }
        }
        if (!inBounds || !touchesCity) continue;
        if (!dominoTouchesRoadFourWay(keys, roadKeys)) continue;
        candidates.push({
          anchorOx: gx,
          anchorOy: gy,
          orientation,
          cells: keys,
        });
      }
    }
  }
  return candidates;
}

/**
 * 候选锚点择一（实现计划 §12-D）：
 *   M2 用确定性序：按 (anchorOy, anchorOx, orientation) 字典升序取首个；同坐标下竖 1×2 优先于横 2×1。
 *   未来可改为基于 pvpWarId hash 的固定随机；签名保留 `pickerSeed` 参数。
 */
function pickBaseCampPlacement(candidates, pickerSeed = 0) {
  if (!candidates?.length) return null;
  void pickerSeed;
  const ord = (s) => (s === 'vertical' ? 0 : 1);
  const sorted = [...candidates].sort((a, b) =>
    a.anchorOy !== b.anchorOy
      ? a.anchorOy - b.anchorOy
      : a.anchorOx !== b.anchorOx
        ? a.anchorOx - b.anchorOx
        : ord(a.orientation) - ord(b.orientation),
  );
  return sorted[0];
}

/**
 * 收集本郡内所有 active / pending PVP 战事的大本营占格（用于避让）。
 */
async function collectOccupiedCampCellsInJun(junId, excludePvpWarId = null) {
  const occupied = new Set();
  const wars = await WarPvp.listWars({ status: ['pending', 'active'], limit: 200 });
  for (const w of wars) {
    if (excludePvpWarId && w.pvpWarId === excludePvpWarId) continue;
    if (!w.baseCamp || !Array.isArray(w.baseCamp.cells)) continue;
    if (w.baseCamp.junId && junId && w.baseCamp.junId !== junId) continue;
    for (const k of w.baseCamp.cells) occupied.add(k);
  }
  return occupied;
}

// ==================== NPC 守军生成（大本营） ====================

/**
 * 大本营 NPC 守军支数：与目标城同档但只取 80%（17-2 §1.6）。
 * 不读取 city 的当前 `npc_garrison_alive`（残余），改用 cityType 满编档；这也避免战时残余传染。
 */
function computeBaseCampNpcCount(cityRow) {
  const t = cityRow?.city_type;
  const fullCount = cityService.NPC_TROOP_COUNT_OWNED[t];
  if (!fullCount) {
    throw new Error(`[pvpWar] 不支持的目标城类型用于大本营生成: ${t}`);
  }
  return Math.round(fullCount * BASE_CAMP_NPC_RATIO_TO_FULL_GARRISON);
}

/**
 * 复用 cityService 的 NPC 生成逻辑，但写回到 `wars_pvp.base_camp.npcUnits`，
 * 不污染 `cities.npc_garrison`（攻守对象不同，不可混入城市表）。
 *
 * 流程：用 cityService.generateNpcGarrison 临时为目标城生成 NPC 数组（troopCountOverride），
 *      读取后立即恢复城市原 NPC 状态，避免副作用。
 */
async function generateBaseCampNpcUnits(targetCity, npcCount) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [snapRows] = await conn.query(
      'SELECT npc_garrison, npc_garrison_alive FROM cities WHERE city_id = ? FOR UPDATE',
      [targetCity.city_id],
    );
    if (!snapRows.length) throw new Error(`[pvpWar] 目标城不存在: ${targetCity.city_id}`);
    const prevNpc = snapRows[0].npc_garrison;
    const prevAlive = snapRows[0].npc_garrison_alive;
    await conn.commit();
    const { npcGarrison } = await cityService.generateNpcGarrison(targetCity.city_id, {
      troopCountOverride: npcCount,
    });
    const conn2 = await pool.getConnection();
    try {
      await conn2.query(
        'UPDATE cities SET npc_garrison = ?, npc_garrison_alive = ? WHERE city_id = ?',
        [prevNpc, prevAlive, targetCity.city_id],
      );
    } finally {
      conn2.release();
    }
    return npcGarrison.map((u, idx) => ({
      ...u,
      index: idx,
      alive: true,
    }));
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

  const cityType = String(city.city_type ?? city.cityType ?? '').trim();
  const isFortTarget = cityType === 'fort';

  // 据点（fort）：仅允许「敌对势力已占」（与 `cityService.isCityOccupiedForNpcGarrison` 同口径）。
  // 中立/无归属白点据点禁止 `wars_pvp`；城级中立仍走既有 PVE，此处不收紧非 fort 目标。
  if (isFortTarget) {
    if (!cityService.isCityOccupiedForNpcGarrison(city)) {
      throw new Error(
        '[pvpWar] 据点为中立或未占领时不可创建势力 PVP 战事，仅可向敌对势力已占据点宣战',
      );
    }
  } else if (!city.faction_id) {
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
      `[pvpWar] 目标城已有进行中 PVP 战事：${existing.pvpWarId}（同城仅一场，17-2 §1.4）`,
    );
  }

  const attackerWarCount = await WarPvp.countActiveOrPendingByAttackerFaction(attackerFactionId);
  if (attackerWarCount >= MAX_CONCURRENT_PVP_WARS_PER_ATTACKER_FACTION) {
    throw new Error(
      `[pvpWar] 攻方势力同时进行中的 PVP 战事已达上限（${MAX_CONCURRENT_PVP_WARS_PER_ATTACKER_FACTION}），无法新建`,
    );
  }

  const [attRows] = await pool.query(
    'SELECT id, faction_name FROM factions WHERE id = ? LIMIT 1',
    [attackerFactionId],
  );
  const [defRows] = await pool.query(
    'SELECT id, faction_name FROM factions WHERE id = ? LIMIT 1',
    [city.faction_id],
  );
  const attackerFactionName = attRows[0]?.faction_name || null;
  const defenderFactionName = defRows[0]?.faction_name || null;

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
        attackerMorale: 100,
        defenderMorale: 100,
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
 * @param {object} input - 同 {@link createPvpWarDraft}
 * @returns {Promise<object>} 已 active 且含 baseCamp 的战事
 */
async function createPvpWarDraftAndActivate(input) {
  const draft = await createPvpWarDraft(input);
  try {
    return await placeAttackerBaseCampAndActivate(draft.pvpWarId);
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
 * @param {string} pvpWarId
 * @returns {Promise<object>} formatted pvp war（含 base_camp、status=active）
 */
async function placeAttackerBaseCampAndActivate(pvpWarId) {
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
  const junId = targetCity.jun_id;
  if (!junId) throw new Error('[pvpWar] 目标城缺 jun_id，无法定位战略格网');

  const grid = await loadRoadGrid(targetCity.season || 'san_1', junId);
  if (grid.source === 'none' || !grid.rawCells?.length) {
    throw new Error(`[pvpWar] 目标郡 ${junId} 缺合并地图；请先生成 worldmap merged JSON`);
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
      `[pvpWar] 目标城 ${war.targetCityId} 在地图无 footprint（position_x/y 越界或缺失）`,
    );
  }

  const occupied = await collectOccupiedCampCellsInJun(junId, pvpWarId);

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
      `[pvpWar] 目标城 ${war.targetCityId} 周围无 1×2/2×1 合法空地放置大本营（须贴城且至少一格四邻接道路）`,
    );
  }
  const pick = pickBaseCampPlacement(candidates, pvpWarId);

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

  const baseCamp = {
    junId,
    anchorOx: pick.anchorOx,
    anchorOy: pick.anchorOy,
    orientation: pick.orientation,
    cells: pick.cells,
    /** 与合并战略格网 `cells[wy][gx]` 一致，客户端/服务端 footprint 优先用此，避免郡内↔叠放行换算漂移 */
    worldCellKeys,
    spriteKey:
      pick.orientation === 'vertical' ? BASE_CAMP_SPRITE_VERTICAL : BASE_CAMP_SPRITE_HORIZONTAL,
    npcTotal: npcCount,
    npcAlive: npcCount,
    npcUnits,
    placedAt: new Date().toISOString(),
  };

  const now = new Date();
  const endTime = new Date(now.getTime() + PVP_WAR_DURATION_MS);

  const gameTime =
    (await gameTimeService.loadGameTimeForFaction(war.attackerFactionId)) || null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const paid = await warInitiationCostService.assertAndDeductInTransaction(
      conn,
      war.attackerFactionId,
      targetCity.city_type,
      gameTime,
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
    await WarPvp.updatePvpWar(
      pvpWarId,
      {
        baseCamp,
        status: WarPvp.WAR_PVP_STATUS.ACTIVE,
        startTime: now,
        endTime,
        sideStats: mergedSide,
      },
      conn,
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

  console.log(
    `[pvpWar] placeAttackerBaseCampAndActivate ok: ${pvpWarId} junId=${junId} ` +
      `anchor=(${pick.anchorOx},${pick.anchorOy}) orient=${pick.orientation} npc=${npcCount}`,
  );
  const activated = await WarPvp.getById(pvpWarId);
  factionBulletinService.logPvpWarStarted(activated);
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

  // TODO(17-2 结算): 主动撤战 / cancel 的势力与个人统计、奖惩与战报摘要（当前仅终局库状态 + 势力公告）。

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
 * 与 cityService NPC 攻城分批一致；锁键单独以 pvpWarId 命名空间，不与城战锁冲突（17-2 §1.7）。
 *
 * @param {string} pvpWarId
 * @param {string} playerId - 守方玩家
 * @returns {Promise<{ pvpWarId: string, baseCampSlice: object[], baseCampAlive: number, baseCampTotal: number, batchIndex: number }>}
 */
async function initiateBaseCampSiege(pvpWarId, playerId) {
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

  const consumed = await cityService.tryConsumeSiegeQuotaOnce(playerId);
  if (!consumed) throw new Error('攻城次数不足');
  if (!tryAcquireBaseCampLock(pvpWarId, playerId)) {
    await cityService.refundSiegeQuotaOnce(playerId);
    throw new Error('[pvpWar] 大本营当前有友军在交战，请稍后再试');
  }

  const maxBatch = Math.ceil(aliveEntries.length / 4);
  const batchIndex = 0;
  const slice = aliveEntries.slice(batchIndex * 4, batchIndex * 4 + 4);
  void maxBatch;

  return {
    pvpWarId,
    targetCityId: war.targetCityId,
    targetCityName: war.targetCityName,
    attackerFactionId: war.attackerFactionId,
    defenderFactionId: war.defenderFactionId,
    baseCampSlice: slice.map(({ u, idx }) => ({ ...u, index: idx })),
    baseCampAlive: aliveEntries.length,
    baseCampTotal: camp.npcUnits.length,
    batchIndex,
  };
}

/**
 * 写入大本营 NPC 战斗结果：将 killedIndices 翻为 alive=false；触发胜负检查。
 * 奖励口径对齐 `cityService.recordSiegeResult`（PVE 攻城 NPC）：按击杀稀有度银两、扣本场消耗、
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
  const { checkAndApplyVeteran } = require('./veteranService');
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
    if (netSilver !== 0) {
      await conn.query(
        'UPDATE players SET silver = GREATEST(0, silver + ?) WHERE player_id = ?',
        [netSilver, playerId],
      );
    }

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

    let veteranPromotions = [];
    try {
      veteranPromotions = await checkAndApplyVeteran(
        (sql, params) => pool.query(sql, params), playerId,
      );
    } catch (vetErr) {
      console.error('[pvpWar] 老兵检查(大本营守方)失败:', vetErr.message);
    }

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
// 语义对齐 17-2 §1.4 / §1.7 / §1.9 与 M1 占领城防御链：
//   1) 披挂上阵（pvp_online，实时同步）
//   2) 普通驻守玩家（player_garrison，异步 PVE）
//   3) NPC 守军（npc，异步 PVE）
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
 * 发起一场对目标城的攻城战斗（PVP 战事内攻方主动出击，三类防守者通用入口）。
 *
 * 防守者优先级（与 17-2 §1.4 / §1.7、M1 cityService 占领城分支语义一致）：
 *   ① 披挂上阵玩家（实时 PVP，pvp_online）
 *   ② 普通驻守玩家（异步 PVE，player_garrison）
 *   ③ NPC 守军（异步 PVE，npc）
 *
 * 与 cityService.initiateSiege 物理分流：仅在 `wars_pvp.status='active'` 下成立，**不** 写 `wars` 表。
 *
 * @param {string} pvpWarId
 * @param {string} attackerPlayerId
 * @returns {Promise<object>}
 */
async function initiateAttackerCitySiege(pvpWarId, attackerPlayerId) {
  const garrisonService = require('./garrisonService');
  const cityService = require('./cityService');

  const war = await WarPvp.getById(pvpWarId);
  if (!war) throw new Error('[pvpWar] 战事不存在');
  if (war.status !== WarPvp.WAR_PVP_STATUS.ACTIVE) {
    throw new Error(`[pvpWar] 战事未进行中（${war.status}）`);
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

  // ── 1) 披挂上阵 + 普通驻守玩家：合并去重，按位置等级 / 槽位顺序匹配 ──
  const onDutyDefenders = await garrisonService.getCityOnDutyDefenders(
    war.targetCityId, war.defenderFactionId,
  );
  const garrisonDefenders = await garrisonService.getCityGarrisonDefenders(
    war.targetCityId, war.defenderFactionId,
  );
  const onDutyPlayerIds = new Set(onDutyDefenders.map((d) => d.player_id));
  const garrisonOnly = garrisonDefenders.filter((d) => !onDutyPlayerIds.has(d.player_id));
  const playerDefenders = [...onDutyDefenders, ...garrisonOnly];

  for (const def of playerDefenders) {
    if (!def.player_id || def.player_id === attackerPlayerId) continue;
    const { units, meetsStationedTroopGate } =
      await garrisonService.buildDefenderLineupForCityDefense(def);
    if (!meetsStationedTroopGate) continue;

    const lockKey = buildPvpCityPlayerLockKey(
      pvpWarId, def.player_id, def.garrison_slot ?? 0,
    );
    if (!tryAcquirePvpCityLock(lockKey, attackerPlayerId)) continue;

    const garrisonUnits = garrisonService.mapBuiltUnitsToSiegeNpcFormat(units);
    const isOnDuty = def.defense_source === 'main_lineup' || !!def.on_duty;
    return {
      pvpWarId,
      cityId: city.city_id,
      cityName: city.city_name,
      cityType: city.city_type,
      npcGarrison: garrisonUnits,
      npcAlive: garrisonUnits.length,
      npcTotal: garrisonUnits.length,
      attackerFactionId: war.attackerFactionId,
      defenderFactionId: war.defenderFactionId,
      defenderType: isOnDuty ? 'pvp_online' : 'player_garrison',
      defenderName: def.character_name || null,
      defenderPlayerId: def.player_id,
      defenderGarrisonSlot: def.garrison_slot ?? 0,
    };
  }

  // ── 2) 玩家防御链全跳过 → NPC 守军（按 4 支一批顺位抢锁） ──
  const fullG = Array.isArray(city.npc_garrison) ? city.npc_garrison : [];
  const aliveEntries = [];
  for (let gi = 0; gi < fullG.length; gi++) {
    const u = fullG[gi];
    if (u && u.alive) aliveEntries.push({ u, gi });
  }
  if (aliveEntries.length === 0) {
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
    throw new Error('[pvpWar] 当前各战线均有友军交战中，请稍后再试');
  }

  return {
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
  };
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
  const reloc = require('./pvpWarPlayerRelocationService');
  await conn.query(
    'UPDATE players SET on_duty = FALSE, on_duty_city_id = NULL WHERE on_duty_city_id = ?',
    [war.targetCityId],
  );
  const [cityGarrisonPlayers] = await conn.query(
    'SELECT DISTINCT player_id FROM player_garrison WHERE city_id = ?',
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
  await conn.query(
    "UPDATE cities SET faction_id = ?, status = 'owned', npc_garrison = NULL, npc_garrison_alive = 0 WHERE city_id = ?",
    [war.attackerFactionId, war.targetCityId],
  );
  await reloc.relocateDefendersOffPvpTargetCity(conn, war, war.targetCityId);
  await conn.query('UPDATE wars_pvp SET base_camp = NULL WHERE pvp_war_id = ?', [war.pvpWarId]);
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

    // ──────── A) 玩家防守者分支：披挂上阵 / 普通驻守 ────────
    if (isPlayerDefender) {
      const allTroopInstanceIds = (garrisonUnits || [])
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
      if (allTroopInstanceIds.length > 0) {
        const ph = allTroopInstanceIds.map(() => '?').join(',');
        await conn.query(
          `UPDATE player_cards SET battle_count = LEAST(
             GREATEST(COALESCE(battle_count, 0), 0) + 1,
             COALESCE(max_battle_count, 60)
           ),
           lifetime_battle_count = COALESCE(lifetime_battle_count, 0) + 1
           WHERE instance_id IN (${ph})`,
          allTroopInstanceIds,
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
          'SELECT char1_troop1, char1_troop2, char2_troop1, char2_troop2 FROM player_garrison WHERE player_id = ? AND city_id = ? AND garrison_slot = ?',
          [gPlayerId, rowCityId, slot],
        );
        if (!slotRows.length) continue;
        const troopIds = [
          slotRows[0].char1_troop1, slotRows[0].char1_troop2,
          slotRows[0].char2_troop1, slotRows[0].char2_troop2,
        ].filter(Boolean);
        if (troopIds.length === 0) {
          await conn.query(
            'UPDATE player_garrison SET is_active = FALSE WHERE player_id = ? AND city_id = ? AND garrison_slot = ?',
            [gPlayerId, rowCityId, slot],
          );
          continue;
        }
        const totalTroopsLeft = await garrisonService.sumTroopInstancesTotalTroops(
          conn, gPlayerId, troopIds,
        );
        if (totalTroopsLeft < garrisonService.MIN_GARRISON_TOTAL_TROOPS) {
          await conn.query(
            'UPDATE player_garrison SET is_active = FALSE WHERE player_id = ? AND city_id = ? AND garrison_slot = ?',
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

    const netSilver = silverReward - (silverSpent > 0 ? silverSpent : 0);
    if (netSilver !== 0) {
      await conn.query(
        'UPDATE players SET silver = GREATEST(0, silver + ?) WHERE player_id = ?',
        [netSilver, attackerPlayerId],
      );
    }

    let nextStatus = war.status;
    let winnerFactionId = war.winnerFactionId || null;
    let victoryCondition = war.victoryCondition || null;
    if (captured) {
      nextStatus = WarPvp.WAR_PVP_STATUS.COMPLETED;
      winnerFactionId = war.attackerFactionId;
      victoryCondition = WarPvp.WAR_PVP_VICTORY_CONDITIONS.CAPTURE_CITY;
    }

    await conn.query(
      `UPDATE wars_pvp SET side_stats = ?, status = ?, winner_faction_id = ?, victory_condition = ?,
         end_time = CASE WHEN ? <> ? THEN NOW() ELSE end_time END,
         settled_at = CASE WHEN ? <> ? THEN NOW() ELSE settled_at END,
         settlement_phase = CASE WHEN ? <> ? THEN 'placeholder' ELSE settlement_phase END
       WHERE pvp_war_id = ?`,
      [
        JSON.stringify(sideStats),
        nextStatus,
        winnerFactionId,
        victoryCondition,
        nextStatus, war.status,
        nextStatus, war.status,
        nextStatus, war.status,
        war.pvpWarId,
      ],
    );

    if (captured) {
      await applyPvpTargetCityOwnershipHandoff(conn, war);
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

    if (captured) {
      try {
        await cityService.generateNpcGarrison(war.targetCityId);
      } catch (e) {
        console.error('[pvpWar] 攻破后刷新 NPC 失败:', e.message);
      }
      console.log(
        `[pvpWar] capture_city: ${war.pvpWarId} winner=${winnerFactionId} city=${war.targetCityId}`,
      );
      factionBulletinService.logPvpWarEnded(war, {
        status: WarPvp.WAR_PVP_STATUS.COMPLETED,
        winnerFactionId,
        victoryCondition,
      });
    }

    let attackerVeteranPromotions = [];
    let defenderVeteranPromotions = [];
    try {
      attackerVeteranPromotions = await checkAndApplyVeteran(
        (sql, params) => pool.query(sql, params), attackerPlayerId,
      );
    } catch (vetErr) {
      console.error('[pvpWar] 老兵检查(攻方)失败:', vetErr.message);
    }
    if (isPlayerDefender && defenderPlayerId) {
      try {
        defenderVeteranPromotions = await checkAndApplyVeteran(
          (sql, params) => pool.query(sql, params), defenderPlayerId,
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
      siegeCompleted: captured,
      winnerFactionId,
      victoryCondition,
      silverReward,
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

// ==================== 胜负判定与 Tick ====================

/**
 * 周期检查 active 战事：到点判负 / 攻占胜利 / 大本营清零等。
 * 仅写库 / 派发结算；不做战斗推演。
 */
async function tickActivePvpWars() {
  await activatePendingPvpDrafts();
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
      // 2) 大本营 NPC 全灭 → 守方胜（攻方失败）
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
      // 3) 目标城 NPC 已空而战事仍 active（异常/竞态兜底）→ 与攻城战果路径一致：易主 + 终局
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
  MAX_CONCURRENT_PVP_WARS_PER_ATTACKER_FACTION,
  BASE_CAMP_SPRITE_VERTICAL,
  BASE_CAMP_SPRITE_HORIZONTAL,
  // 选位（暴露用于测试）
  findBaseCampCandidatePlacements,
  pickBaseCampPlacement,
  computeBaseCampNpcCount,
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
  // Tick
  tickActivePvpWars,
};
