/**
 * Silent account: POST /auth/anonymous
 */

const express = require('express');
const { authAnonymous } = require('../services/userService');
const { authWriteLimiter } = require('../middleware/rateLimit');
const { sendServiceError } = require('../lib/sendServiceError');

const router = express.Router();

router.post('/anonymous', authWriteLimiter, async (req, res) => {
  try {
    const data = await authAnonymous(req.body && req.body.deviceKey);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/auth]');
  }
});

module.exports = router;
