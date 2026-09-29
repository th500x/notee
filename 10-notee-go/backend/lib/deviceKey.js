/**
 * Device credential: client sends opaque deviceKey; we only persist SHA-256 hex.
 */

const crypto = require('crypto');

const DEVICE_KEY_MIN = 16;
const DEVICE_KEY_MAX = 128;

function assertDeviceKey(raw) {
  if (typeof raw !== 'string') {
    const err = new Error('deviceKey 必填');
    err.status = 400;
    err.code = 'BAD_DEVICE_KEY';
    throw err;
  }
  const key = raw.trim();
  if (key.length < DEVICE_KEY_MIN || key.length > DEVICE_KEY_MAX) {
    const err = new Error(`deviceKey 长度须为 ${DEVICE_KEY_MIN}–${DEVICE_KEY_MAX}`);
    err.status = 400;
    err.code = 'BAD_DEVICE_KEY';
    throw err;
  }
  return key;
}

function hashDeviceKey(deviceKey) {
  return crypto.createHash('sha256').update(deviceKey, 'utf8').digest('hex');
}

module.exports = {
  DEVICE_KEY_MIN,
  DEVICE_KEY_MAX,
  assertDeviceKey,
  hashDeviceKey,
};
