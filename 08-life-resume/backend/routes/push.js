/**
 * Web Push 订阅：VAPID 公钥、订阅 / 退订 / 状态。
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { pushSubscribeLimiter } = require('../middleware/rateLimit');
const { getVapidConfig, isVapidConfigured } = require('../services/webPush/vapid');
const {
  PushSubscriptionError,
  upsertSubscription,
  removeSubscription,
  getStatus,
} = require('../services/webPush/subscriptionService');
const { ETH_MA_CROSS } = require('../constants/ethMaCross');

const router = express.Router();

function handlePushError(res, err) {
  if (err instanceof PushSubscriptionError) {
    return res.status(err.status).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }
  if (err && err.code === 'VAPID_MISSING') {
    return res.status(503).json({
      success: false,
      error: '推送服务尚未配置',
      code: 'VAPID_MISSING',
    });
  }
  console.error('[life-resume/push]', err);
  return res.status(500).json({ success: false, error: '服务器内部错误' });
}

/** GET /api/life-resume/push/vapid-public-key */
router.get('/vapid-public-key', (req, res) => {
  if (!isVapidConfigured()) {
    return res.status(503).json({
      success: false,
      error: '推送服务尚未配置',
      code: 'VAPID_MISSING',
    });
  }
  const { publicKey } = getVapidConfig();
  return res.json({
    success: true,
    data: { publicKey },
  });
});

/** GET /api/life-resume/push/status */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const data = await getStatus(req.player.sub, req.query.topic || ETH_MA_CROSS.TOPIC);
    return res.json({ success: true, data });
  } catch (err) {
    return handlePushError(res, err);
  }
});

/** POST /api/life-resume/push/subscribe */
router.post('/subscribe', requireAuth, pushSubscribeLimiter, async (req, res) => {
  try {
    if (!isVapidConfigured()) {
      return handlePushError(res, Object.assign(new Error('VAPID'), { code: 'VAPID_MISSING' }));
    }
    const data = await upsertSubscription(req.player.sub, req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    return handlePushError(res, err);
  }
});

/** POST /api/life-resume/push/unsubscribe */
router.post('/unsubscribe', requireAuth, pushSubscribeLimiter, async (req, res) => {
  try {
    const data = await removeSubscription(req.player.sub, req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    return handlePushError(res, err);
  }
});

module.exports = router;
