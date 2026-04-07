/**
 * 战斗记录服务
 * 战斗保存、查询收藏，以及战后兵力/士气/耐久/积分/宝箱等副作用写入
 * @module services/battleService
 */

const Battle = require('../models/Battle');
const { pool } = require('../database/connection');
const { applyTroopDurabilityExhaustion } = require('./troopDurabilityService');

/**
 * 保存战斗记录
 * @param {Object} battleData - 战斗数据（前端camelCase → 数据库snake_case）
 * @returns {Promise<Object>} 保存的战斗记录
 */
async function saveBattle(battleData) {
  // 前端传入camelCase，转换为模型需要的snake_case
  const data = {
    battle_id: battleData.battleId,
    player_id: battleData.playerId,
    war_id: battleData.warId || null,
    battle_type: battleData.battleType,
    opponent_type: battleData.opponentType,
    opponent_id: battleData.opponentId || null,
    opponent_name: battleData.opponentName || null,
    result: battleData.result,
    player_team: battleData.playerTeam || null,
    opponent_team: battleData.opponentTeam || null,
    battle_log: battleData.battleLog || null,
    total_damage_dealt: battleData.totalDamageDealt || null,
    total_damage_taken: battleData.totalDamageTaken || null,
    total_kills: battleData.totalKills || null,
    duration: battleData.duration || null,
    rewards: battleData.rewards || null,
  };

  const created = await Battle.create(data);
  // 与 POST /api/battles 及服务端直接 saveBattle（如攻城推演）共用：插入成功后再累加 statistics
  await applyBattleStatistics(battleData.playerId, {
    result: battleData.result,
    totalDamageDealt: battleData.totalDamageDealt,
    totalDamageTaken: battleData.totalDamageTaken,
    totalKills: battleData.totalKills,
  });
  return created;
}

/**
 * 获取玩家战斗记录列表
 * @param {string} playerId - 玩家ID
 * @param {string} filter - 筛选类型：all/pvp/campaign/event/favorited
 * @returns {Promise<Array>}
 */
async function getBattles(playerId, filter = 'all') {
  return await Battle.getByPlayerId(playerId, { filter });
}

/**
 * 获取单条战斗记录详情
 * @param {string} battleId - 战斗ID
 * @returns {Promise<Object|null>}
 */
async function getBattleDetail(battleId) {
  return await Battle.getById(battleId);
}

/**
 * 收藏战斗
 * @param {string} playerId - 玩家ID
 * @param {string} battleId - 战斗ID
 * @returns {Promise<Object>} { success, message }
 */
async function favoriteBattle(playerId, battleId) {
  const canFav = await Battle.canFavorite(playerId);
  if (!canFav) {
    return { success: false, message: '最多只能收藏50场战斗' };
  }

  const ok = await Battle.favorite(playerId, battleId);
  if (!ok) {
    return { success: false, message: '战斗记录不存在或无权操作' };
  }

  return { success: true, message: '收藏成功' };
}

/**
 * 取消收藏
 * @param {string} playerId - 玩家ID
 * @param {string} battleId - 战斗ID
 * @returns {Promise<Object>} { success, message }
 */
async function unfavoriteBattle(playerId, battleId) {
  const ok = await Battle.unfavorite(playerId, battleId);
  if (!ok) {
    return { success: false, message: '战斗记录不存在或无权操作' };
  }

  return { success: true, message: '已取消收藏，日志将在14天后过期' };
}

/**
 * 更新活动排行积分（statistics.total_battle_score）。
 * recordOnly 路径和普通路径均调用此函数；失败时仅记录日志，不阻断主流程。
 *
 * @param {string} playerId
 * @param {number|string|undefined} battleScore
 */
async function applyBattleScore(playerId, battleScore) {
  const score = Number(battleScore);
  if (!score || score <= 0) return;
  try {
    await pool.query(
      'UPDATE statistics SET total_battle_score = total_battle_score + ? WHERE player_id = ?',
      [score, playerId],
    );
    console.log(`[battleService] 战斗积分更新: +${score} player=${playerId}`);
  } catch (err) {
    console.error('[battleService] 战斗积分更新失败:', err);
  }
}

