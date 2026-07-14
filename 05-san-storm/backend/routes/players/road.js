/**
 * 玩家路由 · 道路行军 / 遭遇（O3-B1 · 02 §2.1.2）
 * 道路遭遇战已下线（保留 move / self / presence）；档案 `_archive/dao-lu-yu-di/`。
 */
const express = require('express');
const { roadMoveLimiter } = require('../../middleware/rateLimit');
const roadEncounterService = require('../../services/roadEncounterService');
const { validateBody, validateQuery } = require('../../middleware/validation');
const roadSchemas = require('../../middleware/validationSchemas/playersRoad');
const { replyServiceOut, withRoute } = require('../../utils/routeAdapter');
const { ROAD_ENCOUNTERS_ENABLED } = require('../../config/roadConfig');

const router = express.Router();

const ROAD_ENCOUNTER_GONE = {
  success: false,
  error: '道路遭遇战已移除；战略行军仍可用',
  code: 'ROAD_ENCOUNTER_REMOVED',
};

router.post(
  '/:playerId/road/intercept',
  validateBody(roadSchemas.interceptBody),
  withRoute('切换道路开战模式失败', async (req, res) => {
    if (!ROAD_ENCOUNTERS_ENABLED) {
      // 强制清残留来战标记，避免旧客户端误开
      try {
        const { pool } = require('../../database/connection');
        await pool.query(
          'UPDATE players SET road_intercept = 0 WHERE player_id = ?',
          [req.params.playerId],
        );
      } catch (_) {}
      return res.status(410).json({
        ...ROAD_ENCOUNTER_GONE,
        error: '道路遭遇战已移除；来战开关已停用',
      });
    }
    const { enable, clientRequestId } = req.body;
    const out = await roadEncounterService.setIntercept(req.params.playerId, enable, clientRequestId);
    return replyServiceOut(res, out);
  }),
);

router.get('/:playerId/road/self', withRoute('读取道路状态失败', async (req, res) => {
  const out = await roadEncounterService.getSelfRoadState(req.params.playerId);
  return replyServiceOut(res, out);
}));

router.post(
  '/:playerId/road/move',
  roadMoveLimiter,
  validateBody(roadSchemas.moveBody),
  withRoute('沿路移动失败', async (req, res) => {
    const out = await roadEncounterService.moveAlongRoad(req.params.playerId, req.body);
    return replyServiceOut(res, out);
  }),
);

router.post(
  '/:playerId/road/resolve-encounter',
  validateBody(roadSchemas.resolveEncounterBody),
  (_req, res) => {
    res.status(410).json(ROAD_ENCOUNTER_GONE);
  },
);

router.get('/:playerId/road/pending-encounter', (_req, res) => {
  res.status(410).json({ ...ROAD_ENCOUNTER_GONE, encounter: null });
});

router.get(
  '/:playerId/road/encounter-battle',
  validateQuery(roadSchemas.encounterBattleQuery),
  (_req, res) => {
    res.status(410).json(ROAD_ENCOUNTER_GONE);
  },
);

router.post(
  '/:playerId/road/encounter-authoritative-resolve',
  validateBody(roadSchemas.encounterAuthoritativeResolveBody),
  (_req, res) => {
    res.status(410).json(ROAD_ENCOUNTER_GONE);
  },
);

router.get(
  '/:playerId/road/encounter-authoritative-outcome',
  validateQuery(roadSchemas.encounterIdQuery),
  (_req, res) => {
    res.status(410).json(ROAD_ENCOUNTER_GONE);
  },
);

router.post(
  '/:playerId/road/encounter-battle-result',
  validateBody(roadSchemas.encounterBattleResultBody),
  (_req, res) => {
    res.status(410).json(ROAD_ENCOUNTER_GONE);
  },
);

module.exports = router;
