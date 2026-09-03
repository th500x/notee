/**
 * 玩家路由 · 战略道路行军（O3-B1 · 02 §2.1.2）
 *
 * 道路同格遭遇战（含来战/守门）已归档移除：档案 `_archive/dao-lu-yu-di/`。
 * 旧客户端仍可能请求遇敌接口，故保留**显式 410**（不静默 200、不改走别的语义）。
 */
const express = require('express');
const { roadMoveLimiter } = require('../../middleware/rateLimit');
const { getSelfRoadState } = require('../../services/road/roadPresenceService');
const { moveAlongRoad } = require('../../services/road/roadMoveAlongService');
const { validateBody } = require('../../middleware/validation');
const roadSchemas = require('../../middleware/validationSchemas/playersRoad');
const { replyServiceOut, withRoute } = require('../../utils/routeAdapter');

const router = express.Router();

const ROAD_ENCOUNTER_GONE = {
  success: false,
  error: '道路遭遇战已移除；战略行军仍可用',
  code: 'ROAD_ENCOUNTER_REMOVED',
};

router.get('/:playerId/road/self', withRoute('读取道路状态失败', async (req, res) => {
  const out = await getSelfRoadState(req.params.playerId);
  return replyServiceOut(res, out);
}));

/** 大地图立足失败（无效对象等）：常规修复，否则强制随机郡战场入口（31-6 §9.3） */
router.post(
  '/:playerId/road/repair-stand',
  withRoute('修复道路立足失败', async (req, res) => {
    const staleStrategicRoadStandRepairService = require('../../services/staleStrategicRoadStandRepairService');
    const { pool } = require('../../database/connection');
    const pid = String(req.params.playerId || '').trim();
    const out = await staleStrategicRoadStandRepairService.repairOrForceBattlefieldForUnresolvedStand(
      pool,
      pid,
    );
    if (!out?.ok) {
      return res.status(400).json({
        success: false,
        error: out?.error || '无法修复路点',
        code: 'ROAD_STAND_REPAIR_FAILED',
      });
    }
    /** 与 getSelfRoadState 相同：响应里交出 notice 并清库，避免轮询再弹一次叠窗 */
    let pendingRoadNotice = null;
    const raw =
      out.patch?.road_client_notice != null ? String(out.patch.road_client_notice).trim() : '';
    if (raw && pid) {
      pendingRoadNotice = raw;
      try {
        await pool.query(`UPDATE players SET road_client_notice = NULL WHERE player_id = ?`, [pid]);
      } catch (_) {
        /* 清库失败时仍返回文案；轮询可能再读到，前端须去重 */
      }
    }
    const data = out.patch
      ? {
          roadJunId: out.patch.road_jun_id ?? undefined,
          roadPositionX: out.patch.road_position_x ?? undefined,
          roadPositionY: out.patch.road_position_y ?? undefined,
          roadClientNotice: pendingRoadNotice,
        }
      : null;
    return res.json({
      success: true,
      forced: !!out.forced,
      alreadyValid: !!out.alreadyValid,
      pendingRoadNotice: pendingRoadNotice || undefined,
      data,
    });
  }),
);

router.post(
  '/:playerId/road/move',
  roadMoveLimiter,
  validateBody(roadSchemas.moveBody),
  withRoute('沿路移动失败', async (req, res) => {
    const out = await moveAlongRoad(req.params.playerId, req.body);
    return replyServiceOut(res, out);
  }),
);

// ── 已移除：道路遭遇 / 来战（守门）。旧客户端一律 410 ────────────────────────────
const GONE_ROUTES = [
  ['post', '/:playerId/road/intercept'],
  ['post', '/:playerId/road/resolve-encounter'],
  ['get', '/:playerId/road/pending-encounter'],
  ['get', '/:playerId/road/encounter-battle'],
  ['post', '/:playerId/road/encounter-authoritative-resolve'],
  ['get', '/:playerId/road/encounter-authoritative-outcome'],
  ['post', '/:playerId/road/encounter-battle-result'],
];
for (const [method, path] of GONE_ROUTES) {
  router[method](path, (_req, res) => res.status(410).json(ROAD_ENCOUNTER_GONE));
}

module.exports = router;
