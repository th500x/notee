/**
 * 登录后的钱包地址与月均。
 * GET  /api/life-resume/wallet-assets
 * PUT  /api/life-resume/wallet-assets   { address }
 * DELETE /api/life-resume/wallet-assets
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { publicReadLimiter } = require('../middleware/rateLimit');
const { validateAccountIdFormat } = require('../../shared/utils/lifeResumeUsername.cjs');
const { WalletAssetsError } = require('../services/walletAssetsService');
const { readWatchView, saveWatch, clearWatch } = require('../services/walletAssetWatchService');

const router = express.Router();

function accountIdFromReq(req, res) {
  const id = String(req.player && req.player.sub ? req.player.sub : '').trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    res.status(400).json({ success: false, error: '账号格式无效', code: 'BAD_ACCOUNT' });
    return null;
  }
  return id;
}

router.get('/', requireAuth, publicReadLimiter, async (req, res) => {
  const accountId = accountIdFromReq(req, res);
  if (!accountId) return undefined;
  try {
    const data = await readWatchView(accountId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[life-resume/wallet-assets]', err);
    return res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

router.put('/', requireAuth, publicReadLimiter, async (req, res) => {
  const accountId = accountIdFromReq(req, res);
  if (!accountId) return undefined;
  try {
    const data = await saveWatch(accountId, req.body && req.body.address);
    return res.json({ success: true, data });
  } catch (err) {
    if (err instanceof WalletAssetsError) {
      return res.status(err.status).json({
        success: false,
        error: err.message,
        code: err.code,
      });
    }
    console.error('[life-resume/wallet-assets]', err);
    return res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

router.delete('/', requireAuth, publicReadLimiter, async (req, res) => {
  const accountId = accountIdFromReq(req, res);
  if (!accountId) return undefined;
  try {
    const data = await clearWatch(accountId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[life-resume/wallet-assets]', err);
    return res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

module.exports = router;
