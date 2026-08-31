/**
 * ETH 15m 均线交叉只读快照（07 面板展示「最近信号」）。
 */

const express = require('express');
const { publicReadLimiter } = require('../middleware/rateLimit');
const { getLatestSnapshot } = require('../services/ethMaCross/signalStateStore');

const router = express.Router();

/** GET /api/life-resume/eth-ma-cross/latest */
router.get('/latest', publicReadLimiter, async (req, res, next) => {
  try {
    const data = await getLatestSnapshot();
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
