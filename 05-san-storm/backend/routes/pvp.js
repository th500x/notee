/**
 * PVP 攻城挑战路由
 * 
 * @module backend/routes/pvp
 */

const express = require('express');
const router = express.Router();
const pvpService = require('../services/pvpService');
const garrisonService = require('../services/garrisonService');
const { pool } = require('../database/connection');
const Player = require('../models/Player');
const { isPlayerRecentlyActive, DEFAULT_ONLINE_MS } = require('../utils/playerActivity');

/**
 * GET /api/pvp/online-defenders/:cityId
 * 检查城市是否有在线驻守玩家
 * query: { attackerId, attackerFaction }
 */
router.get('/online-defenders/:cityId', async (req, res) => {
  try {
    const { attackerId, attackerFaction } = req.query;
    if (!attackerId || !attackerFaction) {
      return res.status(400).json({ success: false, error: '缺少 attackerId 或 attackerFaction' });
    }
    const defenders = await pvpService.getOnlineDefenders(req.params.cityId, attackerId, attackerFaction);
    res.json({
      success: true,
      hasOnlineDefenders: defenders.length > 0,
      defenders: defenders.map(d => ({
        playerId: d.player_id,
        characterName: d.character_name,
        positionLevel: d.position_level,
        garrisonSlot: d.garrison_slot,
      })),
    });
  } catch (error) {
    console.error('[PVP] 检查在线防守者失败:', error);
    res.status(500).json({ success: false, error: '检查在线防守者失败' });
  }
});

/**
 * POST /api/pvp/challenge
 * 创建 PVP 挑战（攻城方发起）
 * body: { warId, cityId, attackerId, attackerFaction, defenderId, defenderGarrisonSlot }
 */
router.post('/challenge', async (req, res) => {
  try {
    const { warId, cityId, attackerId, attackerFaction, defenderId, defenderGarrisonSlot: slotBody } = req.body;
    if (!warId || !cityId || !attackerId || !defenderId) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const defenderGarrisonSlot =
      slotBody === undefined || slotBody === null || slotBody === ''
        ? 1
        : Number(slotBody);

    // 与 initiateSiege 一致：综合 last_active_at + lastActiveAt，避免「只登录时刷新」导致永远判离线
    const defenderIsInGame = await isPlayerRecentlyActive(defenderId, DEFAULT_ONLINE_MS);

    const result = pvpService.createChallenge({
      warId, cityId, attackerId, attackerFaction,
      defenderId, defenderGarrisonSlot,
      defenderIsInGame,
    });

    // 超时自动战：槽位 0 = 披挂上阵（上阵编组）；否则驻地编组槽
    let defenseUnits = [];
    if (defenderGarrisonSlot === 0) {
      defenseUnits = await garrisonService.buildDefenseUnitsFromMainLineup(defenderId);
    } else {
      const garrison = await garrisonService.getGarrisonSlot(defenderId, defenderGarrisonSlot);
      if (garrison) {
        defenseUnits = await garrisonService.buildDefenseUnits(garrison);
      }
    }

    res.json({
      success: true,
      challengeId: result.challengeId,
      waitSeconds: result.waitSeconds,
      defenderIsInGame,
      defenseUnits,
    });
  } catch (error) {
    console.error('[PVP] 创建挑战失败:', error);
    res.status(500).json({ success: false, error: '创建挑战失败' });
  }
});

/**
 * GET /api/pvp/challenge/:challengeId/status
 * 攻城方轮询挑战状态
 */
router.get('/challenge/:challengeId/status', (req, res) => {
  try {
    const status = pvpService.getChallengeStatus(req.params.challengeId);
    if (!status) {
      return res.status(404).json({ success: false, error: '挑战不存在' });
    }
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('[PVP] 查询挑战状态失败:', error);
    res.status(500).json({ success: false, error: '查询挑战状态失败' });
  }
});

/**
 * GET /api/pvp/pending/:playerId
 * 防守方轮询：是否有待处理的挑战
 */
router.get('/pending/:playerId', async (req, res) => {
  try {
    await Player.updateLastActive(req.params.playerId);
    const challenge = await pvpService.checkPendingChallenge(req.params.playerId);
    res.json({ success: true, challenge });
  } catch (error) {
    console.error('[PVP] 检查待处理挑战失败:', error);
    res.status(500).json({ success: false, error: '检查待处理挑战失败' });
  }
});

/**
 * POST /api/pvp/challenge/:challengeId/accept
 * 防守方接受挑战
 * body: { defenderId }
 */
router.post('/challenge/:challengeId/accept', (req, res) => {
  try {
    const { defenderId } = req.body;
    if (!defenderId) {
      return res.status(400).json({ success: false, error: '缺少 defenderId' });
    }
    const result = pvpService.acceptChallenge(req.params.challengeId, defenderId);
    res.json(result);
  } catch (error) {
    console.error('[PVP] 接受挑战失败:', error);
    res.status(500).json({ success: false, error: '接受挑战失败' });
  }
});

/**
 * POST /api/pvp/challenge/:challengeId/complete
 * 标记挑战完成
 * body: { result: 'attacker_win' | 'defender_win' }
 */
router.post('/challenge/:challengeId/complete', (req, res) => {
  try {
    pvpService.completeChallenge(req.params.challengeId, req.body.result);
    res.json({ success: true });
  } catch (error) {
    console.error('[PVP] 完成挑战失败:', error);
    res.status(500).json({ success: false, error: '完成挑战失败' });
  }
});

module.exports = router;
