/**
 * 应急/本机手工投递：拉 ETHUSDT 永续已收盘 K 线，POST 到 00 ingest。
 * 生产主路径是 PM2 `00-eth-worker`（仓库根 workers/00-eth-worker.cjs），勿与工人双开。
 * Usage:
 *   ETH_MA_INGEST_URL=https://notee.vip/api/life-resume/eth-ma-cross/ingest \
 *   ETH_MA_INGEST_SECRET=... \
 *   node scripts/push-eth-ma-klines.js
 */

const { fetchClosedKlinesForIngest } = require('../services/ethMaCross/ingestPublicKlines');

async function main() {
  const url = String(process.env.ETH_MA_INGEST_URL || '').trim();
  const secret = String(process.env.ETH_MA_INGEST_SECRET || '').trim();
  if (!url || !secret) {
    console.error('missing ETH_MA_INGEST_URL or ETH_MA_INGEST_SECRET');
    process.exit(1);
  }

  const { source, klines } = await fetchClosedKlinesForIngest();
  if (!klines.length) {
    console.error('no closed klines from ingest sources');
    process.exit(1);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Eth-Ma-Ingest-Secret': secret,
    },
    body: JSON.stringify({ source, klines }),
  });
  const text = await res.text();
  let summary = text.slice(0, 200);
  try {
    const json = JSON.parse(text);
    const data = json && json.data ? json.data : {};
    summary = JSON.stringify({
      ok: data.ok,
      reason: data.reason || null,
      cross: data.cross || null,
      relay:
        data.pushDispatch && Array.isArray(data.pushDispatch.subscriptions)
          ? data.pushDispatch.subscriptions.length
          : 0,
    });
  } catch {
    /* keep truncated text */
  }
  console.log(res.status, summary);
  if (!res.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
