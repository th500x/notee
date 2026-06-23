/**
 * Startup checks for 11-life-resume backend.
 */

const { isDevBypassOn } = require('../middleware/auth');

function assertJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    if (isDevBypassOn()) {
      console.warn('[life-resume] JWT_DEV_BYPASS=1：跳过 JWT_SECRET 检查（仅本地）');
      return;
    }
    console.error('[life-resume] JWT_SECRET 未配置或过短（>=16 字符）');
    console.error('  请与 05-san-storm/backend/.env 使用相同 JWT_SECRET');
    process.exit(1);
  }
}

module.exports = { assertJwtSecret };
