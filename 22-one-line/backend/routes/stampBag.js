/**
 * GET /stamp/bag · PUT /stamp/bag
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { publicReadLimiter, stampBagWriteLimiter } = require('../middleware/rateLimit');
const { sendServiceError } = require('../lib/sendServiceError');
const { getBag, putBag } = require('../services/stampBagService');

const router = express.Router();

router.get('/bag', requireAuth, publicReadLimiter, async (req, res) => {
  try {
    const bag = await getBag(req.player.sub);
    res.json({ success: true, data: { bag } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/stamp]');
  }
});

router.put('/bag', requireAuth, stampBagWriteLimiter, async (req, res) => {
  try {
    const bag = await putBag(req.player.sub, req.body);
    res.json({ success: true, data: { bag } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/stamp]');
  }
});

module.exports = router;
