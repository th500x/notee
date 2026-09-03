/**
 * Aliyun OSS for 11-life-resume bucket (browser PUT直传 + 签名读 URL)
 */

const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local'), override: true });

const OSS = require('ali-oss');
const { extensionForMime } = require('../../../33-san-storm/shared/utils/lifeResumeMediaRules.cjs');

const UPLOAD_SIGN_TTL_SECONDS = 15 * 60;
const READ_URL_TTL_SECONDS = 2 * 60 * 60;

let ossClient = null;
let ossDisabledLogged = false;

function hasOssCredentials() {
  const id = process.env.OSS_ACCESS_KEY_ID && String(process.env.OSS_ACCESS_KEY_ID).trim();
  const secret = process.env.OSS_ACCESS_KEY_SECRET && String(process.env.OSS_ACCESS_KEY_SECRET).trim();
  return !!(id && secret);
}

function getOssClient() {
  if (ossClient !== null) {
    return ossClient;
  }
  if (!hasOssCredentials()) {
    if (!ossDisabledLogged) {
      ossDisabledLogged = true;
      console.warn(
        '[life-resume/OSS] 未配置 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET，媒体上传不可用'
      );
    }
    return null;
  }
  ossClient = new OSS({
    region: process.env.OSS_REGION || 'oss-cn-heyuan',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID.trim(),
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET.trim(),
    bucket: process.env.OSS_BUCKET || '11-life-resume',
    secure: true,
  });
  return ossClient;
}

function requireOssClient() {
  const client = getOssClient();
  if (!client) {
    const err = new Error('未配置阿里云 OSS 密钥，无法上传媒体');
    err.code = 'OSS_NOT_CONFIGURED';
    throw err;
  }
  return client;
}

function isOssAvailable() {
  return hasOssCredentials();
}

function randomToken() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Object key inside bucket 11-life-resume: {accountId}/{entryId|_staging/...}/...
 */
function buildObjectKey({ accountId, entryId, stagingToken, mediaType, sortOrder, ext }) {
  const folder = entryId
    ? `${accountId}/${entryId}`
    : `${accountId}/_staging/${stagingToken || randomToken()}`;
  return `${folder}/${mediaType}_${sortOrder}_${randomToken()}.${ext}`;
}

function assertAccountOwnsKey(accountId, ossKey) {
  const id = String(accountId || '').trim().toUpperCase();
  const key = String(ossKey || '');
  if (!key.startsWith(`${id}/`)) {
    const err = new Error('媒体对象路径无效');
    err.code = 'INVALID_OSS_KEY';
    throw err;
  }
  if (key.includes('..')) {
    const err = new Error('媒体对象路径无效');
    err.code = 'INVALID_OSS_KEY';
    throw err;
  }
}

async function createUploadSign({
  accountId,
  entryId,
  stagingToken,
  mediaType,
  mimeType,
  sortOrder = 1,
}) {
  const client = requireOssClient();
  const ext = extensionForMime(mimeType);
  if (!ext) {
    const err = new Error('不支持的 MIME 类型');
    err.code = 'INVALID_MEDIA';
    throw err;
  }

  const ossKey = buildObjectKey({
    accountId,
    entryId: entryId || null,
    stagingToken,
    mediaType,
    sortOrder,
    ext,
  });

  const uploadUrl = client.signatureUrl(ossKey, {
    method: 'PUT',
    expires: UPLOAD_SIGN_TTL_SECONDS,
    'Content-Type': mimeType,
  });

  return {
    ossKey,
    uploadUrl: uploadUrl.replace(/^http:/, 'https:'),
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    expiresIn: UPLOAD_SIGN_TTL_SECONDS,
  };
}

async function copyObjectIfNeeded(sourceKey, targetKey) {
  if (sourceKey === targetKey) return targetKey;
  const client = requireOssClient();
  await client.copy(targetKey, sourceKey);
  await client.delete(sourceKey);
  return targetKey;
}

function buildFinalObjectKey(accountId, entryId, mediaType, sortOrder, ext) {
  return buildObjectKey({ accountId, entryId, mediaType, sortOrder, ext });
}

async function promoteStagingObject(accountId, entryId, stagingKey, mediaType, sortOrder, mimeType) {
  assertAccountOwnsKey(accountId, stagingKey);
  const ext = extensionForMime(mimeType);
  const finalKey = buildFinalObjectKey(accountId, entryId, mediaType, sortOrder, ext);
  if (stagingKey.includes('/_staging/')) {
    return copyObjectIfNeeded(stagingKey, finalKey);
  }
  return stagingKey;
}

async function deleteObject(ossKey) {
  if (!ossKey || !isOssAvailable()) return;
  const client = getOssClient();
  try {
    await client.delete(ossKey);
  } catch (err) {
    console.error('[life-resume/OSS] delete failed:', ossKey, err.message);
  }
}

async function deleteObjects(ossKeys) {
  const keys = (ossKeys || []).filter(Boolean);
  if (keys.length === 0 || !isOssAvailable()) return;
  const client = getOssClient();
  try {
    await client.deleteMulti(keys, { quiet: true });
  } catch (err) {
    console.error('[life-resume/OSS] batch delete failed:', err.message);
  }
}

function getSignedReadUrl(ossKey, { thumb = false } = {}) {
  const client = requireOssClient();
  const options = { expires: READ_URL_TTL_SECONDS };
  if (thumb) {
    options.process = 'image/resize,w_480';
  }
  return client.signatureUrl(ossKey, options).replace(/^http:/, 'https:');
}

async function checkConnection() {
  const client = getOssClient();
  if (!client) {
    return { success: false, message: 'OSS 未配置' };
  }
  try {
    await client.getBucketInfo();
    return {
      success: true,
      message: 'OSS 连接正常',
      bucket: process.env.OSS_BUCKET || '11-life-resume',
      region: process.env.OSS_REGION || 'oss-cn-heyuan',
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

module.exports = {
  isOssAvailable,
  createUploadSign,
  promoteStagingObject,
  assertAccountOwnsKey,
  deleteObject,
  deleteObjects,
  getSignedReadUrl,
  checkConnection,
  buildFinalObjectKey,
};
