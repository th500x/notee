/**
 * GET /api/life-resume/wallet-assets?address=0x…
 * 公开只读：钱包币值 + Uniswap 头寸。地址由调用方传入，不入库。
 */

const express = require('express');
const { publicReadLimiter } = require('../middleware/rateLimit');
const { WalletAssetsError, loadWalletAssets } = require('../services/walletAssetsService');

const router = express.Router();

router.get('/', publicReadLimiter, async (req, res) => {
  try {
    const data = await loadWalletAssets(req.query.address);
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

module.exports = router;
