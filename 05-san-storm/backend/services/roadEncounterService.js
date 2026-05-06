/**
 * 道路遭遇服务（31-6 玩法 / 02 §2.1.2 API 契约 / 01 §3.2.24 表结构）
 *
 * 责任：
 *   1. 守门开关（road_intercept）事务与银两扣减；
 *   2. 沿路移动事务：逐格校验道路集合、邻接、占格、M2 敌对、粮草链路（player.food → factions.reserve_food）、
 *      触发遭遇时瞬间占格（road_encounters.status='fighting'）、同一事务提交；
 *      攻方未达开战门闸时 **禁止** 踏入存在敌对玩家的道路格（整单 409，避免卡住）；守方未达门闸则不登记遭遇并将其 **`road_position_*` 写回最近己方城锚格**（共享 `roadBattleRetreatPlacement`）；
 *      非敌对（M2：同势力；缺 faction 视为非敌对）同格：允许叠站并继续本段路径，不因途经友军/中立而阻断。
 *      **交战格锁**：`pending`/`fighting` 时，非攻防双方 **不得将本格作为本次道路段终点**；**过境**（同请求内非最后道路步）视为透明，不 409、亦不触发与格上敌对之新遭遇。
 *   3. 郡内 presence：仅在线他人 road_position + 锁格；
 *   4. 战后解锁：写 status='resolved'、ended_at、battle_id；战败方移回最近己方城；守门方战败关闭 `road_intercept`。
 *
 * 所有对 players 的写入先 `SELECT … FOR UPDATE`；遭遇占格也在事务内 `SELECT … FOR UPDATE`。
 * 幂等：同一 `clientRequestId` 命中 players.road_last_request_id 时返回当前快照，不重复扣费 / 移格。
 *
 * 物理拆分（2026-04-29，CR 必改 #6 第一阶段；行为零变动）：
 *   - 常量 + 纯 helper          → `services/road/roadShared.js`
 *   - Stale / 幽灵清理           → `services/road/roadStaleCleanup.js`
 *   - 守门开关 `setIntercept`    → `services/road/roadInterceptService.js`
 *   - 自身 / 郡内他人 / 守方轮询 → `services/road/roadPresenceService.js`
 *   本文件保留：`moveAlongRoad`、战斗周期（payload / record / resolve）、权威推演与查询；
 *   对外 `module.exports` 不变，路由层 `roadEncounterService.xxx(...)` 全部继续可用。
 */

const { pool } = require('../database/connection');
const {
  loadRoadGrid,
  loadRoadGridSan1YuVerticalStack,
  isSan1YuStackRoadJunId,
  findMainCityFootprint,
  cellKey,
  isNeighbor4,
} = require('../utils/roadGrid');

const marchPoi = require('../../shared/utils/strategicMarchPoi.js');
const { isHostileByFaction } = require('../utils/roadDiplomacy');
const { isPlayerRecentlyActive, DEFAULT_ONLINE_MS } = require('../utils/playerActivity');
const statisticsDeltaService = require('./statisticsDeltaService');
const garrisonService = require('./garrisonService');
const { applyTroopDurabilityExhaustion } = require('./troopDurabilityService');
const { checkAndApplyVeteran } = require('./veteranService');
const smallMapBattleLootService = require('./smallMapBattleLootService');
const { KILL_SILVER_REWARD } = require('../../shared/utils/siegeKillEconomyByRarity.cjs');
const {
  isPlayerRoadEncounterParticipant,
  isNonParticipantFinalRoadStepOntoEncounter,
} = require('../../shared/utils/roadEncounterLockPassage.js');
const {
  applyFactionPlayerRoadRetreat,
  buildRoadGateFailRetreatNotice,
  buildRoadBattleDefeatRetreatNotice,
} = require('../utils/roadBattleRetreatPlacement');
const { runSiegePvpSkirmish, hashSeed } = require('./siegePvpSkirmish');
const battleService = require('./battleService');
const { newShortBattleId } = require('../utils/battleId');
const {
  calculateBattleScore,
  buildTroopsForAttackerScore,
  buildTroopsForDefenderScore,
  SIEGE_PVP_ONLINE_SCORE_MULT,
} = require('../utils/battleScore.cjs');
const { buildDefenderSiegePvpBattleLog } = require('../utils/siegeDefenseBattleLog');

const {
  INTERCEPT_COST_SILVER,
  FREE_MOVES_PER_DAY,
  FOOD_PER_STEP,
  RESERVE_FOOD_DAILY_LIMIT,
  ROAD_DEFENDER_ALERT_SEC,
  STALE_FIGHT_SQL_MIN,
  getStrategicStackModule,
  newEncounterId,
  toInt,
  buildPlayerRoadSnapshot,
  validatePathShape,
  sumSiegeNpcStartingTroopsRoad,
  siegeNpcDisplayNamesRoad,
} = require('./road/roadShared');
const {
  resolveStaleRoadEncountersAtCell,
  resolveAbandonedRoadFightOnCellIfOpponentOffline,
} = require('./road/roadStaleCleanup');
const { setIntercept } = require('./road/roadInterceptService');
const {
  getSelfRoadState,
  getRoadPresence,
  getPendingDefenderEncounter,
} = require('./road/roadPresenceService');

const { WIN_REPUTATION_REWARD } = smallMapBattleLootService;

// ── moveAlongRoad 内部 helper（CR 必改 #6 第二阶段，2026-04-29）─────────────────
// 仅供 moveAlongRoad 内部使用，**不**导出。设计原则：
//   - 入参纯函数 / 局部读库不跨语义，便于将主体函数从 ~870 行降到可阅读的骨架；
//   - 所有 helper 失败统一返回 `{ ok: false, status, error }`，主流程一行 `if (!r.ok) return r;`；
//   - 不改任何外部行为：移格规则、错误文案、HTTP 码、扣费口径全部沿用旧实现。

/**
 * 移格请求入参校验。
 * @param {string} playerId
 * @param {Object} body
 * @returns {{ ok:true, pid:string, season:string, junId:string, clientRequestId:string } | { ok:false, status:number, error:string }}
 */
function validateMoveAlongRoadInput(playerId, body) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };
  if (body?.confirmFoodCost !== true) {
    return { ok: false, status: 400, error: '缺少 confirmFoodCost=true（与 31-6 §9.1 强制确认一致）' };
  }
  const season = String(body.season || '').trim();
  const junId = String(body.junId || '').trim();
  if (!season || !junId) return { ok: false, status: 400, error: '缺少 season / junId' };
  const clientRequestId = String(body.clientRequestId || '').trim();
  if (!clientRequestId) return { ok: false, status: 400, error: '缺少 clientRequestId' };
  return { ok: true, pid, season, junId, clientRequestId };
}

/**
 * 同 `clientRequestId` 复发：commit 当前事务，重读最新玩家状态后拼接幂等返回包。
 *
 * 抽出原因：原内联块约 25 行（再查 SELECT + commit + 组装 snapshot），与主流程的 trap / 路径解算 /
 * 逐格落脚之间没有依赖；抽出后主体一行 `return await commitIdempotentMoveSnapshot(...)` 即可。
 *
 * @param {import('mysql2/promise').PoolConnection} conn 已经在事务中
 * @param {import('mysql2/promise').Pool|null} pool2 仅当外层在 commit 后还需读最新行时使用；当前实现内联读已经在 commit 前做完，故 pool2 暂不需要
 * @param {string} pid
 * @param {Object} player FOR UPDATE 取出的当前行
 * @param {string} clientRequestId
 * @param {Array<{x:number,y:number}>} bodyPath body.path（可空）
 * @returns {Promise<{ ok:true, data:object }>}
 */
async function commitIdempotentMoveSnapshot(conn, pid, player, clientRequestId, bodyPath) {
  const [again] = await conn.query(
    `SELECT road_jun_id, road_position_x, road_position_y, road_intercept, road_updated_at,
            food, road_move_free_used, road_reserve_used
       FROM players WHERE player_id = ?`,
    [pid],
  );
  await conn.commit();
  const p2 = again[0] || player;
  const idemPath = Array.isArray(bodyPath) && bodyPath.length ? bodyPath : [];
  return {
    ok: true,
    data: {
      ...buildPlayerRoadSnapshot(p2),
      food: Number(p2.food) || 0,
      idempotent: true,
      path: idemPath,
      stepsApplied: idemPath.length,
      costFood: 0,
      costFreeSteps: 0,
      costReserveFood: 0,
      encounter: null,
    },
  };
}

/**
 * 当日免费格 / 势力池粮草使用预算。
 * 纯函数：根据玩家当前状态 + 本次步数，算出免费抵扣 / 个人粮 / 势力池三段如何瓜分。
 * **不**做合法性判断（势力池是否足够留给 `assertFactionReserveFoodSufficient`）。
 *
 * 同时返回 `freeDateStr` / `reserveDateStr`（与 today 比对的 ISO 日期），
 * 用于主流程在二次扣费场景下"今天才使用过 → 累加上去；非今天 → 从 0 重置"的判断口径，
 * 与重构前的内联实现完全一致。
 *
 * @returns {{
 *   todayStr: string,
 *   freeDateStr: string|null,
 *   reserveDateStr: string|null,
 *   freeUsed: number,
 *   reserveUsed: number,
 *   usedFreeThisMove: number,
 *   paidSteps: number,
 *   totalFoodCost: number,
 *   playerFoodUse: number,
 *   reserveFoodUse: number,
 * }}
 */
