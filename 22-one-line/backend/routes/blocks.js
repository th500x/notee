/**
 * Block list APIs.
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { publicReadLimiter, authWriteLimiter } = require('../middleware/rateLimit');
const { sendServiceError } = require('../lib/sendServiceError');
const { addBlock, removeBlock, listBlocks } = require('../services/blockService');

const router = express.Router();

router.get('/', requireAuth, publicReadLimiter, async (req, res) => {
  try {
    const data = await listBlocks(req.player.sub);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/blocks]');
  }
});

router.post('/', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const data = await addBlock(req.player.sub, req.body && req.body.userId);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/blocks]');
  }
});

router.delete('/:userId', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const data = await removeBlock(req.player.sub, req.params.userId);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/blocks]');
  }
});

module.exports = router;
