/**
 * Current user: GET / PATCH / DELETE /me
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { authWriteLimiter } = require('../middleware/rateLimit');
const { getMe, patchMe, deleteMe } = require('../services/userService');
const { sendServiceError } = require('../lib/sendServiceError');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await getMe(req.player.sub);
    res.json({ success: true, data: { user } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/me]');
  }
});

router.patch('/', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const user = await patchMe(req.player.sub, req.body);
    res.json({ success: true, data: { user } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/me]');
  }
});

router.delete('/', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const data = await deleteMe(req.player.sub);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/me]');
  }
});

module.exports = router;
