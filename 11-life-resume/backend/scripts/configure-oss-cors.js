/**
 * 为 11-life-resume OSS Bucket 写入浏览器直传所需的 CORS 规则。
 * 用法（在 11-life-resume/backend，已配置 .env 中 OSS_*）：
 *   node scripts/configure-oss-cors.js
 * 可选环境变量 OSS_CORS_ORIGINS=https://notee.vip,http://localhost:5177
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local'), override: true });

const OSS = require('ali-oss');

function parseOrigins() {
  const raw = process.env.OSS_CORS_ORIGINS || 'https://notee.vip,http://localhost:5177';
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function main() {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID && String(process.env.OSS_ACCESS_KEY_ID).trim();
  const accessKeySecret =
    process.env.OSS_ACCESS_KEY_SECRET && String(process.env.OSS_ACCESS_KEY_SECRET).trim();
  if (!accessKeyId || !accessKeySecret) {
    console.error('缺少 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET，请先配置 backend/.env');
    process.exit(1);
  }

  const client = new OSS({
    region: process.env.OSS_REGION || 'oss-cn-heyuan',
    accessKeyId,
    accessKeySecret,
    bucket: process.env.OSS_BUCKET || '11-life-resume',
    secure: true,
  });

  const allowedOrigin = parseOrigins();
  const rules = [
    {
      allowedOrigin,
      allowedMethod: ['GET', 'PUT', 'HEAD', 'POST', 'DELETE'],
      allowedHeader: ['*'],
      exposeHeader: ['ETag', 'x-oss-request-id'],
      maxAgeSeconds: '3600',
    },
  ];

  console.log('[configure-oss-cors] bucket:', process.env.OSS_BUCKET || '11-life-resume');
  console.log('[configure-oss-cors] region:', process.env.OSS_REGION || 'oss-cn-heyuan');
  console.log('[configure-oss-cors] origins:', allowedOrigin.join(', '));

  await client.putBucketCORS(rules);
  const current = await client.getBucketCORS();
  console.log('[configure-oss-cors] OK — current rules:');
  console.log(JSON.stringify(current.rules || current, null, 2));
}

main().catch((err) => {
  console.error('[configure-oss-cors] FAILED:', err.message);
  process.exit(1);
});
