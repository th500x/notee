/**
 * GET /news?region=bkk                 — last 24h, newest first
 * GET /news/board?region=bkk&month=YYYY-MM — monthly Top 10 (live / frozen)
 */

const express = require('express');
const { publicReadLimiter } = require('../middleware/rateLimit');
const { sendServiceError } = require('../lib/sendServiceError');
const { listLatest, getNewsBoard } = require('../services/newsService');

const router = express.Router();

router.get('/', publicReadLimiter, async (req, res) => {
  try {
    const data = await listLatest(req.query.region);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/news]');
  }
});

router.get('/board', publicReadLimiter, async (req, res) => {
  try {
    const data = await getNewsBoard(req.query.region, req.query.month);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/news/board]');
  }
});

module.exports = router;
