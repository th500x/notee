/**
 * Current user: GET / PATCH / DELETE /me, Google binding, honor rename, Party Pass.
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { authWriteLimiter, loginIdCandidateLimiter } = require('../middleware/rateLimit');
const { getMe, patchMe, deleteMe, bindGoogle } = require('../services/userService');
const {
  pickHonorCandidates,
  renameToHonorLoginId,
} = require('../services/honorLoginIdService');
const { submitPlayPurchase, restorePlayPurchases } = require('../services/partyPassService');
const { deleteRankingsForUser } = require('../services/gameResultService');
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

/** `{ idToken }` → `{ user }`. Short-id accounts only. */
router.post('/google', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const user = await bindGoogle(req.player.sub, req.body);
    res.json({ success: true, data: { user } });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/me]');
  }
});

/** GET /me/honor-login-id/candidates[?ticket=…] — no ticket returns the stored batches. */
router.get('/honor-login-id/candidates', requireAuth, loginIdCandidateLimiter, async (req, res) => {
  try {
    const ticket = typeof req.query.ticket === 'string' && req.query.ticket ? req.query.ticket : null;
    const data = await pickHonorCandidates(req.player.sub, { ticket });
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/me]');
  }
});

/** `{ loginId, ticket }` → `{ user }` with the new digit id. */
router.post('/honor-login-id', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const user = await renameToHonorLoginId(req.player.sub, req.body);
    res.json({ success: true, data: { user } });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/me]');
  }
});

router.delete('/rankings', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const deleted = await deleteRankingsForUser(req.player.sub);
    res.json({ success: true, data: { deleted } });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/rankings]');
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
