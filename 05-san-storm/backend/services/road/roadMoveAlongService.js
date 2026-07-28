/**
 * 沿路移动与遭遇登记（原 roadEncounterService.js · moveAlongRoad 块）。
 * 对外由 roadEncounterService 聚合 re-export；路由层签名不变。
 */
const { pool } = require('../../database/connection');
const {
  loadRoadGrid,
  loadRoadGridSan1YuVerticalStack,
  isSan1YuStackRoadJunId,
  cellKey,
  isNeighbor4,
} = require('../../utils/roadGrid');

const marchPoi = require('../../../shared/utils/strategicMarchPoi.js');
const { isHostileByFaction } = require('../../utils/roadDiplomacy');
const { isPlayerRecentlyActive, DEFAULT_ONLINE_MS } = require('../../utils/playerActivity');
const statisticsDeltaService = require('../statisticsDeltaService');
const garrisonService = require('../garrisonService');
const {
  isPlayerRoadEncounterParticipant,
  isNonParticipantFinalRoadStepOntoEncounter,
} = require('../../../shared/utils/roadEncounterLockPassage.js');
const {
  applyFactionPlayerRoadRetreat,
  buildRoadGateFailRetreatNotice,
  buildRoadBattleDefeatRetreatNotice,
} = require('../../utils/roadBattleRetreatPlacement');
const {
  FREE_MOVES_PER_DAY,
  FOOD_PER_STEP,
  RESERVE_FOOD_DAILY_LIMIT,
  ROAD_ENCOUNTERS_ENABLED,
  newEncounterId,
  toInt,
  buildPlayerRoadSnapshot,
  validatePathShape,
  matchesMoveRequestId,
  scopedRoadRequestId,
  ROAD_REQ_SCOPE,
} = require('./roadShared');
const {
  resolveStaleRoadEncountersAtCell,
  resolveAbandonedRoadFightOnCellIfOpponentOffline,
} = require('./roadStaleCleanup');
const gridCoords = require('../../../shared/utils/strategicGridCoordinates.js');

/**
 * 写库统一为 PlayerRoadCell（`road_jun_id` + 郡内本地格）。
 * @returns {{ junId: string, gx: number, gy: number }}
 */
