/**
 * Current user: GET / PATCH / DELETE /me
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { authWriteLimiter } = require('../middleware/rateLimit');
const { getMe, patchMe, deleteMe } = require('../services/userService');
const { submitPlayPurchase, restorePlayPurchases } = require('../services/partyPassService');
const { sendServiceError } = require('../lib/sendServiceError');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await getMe(req.player.sub);
    res.json({ success: true, data: { user } });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/me]');
  }
});

router.patch('/', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const user = await patchMe(req.player.sub, req.body);
    res.json({ success: true, data: { user } });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/me]');
  }
});

router.delete('/', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const data = await deleteMe(req.player.sub);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/me]');
  }
});

router.post('/party-pass', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const user = await submitPlayPurchase(req.player.sub, req.body);
    res.json({ success: true, data: { user } });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/party-pass]');
  }
});

router.post('/party-pass/restore', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const user = await restorePlayPurchases(req.player.sub, req.body);
    res.json({ success: true, data: { user } });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/party-pass]');
  }
});

module.exports = router;
