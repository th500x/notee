/**
 * Location helpers — POST /api/life-resume/location/reverse-geocode
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { reverseGeocodeToPublicLabel } = require('../services/reverseGeocodeService');

const router = express.Router();

router.post('/reverse-geocode', requireAuth, async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const label = await reverseGeocodeToPublicLabel(body.latitude, body.longitude);
    return res.json({
      success: true,
      data: {
        locationPublicLabel: label,
      },
    });
  } catch (err) {
    const code = err.code || 'GEOCODE_FAILED';
    return res.status(code === 'INVALID_LOCATION' ? 400 : 502).json({
      success: false,
      error: err.message || '逆地理编码失败',
      code,
    });
  }
});

module.exports = router;
