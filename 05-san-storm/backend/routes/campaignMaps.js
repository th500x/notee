/**
 * 战役地图 preset API（与 shared/data/campaign/*.preset.json 一致）
 * + config_campaigns 列表 / 战役中心 / campaign_progress 补丁 / 领奖
 */

const express = require('express');
const path = require('path');
const campaignService = require('../services/campaignService');

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

/**
 * GET /api/campaign/definitions?season=san_1
 */
router.get('/definitions', async (req, res) => {
  try {
    const season = req.query.season || 'san_1';
    const definitions = await campaignService.listDefinitions(season);
    res.json({ success: true, season, definitions });
  } catch (e) {
    console.error('[campaign] definitions:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/campaign/center?playerId=&season=
 * 合并配置 + 进度 + autoOpenCampaignId（可玩中 era 最早的一场）
 */
router.get('/center', async (req, res) => {
  try {
    const { playerId, season } = req.query;
    if (!playerId) {
      return res.status(400).json({ success: false, error: '缺少 playerId' });
    }
    const payload = await campaignService.getCampaignCenterPayload(playerId, season || 'san_1');
    res.json({ success: true, ...payload });
  } catch (e) {
    console.error('[campaign] center:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * PATCH /api/campaign/progress
 * body: { playerId, patch: { [campaign_id]: { ...partial } } }
 */
router.patch('/progress', async (req, res) => {
  try {
    const { playerId, patch } = req.body;
    if (!playerId || !patch) {
      return res.status(400).json({ success: false, error: '缺少 playerId 或 patch' });
    }
    const map = await campaignService.patchCampaignProgress(playerId, patch);
    res.json({ success: true, campaign_progress: map });
  } catch (e) {
    console.error('[campaign] patch progress:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/campaign/claim-reward
 * body: { playerId, campaignId }
 */
router.post('/claim-reward', async (req, res) => {
  try {
    const { playerId, campaignId } = req.body;
    if (!playerId || !campaignId) {
      return res.status(400).json({ success: false, error: '缺少 playerId 或 campaignId' });
    }
    const result = await campaignService.claimCampaignReward(playerId, campaignId);
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error || 'claim failed' });
    }
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('[campaign] claim-reward:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/campaign/presets
 */
router.get('/presets', (req, res) => {
  res.json({
    success: true,
    ids: Object.keys(PRESET_FILES),
  });
});

/**
 * GET /api/campaign/presets/:id
 */
router.get('/presets/:id', (req, res) => {
  const preset = loadPreset(req.params.id);
  if (!preset) {
    return res.status(404).json({ success: false, error: 'unknown preset' });
  }
  res.json({ success: true, preset });
});

module.exports = router;
