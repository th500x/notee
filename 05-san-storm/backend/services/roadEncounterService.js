/**
 * 道路遭遇服务（31-6 玩法 / 02 §2.1.2 API 契约 / 01 §3.2.24 表结构）
 *
 * 责任：
 *   1. 守门开关（road_intercept）事务与银两扣减；
 *   2. 沿路移动事务：逐格校验道路集合、邻接、占格、M2 敌对、粮草链路（player.food → factions.reserve_food）、
 *      触发遭遇时瞬间占格（road_encounters.status='fighting'）、同一事务提交；
 *      攻方未达开战门闸时 **禁止** 踏入存在敌对玩家的道路格（整单 409，避免卡住）；守方未达门闸则不登记遭遇并将其 **`road_position_*` 写回最近己方城锚格**（共享 `roadBattleRetreatPlacement`）；
 *      非敌对（M2：同势力；缺 faction 视为非敌对）同格：允许叠站并继续本段路径，不因途经友军/中立而阻断。
 *   3. 郡内 presence：仅在线他人 road_position + 锁格；
 *   4. 战后解锁：写 status='resolved'、ended_at、battle_id；战败方移回最近己方城；守门方战败关闭 `road_intercept`。
 *
 * 所有对 players 的写入先 `SELECT … FOR UPDATE`；遭遇占格也在事务内 `SELECT … FOR UPDATE`。
 * 幂等：同一 `clientRequestId` 命中 players.road_last_request_id 时返回当前快照，不重复扣费 / 移格。
 */

const crypto = require('crypto');
const { pool } = require('../database/connection');
const { loadRoadGrid, findMainCityFootprint, cellKey, isNeighbor4 } = require('../utils/roadGrid');
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

const { WIN_REPUTATION_REWARD } = smallMapBattleLootService;

const INTERCEPT_COST_SILVER = 40;                 // 31-6 §三（暂定）
const FREE_MOVES_PER_DAY = 50;                    // 31-6 §9.1
const FOOD_PER_STEP = 10;                         // 31-6 §9.1
const RESERVE_FOOD_DAILY_LIMIT = 500;             // 31-6 §十
/** 守方遇袭弹窗倒计时长（秒），与攻城披挂 `WAIT_IN_GAME` 产品口径对齐 */
const ROAD_DEFENDER_ALERT_SEC = 10;
/**
 * `fighting` 且从未写入 `battle_id`、超过此时长仍无结算提交：视为客户端未进战/未打完等卡死，自动 `cancelled` 释放格锁。
 * 须明显长于单场本地战可能时长；短于「玩家长期挂机不关页」误伤窗口。
 */
const STALE_FIGHTING_NO_SETTLEMENT_MINUTES = 5;
/** MySQL/MariaDB 预编译对 `INTERVAL ? MINUTE` 常不生效，Stale 清理须用字面分钟数（仅来自上常数，禁止拼接用户输入） */
const STALE_FIGHT_SQL_MIN = Math.max(1, Math.min(10080, Math.floor(Number(STALE_FIGHTING_NO_SETTLEMENT_MINUTES) || 5)));

