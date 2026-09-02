/**
 * ETH 1h 均线交叉：只读快照 + 海外投递 ingest。
 */

const crypto = require('crypto');
const express = require('express');
const { publicReadLimiter, ethMaIngestLimiter } = require('../middleware/rateLimit');
const { ETH_MA_CROSS } = require('../constants/ethMaCross');
const { getLatestSnapshot } = require('../services/ethMaCross/signalStateStore');
const { parseRestKline } = require('../services/ethMaCross/binanceFuturesKline');
const { applyClosedKlineSeries } = require('../services/ethMaCross/processBar');
const { completePushRelay } = require('../services/ethMaCross/completePushRelay');

const router = express.Router();

function readIngestSecret(req) {
  const header = req.get('x-eth-ma-ingest-secret');
  if (header) return String(header).trim();
  const auth = req.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function ingestSecretConfigured() {
  return String(process.env.ETH_MA_INGEST_SECRET || '').trim().length >= 16;
}

function ingestSecretMatches(provided) {
  const expected = String(process.env.ETH_MA_INGEST_SECRET || '').trim();
  if (expected.length < 16) return false;
  const a = Buffer.from(String(provided || ''), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizeIngestKlines(body) {
  const raw = body && Array.isArray(body.klines) ? body.klines : [];
  const parsed = [];
  for (const item of raw) {
    if (Array.isArray(item)) {
      const row = parseRestKline(item);
      if (row) parsed.push(row);
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const openTime = Number(item.openTime);
    const closeTime = Number(item.closeTime);
    const close = Number(item.close);
    if (!Number.isFinite(openTime) || !Number.isFinite(closeTime) || !Number.isFinite(close)) continue;
    parsed.push({ openTime, closeTime, close });
  }
  return parsed;
}

/** GET /api/life-resume/eth-ma-cross/latest */
router.get('/latest', publicReadLimiter, async (req, res, next) => {
  try {
    const data = await getLatestSnapshot();
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

/** POST /api/life-resume/eth-ma-cross/ingest — 海外（Cloudflare Worker）投递已收盘 K 线 */
router.post('/ingest', ethMaIngestLimiter, async (req, res, next) => {
  try {
    if (!ingestSecretConfigured()) {
      return res.status(503).json({
        success: false,
        error: '未配置 ETH_MA_INGEST_SECRET',
        code: 'INGEST_SECRET_MISSING',
      });
    }
    if (!ingestSecretMatches(readIngestSecret(req))) {
      return res.status(401).json({
        success: false,
        error: '投递密钥无效',
        code: 'INGEST_UNAUTHORIZED',
      });
    }
    const klines = normalizeIngestKlines(req.body || {});
    const result = await applyClosedKlineSeries(klines, {
      freshCloseMs: ETH_MA_CROSS.INGEST_FRESH_CLOSE_MS,
      relayPush: true,
    });
    return res.json({
      success: true,
      data: {
        ok: result.ok,
        reason: result.reason || null,
        barCount: result.barCount || klines.length,
        notified: Boolean(result.notified),
        cross: result.bar ? result.bar.cross : null,
        close: result.bar ? result.bar.close : null,
        sma7: result.bar ? result.bar.sma7 : null,
        sma25: result.bar ? result.bar.sma25 : null,
        closedOpenTime: result.bar ? result.bar.closedOpenTime : null,
        pushDispatch: result.pushDispatch || null,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/** POST /api/life-resume/eth-ma-cross/push-ack — Cloudflare 海外发完 Web Push 后回执 */
router.post('/push-ack', ethMaIngestLimiter, async (req, res, next) => {
  try {
    if (!ingestSecretConfigured()) {
      return res.status(503).json({
        success: false,
        error: '未配置 ETH_MA_INGEST_SECRET',
        code: 'INGEST_SECRET_MISSING',
      });
    }
    if (!ingestSecretMatches(readIngestSecret(req))) {
      return res.status(401).json({
        success: false,
        error: '投递密钥无效',
        code: 'INGEST_UNAUTHORIZED',
      });
    }
    const data = await completePushRelay(req.body || {});
    console.log(
      '[eth-ma-cross]',
      `push-ack marked=${data.marked} sent=${data.sent} failed=${data.failed} gone=${data.gone}`
    );
    return res.json({ success: true, data });
  } catch (err) {
    if (err && err.code === 'BAD_PUSH_ACK') {
      return res.status(err.status || 400).json({
        success: false,
        error: err.message,
        code: err.code,
      });
    }
    return next(err);
  }
});

module.exports = router;
