/**
 * GET /pet/bag · PUT /pet/bag
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { publicReadLimiter, stampBagWriteLimiter } = require('../middleware/rateLimit');
const { sendServiceError } = require('../lib/sendServiceError');
const { getBag, putBag } = require('../services/petBagService');

const router = express.Router();

router.get('/bag', requireAuth, publicReadLimiter, async (req, res) => {
  try {
    const bag = await getBag(req.player.sub);
    res.json({ success: true, data: { bag } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/pet]');
  }
});

router.put('/bag', requireAuth, stampBagWriteLimiter, async (req, res) => {
  try {
    const bag = await putBag(req.player.sub, req.body);
    res.json({ success: true, data: { bag } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/pet]');
  }
});

module.exports = router;
