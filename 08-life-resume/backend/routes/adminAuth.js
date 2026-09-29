/**
 * 全站管理员口令。
 * 签发的凭证给首页、06 租赁后台、33 管理页使用。
 * 密钥必须是 ADMIN_JWT_SECRET，不能用账号 JWT_SECRET。
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

const TOKEN_EXPIRY = '30d';
const TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60;

function getAdminSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 16) {
    const err = new Error('ADMIN_JWT_SECRET 未配置或过短');
    err.code = 'ADMIN_JWT_SECRET_MISSING';
    throw err;
  }
  if (secret === process.env.JWT_SECRET) {
    const err = new Error('ADMIN_JWT_SECRET 与账号 JWT_SECRET 相同');
    err.code = 'ADMIN_JWT_SECRET_COLLISION';
    throw err;
  }
  return secret;
}

function rejectAdminMisconfigured(res, error) {
  console.error('[00 admin-auth]', error.code || error.message);
  const status = error.code === 'ADMIN_JWT_SECRET_COLLISION' ? 500 : 503;
  return res.status(status).json({
    success: false,
    error: '管理员口令未配置',
  });
}

/**
 * POST /api/auth/login
 * body: { password, project? }
 */
router.post('/login', async (req, res) => {
  try {
    const { password, project } = req.body || {};
    const hash = process.env.GLOBAL_PASSWORD_HASH;

    if (!hash) {
      return res.status(503).json({
        success: false,
        error: '管理员口令未配置',
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: '请输入密码' });
    }
    if (password.length > 100) {
      return res.status(400).json({
        success: false,
        error: '密码长度不能超过100个字符',
      });
    }

    let secret;
    try {
      secret = getAdminSecret();
    } catch (error) {
      return rejectAdminMisconfigured(res, error);
    }

    const isValid = await bcrypt.compare(password, hash);
    if (!isValid) {
      console.warn('[00 admin-auth] 口令错误');
      return res.status(401).json({ success: false, error: '密码错误' });
    }

    const token = jwt.sign(
      {
        type: 'global',
        project: project || 'all',
        access: 'granted',
        timestamp: Date.now(),
      },
      secret,
      { algorithm: 'HS256', expiresIn: TOKEN_EXPIRY }
    );

    console.log(`[00 admin-auth] 口令通过 project=${project || 'all'}`);
    return res.json({
      success: true,
      token,
      expiresIn: TOKEN_EXPIRY_SECONDS,
    });
  } catch (error) {
    console.error('[00 admin-auth] 登录错误', error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
});

/**
 * POST /api/auth/verify
 */
router.post('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        valid: false,
        error: '未提供token',
      });
    }

    let secret;
    try {
      secret = getAdminSecret();
    } catch (error) {
      return rejectAdminMisconfigured(res, error);
    }

    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    return res.json({
      success: true,
      valid: true,
      data: {
        type: decoded.type,
        project: decoded.project,
        access: decoded.access,
      },
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        valid: false,
        error: 'Token已过期',
      });
    }
    return res.status(401).json({
      success: false,
      valid: false,
      error: 'Token无效',
    });
  }
});

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: '未提供token' });
    }

    let secret;
    try {
      secret = getAdminSecret();
    } catch (error) {
      return rejectAdminMisconfigured(res, error);
    }

    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      ignoreExpiration: true,
    });

    const tokenAge = Date.now() - decoded.timestamp;
    if (!decoded.timestamp || tokenAge > TOKEN_EXPIRY_SECONDS * 1000) {
      return res.status(401).json({
        success: false,
        error: 'Token过期时间过长，请重新登录',
      });
    }

    const newToken = jwt.sign(
      {
        type: decoded.type,
        project: decoded.project,
        access: decoded.access,
        timestamp: Date.now(),
      },
      secret,
      { algorithm: 'HS256', expiresIn: TOKEN_EXPIRY }
    );

    console.log(`[00 admin-auth] 凭证已刷新 project=${decoded.project}`);
    return res.json({
      success: true,
      token: newToken,
      expiresIn: TOKEN_EXPIRY_SECONDS,
    });
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Token无效' });
  }
});

module.exports = router;