function computeMoveFoodPlan(player, stepsCount) {
  const today = new Date();
  const todayStr =
    `${today.getFullYear()}-` +
    `${String(today.getMonth() + 1).padStart(2, '0')}-` +
    `${String(today.getDate()).padStart(2, '0')}`;
  const freeDateStr = player.road_move_free_date
    ? new Date(player.road_move_free_date).toISOString().slice(0, 10)
    : null;
  const reserveDateStr = player.road_reserve_date
    ? new Date(player.road_reserve_date).toISOString().slice(0, 10)
    : null;
  const freeUsed = freeDateStr === todayStr ? Number(player.road_move_free_used) || 0 : 0;
  const reserveUsed = reserveDateStr === todayStr ? Number(player.road_reserve_used) || 0 : 0;
  let freeRemaining = Math.max(0, FREE_MOVES_PER_DAY - freeUsed);

  let usedFreeThisMove = 0;
  let paidSteps = 0;
  for (let i = 0; i < stepsCount; i++) {
    if (freeRemaining > 0) {
      freeRemaining--;
      usedFreeThisMove++;
    } else {
      paidSteps++;
    }
  }
  const totalFoodCost = paidSteps * FOOD_PER_STEP;
  const playerFoodUse = Math.min(totalFoodCost, Number(player.food) || 0);
  const reserveFoodUse = totalFoodCost - playerFoodUse;
  return {
    todayStr,
    freeDateStr,
    reserveDateStr,
    freeUsed,
    reserveUsed,
    usedFreeThisMove,
    paidSteps,
    totalFoodCost,
    playerFoodUse,
    reserveFoodUse,
  };
}

/**
 * 仅当本次需从势力池垫粮时，对 `factions.reserve_food` 行加锁并校验是否足量。
 * 不写入；后续真正扣减仍由主流程在同事务内执行（保留与库存档号一致的写动作）。
 *
 * @returns {Promise<{ ok:true } | { ok:false, status:number, error:string }>}
 */
async function assertFactionReserveFoodSufficient(conn, factionId, reserveFoodUse) {
  if (reserveFoodUse <= 0) return { ok: true };
  const [fRows] = await conn.query(
    `SELECT id, reserve_food FROM factions WHERE id = ? FOR UPDATE`,
    [factionId],
  );
  const faction = fRows[0];
  if (!faction) {
    return { ok: false, status: 500, error: '玩家势力不存在，无法从势力池扣粮' };
  }
  if ((Number(faction.reserve_food) || 0) < reserveFoodUse) {
    return {
      ok: false,
      status: 409,
      error: `势力粮草储备不足（需 ${reserveFoodUse}、现 ${faction.reserve_food}）`,
    };
  }
  return { ok: true };
}

