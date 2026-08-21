/**
 * GET /gifts/inbox · POST /gifts/:id/claim
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { publicReadLimiter, authWriteLimiter } = require('../middleware/rateLimit');
const { sendServiceError } = require('../lib/sendServiceError');
const { listInbox, claim } = require('../services/giftService');

const router = express.Router();

router.get('/inbox', requireAuth, publicReadLimiter, async (req, res) => {
  try {
    const campaigns = await listInbox(req.player.sub);
    res.json({ success: true, data: { campaigns } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/gifts]');
  }
});

router.post('/:id/claim', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const campaign = await claim(req.player.sub, req.params.id);
    res.json({ success: true, data: { campaign } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/gifts]');
  }
});

module.exports = router;
