/**
 * 旧版前端兼容路由（单数 /api/player/*）
 *
 * 早期静态包使用 `/api/san-storm/player/:playerId/battleRecord/:id` 等路径；
 * 现行接口为 `/api/players/...` 与 `/api/battles/:id`。本路由在**已登录**前提下转发到现行实现。
 */

const express = require('express');
const { requireAuth, requireSelf } = require('../middleware/auth');
const battleService = require('../services/battleService');
const textsService = require('../services/textsService');
const playerExploreEventService = require('../services/playerExploreEventService');
const { wrap500 } = require('../utils/httpError');
const { validateParams } = require('../middleware/validation');
const textSchemas = require('../middleware/validationSchemas/texts');

const router = express.Router();

router.use(requireAuth);
router.param('playerId', requireSelf());

router.get(
  '/:playerId/battleRecord/:battleId',
  validateParams(textSchemas.legacyBattleIdParam),
  async (req, res, next) => {
    try {
      const battle = await battleService.getBattleDetail(req.params.battleId);
      if (!battle) {
        return res.status(404).json({ success: false, message: '战斗记录不存在' });
      }
      return res.json({ success: true, battle });
    } catch (error) {
      return next(wrap500(error, '获取战斗记录失败'));
    }
  },
);

async function textsSummaryHandler(req, res, next) {
  try {
    const { playerId } = req.params;
    const unreadCount = await textsService.countUnread(playerId);
    return res.json({ success: true, unreadCount });
  } catch (error) {
    return next(wrap500(error, '查询失败'));
  }
}

router.get('/:playerId/trans/summary', textsSummaryHandler);
router.get('/:playerId/texts/summary', textsSummaryHandler);

router.get(
  '/:playerId/explore/note/:noteId',
  validateParams(textSchemas.legacyNoteIdParam),
  async (req, res, next) => {
    try {
      const { playerId } = req.params;
      const data = await playerExploreEventService.getExploreEvents(playerId);
      return res.json({ success: true, data });
    } catch (error) {
      return next(wrap500(error, '获取探索进度失败'));
    }
  },
);

module.exports = router;
