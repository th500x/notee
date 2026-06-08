/**
 * 玩家路由 · 聚合入口（O3-B1）
 *
 * 纯 HTTP 适配：鉴权 + 子路由挂载 + 少量全局端点。
 * 业务逻辑均在 `services/`；子域见 `routes/players/*.js`。
 */

const express = require('express');
const { requireAuth, requireSelf } = require('../../middleware/auth');
const Player = require('../../models/Player');
const { getAvatarCategories } = require('../../services/avatarService');
const { withRoute } = require('../../utils/routeAdapter');

const textsRouter = require('../texts');
const creationRouter = require('./creation');
const factionRouter = require('./faction');
const roadRouter = require('./road');
const sanGongFuRouter = require('./sanGongFu');
const lineupRouter = require('./lineup');
const exploreRouter = require('./explore');
const profileRouter = require('./profile');
const dailyReportRouter = require('./dailyReport');

const router = express.Router();

router.use(requireAuth);
router.param('playerId', requireSelf());

router.get('/avatars', withRoute('获取头像列表失败', async (req, res) => {
  const categories = await getAvatarCategories();
  res.set('Cache-Control', 'private, max-age=60');
  res.json({ success: true, data: { categories } });
}));

router.get('/check/:playerId', withRoute('检查玩家失败', async (req, res) => {
  const exists = await Player.exists(req.params.playerId);
  res.json({ success: true, data: { exists } });
}));

router.use('/:playerId/texts', requireSelf(), textsRouter);

router.use(creationRouter);
router.use(factionRouter);
router.use(roadRouter);
router.use(sanGongFuRouter);
router.use(lineupRouter);
router.use(exploreRouter);
router.use(dailyReportRouter);
router.use(profileRouter);

module.exports = router;
