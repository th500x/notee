/**
 * 人生片段认证：登录 / 注册 / 候选 ID / 改密 / 改正生日；读写本库 accounts。
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter, registerCandidatesLimiter } = require('../middleware/rateLimit');
const accountAuth = require('../services/accountAuthService');

const router = express.Router();

function sendAuthFailure(res, result) {
  const body = {
    success: false,
    error: result.error,
  };
  if (result.status === 403 && result.banReason !== undefined) {
    body.reason = result.banReason;
    body.banUntil = result.banUntil;
  }
  if (result.code) {
    body.code = result.code;
  }
  return res.status(result.status || 400).json(body);
}

/** GET /api/life-resume/auth/me — verify Bearer token + 生日 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await accountAuth.getPublicBirthday(req.player.sub);
    if (!result.ok) {
      return sendAuthFailure(res, result);
    }
    return res.json({
      success: true,
      data: {
        accountId: String(req.player.sub),
        role: req.player.role || 'player',
        ...result.data,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/** GET /api/life-resume/auth/register-candidates */
router.get('/register-candidates', registerCandidatesLimiter, async (req, res, next) => {
  try {
    const count = parseInt(req.query.count, 10) || 5;
    const excludeRaw = req.query.exclude;
    const excludeIds =
      typeof excludeRaw === 'string' && excludeRaw.trim()
        ? excludeRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    const result = await accountAuth.pickRegisterIdCandidates({
      count,
      excludeIds,
    });

    if (!result.ok) {
      return sendAuthFailure(res, result);
    }

    return res.json({
      success: true,
      data: {
        ids: result.ids,
        partial: result.partial,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/** POST /api/life-resume/auth/register */
router.post('/register', loginLimiter, async (req, res, next) => {
  try {
    const result = await accountAuth.register(req.body || {}, { requestIp: req.ip });
    if (!result.ok) {
      return sendAuthFailure(res, result);
    }
    return res.json({
      success: true,
      message: '注册成功',
      data: result.accountData,
    });
  } catch (error) {
    return next(error);
  }
});

/** POST /api/life-resume/auth/login */
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { id, password } = req.body || {};
    const result = await accountAuth.login(id, password);
    if (!result.ok) {
      return sendAuthFailure(res, result);
    }
    return res.json({
      success: true,
      message: '登录成功',
      data: result.accountData,
    });
  } catch (error) {
    return next(error);
  }
});

/** POST /api/life-resume/auth/change-password */
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    if (!req.player?.sub || req.player._devBypass) {
      return res.status(401).json({
        success: false,
        error: '请使用正常登录会话后再修改密码',
        code: 'NO_TOKEN',
      });
    }
    const result = await accountAuth.changePassword(req.player.sub, req.body || {});
    if (!result.ok) {
      return sendAuthFailure(res, result);
    }
    return res.json({ success: true, message: '密码已更新' });
  } catch (error) {
    return next(error);
  }
});

/** POST /api/life-resume/auth/change-birthday */
router.post('/change-birthday', requireAuth, async (req, res, next) => {
  try {
    if (!req.player?.sub || req.player._devBypass) {
      return res.status(401).json({
        success: false,
        error: '请使用正常登录会话后再修改生日',
        code: 'NO_TOKEN',
      });
    }
    const result = await accountAuth.changeBirthday(req.player.sub, req.body || {});
    if (!result.ok) {
      return sendAuthFailure(res, result);
    }
    return res.json({
      success: true,
      message: '生日已更新',
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
