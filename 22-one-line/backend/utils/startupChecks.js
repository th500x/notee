/**
 * Startup checks — fail fast; no silent secret fallback.
 */

function assertJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    console.error('[one-line] JWT_SECRET 未配置或过短（>=16 字符）');
    console.error('  请写入 backend/.env（独立密钥，勿复用 3001 管理员 Token）');
    process.exit(1);
  }
}

module.exports = { assertJwtSecret };
