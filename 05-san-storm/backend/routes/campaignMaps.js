/**
 * 战役地图 preset API（与 shared/data/campaign/*.preset.json 一致）
 * + config_campaigns 列表 / 战役中心 / campaign_progress 补丁 / 领奖
 */

const express = require('express');
const path = require('path');
const campaignService = require('../services/campaignService');
const { requireAuth } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation');
const campaignSchemas = require('../middleware/validationSchemas/campaignMaps');

const router = express.Router();

const PRESET_FILES = {
  san_1_camp_1001_v1: path.join(__dirname, '../../shared/data/campaign/san_1_camp_1001_v1.preset.json'),
  san_1_camp_1001_v2: path.join(__dirname, '../../shared/data/campaign/san_1_camp_1001_v2.preset.json'),
};

function loadPreset(id) {
  const fp = PRESET_FILES[id];
  if (!fp) return null;
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(fp);
}

router.get('/presets', (req, res) => {
  res.json({
    success: true,
    ids: Object.keys(PRESET_FILES),
  });
});

router.get('/presets/:id', validateParams(campaignSchemas.presetIdParam), (req, res) => {
  const preset = loadPreset(req.params.id);
  if (!preset) {
    return res.status(404).json({ success: false, error: 'unknown preset' });
  }
  res.json({ success: true, preset });
});

router.use(requireAuth);

router.get('/definitions', validateQuery(campaignSchemas.definitionsQuery), async (req, res, next) => {
  try {
    const season = req.query.season || 'san_1';
    const definitions = await campaignService.listDefinitions(season);
    res.json({ success: true, season, definitions });
  } catch (e) {
    return next(wrap500(e, '获取战役定义失败'));
  }
});

router.get('/center', validateQuery(campaignSchemas.centerQuery), async (req, res, next) => {
  try {
    const { playerId, season } = req.query;
    const payload = await campaignService.getCampaignCenterPayload(playerId, season || 'san_1');
    res.json({ success: true, ...payload });
  } catch (e) {
    return next(wrap500(e, '获取战役中心数据失败'));
  }
});

router.patch('/progress', validateBody(campaignSchemas.progressPatchBody), async (req, res, next) => {
  try {
    const { playerId, patch } = req.body;
    const map = await campaignService.patchCampaignProgress(playerId, patch);
    res.json({ success: true, campaign_progress: map });
  } catch (e) {
    return next(wrap500(e, '更新战役进度失败'));
  }
});

router.post('/claim-reward', validateBody(campaignSchemas.claimRewardBody), async (req, res, next) => {
  try {
    const { playerId, campaignId } = req.body;
    const result = await campaignService.claimCampaignReward(playerId, campaignId);
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error || 'claim failed' });
    }
    res.json({ success: true, ...result });
  } catch (e) {
    return next(wrap500(e, '领取战役奖励失败'));
  }
});

module.exports = router;
