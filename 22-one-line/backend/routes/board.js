/**
 * GET /board?month=YYYY-MM
 */

const express = require('express');
const { publicReadLimiter } = require('../middleware/rateLimit');
const { sendServiceError } = require('../lib/sendServiceError');
const { getBoard } = require('../services/boardService');

const router = express.Router();

router.get('/', publicReadLimiter, async (req, res) => {
  try {
    const data = await getBoard(req.query.month);
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[one-line/board]');
  }
});

module.exports = router;
