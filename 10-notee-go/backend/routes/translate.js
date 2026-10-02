/**
 * POST /api/notee-go/translate — Cloud Translation proxy. No login.
 * Body: { target: "en"|"zh", texts: string[] }
 */

const express = require('express');
const { translateLimiter } = require('../middleware/rateLimit');
const { sendServiceError } = require('../lib/sendServiceError');
const { translateTexts } = require('../services/translateService');

const router = express.Router();

router.post('/', translateLimiter, async (req, res) => {
  try {
    const translations = await translateTexts(req.body && req.body.texts, req.body && req.body.target);
    res.json({ success: true, data: { translations } });
  } catch (err) {
    sendServiceError(res, err, '[notee-go/translate]');
  }
});

module.exports = router;
