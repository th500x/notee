/**
 * life_entry_media — bind, load, OSS cleanup
 */

const { query, transaction } = require('../database/connection');
const {
  validateMediaBundle,
  validateMediaUploadRequest,
  extensionForMime,
} = require('../../../05-san-storm/shared/utils/lifeResumeMediaRules.cjs');
const {
  promoteStagingObject,
  assertAccountOwnsKey,
  deleteObjects,
  getSignedReadUrl,
} = require('./ossService');

class MediaServiceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'MediaServiceError';
    this.code = code;
    this.status = status;
  }
}

function formatMediaRow(row, { includeOssKey = false, signUrls = true } = {}) {
  const base = {
    id: Number(row.id),
    entryId: Number(row.entry_id),
    mediaType: row.media_type,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    sortOrder: Number(row.sort_order),
    originalFilename: row.original_filename,
    width: row.width != null ? Number(row.width) : null,
    height: row.height != null ? Number(row.height) : null,
    durationMs: row.duration_ms != null ? Number(row.duration_ms) : null,
  };

  if (includeOssKey) {
    base.ossKey = row.oss_key;
  }

  if (signUrls) {
    try {
      base.url = getSignedReadUrl(row.oss_key);
      if (row.media_type === 'photo') {
        base.thumbUrl = getSignedReadUrl(row.thumb_oss_key || row.oss_key, { thumb: true });
      }
    } catch {
      base.url = null;
      base.thumbUrl = null;
    }
  }

  return base;
}

function normalizeIncomingMediaItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((item, index) => ({
    ossKey: String(item.ossKey || '').trim(),
    mediaType: String(item.mediaType || '').trim(),
    mimeType: String(item.mimeType || '').trim().toLowerCase(),
    sizeBytes: Number(item.sizeBytes),
    sortOrder: Number(item.sortOrder) > 0 ? Number(item.sortOrder) : index + 1,
    originalFilename: item.originalFilename ? String(item.originalFilename).slice(0, 255) : null,
  }));
}

function parseMediaInput(input) {
  const bundleType =
    input.mediaBundleType != null && input.mediaBundleType !== ''
      ? String(input.mediaBundleType).trim()
      : 'none';
  const rawItems = normalizeIncomingMediaItems(input.mediaItems);

  for (const item of rawItems) {
    if (!item.ossKey) {
      throw new MediaServiceError('INVALID_MEDIA', '媒体 ossKey 缺失');
    }
    const uploadCheck = validateMediaUploadRequest({
      mediaType: item.mediaType,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      filename: item.originalFilename,
    });
    if (!uploadCheck.ok) {
      throw new MediaServiceError(uploadCheck.code, uploadCheck.error);
    }
    item.mediaType = uploadCheck.mediaType;
    item.mimeType = uploadCheck.mimeType;
    item.sizeBytes = uploadCheck.sizeBytes;
  }

  const bundle = validateMediaBundle(bundleType, rawItems);
  if (!bundle.ok) {
    throw new MediaServiceError(bundle.code, bundle.error);
  }

  return bundle;
}

function resolveMediaInputForSave(input) {
  const hasMediaInput =
    input.mediaBundleType != null ||
    (Array.isArray(input.mediaItems) && input.mediaItems.length > 0);
  if (!hasMediaInput) {
    return { bundleType: 'none', items: [] };
  }
  return parseMediaInput(input);
}

/**
 * Promote staging OSS keys and INSERT media rows (create flow — entry row must exist).
 * @param {import('mysql2/promise').PoolConnection} conn
 */
