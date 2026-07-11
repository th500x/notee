/**
 * life_entry_series — 用户自定义人生片段系列
 */

const { query, transaction, pool } = require('../database/connection');
const { deleteObjects } = require('./ossService');
const { validateAccountIdFormat } = require('../../../05-san-storm/shared/utils/lifeResumeUsername.cjs');
const {
  CHRONOLOGICAL_ENTRY_SERIES_NAME,
  MAX_CUSTOM_ENTRY_SERIES_PER_USER,
  normalizeEntrySeriesId,
  validateEntrySeriesName,
  buildEntrySeriesSwitcherList,
} = require('../../../05-san-storm/shared/utils/lifeResumeEntrySeries.cjs');

class EntrySeriesServiceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'EntrySeriesServiceError';
    this.code = code;
    this.status = status;
  }
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function formatSeriesRow(row) {
  return {
    id: Number(row.id),
    accountId: row.account_id,
    name: row.name,
    sortOrder: Number(row.sort_order),
    entryCount: row.entry_count != null ? Number(row.entry_count) : undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function formatSeriesListPayload(customRows) {
  const custom = (customRows || []).map(formatSeriesRow);
  return {
    chronological: {
      id: null,
      name: CHRONOLOGICAL_ENTRY_SERIES_NAME,
      isBuiltin: true,
    },
    custom,
    switcher: buildEntrySeriesSwitcherList(custom),
  };
}

async function assertSeriesMutationAllowed(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  const rows = await query('SELECT profile_status FROM life_profiles WHERE account_id = ? LIMIT 1', [
    id,
  ]);
  if (rows[0]?.profile_status === 'deactivated') {
    throw new EntrySeriesServiceError(
      'PROFILE_DEACTIVATED',
      '账号处于注销冷静期，无法管理系列',
      403
    );
  }
}

async function collectOssKeysForSeriesEntries(accountId, seriesId) {
  const rows = await query(
    `SELECT m.oss_key, m.thumb_oss_key
     FROM life_entry_media m
     INNER JOIN life_entries e ON e.id = m.entry_id
     WHERE e.account_id = ? AND e.entry_series_id = ?`,
    [accountId, seriesId]
  );
  const keys = new Set();
  for (const row of rows) {
    if (row.oss_key) keys.add(row.oss_key);
    if (row.thumb_oss_key) keys.add(row.thumb_oss_key);
  }
  return [...keys];
}

async function listCustomSeriesForAccount(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  const rows = await query(
    `SELECT s.*, COUNT(e.id) AS entry_count
     FROM life_entry_series s
     LEFT JOIN life_entries e
       ON e.entry_series_id = s.id AND e.account_id = s.account_id
     WHERE s.account_id = ?
     GROUP BY s.id
     ORDER BY s.sort_order ASC, s.id ASC`,
    [id]
  );
  return rows.map(formatSeriesRow);
}

async function findOwnedSeries(accountId, seriesId) {
  const id = String(accountId || '').trim().toUpperCase();
  const sid = Number(seriesId);
  if (!validateAccountIdFormat(id) || !Number.isInteger(sid) || sid <= 0) {
    throw new EntrySeriesServiceError('ENTRY_SERIES_NOT_FOUND', '系列不存在', 404);
  }
  const rows = await query(
    'SELECT * FROM life_entry_series WHERE id = ? AND account_id = ? LIMIT 1',
    [sid, id]
  );
  if (!rows[0]) {
    throw new EntrySeriesServiceError('ENTRY_SERIES_NOT_FOUND', '系列不存在', 404);
  }
  return rows[0];
}

/**
 * 解析保存条目时的 series id；null = 编年历。
 * @param {string} accountId
 * @param {unknown} raw
 */
async function resolveEntrySeriesIdForSave(accountId, raw) {
  if (raw === undefined) {
    return undefined;
  }
  const normalized = normalizeEntrySeriesId(raw);
  if (Number.isNaN(normalized)) {
    throw new EntrySeriesServiceError('INVALID_ENTRY_SERIES', '系列无效', 400);
  }
  if (normalized == null) {
    return null;
  }
  await findOwnedSeries(accountId, normalized);
  return normalized;
}

async function countEntriesInSeries(accountId, seriesId) {
  const rows = await query(
    'SELECT COUNT(*) AS c FROM life_entries WHERE account_id = ? AND entry_series_id = ?',
    [accountId, seriesId]
  );
  return Number(rows[0]?.c || 0);
}

async function listEntrySeriesForOwner(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new EntrySeriesServiceError('INVALID_ACCOUNT_ID', '账号 ID 格式无效', 400);
  }
  const custom = await listCustomSeriesForAccount(id);
  return formatSeriesListPayload(custom);
}

async function createEntrySeriesForOwner(accountId, input = {}) {
  const id = String(accountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new EntrySeriesServiceError('INVALID_ACCOUNT_ID', '账号 ID 格式无效', 400);
  }
  await assertSeriesMutationAllowed(id);

  const nameCheck = validateEntrySeriesName(input.name);
  if (!nameCheck.ok) {
    throw new EntrySeriesServiceError(nameCheck.code, nameCheck.error);
  }

  const existing = await query(
    'SELECT COUNT(*) AS c FROM life_entry_series WHERE account_id = ?',
    [id]
  );
  if (Number(existing[0]?.c || 0) >= MAX_CUSTOM_ENTRY_SERIES_PER_USER) {
    throw new EntrySeriesServiceError(
      'ENTRY_SERIES_LIMIT',
      `最多可创建 ${MAX_CUSTOM_ENTRY_SERIES_PER_USER} 个自定义系列`,
      400
    );
  }

  const sortOrder = Number(existing[0]?.c || 0);

  try {
    const [result] = await pool.execute(
      `INSERT INTO life_entry_series (account_id, name, sort_order)
       VALUES (?, ?, ?)`,
      [id, nameCheck.name, sortOrder]
    );
    const rows = await query('SELECT * FROM life_entry_series WHERE id = ? LIMIT 1', [
      result.insertId,
    ]);
    return formatSeriesRow(rows[0]);
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw new EntrySeriesServiceError(
        'ENTRY_SERIES_NAME_TAKEN',
        '已有同名系列，请换一个名称',
        400
      );
    }
    throw err;
  }
}

