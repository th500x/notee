/**
 * PVP 攻城挑战路由
 *
 * @module backend/routes/pvp
 */

const express = require('express');
const router = express.Router();
const pvpService = require('../services/pvpService');
const garrisonService = require('../services/garrisonService');
const pvpGarrisonAutoDuelResolveService = require('../services/pvp/auto-duel/pvpGarrisonAutoDuelResolveService');
const Player = require('../models/Player');
const { isPlayerRecentlyActive, DEFAULT_ONLINE_MS } = require('../utils/playerActivity');
const { requireAuth, requireSelf } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation');
const pvpSchemas = require('../middleware/validationSchemas/pvp');

/**
 * 鉴权（必改 #1）：本路由全部接口要求合法 JWT；URL 含 `:playerId` 的路由须 token.sub 与之匹配。
 */
router.use(requireAuth);
router.param('playerId', requireSelf());

/** 帮手：要求 body / query 中的某身份字段必须与 token.sub 一致（admin 例外）。 */
function assertSelf(req, res, fieldValue, fieldLabel) {
  if (!fieldValue) {
    res.status(400).json({ success: false, error: `缺少 ${fieldLabel}` });
    return false;
  }
  if (req.player && req.player._devBypass && req.player.sub == null) {
    return true;
  }
  if (req.player.role === 'admin') return true;
  if (String(fieldValue) !== String(req.player.sub)) {
    res.status(403).json({ success: false, error: `无权代他人发起 ${fieldLabel}`, code: 'FORBIDDEN' });
    return false;
  }
  return true;
}

/**
 * GET /api/pvp/online-defenders/:cityId
 */
router.get(
  '/online-defenders/:cityId',
  validateParams(pvpSchemas.cityIdParam),
  validateQuery(pvpSchemas.onlineDefendersQuery),
  async (req, res, next) => {
    try {
      const { attackerId, attackerFaction } = req.query;
      if (!assertSelf(req, res, attackerId, 'attackerId')) return;
      const defenders = await pvpService.getOnlineDefenders(req.params.cityId, attackerId, attackerFaction);
      res.json({
        success: true,
        hasOnlineDefenders: defenders.length > 0,
        defenders: defenders.map((d) => ({
          playerId: d.player_id,
          characterName: d.character_name,
          positionLevel: d.position_level,
          garrisonSlot: d.garrison_slot,
        })),
      });
    } catch (error) {
      return next(wrap500(error, '检查在线防守者失败'));
    }
  },
);

/**
 * POST /api/pvp/challenge
 */
router.post('/challenge', pvpSchemas.validateChallengeBody, async (req, res, next) => {
  try {
    const { warId, pvpWarId, cityId, attackerId, attackerFaction, defenderId, defenderGarrisonSlot: slotBody } = req.body;
    if (!assertSelf(req, res, attackerId, 'attackerId')) return;

    const defenderGarrisonSlot =
      slotBody === undefined || slotBody === null || slotBody === ''
        ? 1
        : Number(slotBody);

    const defenderIsInGame = await isPlayerRecentlyActive(defenderId, DEFAULT_ONLINE_MS);

    const result = pvpService.createChallenge({
      warId, pvpWarId, cityId, attackerId, attackerFaction,
      defenderId, defenderGarrisonSlot,
      defenderIsInGame,
    });

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
    return next(wrap500(error, '创建挑战失败'));
  }
});

/**
 * GET /api/pvp/challenge/:challengeId/defender-context
 */
router.get(
  '/challenge/:challengeId/defender-context',
  validateParams(pvpSchemas.challengeIdParam),
  validateQuery(pvpSchemas.defenderIdQuery),
  async (req, res, next) => {
    try {
      const { defenderId } = req.query;
      if (!assertSelf(req, res, defenderId, 'defenderId')) return;
      const result = await pvpService.getDefenderBattleContext(req.params.challengeId, defenderId);
      if (!result.ok) {
        return res.status(400).json({ success: false, error: result.error });
      }
      const { ok: _ok, ...data } = result;
      res.json({ success: true, data });
    } catch (error) {
      return next(wrap500(error, '获取战场数据失败'));
    }
  },
);

/**
 * GET /api/pvp/challenge/:challengeId/status
 */
