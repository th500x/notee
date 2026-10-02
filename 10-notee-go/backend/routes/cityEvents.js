/**
 * GET /city-events — Bangkok and Pattaya events in the 12-month window, by start day.
 */

const express = require('express');
const { publicReadLimiter } = require('../middleware/rateLimit');
const { sendServiceError } = require('../lib/sendServiceError');
const { listCityEvents } = require('../services/cityEventService');

const router = express.Router();

router.get('/', publicReadLimiter, async (req, res) => {
  try {
    const data = await listCityEvents();
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/city-events]');
  }
});

module.exports = router;
