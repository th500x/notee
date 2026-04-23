/**
 * PVP 攻城挑战路由
 * 
 * @module backend/routes/pvp
 */

const express = require('express');
const router = express.Router();
const pvpService = require('../services/pvpService');
const garrisonService = require('../services/garrisonService');
const siegePvpResolveService = require('../services/siegePvpResolveService');
const Player = require('../models/Player');
const { isPlayerRecentlyActive, DEFAULT_ONLINE_MS } = require('../utils/playerActivity');

/**
 * GET /api/pvp/online-defenders/:cityId
 * 仅统计 **当前** 整编兵力 ≥ 800 的驻地槽且在线的玩家（与攻城、defenders 列表同一口径）。
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
        : Number(slotBody); // 含 0 = 披挂上阵，勿用假值合并吞掉

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
      const garrison = await garrisonService.getGarrisonSlot(defenderId, cityId, defenderGarrisonSlot);
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
 * GET /api/pvp/challenge/:challengeId/defender-context?defenderId=
 * 防守方接受挑战后：攻城方上阵部队 + 城市信息（用于进入战斗 UI）
 */
router.get('/challenge/:challengeId/defender-context', async (req, res) => {
  try {
    const { defenderId } = req.query;
    if (!defenderId) {
      return res.status(400).json({ success: false, error: '缺少 defenderId' });
    }
    const result = await pvpService.getDefenderBattleContext(req.params.challengeId, defenderId);
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error });
    }
    const { ok: _ok, ...data } = result;
    res.json({ success: true, data });
  } catch (error) {
    console.error('[PVP] defender-context 失败:', error);
    res.status(500).json({ success: false, error: '获取战场数据失败' });
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
 * POST /api/pvp/siege-resolve
 * 披挂上阵（槽位0）服务端权威单场结算；驻地/NPC 勿调用
 * body: { challengeId, attackerId }
 */
router.post('/siege-resolve', async (req, res) => {
  try {
    const { challengeId, attackerId } = req.body;
    if (!challengeId || !attackerId) {
      return res.status(400).json({ success: false, error: '缺少 challengeId 或 attackerId' });
    }
    const data = await siegePvpResolveService.resolveAuthoritativeSiegePvp({ challengeId, attackerId });
    res.json({ success: true, data });
  } catch (error) {
    const code = error.code;
    const status = code === 'FORBIDDEN' ? 403 : code === 'NOT_READY' ? 409 : code === 'CHALLENGE_NOT_FOUND' ? 404 : 400;
    console.error('[PVP] siege-resolve 失败:', error);
    res.status(status).json({ success: false, error: error.message, code: code || undefined });
  }
});

/**
 * GET /api/pvp/challenge/:challengeId/siege-outcome?playerId=
 * 攻守任一方轮询权威结算结果（结算完成后才有数据）
 */
router.get('/challenge/:challengeId/siege-outcome', (req, res) => {
  try {
    const { playerId } = req.query;
    const c = pvpService.peekChallenge(req.params.challengeId);
    if (!c || !playerId || (playerId !== c.attackerId && playerId !== c.defenderId)) {
      return res.status(403).json({ success: false, error: '无权查看' });
    }
    const outcome = pvpService.getSiegeOutcome(req.params.challengeId);
    res.json({ success: true, outcome });
  } catch (error) {
    console.error('[PVP] siege-outcome 失败:', error);
    res.status(500).json({ success: false, error: '查询失败' });
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