function newEncounterId(junId) {
  const bare = String(junId || '').replace(/^san_1_jun_/, '') || 'jun';
  const rnd = crypto.randomBytes(3).toString('hex');
  return `re_${bare}_${Date.now()}_${rnd}`.slice(0, 50);
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function buildPlayerRoadSnapshot(player) {
  return {
    road_jun_id: player.road_jun_id || null,
    road_position_x: player.road_position_x != null ? Number(player.road_position_x) : null,
    road_position_y: player.road_position_y != null ? Number(player.road_position_y) : null,
    road_intercept: player.road_intercept ? 1 : 0,
    road_updated_at: player.road_updated_at || null,
  };
}

/**
 * 交战格「幽灵」：`road_encounters` 仍为 pending/fighting，但攻防未同时立于该格坐标（断线、未结算、旧数据等）。
 * 若不清理，第三者或守方会被「非本场不可闯入 / 守方禁离格」误伤。本事务内直接 resolved。
 *
 * @param {*} conn 事务连接（`getConnection`）
 */
async function resolveStaleRoadEncountersAtCell(conn, season, junId, px, py) {
  const s = String(season || '').trim();
  const j = String(junId || '').trim();
  const x = toInt(px);
  const y = toInt(py);
  if (!s || !j || x == null || y == null) return;
  // 双方仍站在格上但长期无结算（未进战、前端异常、旧 bug）：`battle_id` 不会被写入，不能仅靠下行「幽灵」条件解锁。
  await conn.query(
    `UPDATE road_encounters e
        SET e.status = 'cancelled', e.ended_at = NOW()
      WHERE e.season = ? AND e.jun_id = ?
        AND e.position_x = ? AND e.position_y = ?
        AND e.status = 'fighting'
        AND e.battle_id IS NULL
        AND e.started_at IS NOT NULL
        AND e.started_at < DATE_SUB(NOW(), INTERVAL ${STALE_FIGHT_SQL_MIN} MINUTE)`,
    [s, j, x, y],
  );
  await conn.query(
    `UPDATE road_encounters e
        SET e.status = 'resolved', e.ended_at = NOW()
      WHERE e.season = ? AND e.jun_id = ?
        AND e.position_x = ? AND e.position_y = ?
        AND e.status IN ('pending','fighting')
        AND NOT (
          EXISTS (
            SELECT 1 FROM players pa
            WHERE pa.player_id = e.attacker_player_id
              AND pa.road_jun_id = e.jun_id
              AND pa.road_position_x = e.position_x
              AND pa.road_position_y = e.position_y
          )
          AND EXISTS (
            SELECT 1 FROM players pd
            WHERE pd.player_id = e.defender_player_id
              AND pd.road_jun_id = e.jun_id
              AND pd.road_position_x = e.position_x
              AND pd.road_position_y = e.position_y
          )
        )`,
    [s, j, x, y],
  );
}

// ── 守门开关 ──────────────────────────────────────────────────────────────────

/**
 * @param {string} playerId
 * @param {boolean} enable
 * @param {string} [clientRequestId]
 */
async function setIntercept(playerId, enable, clientRequestId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT player_id, silver, road_intercept, road_jun_id, road_position_x, road_position_y,
              road_updated_at, road_last_request_id
         FROM players WHERE player_id = ? FOR UPDATE`,
      [pid],
    );
    const player = rows[0];
    if (!player) {
      await conn.rollback();
      return { ok: false, status: 404, error: '玩家不存在' };
    }

    const reqId = clientRequestId ? String(clientRequestId).trim() : '';
    if (reqId && player.road_last_request_id === reqId) {
      await conn.commit();
      return { ok: true, data: { ...buildPlayerRoadSnapshot(player), silver: Number(player.silver) || 0, costSilver: 0, idempotent: true } };
    }

    const want = enable ? 1 : 0;
    const cur = player.road_intercept ? 1 : 0;
    let cost = 0;

    if (want === 1 && cur === 0) {
      const silver = Number(player.silver) || 0;
      if (silver < INTERCEPT_COST_SILVER) {
        await conn.rollback();
        return { ok: false, status: 409, error: `开启开战模式需 ${INTERCEPT_COST_SILVER} 银两` };
      }
      cost = INTERCEPT_COST_SILVER;
      await conn.query(
        `UPDATE players
            SET silver = silver - ?,
                road_intercept = 1,
                road_updated_at = NOW(),
                road_last_request_id = ?
          WHERE player_id = ?`,
        [INTERCEPT_COST_SILVER, reqId || null, pid],
      );
    } else if (want === 0 && cur === 1) {
      await conn.query(
        `UPDATE players
            SET road_intercept = 0,
                road_updated_at = NOW(),
                road_last_request_id = ?
          WHERE player_id = ?`,
        [reqId || null, pid],
      );
    } else {
      await conn.query(
        `UPDATE players SET road_last_request_id = ? WHERE player_id = ?`,
        [reqId || null, pid],
      );
    }

    const [after] = await conn.query(
      `SELECT silver, road_intercept, road_jun_id, road_position_x, road_position_y, road_updated_at
         FROM players WHERE player_id = ?`,
      [pid],
    );
    await conn.commit();

    if (cost > 0) {
      try { await statisticsDeltaService.incrementSpent(pid, { silver: cost }); } catch (_) {}
    }

    return {
      ok: true,
      data: {
        ...buildPlayerRoadSnapshot(after[0]),
        silver: Number(after[0].silver) || 0,
        costSilver: cost,
        idempotent: false,
      },
    };
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    if (/Unknown column/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少道路状态列；请在 backend 目录执行 `node scripts/apply-pending-local-ddl.js` 应用 add-players-road-state.sql' };
    }
    console.error('[roadEncounterService] setIntercept', e);
    return { ok: false, status: 500, error: e.message || '设置开战模式失败' };
  } finally {
    conn.release();
  }
}

// ── 自身道路状态 ──────────────────────────────────────────────────────────────

async function getSelfRoadState(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT road_jun_id, road_position_x, road_position_y, road_intercept, road_updated_at,
              food, silver,
              road_reserve_date, road_reserve_used,
              road_move_free_date, road_move_free_used,
              road_client_notice
         FROM players WHERE player_id = ? FOR UPDATE`,
      [pid],
    );
    if (!rows.length) {
      await conn.rollback();
      return { ok: false, status: 404, error: '玩家不存在' };
    }
    const r = rows[0];
    let pendingRoadNotice = null;
    const rawNotice = r.road_client_notice != null ? String(r.road_client_notice).trim() : '';
    if (rawNotice) {
      pendingRoadNotice = rawNotice;
      await conn.query(`UPDATE players SET road_client_notice = NULL WHERE player_id = ?`, [pid]);
    }
    await conn.commit();
    return {
      ok: true,
      data: {
        ...buildPlayerRoadSnapshot(r),
        food: Number(r.food) || 0,
        silver: Number(r.silver) || 0,
        roadReserveDate: r.road_reserve_date || null,
        roadReserveUsed: Number(r.road_reserve_used) || 0,
        roadMoveFreeDate: r.road_move_free_date || null,
        roadMoveFreeUsed: Number(r.road_move_free_used) || 0,
        pendingRoadNotice: pendingRoadNotice || undefined,
      },
    };
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {}
    if (/Unknown column/i.test(e.message || '') && /road_client_notice/i.test(e.message || '')) {
      const [rows] = await pool.query(
        `SELECT road_jun_id, road_position_x, road_position_y, road_intercept, road_updated_at,
                food, silver,
                road_reserve_date, road_reserve_used,
                road_move_free_date, road_move_free_used
           FROM players WHERE player_id = ?`,
        [pid],
      );
      if (!rows.length) return { ok: false, status: 404, error: '玩家不存在' };
      const r = rows[0];
      return {
        ok: true,
        data: {
          ...buildPlayerRoadSnapshot(r),
          food: Number(r.food) || 0,
          silver: Number(r.silver) || 0,
          roadReserveDate: r.road_reserve_date || null,
          roadReserveUsed: Number(r.road_reserve_used) || 0,
          roadMoveFreeDate: r.road_move_free_date || null,
          roadMoveFreeUsed: Number(r.road_move_free_used) || 0,
        },
      };
    }
    if (/Unknown column/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少道路状态列；请执行 add-players-road-state.sql' };
    }
    throw e;
  } finally {
    conn.release();
  }
}

