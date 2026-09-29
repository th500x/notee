/**
 * 08-life-resume 后端启动检查。
 * 本进程即全站 00：账号 JWT_SECRET 与管理员 ADMIN_JWT_SECRET 必须分开。
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { isDevBypassOn } = require('../middleware/auth');

function assertJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    if (isDevBypassOn()) {
      console.warn('[life-resume] JWT_DEV_BYPASS=1：跳过 JWT_SECRET 检查（仅本地）');
      return;
    }
    console.error('[life-resume] JWT_SECRET 未配置或过短（>=16 字符）');
    console.error('  请在 08-life-resume/backend/.env 配置 JWT_SECRET（>=16 字符）');
    process.exit(1);
  }
}

/**
 * 旧根目录 backend/.env 里的 JWT_SECRET 是管理员密钥。
 * 只补进 ADMIN_JWT_SECRET，不覆盖账号 JWT_SECRET。
 */
function loadLegacyAdminEnv() {
  if (process.env.ADMIN_JWT_SECRET && process.env.GLOBAL_PASSWORD_HASH) {
    return;
  }

  const legacyPath = path.join(__dirname, '../../../backend/.env');
  if (!fs.existsSync(legacyPath)) {
    return;
  }

  const parsed = dotenv.parse(fs.readFileSync(legacyPath));
  let used = false;
  if (!process.env.ADMIN_JWT_SECRET && parsed.JWT_SECRET) {
    process.env.ADMIN_JWT_SECRET = parsed.JWT_SECRET;
    used = true;
  }
  if (!process.env.GLOBAL_PASSWORD_HASH && parsed.GLOBAL_PASSWORD_HASH) {
    process.env.GLOBAL_PASSWORD_HASH = parsed.GLOBAL_PASSWORD_HASH;
    used = true;
  }
  if (used) {
    console.warn(
      '[00] 管理员口令暂从仓库根 backend/.env 读入。请抄到 08-life-resume/backend/.env：ADMIN_JWT_SECRET 用原来的 JWT_SECRET，GLOBAL_PASSWORD_HASH 原样复制。不要和账号 JWT_SECRET 用同一个值。'
    );
  }
}

function assertAdminAuthConfig() {
  const player = process.env.JWT_SECRET || '';
  let admin = process.env.ADMIN_JWT_SECRET || '';
  const hash = process.env.GLOBAL_PASSWORD_HASH || '';

  if (admin && player && admin === player) {
    console.error(
      '[00] ADMIN_JWT_SECRET 与账号 JWT_SECRET 相同，已停用 /api/auth。请换成另一把管理员密钥，否则普通账号会被 06 当成总管理员。'
    );
    delete process.env.ADMIN_JWT_SECRET;
    admin = '';
  }

  const ready = admin.length >= 16 && hash.length > 0;
  if (ready) {
    return;
  }

  console.error(
    '[00] 管理员口令未配齐（需要 ADMIN_JWT_SECRET>=16 与 GLOBAL_PASSWORD_HASH）。人生片段继续运行，/api/auth 暂不可用。'
  );
  console.error(
    '  请把旧 backend/.env 的 JWT_SECRET 写入 08-life-resume/backend/.env 的 ADMIN_JWT_SECRET，GLOBAL_PASSWORD_HASH 原样复制。'
  );
}

module.exports = {
  assertJwtSecret,
  loadLegacyAdminEnv,
  assertAdminAuthConfig,
};
