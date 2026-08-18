/**
 * Accounts: silent open, login id candidates, sign-up, sign-in.
 *
 * None of these may sit behind requireAuth — the client has no token yet on a fresh device.
 * Sign-up uses optionalAuth: it binds credentials to the caller's silent account, so the App
 * opens one first (OneLineSession.ensureAuthed) rather than letting this route create a second.
 */

const express = require('express');
const {
  authAnonymous,
  pickLoginIdCandidates,
  registerLoginId,
  loginWithLoginId,
} = require('../services/userService');
const {
  authWriteLimiter,
  loginIdCandidateLimiter,
  credentialLimiter,
  loginIdAttemptLimiter,
} = require('../middleware/rateLimit');
const { optionalAuth } = require('../middleware/auth');
const { sendServiceError } = require('../lib/sendServiceError');
const { httpError } = require('../lib/httpError');

const router = express.Router();

router.post('/anonymous', authWriteLimiter, async (req, res) => {
  try {
    const data = await authAnonymous(req.body && req.body.deviceKey);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/auth]');
  }
});

/** GET /auth/login-id/candidates?count=9&exclude=AB12,CD34 */
router.get('/login-id/candidates', loginIdCandidateLimiter, async (req, res) => {
  try {
    const raw = typeof req.query.exclude === 'string' ? req.query.exclude : '';
    const data = await pickLoginIdCandidates({
      count: req.query.count,
      exclude: raw.split(',').map((s) => s.trim()).filter(Boolean),
    });
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/auth]');
  }
});

router.post('/register', credentialLimiter, optionalAuth, async (req, res) => {
  try {
    if (!req.player || !req.player.sub) {
      throw httpError(401, '请先开户再注册短号', 'NO_TOKEN');
    }
    const user = await registerLoginId(req.player.sub, req.body);
    res.json({ success: true, data: { user } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/auth]');
  }
});

router.post('/login', credentialLimiter, loginIdAttemptLimiter, async (req, res) => {
  try {
    const data = await loginWithLoginId(req.body);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/auth]');
  }
});

module.exports = router;
