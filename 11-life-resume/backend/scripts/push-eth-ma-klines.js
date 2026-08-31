/**
 * GitHub Actions 用：在海外拉币安已收盘 K 线，POST 到 11 ingest。
 * Usage:
 *   ETH_MA_INGEST_URL=https://notee.vip/api/life-resume/eth-ma-cross/ingest \
 *   ETH_MA_INGEST_SECRET=... \
 *   node scripts/push-eth-ma-klines.js
 */

const { fetchClosedKlines } = require('../services/ethMaCross/binanceFuturesKline');

async function main() {
  const url = String(process.env.ETH_MA_INGEST_URL || '').trim();
  const secret = String(process.env.ETH_MA_INGEST_SECRET || '').trim();
  if (!url || !secret) {
    console.error('missing ETH_MA_INGEST_URL or ETH_MA_INGEST_SECRET');
    process.exit(1);
  }

  const klines = await fetchClosedKlines();
  if (!klines.length) {
    console.error('no closed klines from Binance');
    process.exit(1);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Eth-Ma-Ingest-Secret': secret,
    },
    body: JSON.stringify({ klines }),
  });
  const text = await res.text();
  console.log(res.status, text);
  if (!res.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