async function bindParsedMediaToNewEntry(accountId, entryId, parsed, conn) {
  const id = String(accountId || '').trim().toUpperCase();
  const eid = Number(entryId);

  for (const item of parsed.items) {
    assertAccountOwnsKey(id, item.ossKey);
    const finalKey = await promoteStagingObject(
      id,
      eid,
      item.ossKey,
      item.mediaType,
      item.sortOrder,
      item.mimeType
    );
    await conn.execute(
      `INSERT INTO life_entry_media (
        entry_id, account_id, media_type, oss_key, thumb_oss_key,
        original_filename, mime_type, size_bytes, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eid,
        id,
        item.mediaType,
        finalKey,
        null,
        item.originalFilename,
        item.mimeType,
        item.sizeBytes,
        item.sortOrder,
      ]
    );
  }
}

async function listMediaRowsByEntryIds(entryIds) {
  const ids = (entryIds || []).filter((id) => Number.isInteger(Number(id)) && Number(id) > 0);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(', ');
  return query(
    `SELECT * FROM life_entry_media
     WHERE entry_id IN (${placeholders})
     ORDER BY entry_id ASC, sort_order ASC, id ASC`,
    ids
  );
}

async function listMediaForEntryIds(entryIds, options = {}) {
  const rows = await listMediaRowsByEntryIds(entryIds);
  return rows.map((row) => formatMediaRow(row, options));
}

async function attachMediaMapToEntries(entries, options = {}) {
  const ids = entries.map((e) => e.id);
  const rows = await listMediaRowsByEntryIds(ids);
  const map = new Map();
  for (const row of rows) {
    const entryId = Number(row.entry_id);
    if (!map.has(entryId)) map.set(entryId, []);
    map.get(entryId).push(formatMediaRow(row, options));
  }
  return entries.map((entry) => ({
    ...entry,
    media: map.get(entry.id) || [],
  }));
}

async function replaceEntryMedia(accountId, entryId, input) {
  const id = String(accountId || '').trim().toUpperCase();
  const eid = Number(entryId);
  const parsed = parseMediaInput(input);

  const existingRows = await query('SELECT * FROM life_entry_media WHERE entry_id = ?', [eid]);
  const oldKeys = existingRows.flatMap((row) => [row.oss_key, row.thumb_oss_key].filter(Boolean));

  const finalizedItems = [];
  for (const item of parsed.items) {
    assertAccountOwnsKey(id, item.ossKey);
    const finalKey = await promoteStagingObject(
      id,
      eid,
      item.ossKey,
      item.mediaType,
      item.sortOrder,
      item.mimeType
    );
    finalizedItems.push({ ...item, ossKey: finalKey });
  }

  await transaction(async (conn) => {
    await conn.execute('DELETE FROM life_entry_media WHERE entry_id = ?', [eid]);
    await conn.execute('UPDATE life_entries SET media_bundle_type = ? WHERE id = ? AND account_id = ?', [
      parsed.bundleType,
      eid,
      id,
    ]);

    for (const item of finalizedItems) {
      await conn.execute(
        `INSERT INTO life_entry_media (
          entry_id, account_id, media_type, oss_key, thumb_oss_key,
          original_filename, mime_type, size_bytes, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eid,
          id,
          item.mediaType,
          item.ossKey,
          null,
          item.originalFilename,
          item.mimeType,
          item.sizeBytes,
          item.sortOrder,
        ]
      );
    }
  });

  const newKeys = new Set(finalizedItems.map((item) => item.ossKey));
  const keysToDelete = oldKeys.filter((key) => !newKeys.has(key));
  await deleteObjects(keysToDelete);

  return listMediaForEntryIds([eid], { includeOssKey: true, signUrls: true });
}

async function deleteEntryMediaFromOss(entryId) {
  const rows = await query('SELECT oss_key, thumb_oss_key FROM life_entry_media WHERE entry_id = ?', [
    Number(entryId),
  ]);
  const keys = rows.flatMap((row) => [row.oss_key, row.thumb_oss_key].filter(Boolean));
  await deleteObjects(keys);
}

module.exports = {
  MediaServiceError,
  parseMediaInput,
  resolveMediaInputForSave,
  bindParsedMediaToNewEntry,
  replaceEntryMedia,
  attachMediaMapToEntries,
  listMediaForEntryIds,
  deleteEntryMediaFromOss,
  formatMediaRow,
};
