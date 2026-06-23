/**
 * Profile routes — GET/PUT /api/life-resume/profiles/me
 */

const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { publicReadLimiter } = require('../middleware/rateLimit');
const {
  getProfileForAccount,
  updateProfileForAccount,
  deactivateProfileForAccount,
  cancelDeactivationForAccount,
  ProfileServiceError,
} = require('../services/lifeProfileService');
const { getPublicTimeline, TimelineServiceError } = require('../services/lifeTimelineService');

const router = express.Router();

function handleProfileError(res, err) {
  if (err instanceof ProfileServiceError) {
    return res.status(err.status).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }
  if (err instanceof TimelineServiceError) {
    return res.status(err.status).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }
  console.error('[life-resume/profiles]', err);
  return res.status(500).json({ success: false, error: '服务器内部错误' });
}

router.get('/:accountId/public', publicReadLimiter, optionalAuth, async (req, res) => {
  try {
    const ownerAccountId = String(req.params.accountId || '').trim().toUpperCase();
    const viewerAccountId = req.player ? String(req.player.sub) : null;
    const data = await getPublicTimeline(ownerAccountId, viewerAccountId, { requestIp: req.ip });
    return res.json({ success: true, data });
  } catch (err) {
    return handleProfileError(res, err);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const data = await getProfileForAccount(accountId, { requestIp: req.ip });
    return res.json({ success: true, data });
  } catch (err) {
    return handleProfileError(res, err);
  }
});

router.put('/me', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const patch = {};

    if (body.username !== undefined) patch.username = body.username;
    if (body.pageDefaultVisibility !== undefined) patch.pageDefaultVisibility = body.pageDefaultVisibility;
    if (body.defaultGranteeAccountId !== undefined) patch.defaultGranteeAccountId = body.defaultGranteeAccountId;

    const data = await updateProfileForAccount(accountId, patch);
    return res.json({ success: true, data });
  } catch (err) {
    return handleProfileError(res, err);
  }
});

router.post('/me/deactivate', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const data = await deactivateProfileForAccount(accountId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleProfileError(res, err);
  }
});

router.post('/me/cancel-deactivation', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const data = await cancelDeactivationForAccount(accountId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleProfileError(res, err);
  }
});

module.exports = router;
