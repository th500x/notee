/**
 * 丢弃未绑定条目的 OSS 上传（编辑器内移除 / 关闭未保存）
 */

const { query } = require('../database/connection');
const { assertAccountOwnsKey, deleteObject } = require('./ossService');

class AbandonUploadError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'AbandonUploadError';
    this.code = code;
    this.status = status;
  }
}

/**
 * 仅当 oss_key 尚未写入 life_entry_media 时删除 OSS 对象。
 * 已入库的媒体须等保存条目时由 replaceEntryMedia 清理。
 */
async function abandonUploadObject(accountId, ossKey) {
  const id = String(accountId || '').trim().toUpperCase();
  const key = String(ossKey || '').trim();
  if (!key) {
    throw new AbandonUploadError('INVALID_OSS_KEY', 'ossKey 缺失');
  }

  assertAccountOwnsKey(id, key);

  const rows = await query(
    `SELECT id FROM life_entry_media
     WHERE account_id = ? AND (oss_key = ? OR thumb_oss_key = ?)
     LIMIT 1`,
    [id, key, key]
  );
  if (rows.length > 0) {
    throw new AbandonUploadError(
      'MEDIA_IN_USE',
      '媒体已绑定条目，请保存后生效',
      409
    );
  }

  await deleteObject(key);
  return { ossKey: key, deleted: true };
}

module.exports = {
  AbandonUploadError,
  abandonUploadObject,
};
