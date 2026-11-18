/**
 * POST /api/notee-go/game-results
 * Anonymous batches omit Authorization. A leaderboard host row needs a valid token;
 * the account id is taken from that token, not from the body.
 */

const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { authWriteLimiter } = require('../middleware/rateLimit');
const { ingestRounds } = require('../services/gameResultService');
const { sendServiceError } = require('../lib/sendServiceError');

const router = express.Router();

router.post('/', authWriteLimiter, optionalAuth, async (req, res) => {
  try {
    const userId = req.player && req.player.sub;
    const data = await ingestRounds(userId, req.body && req.body.rounds);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/game-results]');
  }
});

module.exports = router;
