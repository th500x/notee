/**
 * PUT/GET /pour/media/:sittingId/:slot — private JPEG crops, owner JWT only.
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { sendServiceError } = require('../lib/sendServiceError');
const { requireActiveUser } = require('../services/userService');
const {
  assertSittingId,
  assertSlot,
  assertJpeg,
} = require('../lib/pourMedia');
const store = require('../services/pourMediaStore');

const { pourMediaLimiter } = require('../middleware/rateLimit');

const rawJpeg = express.raw({
  type: ['image/jpeg', 'application/octet-stream'],
  limit: '300kb',
});

const router = express.Router();

router.put(
  '/:sittingId/:slot',
  requireAuth,
  pourMediaLimiter,
  rawJpeg,
  async (req, res) => {
    try {
      const userId = req.player.sub;
      await requireActiveUser(userId);
      const sittingId = assertSittingId(req.params.sittingId);
      const slot = assertSlot(req.params.slot);
      const body = assertJpeg(req.body);
      await store.put(userId, sittingId, slot, body);
      res.json({ success: true, data: { sittingId, slot } });
    } catch (err) {
      sendServiceError(res, err, '[one-line/pour-media]');
    }
  }
);

router.head(
  '/:sittingId/:slot',
  requireAuth,
  pourMediaLimiter,
  async (req, res) => {
    try {
      const userId = req.player.sub;
      await requireActiveUser(userId);
      const sittingId = assertSittingId(req.params.sittingId);
      const slot = assertSlot(req.params.slot);
      const dest = store.absolutePath(userId, sittingId, slot);
      if (!dest) return res.status(404).end();
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.status(200).end();
    } catch (err) {
      sendServiceError(res, err, '[one-line/pour-media]');
    }
  }
);

router.get(
  '/:sittingId/:slot',
  requireAuth,
  pourMediaLimiter,
  async (req, res) => {
    try {
      const userId = req.player.sub;
      await requireActiveUser(userId);
      const sittingId = assertSittingId(req.params.sittingId);
      const slot = assertSlot(req.params.slot);
      const dest = store.absolutePath(userId, sittingId, slot);
      if (!dest) {
        return res.status(404).json({
          success: false,
          error: '没有这张裁切',
          code: 'POUR_CROP_MISSING',
        });
      }
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.sendFile(dest);
    } catch (err) {
      sendServiceError(res, err, '[one-line/pour-media]');
    }
  }
);

module.exports = router;
