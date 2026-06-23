/**
 * Home Hub — GET /api/life-resume/home/cards
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { publicReadLimiter } = require('../middleware/rateLimit');
const { getHomeCards, listPublicProfileCards, HomeServiceError } = require('../services/lifeHomeService');
const { ProfileServiceError } = require('../services/lifeProfileService');

const router = express.Router();

function handleHomeError(res, err) {
  if (err instanceof HomeServiceError || err instanceof ProfileServiceError) {
    return res.status(err.status).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }
  console.error('[life-resume/home]', err);
  return res.status(500).json({ success: false, error: '服务器内部错误' });
}

router.get('/public-cards', publicReadLimiter, async (req, res) => {
  try {
    const data = await listPublicProfileCards();
    return res.json({ success: true, data });
  } catch (err) {
    return handleHomeError(res, err);
  }
});

router.get('/cards', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const data = await getHomeCards(accountId, { requestIp: req.ip });
    return res.json({ success: true, data });
  } catch (err) {
    return handleHomeError(res, err);
  }
});

module.exports = router;
