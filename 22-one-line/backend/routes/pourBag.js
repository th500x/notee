/**
 * GET /pour/bag · PUT /pour/bag
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { publicReadLimiter, stampBagWriteLimiter } = require('../middleware/rateLimit');
const { sendServiceError } = require('../lib/sendServiceError');
const { getBag, putBag } = require('../services/pourBagService');
const pourMediaRouter = require('./pourMedia');

const router = express.Router();

router.use('/media', pourMediaRouter);

router.get('/bag', requireAuth, publicReadLimiter, async (req, res) => {
  try {
    const bag = await getBag(req.player.sub);
    res.json({ success: true, data: { bag } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/pour]');
  }
});

router.put('/bag', requireAuth, stampBagWriteLimiter, async (req, res) => {
  try {
    const bag = await putBag(req.player.sub, req.body);
    res.json({ success: true, data: { bag } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/pour]');
  }
});

module.exports = router;
