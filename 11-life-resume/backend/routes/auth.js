/**
 * Auth session routes (JWT verify only; login/register stay on 05).
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/** GET /api/life-resume/auth/me — verify Bearer token */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      accountId: String(req.player.sub),
      role: req.player.role || 'player',
    },
  });
});

module.exports = router;