router.get(
  '/challenge/:challengeId/status',
  validateParams(pvpSchemas.challengeIdParam),
  (req, res, next) => {
    try {
      const status = pvpService.getChallengeStatus(req.params.challengeId);
      if (!status) {
        return res.status(404).json({ success: false, error: '挑战不存在' });
      }
      res.json({ success: true, ...status });
    } catch (error) {
      return next(wrap500(error, '查询挑战状态失败'));
    }
  },
);

/**
 * GET /api/pvp/pending/:playerId
 */
router.get('/pending/:playerId', async (req, res, next) => {
  try {
    await Player.updateLastActive(req.params.playerId);
    const challenge = await pvpService.checkPendingChallenge(req.params.playerId);
    res.json({ success: true, challenge });
  } catch (error) {
    return next(wrap500(error, '检查待处理挑战失败'));
  }
});

/**
 * POST /api/pvp/challenge/:challengeId/accept
 */
router.post(
  '/challenge/:challengeId/accept',
  validateParams(pvpSchemas.challengeIdParam),
  validateBody(pvpSchemas.defenderIdBody),
  (req, res, next) => {
    try {
      const { defenderId } = req.body;
      if (!assertSelf(req, res, defenderId, 'defenderId')) return;
      const result = pvpService.acceptChallenge(req.params.challengeId, defenderId);
      res.json(result);
    } catch (error) {
      return next(wrap500(error, '接受挑战失败'));
    }
  },
);

/**
 * POST /api/pvp/siege-resolve
 */
router.post('/siege-resolve', validateBody(pvpSchemas.siegeResolveBody), async (req, res, next) => {
  try {
    const { challengeId, attackerId } = req.body;
    if (!assertSelf(req, res, attackerId, 'attackerId')) return;
    const data = await pvpGarrisonAutoDuelResolveService.resolveAuthoritativeGarrisonAutoDuel({ challengeId, attackerId });
    res.json({ success: true, data });
  } catch (error) {
    const code = error.code;
    const status = code === 'FORBIDDEN' ? 403 : code === 'NOT_READY' ? 409 : code === 'CHALLENGE_NOT_FOUND' ? 404 : 400;
    console.error('[PVP] siege-resolve 失败:', error);
    res.status(status).json({ success: false, error: error.message, code: code || undefined });
  }
});

/**
 * GET /api/pvp/challenge/:challengeId/siege-outcome
 */
router.get(
  '/challenge/:challengeId/siege-outcome',
  validateParams(pvpSchemas.challengeIdParam),
  validateQuery(pvpSchemas.siegeOutcomeQuery),
  (req, res, next) => {
    try {
      const { playerId } = req.query;
      const c = pvpService.peekChallenge(req.params.challengeId);
      if (!c || !playerId || (playerId !== c.attackerId && playerId !== c.defenderId)) {
        return res.status(403).json({ success: false, error: '无权查看' });
      }
      if (!assertSelf(req, res, playerId, 'playerId')) return;
      const outcome = pvpService.getSiegeOutcome(req.params.challengeId);
      res.json({ success: true, outcome });
    } catch (error) {
      return next(wrap500(error, '查询失败'));
    }
  },
);

/**
 * POST /api/pvp/challenge/:challengeId/complete
 */
router.post(
  '/challenge/:challengeId/complete',
  validateParams(pvpSchemas.challengeIdParam),
  validateBody(pvpSchemas.completeChallengeBody),
  (req, res, next) => {
    try {
      const c = pvpService.peekChallenge(req.params.challengeId);
      if (!c) {
        return res.status(404).json({ success: false, error: '挑战不存在' });
      }
      const sub = req.player.sub;
      const devBypass = req.player._devBypass && sub == null;
      if (!devBypass && req.player.role !== 'admin' && sub !== c.attackerId && sub !== c.defenderId) {
        return res.status(403).json({ success: false, error: '无权操作此挑战', code: 'FORBIDDEN' });
      }
      pvpService.completeChallenge(req.params.challengeId, req.body.result);
      res.json({ success: true });
    } catch (error) {
      return next(wrap500(error, '完成挑战失败'));
    }
  },
);

module.exports = router;
