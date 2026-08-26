/**
 * One Line public API root.
 */

const express = require('express');
const { testConnection, dbConfig } = require('../database/connection');
const { publicReadLimiter } = require('../middleware/rateLimit');
const { optionalAuth } = require('../middleware/auth');
const authRouter = require('./auth');
const meRouter = require('./me');
const postsRouter = require('./posts');
const blocksRouter = require('./blocks');
const boardRouter = require('./board');
const giftsRouter = require('./gifts');
const stampBagRouter = require('./stampBag');
const pourBagRouter = require('./pourBag');
const { getFeed } = require('../services/postService');
const { sendServiceError } = require('../lib/sendServiceError');

const router = express.Router();

router.get('/health', publicReadLimiter, async (req, res) => {
  const dbConnected = await testConnection();
  res.json({
    success: true,
    status: dbConnected ? 'ok' : 'degraded',
    service: 'one-line',
    phase: 'P6',
    database: dbConnected ? 'connected' : 'disconnected',
    databaseName: dbConfig.database,
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRouter);
router.use('/me', meRouter);
router.use('/blocks', blocksRouter);
router.use('/board', boardRouter);
router.use('/gifts', giftsRouter);
router.use('/stamp', stampBagRouter);
router.use('/pour', pourBagRouter);

/** Design path: GET /api/oneline/feed — optional Bearer for resonatedByMe + block filter */
router.get('/feed', publicReadLimiter, optionalAuth, async (req, res) => {
  try {
    const data = await getFeed(req.query, {
      viewerUserId: req.player && req.player.sub,
    });
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/feed]');
  }
});

router.use('/posts', postsRouter);

module.exports = router;
