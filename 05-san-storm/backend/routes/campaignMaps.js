/**
 * 战役地图 preset API（与 shared/data/campaign/*.preset.json 一致）
 */

const express = require('express');
const path = require('path');

const router = express.Router();

const PRESET_FILES = {
  san_1_camp_1001_v1: path.join(__dirname, '../../shared/data/campaign/san_1_camp_1001_v1.preset.json'),
};

function loadPreset(id) {
  const fp = PRESET_FILES[id];
  if (!fp) return null;
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(fp);
}

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
