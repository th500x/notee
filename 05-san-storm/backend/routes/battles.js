/**
 * 战斗记录API路由
 * 提供战斗记录的保存、查询、收藏功能
 */

const express = require('express');
const router = express.Router();
const battleService = require('../services/battleService');
const { pool } = require('../database/connection');

/**
 * 获取玩家战斗记录列表
 * GET /api/battles?playerId=xxx&filter=all
 * 
 * 查询参数：
 * - playerId: 玩家ID（必填）
 * - filter: 筛选类型（可选，默认all）
 *   - all: 全部
 *   - pvp: 所有PVP战斗
 *   - campaign: 战役PVE
 *   - event: 事件PVE
 *   - favorited: 仅收藏
 */
router.get('/', async (req, res) => {
  try {
    const { playerId, filter } = req.query;

    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: '缺少playerId参数'
      });
    }

    const battles = await battleService.getBattles(playerId, filter);

    res.json({
      success: true,
      battles,
      count: battles.length
    });
  } catch (error) {
    console.error('[battles] 获取战斗记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取战斗记录失败',
      error: error.message
    });
  }
});

/**
 * 获取单条战斗记录详情
 * GET /api/battles/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const battle = await battleService.getBattleDetail(req.params.id);

    if (!battle) {
      return res.status(404).json({
        success: false,
        message: '战斗记录不存在'
      });
    }

    res.json({
      success: true,
      battle
    });
  } catch (error) {
    console.error('[battles/:id] 获取战斗详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取战斗详情失败',
      error: error.message
    });
  }
});

/**
 * 保存战斗记录
 * POST /api/battles
 * 
 * Body: {
 *   battleId, playerId, warId?,
 *   battleType, opponentType, opponentId?, opponentName?,
 *   result,
 *   playerTeam?, opponentTeam?, battleLog?,
 *   totalDamageDealt?, totalDamageTaken?, totalKills?, duration?,
 *   rewards?
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { battleId, playerId, battleType, opponentType, result } = req.body;

    // 必填字段校验
    if (!battleId || !playerId || !battleType || !opponentType || !result) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段：battleId, playerId, battleType, opponentType, result'
      });
    }

    // 枚举值校验
    const validBattleTypes = ['pvp_field', 'pvp_siege', 'pvp_defense', 'pve_campaign', 'pve_event', 'pve_siege'];
    const validOpponentTypes = ['player', 'campaign_enemy', 'event_enemy'];
    const validResults = ['win', 'lose', 'draw'];

    if (!validBattleTypes.includes(battleType)) {
      return res.status(400).json({
        success: false,
        message: `无效的battleType: ${battleType}`
      });
    }
    if (!validOpponentTypes.includes(opponentType)) {
      return res.status(400).json({
        success: false,
        message: `无效的opponentType: ${opponentType}`
      });
    }
    if (!validResults.includes(result)) {
      return res.status(400).json({
        success: false,
        message: `无效的result: ${result}`
      });
    }

    const battle = await battleService.saveBattle(req.body);

    // 战斗结束后，所有参战部队卡 battle_count +1（不超过 max_battle_count）
    try {
      const [updated] = await pool.query(
        `UPDATE player_cards 
         SET battle_count = LEAST(battle_count + 1, COALESCE(max_battle_count, 999)) 
         WHERE player_id = ? AND card_type = 'troop' AND is_equipped = TRUE`,
        [playerId]
      );
      if (updated.affectedRows > 0) {
        console.log(`[battles] 部队耐久消耗: 玩家${playerId}, ${updated.affectedRows}张部队卡 battle_count+1`);
      }

      // 更新我方部队战后兵力
      const { troopCasualties } = req.body;
      if (troopCasualties && Array.isArray(troopCasualties)) {
        for (const tc of troopCasualties) {
          if (tc.instanceId && tc.currentTroops != null) {
            await pool.query(
              `UPDATE player_cards SET current_troops = ?, last_troops_lost_at = ? WHERE instance_id = ? AND player_id = ?`,
              [Math.max(0, tc.currentTroops), tc.currentTroops < (tc.maxTroops || 9999) ? new Date() : null, tc.instanceId, playerId]
            );
          }
        }
        console.log(`[battles] 兵力更新: ${troopCasualties.length}支部队`);
      }

      // 更新我方战后士气
      const { moraleUpdates } = req.body;
      if (moraleUpdates && Array.isArray(moraleUpdates)) {
        for (const mu of moraleUpdates) {
          const morale = Math.max(0, Math.min(120, mu.morale));
          if (mu.target === 'player') {
            await pool.query(
              'UPDATE players SET morale = ? WHERE player_id = ?',
              [morale, playerId]
            );
          } else if (mu.target === 'card' && mu.instanceId) {
            await pool.query(
              'UPDATE player_cards SET morale = ? WHERE instance_id = ? AND player_id = ?',
              [morale, mu.instanceId, playerId]
            );
          }
        }
        console.log(`[battles] 士气更新: ${moraleUpdates.length}条`);
      }

      // 保存宝箱装备奖励到 player_cards（装备件，card_id 关联 config_equipment）
      const { chestRewards } = req.body;
      if (chestRewards && Array.isArray(chestRewards) && chestRewards.length > 0) {
        for (const reward of chestRewards) {
          // 根据 equipmentType 和 rarity 从配置表随机选取真实装备
          const rarityDigit = { common: '1', rare: '2', epic: '3', legendary: '4', core: '5' }[reward.rarity] || '1';
          const typeDigit = { weapon: '1', armor: '2', accessory: '3' }[reward.equipmentType] || '1';
          const [eqRows] = await pool.query(
            `SELECT equipment_id, equipment_name FROM config_equipment
             WHERE equipment_id LIKE ? ORDER BY RAND() LIMIT 1`,
            [`san_1_equip_${typeDigit}_${rarityDigit}%`]
          );
          if (!eqRows.length) continue;
          const eq = eqRows[0];
          const instanceId = `${eq.equipment_id}_${playerId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await pool.query(
            `INSERT INTO player_cards (instance_id, player_id, card_id, card_type, rarity, is_equipped)
             VALUES (?, ?, ?, 'equipment', ?, FALSE)`,
            [instanceId, playerId, eq.equipment_id, reward.rarity || 'common']
          );
        }
        console.log(`[battles] 宝箱装备保存: ${chestRewards.length}件`);
      }

      // 耐久耗尽处理：battle_count >= max_battle_count
      // core/legendary稀有度：保留卡牌，卸下装备（留在军营，无法上阵PVP）
      // legendary耐久耗尽后PVE可用但攻防-20%（前端combatSystem判断）
      const [preservedExpired] = await pool.query(
        `UPDATE player_cards 
         SET is_equipped = FALSE, equipped_by = NULL, equipped_slot = NULL
         WHERE player_id = ? AND card_type = 'troop' AND rarity IN ('core', 'legendary')
           AND battle_count >= max_battle_count AND is_equipped = TRUE`,
        [playerId]
      );
      if (preservedExpired.affectedRows > 0) {
        console.log(`[battles] 核心/传奇部队耐久耗尽（保留）: ${preservedExpired.affectedRows}张`);
      }

      // 其他稀有度（epic/rare/common）：直接删除实例
      const [deleted] = await pool.query(
        `DELETE FROM player_cards 
         WHERE player_id = ? AND card_type = 'troop' AND rarity NOT IN ('core', 'legendary')
           AND battle_count >= max_battle_count`,
        [playerId]
      );
      if (deleted.affectedRows > 0) {
        console.log(`[battles] 部队耐久耗尽（删除）: ${deleted.affectedRows}张`);
      }

      // 更新活动排行积分（battle_score）
      const { rewards } = req.body;
      if (rewards?.battleScore && rewards.battleScore > 0) {
        await pool.query(
          'UPDATE statistics SET total_battle_score = total_battle_score + ? WHERE player_id = ?',
          [rewards.battleScore, playerId]
        );
        console.log(`[battles] 战斗积分更新: +${rewards.battleScore}`);
      }
    } catch (err) {
      console.error('[battles] 更新部队耐久失败:', err);
    }

    res.status(201).json({
      success: true,
      battle
    });
  } catch (error) {
    console.error('[battles] 保存战斗记录失败:', error);
    res.status(500).json({
      success: false,
      message: '保存战斗记录失败',
      error: error.message
    });
  }
});

/**
 * 收藏战斗
 * POST /api/battles/favorite
 * Body: { playerId, battleId }
 */
router.post('/favorite', async (req, res) => {
  try {
    const { playerId, battleId } = req.body;

    if (!playerId || !battleId) {
      return res.status(400).json({
        success: false,
        message: '缺少playerId或battleId'
      });
    }

    const result = await battleService.favoriteBattle(playerId, battleId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('[battles/favorite] 收藏失败:', error);
    res.status(500).json({
      success: false,
      message: '收藏失败',
      error: error.message
    });
  }
});

/**
 * 取消收藏
 * POST /api/battles/unfavorite
 * Body: { playerId, battleId }
 */
router.post('/unfavorite', async (req, res) => {
  try {
    const { playerId, battleId } = req.body;

    if (!playerId || !battleId) {
      return res.status(400).json({
        success: false,
        message: '缺少playerId或battleId'
      });
    }

    const result = await battleService.unfavoriteBattle(playerId, battleId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('[battles/unfavorite] 取消收藏失败:', error);
    res.status(500).json({
      success: false,
      message: '取消收藏失败',
      error: error.message
    });
  }
});

module.exports = router;
