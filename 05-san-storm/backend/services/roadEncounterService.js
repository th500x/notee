/**
 * 道路遭遇服务（31-6 玩法 / 02 §2.1.2 API 契约 / 01 §3.2.24 表结构）
 *
 * 聚合入口：对外 `module.exports` 不变，路由层 `roadEncounterService.xxx(...)` 全部继续可用。
 *
 * 物理拆分：
 *   - 常量 + helper           → `services/road/roadShared.js`
 *   - Stale / 幽灵清理        → `services/road/roadStaleCleanup.js`
 *   - 守门 `setIntercept`     → `services/road/roadInterceptService.js`
 *   - presence / 守方轮询     → `services/road/roadPresenceService.js`
 *   - 沿路移动 `moveAlongRoad` → `services/road/roadMoveAlongService.js`（O3-A3）
 *   本文件保留：战斗周期（payload / record / resolve）、权威推演与查询。
 */

const { pool } = require('../database/connection');
const {
  loadRoadGrid,
  loadRoadGridSan1YuVerticalStack,
  isSan1YuStackRoadJunId,
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
const { hashSeed } = require('./pvp/auto-duel/pvpAutoDuelSim');
const { tacticalToAutoDuelResult } = require('./pvp/tactical/tacticalToAutoDuelResult');
const tacticalRoomService = require('./pvp/tactical/pvpTacticalRoomService');
const tacticalSimRunner = require('./pvp/tactical/pvpTacticalSimRunner');
const battleService = require('./battleService');
const { newShortBattleId } = require('../utils/battleId');
const {
  calculateBattleScore,
  buildTroopsForAttackerScore,
  buildTroopsForDefenderScore,
  SIEGE_PVP_ONLINE_SCORE_MULT,
} = require('../utils/battleScore.cjs');
const { buildDefenderPvpAutoDuelBattleLog } = require('./pvp/auto-duel/pvpAutoDuelBattleLog');

const {
  INTERCEPT_COST_SILVER,
  FREE_MOVES_PER_DAY,
  FOOD_PER_STEP,
  RESERVE_FOOD_DAILY_LIMIT,
  ROAD_DEFENDER_ALERT_SEC,
  STALE_FIGHT_SQL_MIN,
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
const gridCoords = require('../../shared/utils/strategicGridCoordinates.js');
const { setIntercept } = require('./road/roadInterceptService');
const {
  getSelfRoadState,
  getRoadPresence,
  getPendingDefenderEncounter,
} = require('./road/roadPresenceService');
const { moveAlongRoad } = require('./road/roadMoveAlongService');

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
    let equipmentDrop = null;
    if (result === 'win' && killCount > 0) {
      const killedRarities = killedIndices
        .map((j) => garrisonUnits[Number(j)]?.rarity)
        .filter(Boolean);
      const bestRarity = smallMapBattleLootService.pickBestRarityFromKills(killedRarities);
      const repLoot = await smallMapBattleLootService.grantWinReputationAndEquipment(
        conn,
        pid,
        bestRarity,
      );
      reputationReward = repLoot.reputationReward;
      equipmentDrop = repLoot.equipmentDrop;
    }

    const shouldFallbackAddBattleScore = Number(battleScore) > 0 && battleReportSaved === false;
    if (shouldFallbackAddBattleScore) {
      await conn.query(
        'UPDATE player_statistics SET total_battle_score = total_battle_score + ? WHERE player_id = ?',
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
        { instanceIds: allTroopInstanceIds },
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
        equipmentDrop,
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
 *   - 守门方若战败，关闭其 road_intercept（31-6 §3）
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

// ── 道路遭遇：服务端权威推演（与 `pvpGarrisonAutoDuelResolveService` 同源 `runPvpAutoDuel`）────────────────

/** ESM 战术内核动态加载（缓存；17-5-3 阶段 4 接入真实道路链条） */
let _roadKernelPromise = null;
function loadTacticalKernel() {
  if (!_roadKernelPromise) {
    _roadKernelPromise = import('../../shared/battle/tacticalSim/runPvpTacticalDuel.js');
  }
  return _roadKernelPromise;
}

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

  // 17-5-3 阶段 4：战术内核 runPvpTacticalDuel 替换自动对决（道路无城防）；经适配器回到 sim.* 同形。
  const duelMapId = await tacticalRoomService.pickDuelMapIdForSeed(seed);
  const kernel = await loadTacticalKernel();
  const tactical = kernel.runPvpTacticalDuel({
    duelMapId,
    lineupSnapshots: { a: attackerNpcs, b: defenderNpcs },
    battleSeed: seed,
    sideLabels: { a: '攻方', b: '守方' },
  });
  const adapted = tacticalToAutoDuelResult({
    winnerSide: tactical.winnerSide,
    finalState: tactical.finalState,
    attackerSnapshot: attackerNpcs,
    defenderSnapshot: defenderNpcs,
  });
  const sim = {
    attackerWon: adapted.attackerWon,
    killedIndices: adapted.killedIndices,
    attackerTroopsEnd: adapted.attackerTroopsEnd,
    defenderTroopsEnd: adapted.defenderTroopsEnd,
    battleLog: tactical.battleLog,
    rounds: tactical.rounds,
    battleSeed: seed >>> 0,
  };
  const result = sim.attackerWon ? 'win' : 'lose';
  const killedIndices = Array.from(new Set((sim.killedIndices || []).map((x) => Number(x)).filter((i) => Number.isFinite(i) && i >= 0 && i < defenderNpcs.length)));

  // 战报 id 先行生成（供事件房间回填 battle_id_a/b 与 rewards.eventReplay）
  const battleId = newShortBattleId('road_pvp_atk');
  const defBattleId = newShortBattleId('road_pvp_def');

  // 事件流回放房间（best-effort；落库失败不阻断权威结算）
  let eventReplay = null;
  try {
    const { roomId, maxSeq } = await tacticalSimRunner.persistResolvedDuelRoom({
      attackerId,
      defenderId,
      duelMapId,
      battleSeed: seed,
      lineupSnapshots: { a: attackerNpcs, b: defenderNpcs },
      sim: { events: tactical.events, winnerSide: tactical.winnerSide, finalState: tactical.finalState },
      battleIdA: battleId,
      battleIdB: defBattleId,
      season: row.season ?? null,
    });
    eventReplay = { source: 'pvp_tactical_room_events', roomId, maxSeq };
  } catch (e) {
    console.error('[roadEncounterService] persistResolvedDuelRoom', {
      message: e.message, attackerId, encounterId,
    });
  }

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
    await garrisonService.applyAuthoritativePvpAutoDuelAttackerLineupCasualties(attackerId, attackerNpcs, sim.attackerTroopsEnd);
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
  const defenderPerspectiveLog = buildDefenderPvpAutoDuelBattleLog({
    battleLogLines: sim.battleLog,
    attackerPlayerName: attackerName,
    defenderPlayerName: defenderName,
    cityName: '道路',
  });

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
        ...(eventReplay ? { eventReplay } : {}),
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
        autoDuelBattleLog: battleLogText,
        roadEncounterId: encounterId,
        ...(eventReplay ? { eventReplay } : {}),
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
    ...(eventReplay ? { eventReplay } : {}),
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