// ── 沿路移动 ──────────────────────────────────────────────────────────────────
async function moveAlongRoad(playerId, body) {
  const inputCheck = validateMoveAlongRoadInput(playerId, body);
  if (!inputCheck.ok) return inputCheck;
  const { pid, season, junId, clientRequestId } = inputCheck;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [pRows] = await conn.query(
      `SELECT player_id, faction_id, silver, food, main_city_id,
              road_jun_id, road_position_x, road_position_y, road_intercept, road_updated_at,
              road_reserve_date, road_reserve_used,
              road_move_free_date, road_move_free_used,
              road_last_request_id
         FROM players WHERE player_id = ? FOR UPDATE`,
      [pid],
    );
    const player = pRows[0];
    if (!player) {
      await conn.rollback();
      return { ok: false, status: 404, error: '玩家不存在' };
    }

    if (String(player.road_jun_id || '').trim() !== junId) {
      await conn.rollback();
      return { ok: false, status: 400, error: 'junId 须与当前 road_jun_id 一致' };
    }

    let grid = null;
    if (isSan1YuStackRoadJunId(player.road_jun_id)) {
      grid = await loadRoadGridSan1YuVerticalStack(season);
    }
    if (!grid || grid.source === 'none' || !grid.cells.size) {
      grid = await loadRoadGrid(season, junId);
    }
    if (grid.source === 'none' || !grid.cells.size) {
      await conn.rollback();
      return { ok: false, status: 400, error: `郡 ${junId} 缺少道路栅格数据（merged.json 未生成或无 roadCells）` };
    }
    const useStackGrid = !!grid.isSan1YuVerticalStack;
    const stackMod = useStackGrid ? await getStrategicStackModule() : null;

    let countyCityRows;
    if (useStackGrid && Array.isArray(grid.stackJunIds) && grid.stackJunIds.length >= 2) {
      const [ccRows] = await conn.query(
        `SELECT city_id, city_type, position_x, position_y, faction_id, jun_id
           FROM cities WHERE season = ? AND jun_id IN (?, ?)`,
        [season, grid.stackJunIds[0], grid.stackJunIds[1]],
      );
      countyCityRows = ccRows;
    } else {
      const [ccRows] = await conn.query(
        `SELECT city_id, city_type, position_x, position_y, faction_id, jun_id
           FROM cities WHERE jun_id = ? AND season = ?`,
        [junId, season],
      );
      countyCityRows = ccRows;
    }
    const mainCityDbRow =
      player.main_city_id != null && String(player.main_city_id).trim() !== ''
        ? countyCityRows.find((r) => String(r.city_id) === String(player.main_city_id)) || null
        : null;

    // 幂等：已处理过同一请求 id → 返回当前快照，不重复扣费 / 移格。
    if (player.road_last_request_id && player.road_last_request_id === clientRequestId) {
      return await commitIdempotentMoveSnapshot(conn, pid, player, clientRequestId, body.path);
    }

    const roadPassableForMarch = marchPoi.buildRoadPassableKeySetForMarch(
      grid.roadCellsRaw || [],
      grid.rawCells,
      grid.mapColumns,
      grid.mapRows,
    );

    const targetPoiIdRaw = body.targetPoiId != null ? String(body.targetPoiId).trim() : '';
    const marchToBanditPoi = !!targetPoiIdRaw && marchPoi.isBanditMapObjectId(targetPoiIdRaw);
    let resolvedPath = [];
    let poiAnchorEnd = null;
    let poiAnchorJunIdEnd = null;

    if (targetPoiIdRaw) {
      /** 匪寨 `san_*_bandit_*` 与 `cities` 表拆库拆语义；寻路 footprint 来自合并图 `cells`，不得强依赖 `cities` 行。 */
      let cityRow = null;
      if (!marchPoi.isBanditMapObjectId(targetPoiIdRaw)) {
        const [cRows] = await conn.query(
          `SELECT city_id AS cityId, city_type AS cityType, faction_id AS factionId,
                  position_x AS positionX, position_y AS positionY, jun_id AS junId
             FROM cities WHERE city_id = ? LIMIT 1`,
          [targetPoiIdRaw],
        );
        if (!cRows.length) {
          await conn.rollback();
          return { ok: false, status: 404, error: '目标战略点不存在' };
        }
        cityRow = cRows[0];
      }
      const acc = marchPoi.canPlayerMarchToPoiCity({
        cityRow,
        targetPoiId: targetPoiIdRaw,
        playerFactionId: player.faction_id,
      });
      if (!acc.ok) {
        await conn.rollback();
        return { ok: false, status: 403, error: acc.error };
      }
      // POI 最短路按全道路网；途经敌对占格在逐步落脚时触发遭遇（与客户端预览一致）。
      const built = marchPoi.buildMarchPathToStrategicPoi({
        cells: grid.rawCells,
        roadCells: grid.roadCellsRaw || [],
        mapColumns: grid.mapColumns,
        mapRows: grid.mapRows,
        countyJunId: junId,
        player,
        targetPoiId: targetPoiIdRaw,
        collectMainCityFootprintKeys: (cells, mainId) =>
          findMainCityFootprint(cells, mainId, grid.mapColumns, grid.mapRows),
        targetCityDbRow: cityRow,
        mainCityDbRow,
        citiesInCountyRows: countyCityRows,
        useWorldStackRoadCoords: useStackGrid,
      });
      if (!built.ok) {
        await conn.rollback();
        return { ok: false, status: 400, error: built.error };
      }
      resolvedPath = built.path;
      poiAnchorEnd = built.poiAnchor || null;
      poiAnchorJunIdEnd = built.poiAnchorJunId || null;
    } else {
      const clientPath = Array.isArray(body.path) ? body.path : [];
      const clientShapeErr = validatePathShape(clientPath);
      if (clientShapeErr) {
        await conn.rollback();
        return { ok: false, status: 400, error: clientShapeErr };
      }
      const last = clientPath[clientPath.length - 1];
      const endX = toInt(last.x);
      const endY = toInt(last.y);
      const endKey = cellKey(endX, endY);
      if (!roadPassableForMarch.has(endKey)) {
        await conn.rollback();
        return { ok: false, status: 400, error: '终点不在可通行道路格（或位于战略对象占格）' };
      }

      const sx0 = toInt(player.road_position_x);
      const sy0 = toInt(player.road_position_y);
      const sy0World =
        useStackGrid && stackMod && sx0 != null && sy0 != null && player.road_jun_id
          ? stackMod.stackWorldGyFromLocalJunRow(String(player.road_jun_id).trim(), sy0)
          : sy0;
      const startKeyIfRoad =
        sx0 != null && sy0 != null && player.road_jun_id === junId ? cellKey(sx0, sy0World) : null;
      const onRoadForBfs = startKeyIfRoad != null && roadPassableForMarch.has(startKeyIfRoad);

      let bfsPath = null;
      if (onRoadForBfs) {
        bfsPath = marchPoi.bfsShortestPathRoad(
          roadPassableForMarch,
          startKeyIfRoad,
          endKey,
          grid.mapColumns,
          grid.mapRows,
        );
      } else {
        const footprint = marchPoi.resolveOffRoadMarchDepartureFootprintKeys(
          grid.rawCells,
          player,
          junId,
          grid.mapColumns,
          grid.mapRows,
          (cells, mainId) => findMainCityFootprint(cells, mainId, grid.mapColumns, grid.mapRows),
          { mainCityDbRow, citiesInCountyRows: countyCityRows },
          useStackGrid,
        );
        if (!footprint.size) {
          await conn.rollback();
          return { ok: false, status: 400, error: '未设置主城或不在可识别的城/寨占格上，无法起步' };
        }
        const starts = marchPoi.roadKeysAdjacentToFootprint(footprint, roadPassableForMarch);
        if (!starts.size) {
          await conn.rollback();
          return { ok: false, status: 400, error: '出发地旁没有可通行的道路格' };
        }
        bfsPath = marchPoi.multiSourceBfsShortestRoad(
          roadPassableForMarch,
          starts,
          endKey,
          grid.mapColumns,
          grid.mapRows,
        );
      }
      if (!bfsPath?.length) {
        await conn.rollback();
        return { ok: false, status: 400, error: '无法沿道路到达目标道路格' };
      }
      resolvedPath = bfsPath;
    }

    const pathShapeErr = validatePathShape(resolvedPath);
    if (pathShapeErr) {
      await conn.rollback();
      return { ok: false, status: 400, error: pathShapeErr };
    }

    // 解算起点：path[0] 必须等于当前 road_position（若已在可通行道路格上），
    // 或当 player 未在路上时为城/寨块邻接的道路格（与 BFS 首格一致）。
    const startX = toInt(player.road_position_x);
    const startY = toInt(player.road_position_y);
    const startYWorld =
      useStackGrid && stackMod && startX != null && startY != null && player.road_jun_id
        ? stackMod.stackWorldGyFromLocalJunRow(String(player.road_jun_id).trim(), startY)
        : startY;
    const startKey =
      startX != null && startY != null && player.road_jun_id === junId
        ? cellKey(startX, startYWorld)
        : null;
    const onRoad = startKey != null && roadPassableForMarch.has(startKey);

    const first = resolvedPath[0];
    const firstX = toInt(first.x);
    const firstY = toInt(first.y);
    if (!roadPassableForMarch.has(cellKey(firstX, firstY))) {
      await conn.rollback();
      return { ok: false, status: 400, error: `起点 (${firstX},${firstY}) 非可通行道路格` };
    }

    if (onRoad) {
      if (firstX !== startX || firstY !== startYWorld) {
        await conn.rollback();
        return {
          ok: false,
          status: 400,
          error: `路径起点须为当前道路位置 (${startX},${startY})`,
        };
      }
    } else {
      // 首跳：道路格须 4-邻接 **当前离路所占城/寨块**（优先 `road_position` 所在 POI）或 **主城块**（回退）。
      const footprint = marchPoi.resolveOffRoadMarchDepartureFootprintKeys(
        grid.rawCells,
        player,
        junId,
        grid.mapColumns,
        grid.mapRows,
        (cells, mainId) => findMainCityFootprint(cells, mainId, grid.mapColumns, grid.mapRows),
        { mainCityDbRow, citiesInCountyRows: countyCityRows },
        useStackGrid,
      );
      if (!footprint.size) {
        await conn.rollback();
        return { ok: false, status: 400, error: '未设置主城或不在可识别的城/寨占格上，无法起步' };
      }
      let adjacent = false;
      for (const k of footprint) {
        const [kx, ky] = k.split(',').map(Number);
        if (isNeighbor4(kx, ky, firstX, firstY)) {
          adjacent = true;
          break;
        }
      }
      if (!adjacent) {
        await conn.rollback();
        return { ok: false, status: 400, error: '首跳须为出发城/寨邻接的道路格' };
      }
    }

    // 道路可通行集（已扣 2×2 战略对象占格）：逐步
    for (const step of resolvedPath) {
      const sx = toInt(step.x);
      const sy = toInt(step.y);
      if (!roadPassableForMarch.has(cellKey(sx, sy))) {
        await conn.rollback();
        return { ok: false, status: 400, error: `(${sx},${sy}) 非可通行道路格` };
      }
    }

    // ── 逐格落脚：占格锁 + 友敌判定 + 粮草扣减 ──
    // 路径第一格若已在其上（onRoad 且等于起点），不重复付出代价；后续每一格都算一步。
    const steps = onRoad ? resolvedPath.slice(1) : resolvedPath.slice(); // 首跳（未上路）仍计一格

    // 先清本格幽灵遭遇，避免「B 仍站着、库里有 fighting 但攻方已不在格」→ A 途经 B 格被误拦或守方被误锁
    if (onRoad && startX != null && startY != null) {
      await resolveStaleRoadEncountersAtCell(conn, season, junId, startX, startY);
      await resolveAbandonedRoadFightOnCellIfOpponentOffline(conn, season, junId, startX, startY, pid);
    }

    // 遭遇进行中：**攻防任一方**均不可离开交战格，直至 `road_encounters` 为 `resolved`（守方遇袭 / 观战口径不变）。
    if (steps.length && onRoad && startX != null && startY != null && String(player.road_jun_id || '').trim() === String(junId).trim()) {
      const [trapRows] = await conn.query(
        `SELECT encounter_id, position_x, position_y
           FROM road_encounters
          WHERE status = 'fighting' AND season = ? AND jun_id = ?
            AND position_x = ? AND position_y = ?
            AND (attacker_player_id = ? OR defender_player_id = ?)
          LIMIT 1`,
        [season, junId, startX, startY, pid, pid],
      );
      if (trapRows.length) {
        const tr = trapRows[0];
        const ex = toInt(tr.position_x);
        const ey = toInt(tr.position_y);
        let leavesCell = false;
        for (const step of steps) {
          const sx = toInt(step.x);
          const sy = toInt(step.y);
          if (!useStackGrid) {
            if (sx !== ex || sy !== ey) {
              leavesCell = true;
              break;
            }
          } else if (stackMod) {
            const loc = stackMod.stackLocalJunRowFromWorldGy(sy);
            if (!loc || loc.junId !== junId || sx !== ex || loc.localGy !== ey) {
              leavesCell = true;
              break;
            }
          }
        }
        if (leavesCell) {
          await conn.rollback();
          return {
            ok: false,
            status: 409,
            error: '道路遭遇进行中，本场结束前不可离开交战格（若已收到遇袭提示，可点「确定」进场观战）',
          };
        }
      }
    }

    if (!steps.length) {
      const axSnap = poiAnchorEnd != null ? toInt(poiAnchorEnd.x) : null;
      const aySnap = poiAnchorEnd != null ? toInt(poiAnchorEnd.y) : null;
      const canPoiSnapFromAdjRoad =
        !!targetPoiIdRaw &&
        poiAnchorEnd != null &&
        Number.isFinite(axSnap) &&
        Number.isFinite(aySnap) &&
        onRoad &&
        startX != null &&
        startY != null &&
        String(player.road_jun_id || '').trim() === String(junId).trim() &&
        resolvedPath.length === 1 &&
        toInt(resolvedPath[0].x) === startX &&
        toInt(resolvedPath[0].y) === startYWorld;

      if (canPoiSnapFromAdjRoad) {
        const [trapRows0] = await conn.query(
          `SELECT encounter_id, position_x, position_y
             FROM road_encounters
            WHERE status = 'fighting' AND season = ? AND jun_id = ?
              AND position_x = ? AND position_y = ?
              AND (attacker_player_id = ? OR defender_player_id = ?)
            LIMIT 1`,
          [season, junId, startX, startY, pid, pid],
        );
        if (trapRows0.length) {
          await conn.rollback();
          return {
            ok: false,
            status: 409,
            error:
              '道路遭遇进行中，本场结束前不可离开交战格（若已收到遇袭提示，可点「确定」进场观战）',
          };
        }
        await resolveStaleRoadEncountersAtCell(conn, season, junId, startX, startY);
        await resolveAbandonedRoadFightOnCellIfOpponentOffline(conn, season, junId, startX, startY, pid);

        /** 叠放图：贴城锚格坐标为郡内本地格，条带须与当前立足道路一致；勿盲信可能滞后的 `poiAnchorJunIdEnd`（库 `cities.jun_id` 与路径终点条带不一致时会写错郡）。 */
        const snapJun =
          useStackGrid && stackMod ? String(junId).trim() : poiAnchorJunIdEnd || junId;
        await conn.query(
          `UPDATE players SET road_last_request_id = ?, road_jun_id = ?, road_position_x = ?, road_position_y = ?, road_updated_at = NOW() WHERE player_id = ?`,
          [clientRequestId, snapJun, axSnap, aySnap, pid],
        );
        await conn.commit();
        const [finalRowsSnap] = await pool.query(
          `SELECT food, road_jun_id, road_position_x, road_position_y, road_intercept, road_updated_at,
                  road_move_free_used, road_reserve_used
             FROM players WHERE player_id = ?`,
          [pid],
        );
        const finSnap = finalRowsSnap[0] || {};
        return {
          ok: true,
          data: {
            ...buildPlayerRoadSnapshot(finSnap),
            food: Number(finSnap.food) || 0,
            idempotent: false,
            path: resolvedPath,
            stepsApplied: 0,
            poiAnchor: poiAnchorEnd,
            targetPoiId: targetPoiIdRaw,
            costFood: 0,
            costFreeSteps: 0,
            costReserveFood: 0,
            encounter: null,
            defenderAutoRetreats: [],
          },
        };
      }

      // 等价于原地路径；为避免扣费又告知起点一致，直接视为 noop 幂等成功。
      await conn.query(`UPDATE players SET road_last_request_id = ? WHERE player_id = ?`, [clientRequestId, pid]);
      await conn.commit();
      return {
        ok: true,
        data: {
          ...buildPlayerRoadSnapshot(player),
          idempotent: false,
          path: resolvedPath,
          stepsApplied: 0,
          costFood: 0,
          costFreeSteps: 0,
          costReserveFood: 0,
          encounter: null,
        },
      };
    }

    // 今日免费格重置（与 attr_reroll 同型）
    const foodPlan = computeMoveFoodPlan(player, steps.length);
    const { todayStr, freeDateStr, reserveDateStr, freeUsed, reserveUsed, paidSteps, totalFoodCost } = foodPlan;
    let { usedFreeThisMove, playerFoodUse, reserveFoodUse } = foodPlan;
    const reserveRemaining = Math.max(0, RESERVE_FOOD_DAILY_LIMIT - reserveUsed);

    if (reserveFoodUse > reserveRemaining) {
      await conn.rollback();
      return { ok: false, status: 409, error: `粮草不足且势力池垫粮将超当日 500 粮上限（还差 ${reserveFoodUse - reserveRemaining}）` };
    }

    const reserveCheck = await assertFactionReserveFoodSufficient(conn, player.faction_id, reserveFoodUse);
    if (!reserveCheck.ok) {
      await conn.rollback();
      return reserveCheck;
    }

    // 逐格落脚 — 在事务内对每个候选格做 SELECT FOR UPDATE 锁检查（road_encounters + 占格玩家）。
    const retreatGridByJun = new Map();
    const loadRetreatGrid = async (jid) => {
      const j = String(jid || '').trim();
      if (!j) return grid;
      if (retreatGridByJun.has(j)) return retreatGridByJun.get(j);
      const g = await loadRoadGrid(season, j);
      retreatGridByJun.set(j, g);
      return g;
    };
    const cityRowsForJun = (j) =>
      (countyCityRows || []).filter((r) => String(r.jun_id ?? r.junId ?? '') === String(j));

    const startWalkWy =
      useStackGrid && stackMod && onRoad && startX != null && startY != null && player.road_jun_id
        ? stackMod.stackWorldGyFromLocalJunRow(String(player.road_jun_id).trim(), startY)
        : startY;
    let lastX = onRoad ? startX : null;
    let lastY = onRoad ? startWalkWy : null;
    let encounter = null;
    let stepsApplied = 0;
    /** @type {Array<{ defenderPlayerId: string, retreatX?: number, retreatY?: number, reason?: string }>} */
    const defenderAutoRetreats = [];

    for (let i = 0; i < steps.length; i++) {
      const wsx = toInt(steps[i].x);
      const wsy = toInt(steps[i].y);
      const locStep = useStackGrid && stackMod ? stackMod.stackLocalJunRowFromWorldGy(wsy) : null;
      const stepJun = locStep ? locStep.junId : junId;
      const stepPy = locStep ? locStep.localGy : wsy;
      const stepPx = wsx;

      // 与前一格的邻接：若 onRoad，则 lastX/Y 为当前；否则 first 是 lastX=null，首跳不要求与 lastX 相邻（已在主城邻接校验过）。
      if (lastX != null && lastY != null) {
        if (!isNeighbor4(lastX, lastY, wsx, wsy)) {
          await conn.rollback();
          return { ok: false, status: 400, error: `(${lastX},${lastY}) → (${wsx},${wsy}) 非相邻` };
        }
      }

      await resolveStaleRoadEncountersAtCell(conn, season, stepJun, stepPx, stepPy);
      await resolveAbandonedRoadFightOnCellIfOpponentOffline(conn, season, stepJun, stepPx, stepPy, pid);

      // 1) 交战登记格：非攻防双方 **不得以本格为本次道路段最后一步**；过境（同请求内后续仍有道路步）不拦。与 `road_intercept` 无关。
      const [lockRows] = await conn.query(
        `SELECT encounter_id, attacker_player_id, defender_player_id
           FROM road_encounters
          WHERE season = ? AND jun_id = ? AND position_x = ? AND position_y = ?
            AND status IN ('pending','fighting')
          FOR UPDATE`,
        [season, stepJun, stepPx, stepPy],
      );
      let skipHostileBecauseEncounterTransit = false;
      if (lockRows.length) {
        const lr = lockRows[0];
        const lockMeta = {
          attackerPlayerId: lr.attacker_player_id,
          defenderPlayerId: lr.defender_player_id,
        };
        const isParticipant = isPlayerRoadEncounterParticipant(lockMeta, pid);
        if (!isParticipant) {
          if (isNonParticipantFinalRoadStepOntoEncounter(i, steps.length)) {
            await conn.rollback();
            return {
              ok: false,
              status: 409,
              error: `(${sx},${sy}) 道路交战进行中，不可将该格作为本次行军道路终点`,
            };
          }
          skipHostileBecauseEncounterTransit = true;
        }
      }

      // 2) 同格玩家（与 `getRoadPresence` 一致：仅「近期活跃」账号算占格；久未活跃敌对先自动退让，避免离线叠坐标假遭遇 / 409）
      const onlineSec = Math.ceil(DEFAULT_ONLINE_MS / 1000);
      const [ghostRows] = await conn.query(
        `SELECT p.player_id, p.faction_id
           FROM players p
           INNER JOIN accounts a ON a.id = p.player_id
          WHERE p.road_jun_id = ? AND p.road_position_x = ? AND p.road_position_y = ?
            AND p.player_id <> ?
            AND GREATEST(COALESCE(UNIX_TIMESTAMP(p.last_active_at), 0),
                          COALESCE(UNIX_TIMESTAMP(a.lastActiveAt), 0)) <= UNIX_TIMESTAMP(NOW()) - ?
          ORDER BY p.player_id
          FOR UPDATE`,
        [stepJun, stepPx, stepPy, pid, onlineSec],
      );
      for (const gr of ghostRows) {
        if (!isHostileByFaction(player.faction_id, gr.faction_id)) continue;
        // eslint-disable-next-line no-await-in-loop
        const ret = await applyFactionPlayerRoadRetreat(conn, {
          junId: stepJun,
          grid: await loadRetreatGrid(stepJun),
          countyCityRows: cityRowsForJun(stepJun).length ? cityRowsForJun(stepJun) : countyCityRows,
          playerId: gr.player_id,
          fromX: stepPx,
          fromY: stepPy,
          noticeText: buildRoadGateFailRetreatNotice('道路坐标久未活跃，已自动退让'),
        });
        if (ret.ok) {
          defenderAutoRetreats.push({
            defenderPlayerId: String(gr.player_id),
            retreatX: ret.retreatX,
            retreatY: ret.retreatY,
            retreatCityId: ret.retreatCityId || undefined,
            reason: '道路坐标久未活跃',
          });
        }
      }

      const [occRows] = await conn.query(
        `SELECT p.player_id, p.faction_id, p.road_intercept
           FROM players p
           INNER JOIN accounts a ON a.id = p.player_id
          WHERE p.road_jun_id = ? AND p.road_position_x = ? AND p.road_position_y = ?
            AND p.player_id <> ?
            AND GREATEST(COALESCE(UNIX_TIMESTAMP(p.last_active_at), 0),
                          COALESCE(UNIX_TIMESTAMP(a.lastActiveAt), 0)) > UNIX_TIMESTAMP(NOW()) - ?
          ORDER BY p.player_id
          FOR UPDATE`,
        [stepJun, stepPx, stepPy, pid, onlineSec],
      );
      if (occRows.length) {
        if (skipHostileBecauseEncounterTransit) {
          lastX = wsx;
          lastY = wsy;
          stepsApplied = i + 1;
          continue;
        }
        /** 行军目标为战略匪寨时：最后一道路步不登记道路遭遇（与 31-6 / 17-6 一致；遭遇仅道路格常规规则）。 */
        if (marchToBanditPoi && i === steps.length - 1) {
          lastX = wsx;
          lastY = wsy;
          stepsApplied = i + 1;
          continue;
        }
        let defender = null;
        for (const row of occRows) {
          if (isHostileByFaction(player.faction_id, row.faction_id)) {
            defender = row;
            break;
          }
        }
        if (!defender) {
          // 格上仅有非敌对玩家（M2：同势力等）：允许同格叠站，继续走后续路径。
          lastX = wsx;
          lastY = wsy;
          stepsApplied = i + 1;
          continue;
        }
        const other = defender;
        const atkGate = await garrisonService.validateMainLineupBattleGateOnConn(conn, pid);
        if (!atkGate.ok) {
          await conn.rollback();
          return {
            ok: false,
            status: 409,
            error: `无法进入与敌对玩家相同的道路格：${atkGate.error}（须先满足道路开战兵力与粮草要求）`,
          };
        }
        const [defLockRows] = await conn.query(
          `SELECT player_id, faction_id, main_city_id FROM players WHERE player_id = ? FOR UPDATE`,
          [other.player_id],
        );
        const defRow = defLockRows[0];
        if (!defRow) {
          await conn.rollback();
          return { ok: false, status: 500, error: '防守方档案不存在' };
        }
        const gate = await garrisonService.validateMainLineupBattleGateOnConn(conn, other.player_id);
        if (!gate.ok) {
          const ret = await applyFactionPlayerRoadRetreat(conn, {
            junId: stepJun,
            grid: await loadRetreatGrid(stepJun),
            countyCityRows: cityRowsForJun(stepJun).length ? cityRowsForJun(stepJun) : countyCityRows,
            playerId: other.player_id,
            fromX: stepPx,
            fromY: stepPy,
            noticeText: buildRoadGateFailRetreatNotice(gate.error),
          });
          if (!ret.ok) {
            await conn.rollback();
            return {
              ok: false,
              status: 409,
              error:
                '对格玩家未满足开战兵力/粮草要求，且本郡内没有可解析的己方城池锚格（请确认地图与城池归属数据），本次行军无法进入该格',
            };
          }
          defenderAutoRetreats.push({
            defenderPlayerId: String(other.player_id),
            retreatX: ret.retreatX,
            retreatY: ret.retreatY,
            retreatCityId: ret.retreatCityId || undefined,
            reason: gate.error || '未满足开战条件',
          });
          lastX = wsx;
          lastY = wsy;
          stepsApplied = i + 1;
          continue;
        }
        // 敌对且守方满足开战门闸 → 登记遭遇（status='fighting'），攻方落脚到该格，后续 steps 中断。
        const encounterId = newEncounterId(stepJun);
        // 守门方：仅当格上防守方处于开战模式时记入 gatekeeper（31-6 §五）；其余敌对遭遇 gatekeeper 置空。
        const gatekeeperId = other.road_intercept ? other.player_id : null;
        await conn.query(
          `INSERT INTO road_encounters
              (encounter_id, season, jun_id, position_x, position_y,
               attacker_player_id, defender_player_id, gatekeeper_player_id,
               status, started_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'fighting', NOW())`,
          [encounterId, season, stepJun, stepPx, stepPy, pid, other.player_id, gatekeeperId],
        );
        encounter = {
          encounterId,
          season,
          junId: stepJun,
          positionX: stepPx,
          positionY: stepPy,
          attackerPlayerId: pid,
          defenderPlayerId: other.player_id,
          gatekeeperPlayerId: gatekeeperId,
          status: 'fighting',
        };
        lastX = wsx;
        lastY = wsy;
        stepsApplied = i + 1;
        break;
      }

      lastX = wsx;
      lastY = wsy;
      stepsApplied = i + 1;
    }

    let appliedPoiSnap = false;
    if (poiAnchorEnd && lastX != null && lastY != null && !encounter && stepsApplied === steps.length) {
      lastX = poiAnchorEnd.x;
      lastY = poiAnchorEnd.y;
      appliedPoiSnap = true;
    }

    let destRoadJunId = junId;
    let destPx = lastX;
    let destPy = lastY;
    if (appliedPoiSnap) {
      /** 路径最后一格世界行 → 条带：与 BFS 终点一致，优先于 `poiAnchorJunIdEnd`（避免库 jun 与合并图不一致导致「颍川 id + 汝南格」）。 */
      let pathEndJunId = null;
      if (useStackGrid && stackMod && Array.isArray(resolvedPath) && resolvedPath.length) {
        const wy = toInt(resolvedPath[resolvedPath.length - 1]?.y);
        const zEnd = stackMod.stackLocalJunRowFromWorldGy(wy);
        if (zEnd?.junId) pathEndJunId = zEnd.junId;
      }
      if (pathEndJunId) destRoadJunId = pathEndJunId;
      else if (poiAnchorJunIdEnd) destRoadJunId = poiAnchorJunIdEnd;
    } else if (useStackGrid && stackMod && destPx != null && destPy != null) {
      const z = stackMod.stackLocalJunRowFromWorldGy(destPy);
      if (z) {
        destRoadJunId = z.junId;
        destPy = z.localGy;
      }
    }

    // 若中途遇敌停下，只对已走过的 steps 扣粮草 / 免费格；重新按 stepsApplied 结算
    if (stepsApplied < steps.length) {
      let free2 = 0;
      let paid2 = 0;
      let freeLeft = Math.max(0, FREE_MOVES_PER_DAY - (freeDateStr === todayStr ? (Number(player.road_move_free_used) || 0) : 0));
      for (let i = 0; i < stepsApplied; i++) {
        if (freeLeft > 0) { freeLeft--; free2++; } else { paid2++; }
      }
      usedFreeThisMove = free2;
      const cost = paid2 * FOOD_PER_STEP;
      playerFoodUse = Math.min(cost, Number(player.food) || 0);
      reserveFoodUse = cost - playerFoodUse;
    }

    // 写 players 位置 / 日累计 / 粮草
    await conn.query(
      `UPDATE players
          SET food = food - ?,
              road_jun_id = ?,
              road_position_x = ?,
              road_position_y = ?,
              road_updated_at = NOW(),
              road_move_free_date = ?,
              road_move_free_used = ?,
              road_reserve_date = ?,
              road_reserve_used = ?,
              road_last_request_id = ?
        WHERE player_id = ?`,
      [
        playerFoodUse,
        destRoadJunId,
        destPx,
        destPy,
        todayStr,
        (freeDateStr === todayStr ? (Number(player.road_move_free_used) || 0) : 0) + usedFreeThisMove,
        todayStr,
        (reserveDateStr === todayStr ? (Number(player.road_reserve_used) || 0) : 0) + reserveFoodUse,
        clientRequestId,
        pid,
      ],
    );

    if (reserveFoodUse > 0) {
      await conn.query(
        `UPDATE factions SET reserve_food = reserve_food - ? WHERE id = ?`,
        [reserveFoodUse, player.faction_id],
      );
    }

    await conn.commit();

    if (playerFoodUse > 0) {
      try {
        await statisticsDeltaService.incrementSpent(pid, { food: playerFoodUse });
      } catch (_) {}
    }

    const [finalRows] = await pool.query(
      `SELECT food, road_jun_id, road_position_x, road_position_y, road_intercept, road_updated_at
         FROM players WHERE player_id = ?`,
      [pid],
    );
    const fin = finalRows[0] || {};

    return {
      ok: true,
      data: {
        ...buildPlayerRoadSnapshot(fin),
        food: Number(fin.food) || 0,
        path: resolvedPath,
        stepsApplied,
        poiAnchor: poiAnchorEnd || undefined,
        targetPoiId: targetPoiIdRaw || undefined,
        costFood: playerFoodUse,
        costFreeSteps: usedFreeThisMove,
        costReserveFood: reserveFoodUse,
        encounter,
        defenderAutoRetreats,
      },
    };
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    if (/Unknown column/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少道路状态列或势力池列；请执行 add-players-road-state.sql 与 create-road-encounters.sql' };
    }
    if (/road_encounters/i.test(e.message || '') && /doesn't exist/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少 road_encounters 表；请执行 create-road-encounters.sql' };
    }
    console.error('[roadEncounterService] moveAlongRoad', e);
    return { ok: false, status: 500, error: e.message || '沿路移动失败' };
  } finally {
    conn.release();
  }
}

