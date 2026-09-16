/**
 * POST /lyric/proposals
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { authWriteLimiter } = require('../middleware/rateLimit');
const { sendServiceError } = require('../lib/sendServiceError');
const { createBatch } = require('../services/lyricProposalService');

const router = express.Router();

router.post('/proposals', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const data = await createBatch(req.player.sub, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/lyric]');
  }
});

module.exports = router;