/**
 * 战后累加 statistics：场次、胜负平、胜率、歼敌/自损兵力、击杀数。
 * 在 battles 表插入成功之后调用；仅打日志，不阻断主流程。
 *
 * @param {string} playerId
 * @param {{ result: 'win'|'lose'|'draw', totalDamageDealt?: number, totalDamageTaken?: number, totalKills?: number }} payload
 */
async function applyBattleStatistics(playerId, payload) {
  const { result, totalDamageDealt, totalDamageTaken, totalKills } = payload || {};
  const pid = playerId != null ? String(playerId).trim() : '';
  if (!pid || !result) return;
  if (result !== 'win' && result !== 'lose' && result !== 'draw') return;

  const dd = Math.max(0, Math.floor(Number(totalDamageDealt) || 0));
  const dt = Math.max(0, Math.floor(Number(totalDamageTaken) || 0));
  const k = Math.max(0, Math.floor(Number(totalKills) || 0));
  const w = result === 'win' ? 1 : 0;
  const l = result === 'lose' ? 1 : 0;
  const d = result === 'draw' ? 1 : 0;

  try {
    const [r1] = await pool.query(
      `UPDATE statistics SET
        total_battles = total_battles + 1,
        wins = wins + ?,
        losses = losses + ?,
        draws = draws + ?,
        total_damage_dealt = total_damage_dealt + ?,
        total_damage_taken = total_damage_taken + ?,
        total_kills = total_kills + ?
       WHERE player_id = ?`,
      [w, l, d, dd, dt, k, pid],
    );
    if (!r1.affectedRows) {
      console.warn('[battleService] statistics 累加未命中行（无 statistics 行或 player_id 不匹配）:', pid);
      return;
    }
    await pool.query(
      `UPDATE statistics SET
        win_rate = CASE
          WHEN total_battles > 0 THEN ROUND(100 * wins / total_battles, 2)
          ELSE 0
        END
       WHERE player_id = ?`,
      [pid],
    );
    console.log(`[battleService] statistics 累加: player=${pid} result=${result} dmg ${dd}/${dt} kills=${k}`);
  } catch (err) {
    console.error('[battleService] statistics 累加失败:', err);
  }
}

/**
 * 将地图宝箱掉落的装备写入 player_cards。
 * 每件独立 try，单件失败不影响其他件。失败时仅记录日志，不阻断主流程。
 *
 * equipmentId 必须与 config_equipment.equipment_id（及前端 equipment.json）一致。
 * @see docs/00-base/04-ID_NAMING_GUIDE.md §12
 *
 * @param {string} playerId
 * @param {Array<{ equipmentId?: string, card_id?: string, rarity?: string }>} chestRewards
 */