async function updateEntrySeriesForOwner(accountId, seriesId, input = {}) {
  await assertSeriesMutationAllowed(accountId);
  const row = await findOwnedSeries(accountId, seriesId);
  const nameCheck = validateEntrySeriesName(input.name);
  if (!nameCheck.ok) {
    throw new EntrySeriesServiceError(nameCheck.code, nameCheck.error);
  }
  if (nameCheck.name === row.name) {
    return formatSeriesRow(row);
  }
  try {
    await query('UPDATE life_entry_series SET name = ? WHERE id = ? AND account_id = ?', [
      nameCheck.name,
      Number(seriesId),
      String(accountId).trim().toUpperCase(),
    ]);
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw new EntrySeriesServiceError(
        'ENTRY_SERIES_NAME_TAKEN',
        '已有同名系列，请换一个名称',
        400
      );
    }
    throw err;
  }
  const updated = await findOwnedSeries(accountId, seriesId);
  return formatSeriesRow(updated);
}

async function deleteEntrySeriesForOwner(accountId, seriesId, { confirm = false } = {}) {
  const id = String(accountId || '').trim().toUpperCase();
  await assertSeriesMutationAllowed(id);
  await findOwnedSeries(id, seriesId);
  const sid = Number(seriesId);
  const entryCount = await countEntriesInSeries(id, sid);

  if (!confirm) {
    throw new EntrySeriesServiceError(
      'ENTRY_SERIES_CONFIRM_REQUIRED',
      '删除系列须显式确认',
      400
    );
  }

  const ossKeys = await collectOssKeysForSeriesEntries(id, sid);

  await transaction(async (conn) => {
    await conn.execute('DELETE FROM life_entries WHERE account_id = ? AND entry_series_id = ?', [
      id,
      sid,
    ]);
    await conn.execute('DELETE FROM life_entry_series WHERE id = ? AND account_id = ?', [sid, id]);
    await conn.execute(
      'UPDATE life_profiles SET default_entry_series_id = NULL WHERE account_id = ? AND default_entry_series_id = ?',
      [id, sid]
    );
  });

  if (ossKeys.length > 0) {
    await deleteObjects(ossKeys);
  }

  return {
    deleted: true,
    id: sid,
    deletedEntryCount: entryCount,
    hadEntries: entryCount > 0,
  };
}

module.exports = {
  EntrySeriesServiceError,
  listCustomSeriesForAccount,
  findOwnedSeries,
  resolveEntrySeriesIdForSave,
  countEntriesInSeries,
  listEntrySeriesForOwner,
  createEntrySeriesForOwner,
  updateEntrySeriesForOwner,
  deleteEntrySeriesForOwner,
  formatSeriesListPayload,
};
