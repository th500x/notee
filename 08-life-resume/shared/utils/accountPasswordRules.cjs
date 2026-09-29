/**
 * 账号密码规则（注册 / 修改密码共用）
 * 11 自持副本；须与 accountPasswordRules.js 同步
 */

const ACCOUNT_PASSWORD_MIN_LENGTH = 6;

/**
 * @param {string} password
 * @param {string} confirmPassword
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function validateNewAccountPassword(password, confirmPassword) {
  const pwd = String(password ?? '');
  const confirm = String(confirmPassword ?? '');

  if (!pwd || !confirm) {
    return { ok: false, error: '请输入密码' };
  }
  if (pwd.length < ACCOUNT_PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `密码至少需要${ACCOUNT_PASSWORD_MIN_LENGTH}位` };
  }
  if (pwd !== confirm) {
    return { ok: false, error: '两次输入的密码不一致' };
  }
  return { ok: true };
}

module.exports = {
  ACCOUNT_PASSWORD_MIN_LENGTH,
  validateNewAccountPassword,
};
