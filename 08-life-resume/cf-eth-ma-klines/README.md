# ETH 均线投递 · Cloudflare Worker（已停用）

**2026-10-03**：生产已改为曼谷本机 **`00-eth-worker`**（仓库根 `workers/00-eth-worker.cjs`，由根目录 `ecosystem.config.cjs` 与 `00-notee-backend` 一并启动）。Cloudflare Worker **`eth-ma-klines` 已删除**，请勿再 `wrangler deploy`。

本目录代码仅作历史参考；应急手工投递仍可用：

```bash
cd 08-life-resume/backend
ETH_MA_INGEST_URL=https://notee.vip/api/life-resume/eth-ma-cross/ingest \
ETH_MA_INGEST_SECRET=... \
node scripts/push-eth-ma-klines.js
```

设计细节见本地（不进 Git）：`07-coin-index/docs/ETH-MA-CROSS-PUSH.md`。
