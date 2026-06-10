/**
 * 玩家路由 · 聚合入口（O3-B1）
 *
 * 纯 HTTP 适配：鉴权 + 子路由挂载 + 少量全局端点。
 * 业务逻辑均在 `services/`；子域见 `routes/players/*.js`。
 */

const express = require('express');
const { requireAuth, requireSelf } = require('../../middleware/auth');
const { serverMaintenanceGate } = require('../../middleware/serverMaintenanceGate');
const { seasonSettlementGate } = require('../../middleware/seasonSettlementGate');
const Player = require('../../models/Player');
const { getAvatarCategories } = require('../../services/avatarService');
const { withRoute } = require('../../utils/routeAdapter');

const textsRouter = require('../texts');
const { globalRouter: creationGlobalRouter, playerRouter: creationPlayerRouter } = require('./creation');
const factionRouter = require('./faction');
const roadRouter = require('./road');
const sanGongFuRouter = require('./sanGongFu');
const lineupRouter = require('./lineup');
const exploreRouter = require('./explore');
const profileRouter = require('./profile');
const dailyReportRouter = require('./dailyReport');
const seasonSettlementRouter = require('./seasonSettlement');

const router = express.Router();

router.use(requireAuth);
router.param('playerId', requireSelf());

// 非「账号自身」路由（无 :playerId 或 playerId 为字面段）须在 `/:playerId` 门禁之前注册：
// 否则 `router.use('/:playerId', …)` 会把 `avatars` / `check` 当作 playerId 触发 requireSelf，
// 与真实会话 sub 不符而 403（曾导致 checkExists 失败→误判无角色→走创角）。
router.get('/avatars', withRoute('获取头像列表失败', async (req, res) => {
  const categories = await getAvatarCategories();
  res.set('Cache-Control', 'private, max-age=60');
  res.json({ success: true, data: { categories } });
}));

router.get('/check/:playerId', serverMaintenanceGate(), withRoute('检查玩家失败', async (req, res) => {
  const exists = await Player.exists(req.params.playerId);
  res.json({ success: true, data: { exists } });
}));

// 创角全局端点（无 :playerId）须在 /:playerId 门禁之前，否则 validate-name 等会被当成 playerId → 403
router.use(creationGlobalRouter);

// 维护态门禁：服务器 maintenance/closed 时该玩家所有请求 503（关服窗口拦进游戏）
router.use('/:playerId', serverMaintenanceGate());

// 全局写门禁：封档后拦截改写类操作（GET 与 season-settlement 自身路由放行）
router.use('/:playerId', seasonSettlementGate());

router.use('/:playerId/texts', requireSelf(), textsRouter);

router.use(seasonSettlementRouter);
router.use(creationPlayerRouter);
router.use(factionRouter);
router.use(roadRouter);
router.use(sanGongFuRouter);
router.use(lineupRouter);
router.use(exploreRouter);
router.use(dailyReportRouter);
router.use(profileRouter);

module.exports = router;
