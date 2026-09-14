/**
 * GET /pet/bag · PUT /pet/bag
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { publicReadLimiter, stampBagWriteLimiter } = require('../middleware/rateLimit');
const { sendServiceError } = require('../lib/sendServiceError');
const { getBag, putBag } = require('../services/petBagService');
const { bagSummary } = require('../lib/petBagRules');

const router = express.Router();

function logBag(op, userId, bag, extra) {
  const s = bagSummary(bag);
  const bits = [
    `[one-line/pet] ${op}`,
    `user=${userId}`,
    `rev=${s.rev}`,
    `pets=${s.pets}`,
    `pp=${s.pp}`,
    `blob=${s.blob}`,
    `welcome=${s.welcome}`,
    `tonight=${s.tonight || '-'}`,
  ];
  if (extra) bits.push(extra);
  console.log(bits.join(' '));
}

router.get('/bag', requireAuth, publicReadLimiter, async (req, res) => {
  const userId = req.player.sub;
  try {
    const bag = await getBag(userId);
    logBag('GET', userId, bag);
    res.json({ success: true, data: { bag } });
  } catch (err) {
    console.warn('[one-line/pet] GET fail', `user=${userId}`, err.code || err.message);
    sendServiceError(res, err, '[one-line/pet]');
  }
});

router.put('/bag', requireAuth, stampBagWriteLimiter, async (req, res) => {
  const userId = req.player.sub;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const incomingType = body.bagBlob == null ? 'null' : typeof body.bagBlob;
  try {
    const bag = await putBag(userId, body);
    logBag('PUT ok', userId, bag, `inType=${incomingType}`);
    res.json({ success: true, data: { bag } });
  } catch (err) {
    console.warn(
      '[one-line/pet] PUT fail',
      `user=${userId}`,
      `code=${err.code || '-'}`,
      `status=${err.status || 500}`,
      `inType=${incomingType}`,
      `inRev=${body.revision}`,
      err.message
    );
    sendServiceError(res, err, '[one-line/pet]');
  }
});

module.exports = router;