async function saveChestRewards(playerId, chestRewards) {
  if (!Array.isArray(chestRewards) || chestRewards.length === 0) return;
  const season = 'san_1';
  let saved = 0;
  for (const reward of chestRewards) {
    try {
      const equipmentId = reward.equipmentId || reward.card_id;
      if (!equipmentId || typeof equipmentId !== 'string') {
        console.error('[battleService] 宝箱入库缺少 equipmentId', { playerId, reward });
        continue;
      }
      const [rows] = await pool.query(
        'SELECT equipment_id FROM config_equipment WHERE season = ? AND equipment_id = ? LIMIT 1',
        [season, equipmentId],
      );
      if (!rows[0]) {
        console.error('[battleService] 宝箱 equipmentId 在 config_equipment 中不存在', { equipmentId, season, playerId });
        continue;
      }
      const instanceId = `${equipmentId}_${playerId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await pool.query(
        `INSERT INTO player_cards (instance_id, player_id, card_id, card_type, rarity, is_equipped)
         VALUES (?, ?, ?, 'equipment', ?, FALSE)`,
        [instanceId, playerId, equipmentId, reward.rarity || 'common'],
      );
      saved += 1;
    } catch (err) {
      console.error('[battleService] 单件宝箱装备保存失败:', err);
    }
  }
  console.log(`[battleService] 宝箱装备保存: ${saved}/${chestRewards.length} 件 player=${playerId}`);
}

/**
 * 战斗结束后的部队/玩家状态更新（耐久、兵力、士气、耐久耗尽处理）。
 * 三段逻辑全部独立 try，互不阻断；最终统一调用 applyTroopDurabilityExhaustion。
 *
 * @param {string} playerId
 * @param {object} options
 * @param {Array<{ instanceId: string, currentTroops: number, maxTroops?: number }>} [options.troopCasualties]
 * @param {Array<{ target: 'player'|'card', instanceId?: string, morale: number }>} [options.moraleUpdates]
 */
async function applyBattlePostEffects(playerId, { troopCasualties, moraleUpdates } = {}) {
  // 上阵部队耐久消耗：battle_count +1（钳制在 [0, max_battle_count]，避免 NULL/负数脏数据）
  try {
    const [updated] = await pool.query(
      `UPDATE player_cards
       SET battle_count = LEAST(
         GREATEST(COALESCE(battle_count, 0), 0) + 1,
         COALESCE(max_battle_count, 60)
       )
       WHERE player_id = ? AND card_type = 'troop' AND is_equipped = TRUE`,
      [playerId],
    );
    if (updated.affectedRows > 0) {
      console.log(`[battleService] 部队耐久消耗: player=${playerId}, ${updated.affectedRows}张部队卡 battle_count+1`);
    }
  } catch (err) {
    console.error('[battleService] 部队耐久消耗更新失败:', err);
  }

  // 战后兵力写入
  if (Array.isArray(troopCasualties) && troopCasualties.length > 0) {
    try {
      for (const tc of troopCasualties) {
        if (tc.instanceId && tc.currentTroops != null) {
          const lostAt = tc.currentTroops < (tc.maxTroops ?? 9999) ? new Date() : null;
          await pool.query(
            'UPDATE player_cards SET current_troops = ?, last_troops_lost_at = ? WHERE instance_id = ? AND player_id = ?',
            [Math.max(0, tc.currentTroops), lostAt, tc.instanceId, playerId],
          );
        }
      }
      console.log(`[battleService] 兵力更新: ${troopCasualties.length}支部队 player=${playerId}`);
    } catch (err) {
      console.error('[battleService] 兵力更新失败:', err);
    }
  }

  // 战后士气写入
  if (Array.isArray(moraleUpdates) && moraleUpdates.length > 0) {
    try {
      for (const mu of moraleUpdates) {
        const morale = Math.max(0, Math.min(120, mu.morale));
        if (mu.target === 'player') {
          await pool.query('UPDATE players SET morale = ? WHERE player_id = ?', [morale, playerId]);
        } else if (mu.target === 'card' && mu.instanceId) {
          await pool.query(
            'UPDATE player_cards SET morale = ? WHERE instance_id = ? AND player_id = ?',
            [morale, mu.instanceId, playerId],
          );
        }
      }
      console.log(`[battleService] 士气更新: ${moraleUpdates.length}条 player=${playerId}`);
    } catch (err) {
      console.error('[battleService] 士气更新失败:', err);
    }
  }

  // 耐久耗尽处理：金卸下、白蓝紫删除、橙保留；驻守槽同步清空
  try {
    await applyTroopDurabilityExhaustion((sql, params) => pool.query(sql, params), playerId);
  } catch (err) {
    console.error('[battleService] 耐久耗尽处理失败:', err);
  }
}

module.exports = {
  saveBattle,
  getBattles,
  getBattleDetail,
  favoriteBattle,
  unfavoriteBattle,
  applyBattleScore,
  applyBattleStatistics,
  saveChestRewards,
  applyBattlePostEffects,
};
