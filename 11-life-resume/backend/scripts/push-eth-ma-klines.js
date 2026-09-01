/**
 * 应急/本机手工投递：在能访问交易所的网络拉 ETHUSDT 永续已收盘 K 线，POST 到 11 ingest。
 * 生产主路径是 Cloudflare Worker（11-life-resume/cf-eth-ma-klines），不要再用 GitHub Actions。
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
  console.log(res.status, text);
  if (!res.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
