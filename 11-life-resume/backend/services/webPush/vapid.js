/**
 * VAPID 读取。HTTP 进程缺钥时仍可启动；订阅接口与工人自行检查。
 */

function trimEnv(name) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : '';
}

function getVapidConfig() {
  const publicKey = trimEnv('VAPID_PUBLIC_KEY');
  const privateKey = trimEnv('VAPID_PRIVATE_KEY');
  const subject = trimEnv('VAPID_SUBJECT') || 'https://notee.vip';
  return { publicKey, privateKey, subject };
}

function isVapidConfigured() {
  const { publicKey, privateKey } = getVapidConfig();
  return Boolean(publicKey && privateKey);
}

function assertVapidConfigured(context) {
  if (isVapidConfigured()) return getVapidConfig();
  const err = new Error(`${context}: 未配置 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY`);
  err.code = 'VAPID_MISSING';
  throw err;
}

module.exports = {
  getVapidConfig,
  isVapidConfigured,
  assertVapidConfigured,
};