// ── 郡内 presence（仅在线他人 + 锁格） ────────────────────────────────────────
// ── 道路遭遇：开战数据（客户端进 BattleArena）──────────────────────────────────

/**
 * 校验遭遇并返回 BattleArena 用 payload。
 * - 默认：进攻方，npcGarrison = 守方上阵编组。
 * - opts.spectator：防守方观战，npcGarrison = 攻方上阵编组，`skipSiegeResult`+`pvpSiegeRole:'defender'`。
 *
 * @param {string} playerId
 * @param {string} encounterId
 * @param {{ spectator?: boolean }} [opts]
 */
async function getEncounterBattlePayload(playerId, encounterId, opts = {}) {
  const pid = String(playerId || '').trim();
  const eid = String(encounterId || '').trim();
  const spectator = !!opts?.spectator;
  if (!pid || !eid) return { ok: false, status: 400, error: '缺少 playerId / encounterId' };

  try {
    const [encRows] = await pool.query(
      `SELECT encounter_id, status, attacker_player_id, defender_player_id,
              season, jun_id, position_x, position_y, battle_id, started_at
         FROM road_encounters WHERE encounter_id = ?`,
      [eid],
    );
    const enc = encRows[0];
    if (!enc) return { ok: false, status: 404, error: '遭遇实例不存在' };
    const startedMs = enc.started_at ? new Date(enc.started_at).getTime() : NaN;
    const staleMs = STALE_FIGHTING_NO_SETTLEMENT_MINUTES * 60 * 1000;
    const staleNoSettlement =
      enc.status === 'fighting' &&
      (enc.battle_id == null || String(enc.battle_id).trim() === '') &&
      Number.isFinite(startedMs) &&
      Date.now() - startedMs > staleMs;
    if (staleNoSettlement) {
      const [u] = await pool.query(
        `UPDATE road_encounters
            SET status = 'cancelled', ended_at = NOW()
          WHERE encounter_id = ? AND status = 'fighting'`,
        [eid],
      );
      if (u.affectedRows) {
        return {
          ok: false,
          status: 409,
          error: '该道路遭遇因长时间未产生战报已自动作废，可再次沿路移动。',
        };
      }
      const [again] = await pool.query(
        `SELECT status FROM road_encounters WHERE encounter_id = ?`,
        [eid],
      );
      const st = again[0]?.status;
      if (st && st !== 'fighting') {
        return { ok: false, status: 409, error: st === 'resolved' ? '该遭遇已结束' : '遭遇状态不可开战' };
      }
    }
    if (enc.status !== 'fighting') {
      return { ok: false, status: 409, error: enc.status === 'resolved' ? '该遭遇已结束' : '遭遇状态不可开战' };
    }

    if (spectator) {
      if (String(enc.defender_player_id || '').trim() !== pid) {
        return { ok: false, status: 403, error: '仅防守方可观战本场' };
      }
      const [pRows] = await pool.query(
        `SELECT road_jun_id, road_position_x, road_position_y, faction_id
           FROM players WHERE player_id = ?`,
        [pid],
      );
      const pl = pRows[0];
      if (!pl) return { ok: false, status: 404, error: '玩家不存在' };
      const jOk = String(pl.road_jun_id || '').trim() === String(enc.jun_id || '').trim();
      const xOk = toInt(pl.road_position_x) === toInt(enc.position_x);
      const yOk = toInt(pl.road_position_y) === toInt(enc.position_y);
      if (!jOk || !xOk || !yOk) {
        return { ok: false, status: 409, error: '您不在该交战格，无法观战' };
      }

      const attackerId = String(enc.attacker_player_id || '').trim();
      if (!attackerId) return { ok: false, status: 500, error: '遭遇缺少进攻方' };

      const [atkNameRows] = await pool.query(
        'SELECT character_name FROM players WHERE player_id = ?',
        [attackerId],
      );
      const attackerName = atkNameRows[0]?.character_name || '对方';

      const rawAtk = await garrisonService.buildDefenseUnitsFromMainLineup(attackerId);
      if (!rawAtk.length) {
        return { ok: false, status: 409, error: '对方上阵编组暂无可战单位，无法观战' };
      }
      const npcGarrison = garrisonService.mapBuiltUnitsToSiegeNpcFormat(rawAtk);

      return {
        ok: true,
        data: {
          roadEncounterId: eid,
          encounterId: eid,
          cityName: '道路遭遇',
          isPvp: true,
          skipSiegeResult: true,
          pvpSiegeRole: 'defender',
          defenderType: 'pvp_online',
          attackerName,
          attackerPlayerId: attackerId,
          npcGarrison,
          playerFaction: pl.faction_id,
          defenderGarrisonSlot: 0,
        },
      };
    }

    if (String(enc.attacker_player_id || '').trim() !== pid) {
      return { ok: false, status: 403, error: '仅进攻方可进入本场战斗' };
    }

    const defenderId = String(enc.defender_player_id || '').trim();
    if (!defenderId) return { ok: false, status: 500, error: '遭遇缺少防守方' };

    const [atkRows] = await pool.query('SELECT faction_id FROM players WHERE player_id = ?', [pid]);
    if (!atkRows.length) return { ok: false, status: 404, error: '玩家不存在' };
    const playerFaction = atkRows[0].faction_id;

    const [defNameRows] = await pool.query(
      'SELECT character_name FROM players WHERE player_id = ?',
      [defenderId],
    );
    const defenderName = defNameRows[0]?.character_name || '敌方';

    const rawUnits = await garrisonService.buildDefenseUnitsFromMainLineup(defenderId);
    if (!rawUnits.length) {
      return { ok: false, status: 409, error: '对方上阵编组无可战部队，无法开战' };
    }
    const npcGarrison = garrisonService.mapBuiltUnitsToSiegeNpcFormat(rawUnits);

    return {
      ok: true,
      data: {
        roadEncounterId: eid,
        encounterId: eid,
        cityName: '道路遭遇',
        isPvp: true,
        defenderType: 'pvp_online',
        defenderPlayerId: defenderId,
        defenderName,
        defenderGarrisonSlot: 0,
        npcGarrison,
        playerFaction,
        pvpSiegeRole: 'attacker',
      },
    };
  } catch (e) {
    if (/road_encounters/i.test(e.message || '') && /doesn't exist/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少 road_encounters 表；请执行 create-road-encounters.sql' };
    }
    console.error('[roadEncounterService] getEncounterBattlePayload', e);
    return { ok: false, status: 500, error: e.message || '读取道路战斗数据失败' };
  }
}

