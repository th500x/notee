/**
 * lifePath routes — /api/life-resume/profiles/me/life-path/*
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  getLifePathForOwner,
  generateLifePathForOwner,
  publishLifePathForOwner,
  discardLifePathDraftForOwner,
  unpublishLifePathForOwner,
  LifePathServiceError,
} = require('../services/lifePathService');

const router = express.Router();

function handleLifePathError(res, err) {
  if (err instanceof LifePathServiceError) {
    return res.status(err.status).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }
  console.error('[life-resume/life-path]', err);
  return res.status(500).json({ success: false, error: '服务器内部错误' });
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const data = await getLifePathForOwner(accountId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleLifePathError(res, err);
  }
});

router.post('/generate', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const data = await generateLifePathForOwner(accountId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleLifePathError(res, err);
  }
});

router.post('/publish', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const data = await publishLifePathForOwner(accountId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleLifePathError(res, err);
  }
});

router.delete('/draft', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const data = await discardLifePathDraftForOwner(accountId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleLifePathError(res, err);
  }
});

router.post('/unpublish', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const data = await unpublishLifePathForOwner(accountId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleLifePathError(res, err);
  }
});

module.exports = router;