function resolveMoveDestinationPlayerRoad({
  appliedPoiSnap,
  poiAnchorEnd,
  poiAnchorJunIdEnd,
  lastWorldGx,
  lastWorldGy,
  useStackGrid,
  requestJunId,
}) {
  if (appliedPoiSnap && poiAnchorEnd) {
    const junForPoi =
      poiAnchorJunIdEnd != null && String(poiAnchorJunIdEnd).trim()
        ? String(poiAnchorJunIdEnd).trim()
        : String(requestJunId || '').trim();
    const dest = gridCoords.playerRoadDestFromPoiAnchor(poiAnchorEnd, junForPoi);
    if (dest) return dest;
  }
  if (useStackGrid) {
    const dest = gridCoords.playerRoadDestFromWorldPathEnd(lastWorldGx, lastWorldGy);
    if (dest) return dest;
  }
  return {
    junId: String(requestJunId || '').trim(),
    gx: toInt(lastWorldGx) ?? 0,
    gy: toInt(lastWorldGy) ?? 0,
  };
}
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
    return { ok: false, status: 400, error: '缺少 confirmFoodCost=true（与 31-6 §6 强制确认一致）' };
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
function computeMoveFoodPlan(player, stepsCount, noFoodCost = false) {
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

  // 可选免粮草行军（也不占用免费格配额）：全部步数视为 0 成本。
  // 仅 body.noFoodCost=true 时生效；真人默认路径不传此标志。历史调用方为已归档的 AI 玩家移动规划。
  if (noFoodCost) {
    return {
      todayStr,
      freeDateStr,
      reserveDateStr,
      freeUsed,
      reserveUsed,
      usedFreeThisMove: 0,
      paidSteps: 0,
      totalFoodCost: 0,
      playerFoodUse: 0,
      reserveFoodUse: 0,
    };
  }

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
 * 仅当本次需从势力池垫粮时，对 `faction_reserve`（pool）行加锁并校验是否足量。
 * 不写入；后续真正扣减仍由主流程在同事务内执行（保留与库存档号一致的写动作）。
 *
 * @returns {Promise<{ ok:true } | { ok:false, status:number, error:string }>}
 */
async function assertFactionReserveFoodSufficient(conn, factionId, reserveFoodUse) {
  if (reserveFoodUse <= 0) return { ok: true };
  const factionReserveService = require('../factionReserveService');
  await factionReserveService.ensurePoolRow(conn, factionId);
  const bal = await factionReserveService.getPoolBalance(conn, factionId, { forUpdate: true });
  if (bal.food < reserveFoodUse) {
    return {
      ok: false,
      status: 409,
      error: `势力粮草储备不足（需 ${reserveFoodUse}、现 ${bal.food}）`,
    };
  }
  return { ok: true };
}

// ── 沿路移动 ──────────────────────────────────────────────────────────────────
async function moveAlongRoadAttempt(playerId, body) {
  const inputCheck = validateMoveAlongRoadInput(playerId, body);
  if (!inputCheck.ok) return inputCheck;
  const { pid, season, junId, clientRequestId } = inputCheck;
  const scopedMoveReqId = scopedRoadRequestId(ROAD_REQ_SCOPE.MOVE, clientRequestId);
  // 可选免粮草（显式 noFoodCost；真人默认不传）
  const noFoodCost = body?.noFoodCost === true;

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

    /** 全图活跃攻方大本营（含他势力）：离路出发识别本营 + 终点停营门闸。 */
    let pvpBaseCampsForMarch = [];
    {
      const [pvpWarCampRows] = await conn.query(
        `SELECT pvp_war_id AS pvpWarId, attacker_faction_id AS attackerFactionId,
                target_city_id AS targetCityId, base_camp AS baseCamp
           FROM wars_pvp
          WHERE status = 'active' AND season = ?
          LIMIT 120`,
        [season],
      );
      for (const row of pvpWarCampRows || []) {
        let bc = row.baseCamp;
        if (typeof bc === 'string') {
          try {
            bc = JSON.parse(bc);
          } catch {
            bc = null;
          }
        }
        if (!bc || typeof bc !== 'object' || !Array.isArray(bc.cells) || !bc.cells.length) continue;
        const tid = row.targetCityId != null ? String(row.targetCityId).trim() : '';
        let junPatch = String(bc.junId ?? bc.jun_id ?? '').trim();
        if (!junPatch && tid && Array.isArray(countyCityRows)) {
          const cr = countyCityRows.find((r) => String(r.city_id ?? r.cityId ?? '').trim() === tid);
          const jfrom = cr?.jun_id ?? cr?.junId;
          if (jfrom) junPatch = String(jfrom).trim();
        }
        pvpBaseCampsForMarch.push({
          ...bc,
          ...(junPatch ? { junId: junPatch } : {}),
          pvpWarId: String(row.pvpWarId || '').trim(),
          attackerFactionId: row.attackerFactionId != null ? String(row.attackerFactionId).trim() : '',
          kind: 'pvp',
        });
      }
      const [pveWarCampRows] = await conn.query(
        `SELECT w.war_id AS pveWarId, w.target_city_id AS targetCityId, w.attacker_base_camps AS attackerBaseCamps
           FROM wars w
           INNER JOIN cities c ON c.city_id = w.target_city_id
          WHERE w.status = 'active' AND w.war_type = 'siege' AND c.season = ?
            AND w.attacker_base_camps IS NOT NULL
          LIMIT 80`,
        [season],
      );
      for (const row of pveWarCampRows || []) {
        let camps = row.attackerBaseCamps;
        if (typeof camps === 'string') {
          try {
            camps = JSON.parse(camps);
          } catch {
            camps = null;
          }
        }
        if (!camps || typeof camps !== 'object') continue;
        const tid = row.targetCityId != null ? String(row.targetCityId).trim() : '';
        for (const [factionKey, bc] of Object.entries(camps)) {
          if (!bc || !Array.isArray(bc.cells) || !bc.cells.length) continue;
          let junPatch = String(bc.junId ?? bc.jun_id ?? '').trim();
          if (!junPatch && tid && Array.isArray(countyCityRows)) {
            const cr = countyCityRows.find((r) => String(r.city_id ?? r.cityId ?? '').trim() === tid);
            const jfrom = cr?.jun_id ?? cr?.junId;
            if (jfrom) junPatch = String(jfrom).trim();
          }
          pvpBaseCampsForMarch.push({
            ...bc,
            ...(junPatch ? { junId: junPatch } : {}),
            pvpWarId: String(row.pveWarId || '').trim(),
            attackerFactionId: String(factionKey || '').trim(),
            kind: 'pve',
          });
        }
      }
    }

    // 幂等：已处理过同一请求 id → 返回当前快照，不重复扣费 / 移格。
    if (matchesMoveRequestId(player.road_last_request_id, clientRequestId)) {
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
    let marchToPvpCampPoi = false;
    let pvpCampBaseCampJson = null;
    let pvpCampAttackerFactionId = null;
    let resolvedPath = [];
    let poiAnchorEnd = null;
    let poiAnchorJunIdEnd = null;

    if (targetPoiIdRaw) {
      /**
       * 匪寨 `san_*_bandit_*` 与 `cities` 拆库。
       * PVP：`pvp_war_id` 与 `city_id` 不同命名空间，但仍须 **先查 wars_pvp**——若先查 cities 且因脏数据/误传 id 命中城行，
       * 会跳过战事分支，寻路按城心走（表现为「点大本营却到目标中城」）。
       */
      let cityRow = null;
      if (!marchPoi.isBanditMapObjectId(targetPoiIdRaw)) {
        const [wRowsFirst] = await conn.query(
          `SELECT attacker_faction_id AS attackerFactionId, base_camp AS baseCamp
             FROM wars_pvp WHERE pvp_war_id = ? AND status = 'active' LIMIT 1`,
          [targetPoiIdRaw],
        );
        if (wRowsFirst.length) {
          let bc = wRowsFirst[0].baseCamp;
          if (typeof bc === 'string') {
            try {
              bc = JSON.parse(bc);
            } catch {
              bc = null;
            }
          }
          if (bc && Array.isArray(bc.cells) && bc.cells.length) {
            marchToPvpCampPoi = true;
            pvpCampBaseCampJson = bc;
            pvpCampAttackerFactionId = wRowsFirst[0].attackerFactionId;
          }
        }
        if (!marchToPvpCampPoi && marchPoi.isPvpWarMarchTargetId(targetPoiIdRaw)) {
          const [pveWarRows] = await conn.query(
            `SELECT war_id AS warId, target_city_id AS targetCityId, attacker_base_camps AS attackerBaseCamps
               FROM wars WHERE war_id = ? AND status = 'active' AND war_type = 'siege' LIMIT 1`,
            [targetPoiIdRaw],
          );
          if (pveWarRows.length && player.faction_id) {
            let camps = pveWarRows[0].attackerBaseCamps;
            if (typeof camps === 'string') {
              try {
                camps = JSON.parse(camps);
              } catch {
                camps = null;
              }
            }
            const fid = String(player.faction_id).trim();
            const bc = camps && typeof camps === 'object' ? camps[fid] : null;
            if (bc && Array.isArray(bc.cells) && bc.cells.length) {
              marchToPvpCampPoi = true;
              pvpCampBaseCampJson = bc;
              pvpCampAttackerFactionId = fid;
            }
          }
        }
        if (!marchToPvpCampPoi) {
          const [cRows] = await conn.query(
            `SELECT city_id AS cityId, city_type AS cityType, faction_id AS factionId,
                    position_x AS positionX, position_y AS positionY, jun_id AS junId
               FROM cities WHERE city_id = ? LIMIT 1`,
            [targetPoiIdRaw],
          );
          if (cRows.length) {
            cityRow = cRows[0];
          }
        }
        if (!cityRow && !marchToBanditPoi && !marchToPvpCampPoi) {
          await conn.rollback();
          return { ok: false, status: 404, error: '目标战略点不存在' };
        }
      }
      const acc = marchPoi.canPlayerMarchToPoiCity({
        cityRow,
        targetPoiId: targetPoiIdRaw,
        playerFactionId: player.faction_id,
        pvpCampAttackerFactionId: marchToPvpCampPoi ? pvpCampAttackerFactionId : null,
      });
      if (!acc.ok) {
        await conn.rollback();
        return { ok: false, status: 403, error: acc.error };
      }
      const preferredStand =
        body.targetPoiStand &&
        Number.isFinite(Number(body.targetPoiStand.x)) &&
        Number.isFinite(Number(body.targetPoiStand.y))
          ? { gx: toInt(body.targetPoiStand.x), gy: toInt(body.targetPoiStand.y) }
          : null;
      // POI 最短路按全道路网；途经敌对占格在逐步落脚时触发遭遇（与客户端预览一致）。
      const built = marchPoi.buildMarchPathToStrategicPoi({
        cells: grid.rawCells,
        roadCells: grid.roadCellsRaw || [],
        mapColumns: grid.mapColumns,
        mapRows: grid.mapRows,
        countyJunId: junId,
        player,
        targetPoiId: targetPoiIdRaw,
        targetCityDbRow: cityRow,
        citiesInCountyRows: countyCityRows,
        useWorldStackRoadCoords: useStackGrid,
        pvpCampBaseCamp: marchToPvpCampPoi ? pvpCampBaseCampJson : null,
        pvpBaseCamps: pvpBaseCampsForMarch.length ? pvpBaseCampsForMarch : null,
        preferredPoiCell: preferredStand,
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
      const sy0WorldCell =
        useStackGrid && sx0 != null && sy0 != null && player.road_jun_id
          ? gridCoords.playerRoadToWorldMapCell(String(player.road_jun_id).trim(), sx0, sy0)
          : null;
      const sy0World = sy0WorldCell ? sy0WorldCell.worldGy : sy0;
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
          {
            citiesInCountyRows: countyCityRows,
            pvpBaseCamps: pvpBaseCampsForMarch.length ? pvpBaseCampsForMarch : null,
          },
          useStackGrid,
        );
        if (!footprint.size) {
          await conn.rollback();
          return {
            ok: false,
            status: 400,
            error:
              '离路起点无法解析：当前坐标须落在库城/格网城寨/PVP 攻方大本营等已登记 POI 占格内（不以主城替代）。请刷新地图或核对 road_position。',
          };
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

    /** 终点若为大本营格：仅所属势力可停；途经不拦。 */
    {
      const endPt = resolvedPath[resolvedPath.length - 1];
      const endGx = toInt(endPt.x);
      const endGy = toInt(endPt.y);
      if (endGx != null && endGy != null && pvpBaseCampsForMarch.length) {
        const campSlice = marchPoi.findBaseCampSliceAtMergedCell(
          endGy,
          endGx,
          pvpBaseCampsForMarch,
          grid.mapColumns,
          grid.mapRows,
        );
        const stopGate = marchPoi.canPlayerStopOnAttackerBaseCampCell({
          playerFactionId: player.faction_id,
          campAttackerFactionId: campSlice?.attackerFactionId ?? campSlice?.attacker_faction_id,
        });
        if (!stopGate.ok) {
          await conn.rollback();
          return { ok: false, status: 403, error: stopGate.error };
        }
      }
    }

    // 解算起点：path[0] 必须等于当前 road_position（若已在可通行道路格上），
    // 或当 player 未在路上时为城/寨块邻接的道路格（与 BFS 首格一致）。
    const startX = toInt(player.road_position_x);
    const startY = toInt(player.road_position_y);
    const startYWorldCell =
      useStackGrid && startX != null && startY != null && player.road_jun_id
        ? gridCoords.playerRoadToWorldMapCell(String(player.road_jun_id).trim(), startX, startY)
        : null;
    const startYWorld = startYWorldCell ? startYWorldCell.worldGy : startY;
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
      // 首跳：道路格须 4-邻接 **当前离路所占** 库城/格网城寨/PVP 攻方大本营 POI 块（与 `resolveOffRoadMarchDepartureFootprintKeys` 一致，无主城回退）。
      const footprint = marchPoi.resolveOffRoadMarchDepartureFootprintKeys(
        grid.rawCells,
        player,
        junId,
        grid.mapColumns,
        grid.mapRows,
        {
          citiesInCountyRows: countyCityRows,
          pvpBaseCamps: pvpBaseCampsForMarch.length ? pvpBaseCampsForMarch : null,
        },
        useStackGrid,
      );
      if (!footprint.size) {
        await conn.rollback();
        return {
          ok: false,
          status: 400,
          error:
            '离路起点无法解析：当前坐标须落在库城/格网城寨/PVP 攻方大本营等已登记 POI 占格内（不以主城替代）。请刷新地图或核对 road_position。',
        };
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
        return { ok: false, status: 400, error: '首跳须为出发 POI 占格（城/寨/攻方大本营）四邻接的道路格' };
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

    // 道路遭遇战已下线：取消本玩家残留 pending/fighting，避免旧锁卡死行军
    if (!ROAD_ENCOUNTERS_ENABLED) {
      await conn.query(
        `UPDATE road_encounters
            SET status = 'cancelled', ended_at = NOW()
          WHERE status IN ('pending', 'fighting')
            AND (attacker_player_id = ? OR defender_player_id = ?)`,
        [pid, pid],
      );
    }

    // 遭遇进行中：**攻防任一方**均不可离开交战格，直至 `road_encounters` 为 `resolved`（守方遇袭 / 观战口径不变）。
    if (
      ROAD_ENCOUNTERS_ENABLED &&
      steps.length &&
      onRoad &&
      startX != null &&
      startY != null &&
      String(player.road_jun_id || '').trim() === String(junId).trim()
    ) {
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
          } else if (useStackGrid) {
            const loc = gridCoords.worldMapCellToPlayerRoad(sx, sy);
            if (!loc || loc.junId !== junId || sx !== ex || loc.gy !== ey) {
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
        if (ROAD_ENCOUNTERS_ENABLED) {
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
        }
        await resolveStaleRoadEncountersAtCell(conn, season, junId, startX, startY);
        await resolveAbandonedRoadFightOnCellIfOpponentOffline(conn, season, junId, startX, startY, pid);

        const snapDest =
          gridCoords.playerRoadDestFromPoiAnchor(
            { x: axSnap, y: aySnap },
            poiAnchorJunIdEnd || junId,
          ) || { junId: String(junId).trim(), gx: axSnap, gy: aySnap };
        await conn.query(
          `UPDATE players SET road_last_request_id = ?, road_jun_id = ?, road_position_x = ?, road_position_y = ?, road_updated_at = NOW() WHERE player_id = ?`,
          [scopedMoveReqId, snapDest.junId, snapDest.gx, snapDest.gy, pid],
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
      await conn.query(`UPDATE players SET road_last_request_id = ? WHERE player_id = ?`, [scopedMoveReqId, pid]);
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
    const foodPlan = computeMoveFoodPlan(player, steps.length, noFoodCost);
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

    const startWalkWorldCell =
      useStackGrid && onRoad && startX != null && startY != null && player.road_jun_id
        ? gridCoords.playerRoadToWorldMapCell(String(player.road_jun_id).trim(), startX, startY)
        : null;
    const startWalkWy = startWalkWorldCell ? startWalkWorldCell.worldGy : startY;
    let lastX = onRoad ? startX : null;
    let lastY = onRoad ? startWalkWy : null;
    let encounter = null;
    let stepsApplied = 0;
    /** @type {Array<{ defenderPlayerId: string, retreatX?: number, retreatY?: number, reason?: string }>} */
    const defenderAutoRetreats = [];

    for (let i = 0; i < steps.length; i++) {
      const wsx = toInt(steps[i].x);
      const wsy = toInt(steps[i].y);
      const locStep = useStackGrid ? gridCoords.worldMapCellToPlayerRoad(wsx, wsy) : null;
      const stepJun = locStep ? locStep.junId : junId;
      const stepPy = locStep ? locStep.gy : wsy;
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
      let skipHostileBecauseEncounterTransit = false;
      if (ROAD_ENCOUNTERS_ENABLED) {
      const [lockRows] = await conn.query(
        `SELECT encounter_id, attacker_player_id, defender_player_id
           FROM road_encounters
          WHERE season = ? AND jun_id = ? AND position_x = ? AND position_y = ?
            AND status IN ('pending','fighting')
          FOR UPDATE`,
        [season, stepJun, stepPx, stepPy],
      );
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
              error: `(${stepPx},${stepPy}) 道路交战进行中，不可将该格作为本次行军道路终点`,
            };
          }
          skipHostileBecauseEncounterTransit = true;
        }
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
        /** 行军目标为战略匪寨 / PVP 攻方大本营时：最后一道路步不登记道路遭遇（31-6 §4.2 / 17-7）。 */
        if ((marchToBanditPoi || marchToPvpCampPoi) && i === steps.length - 1) {
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
        // 道路遭遇战已下线：敌对同格与友方一样允许叠站，不登记遭遇、不要求开战门闸。
        if (!ROAD_ENCOUNTERS_ENABLED) {
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
        // 守门方：仅当格上防守方处于开战模式时记入 gatekeeper（31-6 §5）；其余敌对遭遇 gatekeeper 置空。
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

    const destPlayerRoad = resolveMoveDestinationPlayerRoad({
      appliedPoiSnap,
      poiAnchorEnd,
      poiAnchorJunIdEnd,
      lastWorldGx: lastX,
      lastWorldGy: lastY,
      useStackGrid: !!useStackGrid,
      requestJunId: junId,
    });
    const destRoadJunId = destPlayerRoad.junId;
    const destPx = destPlayerRoad.gx;
    const destPy = destPlayerRoad.gy;

    // 若中途遇敌停下，只对已走过的 steps 扣粮草 / 免费格；重新按 stepsApplied 结算
    // （AI 免粮草时保持 foodPlan 的全 0，不重算）
    if (!noFoodCost && stepsApplied < steps.length) {
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
              road_client_notice = NULL,
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
        scopedMoveReqId,
        pid,
      ],
    );

    if (reserveFoodUse > 0) {
      const factionReserveService = require('../factionReserveService');
      await factionReserveService.deductPoolOnConnection(conn, player.faction_id, {
        food: reserveFoodUse,
      });
      await factionReserveService.addUsageOnConnection(
        conn,
        player.faction_id,
        factionReserveService.CATEGORY.MARCH_FOOD,
        { food: reserveFoodUse },
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
    // 死锁（InnoDB 会整事务回滚，提示"try restarting transaction"）：标记可重试，由外层 moveAlongRoad 重跑。
    // 高发场景：同势力多个 AI 并发行军抢同一行 faction_reserve(pool) + 沿途玩家行的 FOR UPDATE。
    if (e && (e.code === 'ER_LOCK_DEADLOCK' || e.errno === 1213)) {
      return { ok: false, status: 409, error: 'DEADLOCK_RETRY', retryable: true };
    }
    console.error('[roadEncounterService] moveAlongRoad', e);
    return { ok: false, status: 500, error: e.message || '沿路移动失败' };
  } finally {
    conn.release();
  }
}

/** 死锁重试上限（含首次），指数退避 + 抖动，避免同势力 AI 同拍再次相撞。 */
const MOVE_DEADLOCK_MAX_ATTEMPTS = 3;

/**
 * 对外入口：沿路移动 + 死锁有界重试。
 * 仅对「事务整体回滚的死锁」重跑（`moveAlongRoadAttempt` 每次都重新读锁全部状态，且靠
 * `road_last_request_id` 幂等去重）；其它成功/正常失败路径行为与语义不变。
 */
async function moveAlongRoad(playerId, body) {
  for (let attempt = 1; attempt <= MOVE_DEADLOCK_MAX_ATTEMPTS; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const r = await moveAlongRoadAttempt(playerId, body);
    if (!r || !r.retryable) return r;
    if (attempt >= MOVE_DEADLOCK_MAX_ATTEMPTS) {
      return { ok: false, status: 503, error: '系统繁忙（道路锁竞争），请稍后重试' };
    }
    const backoffMs = 40 * attempt + Math.floor(Math.random() * 60);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }
  return { ok: false, status: 503, error: '系统繁忙（道路锁竞争），请稍后重试' };
}

module.exports = {
  moveAlongRoad,
};