/**
 * 道路遭遇战后结算（不写 wars、不走 /cities/siege-result）：
 * 按服务端当场重建的防守阵容与 killedIndices 写回防守方兵力、耐久与老兵；
 * 进攻方银两/声望；解锁 road_encounters + 守门战败关 intercept。
 *
 * @param {string} attackerPlayerId
 * @param {{ encounterId: string, factionId: string, killedIndices?: number[], result: 'win'|'lose',
 *            silverSpent?: number, battleScore?: number, battleReportSaved?: boolean, battleId?: string,
 *            defenderLineupTroopUpdates?: Array<{ instanceId: string, currentTroops: number, maxTroops?: number }> }} body
 */
async function recordEncounterBattleSettlement(attackerPlayerId, body) {
  const pid = String(attackerPlayerId || '').trim();
  const encounterId = String(body?.encounterId || '').trim();
  const factionId = String(body?.factionId || '').trim();
  const killedIndices = Array.isArray(body?.killedIndices) ? body.killedIndices : [];
  const result = String(body?.result || '').trim() === 'win' ? 'win' : 'lose';
  const silverSpent = Math.max(0, Math.floor(Number(body?.silverSpent) || 0));
  const battleScore = Number(body?.battleScore) || 0;
  const battleReportSaved = body?.battleReportSaved !== false;
  const battleId = body?.battleId ? String(body.battleId).trim().slice(0, 80) : null;

  if (!pid || !encounterId || !factionId) {
    return { ok: false, status: 400, error: '缺少 encounterId 或 factionId' };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [encRows] = await conn.query(
      `SELECT encounter_id, status, attacker_player_id, defender_player_id, gatekeeper_player_id,
              season, jun_id, position_x, position_y
         FROM road_encounters WHERE encounter_id = ? FOR UPDATE`,
      [encounterId],
    );
    const row = encRows[0];
    if (!row) {
      await conn.rollback();
      return { ok: false, status: 404, error: '遭遇实例不存在' };
    }
    if (String(row.attacker_player_id || '').trim() !== pid) {
      await conn.rollback();
      return { ok: false, status: 403, error: '仅进攻方可提交道路战结算' };
    }

    const defenderPlayerId = String(row.defender_player_id || '').trim();
    if (!defenderPlayerId) {
      await conn.rollback();
      return { ok: false, status: 500, error: '遭遇缺少防守方' };
    }

    if (row.status === 'resolved' || row.status === 'cancelled') {
      await conn.commit();
      return {
        ok: true,
        data: {
          idempotent: true,
          encounterId,
          npcKilled: 0,
          killCount: 0,
          npcTotal: 0,
          silverReward: 0,
          reputationReward: 0,
          siegeCompleted: false,
        },
      };
    }

    if (row.status !== 'fighting') {
      await conn.rollback();
      return { ok: false, status: 409, error: '遭遇状态异常' };
    }

    const [facRows] = await conn.query('SELECT faction_id FROM players WHERE player_id = ?', [pid]);
    const atkFaction = facRows[0]?.faction_id != null ? String(facRows[0].faction_id).trim() : '';
    if (!atkFaction || atkFaction !== String(factionId).trim()) {
      await conn.rollback();
      return { ok: false, status: 403, error: 'factionId 与当前玩家势力不符' };
    }

    const rawUnits = await garrisonService.buildDefenseUnitsFromMainLineup(defenderPlayerId);
    const garrisonUnits = garrisonService.mapBuiltUnitsToSiegeNpcFormat(rawUnits);
    if (!garrisonUnits.length) {
      await conn.rollback();
      return { ok: false, status: 409, error: '防守方编组已无可战部队' };
    }

    const allTroopInstanceIds = garrisonUnits
      .filter((u) => u && u._troopInstanceId)
      .map((u) => u._troopInstanceId);

    const instToNpc = new Map();
    for (const u of garrisonUnits) {
      if (u && u._troopInstanceId) instToNpc.set(String(u._troopInstanceId).trim(), u);
    }

    const lineupUpdates = Array.isArray(body?.defenderLineupTroopUpdates) ? body.defenderLineupTroopUpdates : [];
    const useLineupUpdates = lineupUpdates.length > 0;

    let killCount = 0;
    let silverReward = 0;

    if (useLineupUpdates) {
      for (const u of lineupUpdates) {
        const iid = u?.instanceId != null ? String(u.instanceId).trim() : '';
        if (!iid || !instToNpc.has(iid)) continue;
        const npc = instToNpc.get(iid);
        const maxFromNpc = Number(npc.maxTroops) || 9999;
        const maxT = u.maxTroops != null ? Math.min(Number(u.maxTroops) || 9999, maxFromNpc) : maxFromNpc;
        const cur = Math.max(0, Math.min(maxT, Math.round(Number(u.currentTroops) || 0)));
        await conn.query(
          `UPDATE player_cards SET current_troops = ?, last_troops_lost_at = ? WHERE instance_id = ? AND player_id = ?`,
          [cur, cur < maxT ? new Date() : null, iid, defenderPlayerId],
        );
      }
      for (const idx of killedIndices) {
        const i = Number(idx);
        if (!Number.isFinite(i) || i < 0 || i >= garrisonUnits.length) continue;
        const unit = garrisonUnits[i];
        if (!unit) continue;
        killCount += 1;
        silverReward += KILL_SILVER_REWARD[unit.rarity] || 10;
      }
    } else {
      for (const idx of killedIndices) {
        const i = Number(idx);
        if (!Number.isFinite(i) || i < 0 || i >= garrisonUnits.length) continue;
        const unit = garrisonUnits[i];
        if (!unit || !unit._troopInstanceId) continue;
        await conn.query(
          'UPDATE player_cards SET current_troops = 0, last_troops_lost_at = NOW() WHERE instance_id = ? AND player_id = ?',
          [unit._troopInstanceId, defenderPlayerId],
        );
        killCount += 1;
        silverReward += KILL_SILVER_REWARD[unit.rarity] || 10;
      }
    }

    if (allTroopInstanceIds.length > 0) {
      const ph = allTroopInstanceIds.map(() => '?').join(',');
      await conn.query(
        `UPDATE player_cards SET battle_count = LEAST(
           GREATEST(COALESCE(battle_count, 0), 0) + 1,
           COALESCE(max_battle_count, 60)
         ),
         lifetime_battle_count = COALESCE(lifetime_battle_count, 0) + 1
         WHERE instance_id IN (${ph}) AND player_id = ?`,
        [...allTroopInstanceIds, defenderPlayerId],
      );
    }

    await applyTroopDurabilityExhaustion((sql, params) => conn.query(sql, params), defenderPlayerId);

    const netSilver = silverReward - silverSpent;
    if (netSilver !== 0) {
      await conn.query('UPDATE players SET silver = GREATEST(0, silver + ?) WHERE player_id = ?', [
        netSilver,
        pid,
      ]);
    }

    let reputationReward = 0;
    if (result === 'win' && killCount > 0) {
      const killedRarities = killedIndices
        .map((j) => garrisonUnits[Number(j)]?.rarity)
        .filter(Boolean);
      const rarityOrder = ['common', 'rare', 'epic', 'legendary', 'core'];
      const bestRarity =
        killedRarities.sort((a, b) => rarityOrder.indexOf(b) - rarityOrder.indexOf(a))[0] || 'common';
      reputationReward = WIN_REPUTATION_REWARD[bestRarity] || 5;
      await conn.query('UPDATE players SET reputation = reputation + ? WHERE player_id = ?', [
        reputationReward,
        pid,
      ]);
    }

    const shouldFallbackAddBattleScore = Number(battleScore) > 0 && battleReportSaved === false;
    if (shouldFallbackAddBattleScore) {
      await conn.query(
        'UPDATE statistics SET total_battle_score = total_battle_score + ? WHERE player_id = ?',
        [Number(battleScore), pid],
      );
    }

    await conn.query(
      `UPDATE road_encounters
          SET status = 'resolved',
              battle_id = COALESCE(?, battle_id),
              ended_at = NOW()
        WHERE encounter_id = ?`,
      [battleId, encounterId],
    );

    const defenderWon = result !== 'win';
    const gatekeeper = row.gatekeeper_player_id;
    if (gatekeeper) {
      const gatekeeperWon =
        (gatekeeper === row.defender_player_id && defenderWon) ||
        (gatekeeper === row.attacker_player_id && !defenderWon);
      if (!gatekeeperWon) {
        await conn.query(
          `UPDATE players SET road_intercept = 0, road_updated_at = NOW() WHERE player_id = ?`,
          [gatekeeper],
        );
      }
    }

    const loserPlayerId = defenderWon ? String(row.attacker_player_id || '').trim() : defenderPlayerId;
    const cellX = toInt(row.position_x);
    const cellY = toInt(row.position_y);
    const encSeason = String(row.season || '').trim();
    const encJun = String(row.jun_id || '').trim();
    if (loserPlayerId && cellX != null && cellY != null && encSeason && encJun) {
      try {
        const grid = await loadRoadGrid(encSeason, encJun);
        if (grid?.rawCells?.length) {
          const [cRows] = await conn.query(
            `SELECT city_id, city_type, position_x, position_y, faction_id FROM cities WHERE jun_id = ? AND season = ?`,
            [encJun, encSeason],
          );
          const ret = await applyFactionPlayerRoadRetreat(conn, {
            junId: encJun,
            grid,
            countyCityRows: cRows,
            playerId: loserPlayerId,
            fromX: cellX,
            fromY: cellY,
            noticeText: buildRoadBattleDefeatRetreatNotice(),
          });
          if (!ret.ok) {
            console.warn('[roadEncounterService] recordEncounterBattleSettlement loser retreat skipped:', ret.error);
          }
        }
      } catch (lzErr) {
        console.warn('[roadEncounterService] recordEncounterBattleSettlement loser retreat', lzErr);
      }
    }

    await conn.commit();

    if (silverSpent > 0) {
      try {
        await statisticsDeltaService.incrementSpent(pid, { silver: silverSpent });
      } catch (_) {}
    }
    try {
      await statisticsDeltaService.recordEarned(pid, {
        ...(silverReward > 0 ? { silver: silverReward } : {}),
        ...(reputationReward > 0 ? { reputation: reputationReward } : {}),
      });
    } catch (_) {}

    let defenderVeteranPromotions = [];
    try {
      defenderVeteranPromotions = await checkAndApplyVeteran(
        (sql, params) => pool.query(sql, params),
        defenderPlayerId,
      );
    } catch (vetErr) {
      console.error('[roadEncounterService] defender veteran', vetErr);
    }

    return {
      ok: true,
      data: {
        idempotent: false,
        encounterId,
        npcKilled: killCount,
        killCount,
        npcTotal: garrisonUnits.length,
        silverReward,
        reputationReward,
        siegeCompleted: false,
        defenderType: 'road_encounter',
        defenderVeteranPromotions,
      },
    };
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {}
    console.error('[roadEncounterService] recordEncounterBattleSettlement', e);
    return { ok: false, status: 500, error: e.message || '道路战结算失败' };
  } finally {
    conn.release();
  }
}

