/**
 * 道路遭遇服务（31-6 玩法 / 02 §2.1.2 API 契约 / 01 §3.2.24 表结构）
 *
 * 责任：
 *   1. 守门开关（road_intercept）事务与银两扣减；
 *   2. 沿路移动事务：逐格校验道路集合、邻接、占格、M2 敌对、粮草链路（player.food → factions.reserve_food）、
 *      触发遭遇时瞬间占格（road_encounters.status='fighting'）、同一事务提交；
 *      非敌对（M2：同势力；缺 faction 视为非敌对）同格：允许叠站并继续本段路径，不因途经友军/中立而阻断。
 *   3. 郡内 presence：仅在线他人 road_position + 锁格；
 *   4. 战后解锁：写 status='resolved'、ended_at、battle_id；战败方关闭守门。
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

const INTERCEPT_COST_SILVER = 40;                 // 31-6 §三（暂定）
const FREE_MOVES_PER_DAY = 50;                    // 31-6 §9.1
const FOOD_PER_STEP = 10;                         // 31-6 §9.1
const RESERVE_FOOD_DAILY_LIMIT = 500;             // 31-6 §十

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
  try {
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
  } catch (e) {
    if (/Unknown column/i.test(e.message || '')) {
      return { ok: false, status: 503, error: '数据库缺少道路状态列；请执行 add-players-road-state.sql' };
    }
    throw e;
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
      `SELECT city_id, city_type, position_x, position_y FROM cities WHERE jun_id = ? AND season = ?`,
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
        // 敌对 → 登记遭遇（status='fighting'），攻方落脚到该格，后续 steps 中断。
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

// ── 战后解锁 ──────────────────────────────────────────────────────────────────

/**
 * 战后收尾：
 *   - road_encounters: status=resolved, battle_id, ended_at
 *   - 守门方若战败，关闭其 road_intercept（31-6 §三）
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
      `SELECT encounter_id, status, attacker_player_id, defender_player_id, gatekeeper_player_id
         FROM road_encounters WHERE encounter_id = ? FOR UPDATE`,
      [eid],
    );
    const row = rows[0];
    if (!row) {
      await conn.rollback();
      return { ok: false, status: 404, error: '遭遇实例不存在' };
    }
    if (row.attacker_player_id !== pid && row.defender_player_id !== pid) {
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

module.exports = {
  INTERCEPT_COST_SILVER,
  FREE_MOVES_PER_DAY,
  FOOD_PER_STEP,
  RESERVE_FOOD_DAILY_LIMIT,
  setIntercept,
  getSelfRoadState,
  moveAlongRoad,
  getRoadPresence,
  resolveEncounter,
};
