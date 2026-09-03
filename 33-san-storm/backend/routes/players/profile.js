/**
 * 玩家路由 · 档案 / 统计 / 主城（O3-B1）
 */
const express = require('express');
const Player = require('../../models/Player');
const characterRankService = require('../../services/characterRankService');
const playerStatisticsService = require('../../services/playerStatisticsService');
const playerTitleCatalogService = require('../../services/playerTitleCatalogService');
const playerAchievementCatalogService = require('../../services/playerAchievementCatalogService');
const { claimPlayerAchievement } = require('../../services/achievementClaimService');
const seasonPremiumService = require('../../services/seasonPremiumService');
const playerProfileService = require('../../services/playerProfileService');
const playerMainCityService = require('../../services/playerMainCityService');
const mainCityBarracksStorageService = require('../../services/mainCityBarracksStorageService');
const { validateBody, validateQuery } = require('../../middleware/validation');
const profileSchemas = require('../../middleware/validationSchemas/playersProfile');
const { replyServiceOut, withRoute } = require('../../utils/routeAdapter');

const router = express.Router();

router.get(
  '/:playerId/character-rank',
  validateQuery(profileSchemas.characterRankQuery),
  withRoute('查询将领排名失败', async (req, res) => {
    const data = await characterRankService.getCharacterRankForBucket(req.params.playerId, req.query.bucket);
    res.json({ success: true, data });
  }),
);

router.get('/:playerId/statistics', withRoute('获取统计数据失败', async (req, res) => {
  const result = await playerStatisticsService.getPlayerStatistics(req.params.playerId);
  return replyServiceOut(res, result, { notFoundMessage: '统计数据不存在' });
}));

router.get('/:playerId/titles/catalog', withRoute('获取称号目录失败', async (req, res) => {
  const result = await playerTitleCatalogService.getPlayerTitleCatalog(req.params.playerId);
  return replyServiceOut(res, result, { notFoundMessage: '玩家不存在' });
}));

router.get('/:playerId/achievements/catalog', withRoute('获取成就目录失败', async (req, res) => {
  const result = await playerAchievementCatalogService.getPlayerAchievementCatalog(req.params.playerId);
  return replyServiceOut(res, result, { notFoundMessage: '玩家不存在' });
}));

router.post('/:playerId/achievements/:achievementId/claim', withRoute('领取成就失败', async (req, res) => {
  const out = await claimPlayerAchievement(req.params.playerId, req.params.achievementId);
  if (!out.ok) {
    return res.status(out.status || 400).json({ success: false, error: out.error });
  }
  res.json({ success: true, data: out.data });
}));

router.post(
  '/:playerId/season-premium/activate',
  validateBody(profileSchemas.seasonPremiumActivateBody),
  withRoute('战令开通失败', async (req, res) => {
    const out = await seasonPremiumService.activateSeasonPremium(
      req.params.playerId,
      req.body.activationCode,
    );
    if (!out.ok) {
      return res.status(out.status || 400).json({ success: false, error: out.error });
    }
    res.json({
      success: true,
      data: {
        alreadyActive: out.alreadyActive,
        milestoneUnlock: out.milestone
          ? {
              titles: out.milestone.titles?.newlyGranted || [],
              achievements: out.milestone.achievements?.newlyGranted || [],
            }
          : null,
      },
    });
  }),
);

router.get('/:playerId/profile', withRoute('获取玩家档案失败', async (req, res) => {
  const result = await playerProfileService.getPlayerProfile(req.params.playerId);
  return replyServiceOut(res, result, { notFoundMessage: '玩家不存在' });
}));

router.post(
  '/:playerId/main-city',
  validateBody(profileSchemas.mainCityBody),
  withRoute('设置主城失败', async (req, res) => {
    const out = await playerMainCityService.setPlayerMainCity(req.params.playerId, req.body.cityId);
    return replyServiceOut(res, out);
  }),
);

router.post(
  '/:playerId/main-city-barracks/transfer-in',
  validateBody(profileSchemas.barracksTransferBody),
  withRoute('驻军所转入失败', async (req, res) => {
    const out = await mainCityBarracksStorageService.transferIn(req.params.playerId, req.body.instanceIds);
    return replyServiceOut(res, out);
  }),
);

router.post(
  '/:playerId/main-city-barracks/transfer-out',
  validateBody(profileSchemas.barracksTransferBody),
  withRoute('驻军所转出失败', async (req, res) => {
    const out = await mainCityBarracksStorageService.transferOut(req.params.playerId, req.body.instanceIds);
    return replyServiceOut(res, out);
  }),
);

/** 必须放在所有 `/:playerId/...` 子路径注册之后（由 index 最后挂载） */
router.get('/:playerId', withRoute('获取玩家信息失败', async (req, res) => {
  const player = await Player.getById(req.params.playerId);
  if (!player) return res.status(404).json({ success: false, error: '玩家不存在' });
  res.json({ success: true, data: player });
}));

module.exports = router;
