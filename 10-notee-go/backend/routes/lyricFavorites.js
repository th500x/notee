/**
 * GET /lyric/favorites · PUT /lyric/favorites
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { publicReadLimiter, stampBagWriteLimiter } = require('../middleware/rateLimit');
const { sendServiceError } = require('../lib/sendServiceError');
const { getBag, putBag } = require('../services/lyricFavoriteService');

const router = express.Router();

router.get('/favorites', requireAuth, publicReadLimiter, async (req, res) => {
  try {
    const bag = await getBag(req.player.sub);
    res.json({ success: true, data: { bag } });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/lyric-favorites]');
  }
});

router.put('/favorites', requireAuth, stampBagWriteLimiter, async (req, res) => {
  try {
    const bag = await putBag(req.player.sub, req.body);
    res.json({ success: true, data: { bag } });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/lyric-favorites]');
  }
});

module.exports = router;
