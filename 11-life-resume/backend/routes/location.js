/**
 * Location helpers — POST /api/life-resume/location/reverse-geocode
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { reverseGeocodeToPublicLabel } = require('../services/reverseGeocodeService');
const {
  GoogleMapsResolveError,
  resolveGoogleMapsShareUrl,
} = require('../services/googleMapsUrlResolveService');

const router = express.Router();

router.post('/resolve-maps-url', requireAuth, async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const mapsUrl = body.mapsUrl != null ? String(body.mapsUrl).trim() : '';
    if (!mapsUrl) {
      return res.status(400).json({
        success: false,
        error: '请提供 mapsUrl',
        code: 'INVALID_GOOGLE_MAPS_URL',
      });
    }
    const parsed = await resolveGoogleMapsShareUrl(mapsUrl);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        error: parsed.error,
        code: parsed.code || 'INVALID_GOOGLE_MAPS_URL',
      });
    }
    return res.json({ success: true, data: parsed });
  } catch (err) {
    if (err instanceof GoogleMapsResolveError) {
      return res.status(err.status).json({
        success: false,
        error: err.message,
        code: err.code,
      });
    }
    return res.status(502).json({
      success: false,
      error: err.message || '短链接解析失败',
      code: 'GOOGLE_MAPS_RESOLVE_FAILED',
    });
  }
});

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