// ── 沿路移动 ──────────────────────────────────────────────────────────────────

/** 判断 path 是否合法（非空、逐格相邻、格坐标为整数） */
function validatePathShape(path) {
  if (!Array.isArray(path) || !path.length) return '路径为空';
  for (const step of path) {
    if (!step || typeof step !== 'object') return '路径格式错误';
    const x = toInt(step.x);
    const y = toInt(step.y);
    if (x == null || y == null) return '路径格坐标缺失';
  }
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!isNeighbor4(Number(a.x), Number(a.y), Number(b.x), Number(b.y))) {
      return '路径格非 4-邻接';
    }
  }
  return null;
}

/**
 * 沿路移动（权威写位置 + 粮草 / 势力储备）
 *
 * @param {string} playerId
 * @param {{ season: string, junId: string, path: Array<{x:number,y:number}>, clientRequestId: string, confirmFoodCost: boolean }} body
 */
async function moveAlongRoad(playerId, body) {
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

  // 先加载栅格与当前 presence / 锁格（事务外读，事务内二次校验最关键的「锁格」）
  const grid = await loadRoadGrid(season, junId);
  if (grid.source === 'none' || !grid.cells.size) {
    return { ok: false, status: 400, error: `郡 ${junId} 缺少道路栅格数据（merged.json 未生成或无 roadCells）` };
  }

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

    const [countyCityRows] = await conn.query(
      `SELECT city_id, city_type, position_x, position_y, faction_id FROM cities WHERE jun_id = ? AND season = ?`,
      [junId, season],
    );
    const mainCityDbRow =
      player.main_city_id != null && String(player.main_city_id).trim() !== ''
        ? countyCityRows.find((r) => String(r.city_id) === String(player.main_city_id)) || null
        : null;

    // 幂等：已处理过同一请求 id → 返回当前快照，不重复扣费 / 移格。
    if (player.road_last_request_id && player.road_last_request_id === clientRequestId) {
      const [again] = await conn.query(
        `SELECT road_jun_id, road_position_x, road_position_y, road_intercept, road_updated_at,
                food, road_move_free_used, road_reserve_used
           FROM players WHERE player_id = ?`,
        [pid],
      );
      await conn.commit();
      const p2 = again[0] || player;
      const idemPath = Array.isArray(body.path) && body.path.length ? body.path : [];
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

    const targetCityIdRaw = body.targetCityId != null ? String(body.targetCityId).trim() : '';
    let resolvedPath = Array.isArray(body.path) ? body.path : [];
    let poiAnchorEnd = null;

    if (targetCityIdRaw) {
      const [cRows] = await conn.query(
        `SELECT city_id AS cityId, city_type AS cityType, faction_id AS factionId,
                position_x AS positionX, position_y AS positionY
           FROM cities WHERE city_id = ? LIMIT 1`,
        [targetCityIdRaw],
      );
      if (!cRows.length) {
        await conn.rollback();
        return { ok: false, status: 404, error: '目标城池不存在' };
      }
      const cityRow = cRows[0];
      const acc = marchPoi.canPlayerMarchToPoiCity({
        cityRow,
        cityId: targetCityIdRaw,
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
        targetCityId: targetCityIdRaw,
        collectMainCityFootprintKeys: (cells, mainId) =>
          findMainCityFootprint(cells, mainId, grid.mapColumns, grid.mapRows),
        targetCityDbRow: cityRow,
        mainCityDbRow,
        citiesInCountyRows: countyCityRows,
      });
      if (!built.ok) {
        await conn.rollback();
        return { ok: false, status: 400, error: built.error };
      }
      resolvedPath = built.path;
      poiAnchorEnd = built.poiAnchor || null;
    }

    const pathShapeErr = validatePathShape(resolvedPath);
    if (pathShapeErr) {
      await conn.rollback();
      return { ok: false, status: 400, error: pathShapeErr };
    }

    // 解算起点：path[0] 必须等于当前 road_position（若已在路上），
    // 或当 player 未在路上时为主城块邻接的道路格。
    const startX = toInt(player.road_position_x);
    const startY = toInt(player.road_position_y);
    const startKey =
      startX != null && startY != null && player.road_jun_id === junId ? cellKey(startX, startY) : null;
    const onRoad = startKey != null && grid.cells.has(startKey);

    const first = resolvedPath[0];
    const firstX = toInt(first.x);
    const firstY = toInt(first.y);
    if (!grid.cells.has(cellKey(firstX, firstY))) {
      await conn.rollback();
      return { ok: false, status: 400, error: `起点 (${firstX},${firstY}) 非道路格` };
    }

    if (onRoad) {
      if (firstX !== startX || firstY !== startY) {
        await conn.rollback();
        return { ok: false, status: 400, error: `路径起点须为当前道路位置 (${startX},${startY})` };
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

    // 道路 / 2×2 对象占格校验：逐步
    for (const step of resolvedPath) {
      const sx = toInt(step.x);
      const sy = toInt(step.y);
      if (!grid.cells.has(cellKey(sx, sy))) {
        await conn.rollback();
        return { ok: false, status: 400, error: `(${sx},${sy}) 非道路格` };
      }
      if (grid.blocked.has(cellKey(sx, sy))) {
        await conn.rollback();
        return { ok: false, status: 400, error: `(${sx},${sy}) 被 2×2 战略对象占据` };
      }
    }

    // ── 逐格落脚：占格锁 + 友敌判定 + 粮草扣减 ──
    // 路径第一格若已在其上（onRoad 且等于起点），不重复付出代价；后续每一格都算一步。
    const steps = onRoad ? resolvedPath.slice(1) : resolvedPath.slice(); // 首跳（未上路）仍计一格

    // 先清本格幽灵遭遇，避免「B 仍站着、库里有 fighting 但攻方已不在格」→ A 途经 B 格被误拦或守方被误锁
    if (onRoad && startX != null && startY != null) {
      await resolveStaleRoadEncountersAtCell(conn, season, junId, startX, startY);
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
          if (sx !== ex || sy !== ey) {
            leavesCell = true;
            break;
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
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const freeDateStr = player.road_move_free_date ? new Date(player.road_move_free_date).toISOString().slice(0, 10) : null;
    const reserveDateStr = player.road_reserve_date ? new Date(player.road_reserve_date).toISOString().slice(0, 10) : null;
    let freeUsed = freeDateStr === todayStr ? (Number(player.road_move_free_used) || 0) : 0;
    let reserveUsed = reserveDateStr === todayStr ? (Number(player.road_reserve_used) || 0) : 0;
    let freeRemaining = Math.max(0, FREE_MOVES_PER_DAY - freeUsed);
    const reserveRemaining = Math.max(0, RESERVE_FOOD_DAILY_LIMIT - reserveUsed);

    let usedFreeThisMove = 0;
    let paidSteps = 0; // 需付费的格数
    for (let i = 0; i < steps.length; i++) {
      if (freeRemaining > 0) {
        freeRemaining--;
        usedFreeThisMove++;
      } else {
        paidSteps++;
      }
    }
    const totalFoodCost = paidSteps * FOOD_PER_STEP;
    let playerFoodUse = Math.min(totalFoodCost, Number(player.food) || 0);
    let reserveFoodUse = totalFoodCost - playerFoodUse;

    if (reserveFoodUse > reserveRemaining) {
      await conn.rollback();
      return { ok: false, status: 409, error: `粮草不足且势力池垫粮将超当日 500 粮上限（还差 ${reserveFoodUse - reserveRemaining}）` };
    }

    // 从势力池扣减时须校验 factions.reserve_food 足量
    if (reserveFoodUse > 0) {
      const [fRows] = await conn.query(
        `SELECT id, reserve_food FROM factions WHERE id = ? FOR UPDATE`,
        [player.faction_id],
      );
      const faction = fRows[0];
      if (!faction) {
        await conn.rollback();
        return { ok: false, status: 500, error: '玩家势力不存在，无法从势力池扣粮' };
      }
      if ((Number(faction.reserve_food) || 0) < reserveFoodUse) {
        await conn.rollback();
        return { ok: false, status: 409, error: `势力粮草储备不足（需 ${reserveFoodUse}、现 ${faction.reserve_food}）` };
      }
    }

    // 逐格落脚 — 在事务内对每个候选格做 SELECT FOR UPDATE 锁检查（road_encounters + 占格玩家）。
    let lastX = onRoad ? startX : null;
    let lastY = onRoad ? startY : null;
    let encounter = null;
    let stepsApplied = 0;
    /** @type {Array<{ defenderPlayerId: string, retreatX?: number, retreatY?: number, reason?: string }>} */
    const defenderAutoRetreats = [];

    for (let i = 0; i < steps.length; i++) {
      const sx = toInt(steps[i].x);
      const sy = toInt(steps[i].y);

      // 与前一格的邻接：若 onRoad，则 lastX/Y 为当前；否则 first 是 lastX=null，首跳不要求与 lastX 相邻（已在主城邻接校验过）。
      if (lastX != null && lastY != null) {
        if (!isNeighbor4(lastX, lastY, sx, sy)) {
          await conn.rollback();
          return { ok: false, status: 400, error: `(${lastX},${lastY}) → (${sx},${sy}) 非相邻` };
        }
      }

      await resolveStaleRoadEncountersAtCell(conn, season, junId, sx, sy);

      // 1) 交战登记格：仅禁止「非本格遭遇参与方」跨入（31-6 §五「占格与锁格」）；与 `road_intercept` 无关。遭遇双方沿路移动/截断由下方同格敌对逻辑处理。
      const [lockRows] = await conn.query(
        `SELECT encounter_id, attacker_player_id, defender_player_id
           FROM road_encounters
          WHERE season = ? AND jun_id = ? AND position_x = ? AND position_y = ?
            AND status IN ('pending','fighting')
          FOR UPDATE`,
        [season, junId, sx, sy],
      );
      if (lockRows.length) {
        const lr = lockRows[0];
        const att = lr.attacker_player_id != null ? String(lr.attacker_player_id).trim() : '';
        const def = lr.defender_player_id != null ? String(lr.defender_player_id).trim() : '';
        const moving = String(pid).trim();
        const isParticipant = (att && moving === att) || (def && moving === def);
        if (!isParticipant) {
          await conn.rollback();
          return { ok: false, status: 409, error: `(${sx},${sy}) 交战进行中，非本场双方不可闯入` };
        }
      }

      // 2) 同格玩家
      const [occRows] = await conn.query(
        `SELECT player_id, faction_id, road_intercept
           FROM players
          WHERE road_jun_id = ? AND road_position_x = ? AND road_position_y = ?
            AND player_id <> ?
          ORDER BY player_id
          FOR UPDATE`,
        [junId, sx, sy, pid],
      );
      if (occRows.length) {
        let defender = null;
        for (const row of occRows) {
          if (isHostileByFaction(player.faction_id, row.faction_id)) {
            defender = row;
            break;
          }
        }
        if (!defender) {
          // 格上仅有非敌对玩家（M2：同势力等）：允许同格叠站，继续走后续路径。
          lastX = sx;
          lastY = sy;
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
            junId,
            grid,
            countyCityRows,
            playerId: other.player_id,
            fromX: sx,
            fromY: sy,
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
          lastX = sx;
          lastY = sy;
          stepsApplied = i + 1;
          continue;
        }
        // 敌对且守方满足开战门闸 → 登记遭遇（status='fighting'），攻方落脚到该格，后续 steps 中断。
        const encounterId = newEncounterId(junId);
        // 守门方：仅当格上防守方处于开战模式时记入 gatekeeper（31-6 §五）；其余敌对遭遇 gatekeeper 置空。
        const gatekeeperId = other.road_intercept ? other.player_id : null;
        await conn.query(
          `INSERT INTO road_encounters
              (encounter_id, season, jun_id, position_x, position_y,
               attacker_player_id, defender_player_id, gatekeeper_player_id,
               status, started_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'fighting', NOW())`,
          [encounterId, season, junId, sx, sy, pid, other.player_id, gatekeeperId],
        );
        encounter = {
          encounterId,
          season,
          junId,
          positionX: sx,
          positionY: sy,
          attackerPlayerId: pid,
          defenderPlayerId: other.player_id,
          gatekeeperPlayerId: gatekeeperId,
          status: 'fighting',
        };
        lastX = sx;
        lastY = sy;
        stepsApplied = i + 1;
        break;
      }

      lastX = sx;
      lastY = sy;
      stepsApplied = i + 1;
    }

    if (poiAnchorEnd && lastX != null && lastY != null && !encounter && stepsApplied === steps.length) {
      lastX = poiAnchorEnd.x;
      lastY = poiAnchorEnd.y;
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
        junId,
        lastX,
        lastY,
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
        targetCityId: targetCityIdRaw || undefined,
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

/**
 * @param {string} season
 * @param {string} junId
 * @param {string} callerPlayerId  不把自己列入「他人」
 */
async function getRoadPresence(season, junId, callerPlayerId) {
  const s = String(season || '').trim();
  const j = String(junId || '').trim();
  const caller = String(callerPlayerId || '').trim();
  if (!s || !j) return { ok: false, status: 400, error: '缺少 season / junId' };

  const thresholdSec = Math.ceil(DEFAULT_ONLINE_MS / 1000);

  try {
    const [others] = await pool.query(
      `SELECT p.player_id AS playerId,
              p.character_name AS characterName,
              p.faction_id AS factionId,
              p.faction_name AS factionName,
              p.avatar AS avatar,
              p.road_position_x AS roadPositionX,
              p.road_position_y AS roadPositionY,
              p.road_intercept AS roadIntercept,
              p.road_updated_at AS roadUpdatedAt
         FROM players p
         INNER JOIN accounts a ON a.id = p.player_id
        WHERE p.road_jun_id = ?
          AND p.road_position_x IS NOT NULL
          AND p.road_position_y IS NOT NULL
          AND p.player_id <> ?
          AND GREATEST(COALESCE(UNIX_TIMESTAMP(p.last_active_at), 0),
                       COALESCE(UNIX_TIMESTAMP(a.lastActiveAt), 0))
              > UNIX_TIMESTAMP(NOW()) - ?`,
      [j, caller || '', thresholdSec],
    );

    const [locks] = await pool.query(
      `SELECT encounter_id AS encounterId,
              position_x AS positionX,
              position_y AS positionY,
              status,
              attacker_player_id AS attackerPlayerId,
              defender_player_id AS defenderPlayerId,
              started_at AS startedAt
         FROM road_encounters
        WHERE season = ? AND jun_id = ? AND status IN ('pending','fighting')`,
      [s, j],
    );

    return {
      ok: true,
      data: {
        season: s,
        junId: j,
        thresholdMs: DEFAULT_ONLINE_MS,
        others: others.map((r) => ({
          playerId: r.playerId,
          characterName: r.characterName,
          factionId: r.factionId,
          factionName: r.factionName,
          avatar: r.avatar || null,
          roadPositionX: Number(r.roadPositionX),
          roadPositionY: Number(r.roadPositionY),
          roadIntercept: r.roadIntercept ? 1 : 0,
          roadUpdatedAt: r.roadUpdatedAt || null,
        })),
        lockedCells: locks.map((r) => ({
          encounterId: r.encounterId,
          positionX: Number(r.positionX),
          positionY: Number(r.positionY),
          status: r.status,
          attackerPlayerId: r.attackerPlayerId,
          defenderPlayerId: r.defenderPlayerId,
          startedAt: r.startedAt || null,
        })),
      },
    };
  } catch (e) {
    if (/road_encounters/i.test(e.message || '') && /doesn't exist/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少 road_encounters 表；请执行 create-road-encounters.sql' };
    }
    if (/Unknown column/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少道路状态列；请执行 add-players-road-state.sql' };
    }
    throw e;
  }
}

// ── 道路遭遇：守方遇袭轮询（与攻城 `/pvp/pending` 对称）────────────────────────

/**
 * 若当前用户为某条 fighting 遭遇的防守方且立点与交战格一致，返回遇袭摘要（否则 encounter=null）。
 *
 * @param {string} defenderPlayerId
 */
async function getPendingDefenderEncounter(defenderPlayerId) {
  const pid = String(defenderPlayerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };
  try {
    // 与 `resolveStaleRoadEncountersAtCell` 同阈值：守方轮询也能摘掉「永不结束」的 fighting，避免 UI 永久遇袭
    await pool.query(
      `UPDATE road_encounters e
          SET e.status = 'cancelled', e.ended_at = NOW()
        WHERE e.status = 'fighting'
          AND e.battle_id IS NULL
          AND e.started_at IS NOT NULL
          AND e.started_at < DATE_SUB(NOW(), INTERVAL ${STALE_FIGHT_SQL_MIN} MINUTE)
          AND (e.attacker_player_id = ? OR e.defender_player_id = ?)`,
      [pid, pid],
    );
    const [rows] = await pool.query(
      `SELECT e.encounter_id AS encounterId,
              e.attacker_player_id AS attackerPlayerId,
              e.started_at AS startedAt,
              pa.character_name AS attackerName
         FROM road_encounters e
         INNER JOIN players pd ON pd.player_id = e.defender_player_id
         LEFT JOIN players pa ON pa.player_id = e.attacker_player_id
        WHERE e.defender_player_id = ?
          AND e.status = 'fighting'
          AND pd.road_jun_id = e.jun_id
          AND pd.road_position_x = e.position_x
          AND pd.road_position_y = e.position_y
        ORDER BY e.started_at DESC
        LIMIT 1`,
      [pid],
    );
    if (!rows.length) {
      return { ok: true, data: { encounter: null } };
    }
    const r = rows[0];
    const startedMs = r.startedAt ? new Date(r.startedAt).getTime() : Date.now();
    const elapsedSec = Math.max(0, (Date.now() - startedMs) / 1000);
    const remainingSeconds = Math.max(0, Math.ceil(ROAD_DEFENDER_ALERT_SEC - elapsedSec));
    return {
      ok: true,
      data: {
        encounter: {
          encounterId: r.encounterId,
          attackerPlayerId: r.attackerPlayerId,
          attackerName: r.attackerName || '敌方',
          waitSeconds: ROAD_DEFENDER_ALERT_SEC,
          remainingSeconds,
        },
      },
    };
  } catch (e) {
    if (/road_encounters/i.test(e.message || '') && /doesn't exist/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少 road_encounters 表；请执行 create-road-encounters.sql' };
    }
    console.error('[roadEncounterService] getPendingDefenderEncounter', e);
    return { ok: false, status: 500, error: e.message || '查询道路遇袭失败' };
  }
}

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
      `SELECT encounter_id, status, attacker_player_id, defender_player_id, gatekeeper_player_id
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

function sumSiegeNpcStartingTroopsRoad(npcs) {
  if (!Array.isArray(npcs)) return 0;
  return npcs.reduce((sum, n) => {
    const cur = n?.currentTroops;
    const mx = n?.maxTroops;
    const v = cur != null && cur !== '' ? Number(cur) : Number(mx);
    return sum + (Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
  }, 0);
}

function siegeNpcDisplayNamesRoad(npcs) {
  const names = [];
  for (const n of npcs || []) {
    const c = n.character;
    const label = (c && (c.courtesyName || c.name)) || n.troopName;
    if (label) names.push(String(label).trim());
  }
  return names;
}

async function applyRoadEncounterLoserRetreatOnly(encRow, defenderWon) {
  const loserPlayerId = defenderWon ? encRow.attacker_player_id : encRow.defender_player_id;
  const cellX = toInt(encRow.position_x);
  const cellY = toInt(encRow.position_y);
  const encSeason = String(encRow.season || '').trim();
  const encJun = String(encRow.jun_id || '').trim();
  if (!loserPlayerId || cellX == null || cellY == null || !encSeason || !encJun) return;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const grid = await loadRoadGrid(encSeason, encJun);
    if (!grid?.rawCells?.length) {
      await conn.rollback();
      return;
    }
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
      console.warn('[roadEncounterService] authoritative road loser retreat skipped:', ret.error);
    }
    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {}
    console.warn('[roadEncounterService] authoritative road loser retreat', e);
  } finally {
    conn.release();
  }
}

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

  try {
    await applyRoadEncounterLoserRetreatOnly(row, !sim.attackerWon);
  } catch (_) {}

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
