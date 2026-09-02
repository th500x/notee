/**
 * Posts + resonance (Phase 2–3).
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { publicReadLimiter, authWriteLimiter } = require('../middleware/rateLimit');
const { sendServiceError } = require('../lib/sendServiceError');
const {
  createPost,
  createPourPost,
  createMealPost,
  patchPost,
  deletePost,
  getTodayMine,
  listMine,
} = require('../services/postService');
const { addResonance, removeResonance } = require('../services/resonanceService');
const { reportPost } = require('../services/reportService');

const router = express.Router();

router.get('/today/me', requireAuth, publicReadLimiter, async (req, res) => {
  try {
    const data = await getTodayMine(req.player.sub);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/posts]');
  }
});

router.get('/mine', requireAuth, publicReadLimiter, async (req, res) => {
  try {
    const data = await listMine(req.player.sub, req.query);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/posts]');
  }
});

router.post('/', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const post = await createPost(req.player.sub, req.body);
    res.status(201).json({ success: true, data: { post } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/posts]');
  }
});

router.post('/pour', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const post = await createPourPost(req.player.sub, req.body);
    res.status(201).json({ success: true, data: { post } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/posts]');
  }
});

router.post('/meal', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const post = await createMealPost(req.player.sub, req.body);
    res.status(201).json({ success: true, data: { post } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/posts]');
  }
});

router.post('/:id/report', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const data = await reportPost(req.player.sub, req.params.id, req.body && req.body.reason);
    res.status(201).json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/report]');
  }
});

router.post('/:id/resonance', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const data = await addResonance(req.player.sub, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/resonance]');
  }
});

router.delete('/:id/resonance', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const data = await removeResonance(req.player.sub, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/resonance]');
  }
});

router.patch('/:id', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const post = await patchPost(req.player.sub, req.params.id, req.body);
    res.json({ success: true, data: { post } });
  } catch (err) {
    sendServiceError(res, err, '[one-line/posts]');
  }
});

router.delete('/:id', requireAuth, authWriteLimiter, async (req, res) => {
  try {
    const data = await deletePost(req.player.sub, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/posts]');
  }
});

module.exports = router;