// ── 战后解锁 ──────────────────────────────────────────────────────────────────

/**
 * 战后收尾：
 *   - road_encounters: status=resolved, battle_id, ended_at
 *   - 守门方若战败，关闭其 road_intercept（31-6 §三）
 *   - 战败方移回本郡最近己方城（`roadBattleRetreatPlacement`）
 *
 * @param {string} playerId   发起方（通常 = attacker，亦支持 defender 主动上报）
 * @param {{ encounterId: string, battleId?: string, defenderWon: boolean }} body
 */
async function resolveEncounter(playerId, body) {
  const pid = String(playerId || '').trim();
  const eid = String(body?.encounterId || '').trim();
  if (!pid || !eid) return { ok: false, status: 400, error: '缺少 playerId / encounterId' };
  const battleId = body?.battleId ? String(body.battleId).trim().slice(0, 80) : null;
  const defenderWon = !!body?.defenderWon;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT encounter_id, status, attacker_player_id, defender_player_id, gatekeeper_player_id,
              season, jun_id, position_x, position_y
         FROM road_encounters WHERE encounter_id = ? FOR UPDATE`,
      [eid],
    );
    const row = rows[0];
    if (!row) {
      await conn.rollback();
      return { ok: false, status: 404, error: '遭遇实例不存在' };
    }
    if (String(row.attacker_player_id || '').trim() !== pid && String(row.defender_player_id || '').trim() !== pid) {
      await conn.rollback();
      return { ok: false, status: 403, error: '仅遭遇双方可提交战后结果' };
    }
    if (row.status === 'resolved' || row.status === 'cancelled') {
      await conn.commit();
      return { ok: true, data: { encounterId: eid, status: row.status, idempotent: true } };
    }

    await conn.query(
      `UPDATE road_encounters
          SET status = 'resolved',
              battle_id = COALESCE(?, battle_id),
              ended_at = NOW()
        WHERE encounter_id = ?`,
      [battleId, eid],
    );

    // 守门方战败（defender = gatekeeper 且 defenderWon=false；或 gatekeeper = attacker 且 defenderWon=true）关闭其守门。
    const gatekeeper = row.gatekeeper_player_id;
    if (gatekeeper) {
      const gatekeeperWon = (gatekeeper === row.defender_player_id && defenderWon) ||
                            (gatekeeper === row.attacker_player_id && !defenderWon);
      if (!gatekeeperWon) {
        await conn.query(
          `UPDATE players
              SET road_intercept = 0,
                  road_updated_at = NOW()
            WHERE player_id = ?`,
          [gatekeeper],
        );
      }
    }

    const loserPlayerId = defenderWon ? row.attacker_player_id : row.defender_player_id;
    const cellX = toInt(row.position_x);
    const cellY = toInt(row.position_y);
    const encSeason = String(row.season || '').trim();
    const encJun = String(row.jun_id || '').trim();
    if (loserPlayerId && cellX != null && cellY != null && encSeason && encJun) {
      try {
        const grid = await loadRoadGrid(encSeason, encJun);
        if (grid?.rawCells?.length) {
          const [cRows] = await conn.query(
            `SELECT city_id, city_type, position_x, position_y, faction_id FROM cities WHERE jun_id = ? AND season = ?`,
            [encJun, encSeason],
          );
          const ret = await applyFactionPlayerRoadRetreat(conn, {
            junId: encJun,
            grid,
            countyCityRows: cRows,
            playerId: String(loserPlayerId).trim(),
            fromX: cellX,
            fromY: cellY,
            noticeText: buildRoadBattleDefeatRetreatNotice(),
          });
          if (!ret.ok) {
            console.warn('[roadEncounterService] resolveEncounter loser retreat skipped:', ret.error);
          }
        }
      } catch (lzErr) {
        console.warn('[roadEncounterService] resolveEncounter loser retreat', lzErr);
      }
    }

    await conn.commit();
    return { ok: true, data: { encounterId: eid, status: 'resolved', battleId, idempotent: false } };
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    console.error('[roadEncounterService] resolveEncounter', e);
    return { ok: false, status: 500, error: e.message || '解锁遭遇失败' };
  } finally {
    conn.release();
  }
}

// ── 道路遭遇：服务端权威推演（与 `siegePvpResolveService` 同源 `runSiegePvpSkirmish`）────────────────

const authoritativeRoadResolveLocks = new Map();
async function doResolveAuthoritativeRoadEncounter(attackerId, encounterId) {
  const [rows] = await pool.query(
    `SELECT encounter_id, status, attacker_player_id, defender_player_id,
            season, jun_id, position_x, position_y, authoritative_resolution_json
       FROM road_encounters WHERE encounter_id = ?`,
    [encounterId],
  );
  const row = rows[0];
  if (!row) return { ok: false, status: 404, error: '遭遇实例不存在' };
  if (String(row.attacker_player_id || '').trim() !== attackerId) {
    return { ok: false, status: 403, error: '仅进攻方可请求权威结算' };
  }
  if (row.status === 'resolved' || row.status === 'cancelled') {
    if (row.authoritative_resolution_json) {
      try {
        const snap = JSON.parse(String(row.authoritative_resolution_json));
        return { ok: true, data: { ...snap, idempotent: true } };
      } catch (_) {
        /* fallthrough */
      }
    }
    return {
      ok: true,
      data: {
        idempotent: true,
        encounterId,
        pendingReplay: false,
        noReplay: true,
        message: '遭遇已结束',
      },
    };
  }
  if (row.status !== 'fighting') {
    return { ok: false, status: 409, error: '遭遇状态不可结算' };
  }

  const defenderId = String(row.defender_player_id || '').trim();
  if (!defenderId) return { ok: false, status: 500, error: '遭遇缺少防守方' };

  const rawAttacker = await garrisonService.buildDefenseUnitsFromMainLineup(attackerId);
  const rawDefender = await garrisonService.buildDefenseUnitsFromMainLineup(defenderId);
  const attackerNpcs = garrisonService.mapBuiltUnitsToSiegeNpcFormat(rawAttacker);
  const defenderNpcs = garrisonService.mapBuiltUnitsToSiegeNpcFormat(rawDefender);
  if (!attackerNpcs.length || !defenderNpcs.length) {
    return { ok: false, status: 409, error: '双方上阵编组须均有部队才可权威结算' };
  }

  const seed = hashSeed([encounterId, attackerId, defenderId]);
  const sim = runSiegePvpSkirmish(attackerNpcs, defenderNpcs, seed);
  const result = sim.attackerWon ? 'win' : 'lose';
  const killedIndices = Array.from(new Set((sim.killedIndices || []).map((x) => Number(x)).filter((i) => Number.isFinite(i) && i >= 0 && i < defenderNpcs.length)));

  const defenderLineupTroopUpdates = defenderNpcs
    .map((npc, i) => ({
      instanceId: npc._troopInstanceId,
      maxTroops: npc.maxTroops,
      currentTroops: Math.max(0, Math.round(Number(sim.defenderTroopsEnd[i]?.currentTroops) || 0)),
    }))
    .filter((u) => u.instanceId);

  const [atkFac] = await pool.query('SELECT faction_id FROM players WHERE player_id = ?', [attackerId]);
  const factionId = atkFac[0]?.faction_id != null ? String(atkFac[0].faction_id).trim() : '';
  if (!factionId) return { ok: false, status: 400, error: '进攻方缺少势力信息' };

  const atkTroops = buildTroopsForAttackerScore(sim.attackerTroopsEnd, sim.defenderTroopsEnd);
  const defTroops = buildTroopsForDefenderScore(sim.attackerTroopsEnd, sim.defenderTroopsEnd);
  const scoreMultOpts = { scoreMultiplier: SIEGE_PVP_ONLINE_SCORE_MULT };
  const atkBattleScore = calculateBattleScore(
    atkTroops,
    sim.rounds,
    sim.attackerWon ? 'victory' : 'defeat',
    scoreMultOpts,
  );
  const defBattleScore = calculateBattleScore(
    defTroops,
    sim.rounds,
    sim.attackerWon ? 'defeat' : 'victory',
    scoreMultOpts,
  );

  const battleId = newShortBattleId('road_pvp_atk');
  const settleBody = {
    encounterId,
    factionId,
    killedIndices,
    result,
    silverSpent: 0,
    battleScore: atkBattleScore.score,
    battleReportSaved: true,
    battleId,
    defenderLineupTroopUpdates,
  };

  const settled = await recordEncounterBattleSettlement(attackerId, settleBody);
  if (!settled.ok) return settled;

  try {
    await garrisonService.applyAuthoritativeSiegePvpAttackerLineupCasualties(attackerId, attackerNpcs, sim.attackerTroopsEnd);
  } catch (e) {
    console.error('[roadEncounterService] authoritative road attacker casualties', {
      message: e.message,
      attackerId,
      encounterId,
    });
  }

  const [nameRows] = await pool.query(
    'SELECT player_id, character_name FROM players WHERE player_id IN (?, ?)',
    [attackerId, defenderId],
  );
  const nameMap = Object.fromEntries(nameRows.map((r) => [r.player_id, r.character_name]));
  const attackerName = nameMap[attackerId] || attackerId;
  const defenderName = nameMap[defenderId] || defenderId;

  const battleLogText = sim.battleLog.join('\n');
  const defenderPerspectiveLog = buildDefenderSiegePvpBattleLog({
    battleLogLines: sim.battleLog,
    attackerPlayerName: attackerName,
    defenderPlayerName: defenderName,
    cityName: '道路',
  });

  const defBattleId = newShortBattleId('road_pvp_def');
  try {
    await battleService.saveBattle({
      battleId,
      playerId: attackerId,
      warId: null,
      battleType: 'pvp_field',
      opponentType: 'player',
      opponentId: defenderId,
      opponentName: defenderName,
      result: sim.attackerWon ? 'win' : 'lose',
      playerTeam: attackerNpcs.map((n) => ({
        name: n.character?.courtesyName || n.character?.name || n.troopName,
        courtesyName: n.character?.courtesyName || n.character?.name || n.troopName,
      })),
      opponentTeam: defenderNpcs.map((n) => ({
        name: n.character?.courtesyName || n.character?.name || n.troopName,
        courtesyName: n.character?.courtesyName || n.character?.name || n.troopName,
      })),
      battleLog: battleLogText,
      totalKills: killedIndices.length,
      duration: sim.rounds,
      rewards: {
        battleSeed: sim.battleSeed,
        authoritative: true,
        roadEncounterId: encounterId,
        battleScore: atkBattleScore.score,
        battleGrade: atkBattleScore.grade,
        scoreDetails: atkBattleScore.details,
        initialAttackerTroops: sumSiegeNpcStartingTroopsRoad(attackerNpcs),
        initialDefenderTroops: sumSiegeNpcStartingTroopsRoad(defenderNpcs),
      },
    });
  } catch (e) {
    console.error('[roadEncounterService] authoritative road saveBattle attacker', e);
  }

  try {
    await battleService.saveBattle({
      battleId: defBattleId,
      playerId: defenderId,
      warId: null,
      battleType: 'pvp_defense',
      opponentType: 'player',
      opponentId: attackerId,
      opponentName: attackerName,
      result: sim.attackerWon ? 'lose' : 'win',
      playerTeam: defenderNpcs.map((n) => ({
        name: n.character?.courtesyName || n.character?.name || n.troopName,
        courtesyName: n.character?.courtesyName || n.character?.name || n.troopName,
      })),
      opponentTeam: attackerNpcs.map((n) => ({
        name: n.character?.courtesyName || n.character?.name || n.troopName,
        courtesyName: n.character?.courtesyName || n.character?.name || n.troopName,
      })),
      battleLog: defenderPerspectiveLog,
      totalKills: killedIndices.length,
      duration: sim.rounds,
      rewards: {
        battleScore: defBattleScore.score,
        battleGrade: defBattleScore.grade,
        scoreDetails: defBattleScore.details,
        initialAttackerTroops: sumSiegeNpcStartingTroopsRoad(attackerNpcs),
        initialDefenderTroops: sumSiegeNpcStartingTroopsRoad(defenderNpcs),
        skirmishBattleLog: battleLogText,
        roadEncounterId: encounterId,
      },
      recordOnly: true,
    });
  } catch (e) {
    console.error('[roadEncounterService] authoritative road saveBattle defender', e);
  }

  try {
    if (atkBattleScore.score > 0) {
      await battleService.applyBattleScore(attackerId, atkBattleScore.score);
    }
    if (defBattleScore.score > 0) {
      await battleService.applyBattleScore(defenderId, defBattleScore.score);
    }
  } catch (e) {
    console.error('[roadEncounterService] authoritative road battle score stats', e);
  }

  const resolutionPayload = {
    battleLog: sim.battleLog,
    battleSeed: sim.battleSeed,
    initialAttackerTroops: sumSiegeNpcStartingTroopsRoad(attackerNpcs),
    initialDefenderTroops: sumSiegeNpcStartingTroopsRoad(defenderNpcs),
    attackerWon: sim.attackerWon,
    attackerName,
    defenderName,
    attackerBattleScore: atkBattleScore.score,
    attackerBattleGrade: atkBattleScore.grade,
    attackerScoreDetails: atkBattleScore.details,
    defenderBattleScore: defBattleScore.score,
    defenderBattleGrade: defBattleScore.grade,
    defenderScoreDetails: defBattleScore.details,
    settlement: settled.data || {},
    siegeReplayAttackerNames: siegeNpcDisplayNamesRoad(attackerNpcs),
    siegeReplayDefenderNames: siegeNpcDisplayNamesRoad(defenderNpcs),
  };

  try {
    await pool.query(
      'UPDATE road_encounters SET authoritative_resolution_json = ? WHERE encounter_id = ?',
      [JSON.stringify(resolutionPayload), encounterId],
    );
  } catch (e) {
    if (!/Unknown column/i.test(e.message || '')) {
      console.error('[roadEncounterService] authoritative_resolution_json write', e);
    }
  }

  return {
    ok: true,
    data: {
      ...resolutionPayload,
      battleId,
      defenderBattleId: defBattleId,
    },
  };
}

async function resolveAuthoritativeRoadEncounter(attackerPlayerId, encounterIdRaw) {
  const encounterId = String(encounterIdRaw || '').trim();
  const attackerId = String(attackerPlayerId || '').trim();
  if (!encounterId || !attackerId) return { ok: false, status: 400, error: '缺少 encounterId' };
  if (authoritativeRoadResolveLocks.has(encounterId)) {
    return authoritativeRoadResolveLocks.get(encounterId);
  }
  const p = doResolveAuthoritativeRoadEncounter(attackerId, encounterId).finally(() => {
    authoritativeRoadResolveLocks.delete(encounterId);
  });
  authoritativeRoadResolveLocks.set(encounterId, p);
  return p;
}

async function getRoadEncounterAuthoritativeOutcome(viewerPlayerId, encounterIdRaw) {
  const pid = String(viewerPlayerId || '').trim();
  const encounterId = String(encounterIdRaw || '').trim();
  if (!pid || !encounterId) return { ok: false, status: 400, error: '缺少参数' };
  try {
    const [rows] = await pool.query(
      `SELECT encounter_id, status, attacker_player_id, defender_player_id, authoritative_resolution_json
         FROM road_encounters WHERE encounter_id = ?`,
      [encounterId],
    );
    const row = rows[0];
    if (!row) return { ok: false, status: 404, error: '遭遇不存在' };
    const att = String(row.attacker_player_id || '').trim();
    const def = String(row.defender_player_id || '').trim();
    if (pid !== att && pid !== def) return { ok: false, status: 403, error: '无权查看' };
    if (row.status === 'fighting') {
      return { ok: true, data: { pending: true } };
    }
    if (row.authoritative_resolution_json) {
      try {
        const snap = JSON.parse(String(row.authoritative_resolution_json));
        return { ok: true, data: { pending: false, ...snap, viewerIsDefender: pid === def } };
      } catch (_) {
        return { ok: true, data: { pending: false, noReplay: true } };
      }
    }
    return { ok: true, data: { pending: false, noReplay: true, legacyClientSettlement: true } };
  } catch (e) {
    if (/Unknown column/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '请执行迁移 road-encounters-add-authoritative-resolution-json.sql' };
    }
    console.error('[roadEncounterService] getRoadEncounterAuthoritativeOutcome', e);
    return { ok: false, status: 500, error: e.message || '查询失败' };
  }
}

module.exports = {
  INTERCEPT_COST_SILVER,
  FREE_MOVES_PER_DAY,
  FOOD_PER_STEP,
  RESERVE_FOOD_DAILY_LIMIT,
  setIntercept,
  getSelfRoadState,
  moveAlongRoad,
  getRoadPresence,
  getPendingDefenderEncounter,
  getEncounterBattlePayload,
  recordEncounterBattleSettlement,
  resolveEncounter,
  resolveAuthoritativeRoadEncounter,
  getRoadEncounterAuthoritativeOutcome,
};
