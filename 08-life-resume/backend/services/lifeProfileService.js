/**
 * life_profiles CRUD — lazy create on first access.
 */

const { query } = require('../database/connection');
const {
  defaultUsernameFromAccountId,
  isDefaultUsernameForAccount,
  validateUsername,
  assessUsernameChangeCooldown,
  validateAccountIdFormat,
  USERNAME_CHANGE_COOLDOWN_DAYS,
} = require('../../shared/utils/lifeResumeUsername.cjs');
const {
  formatProfileDisplayName,
  shouldRefreshProfileRegion,
  isPlaceholderClientIp,
} = require('../../shared/utils/lifeResumeProfileRegion.cjs');
const { resolveRegionFromIp } = require('./ipGeolocationService');
const { parseLifePathDraftJson, assessLifePathGenerateCooldown, DEFAULT_LIFE_PATH_COOLDOWN_HOURS } = require('../../shared/utils/lifeResumeLifePath.cjs');
const {
  listEntrySeriesForOwner,
  findOwnedSeries,
} = require('./lifeEntrySeriesService');
const { normalizeEntrySeriesId } = require('../../shared/utils/lifeResumeEntrySeries.cjs');

const VISIBILITY_VALUES = new Set(['public', 'private', 'specific']);

const LIFE_PATH_COOLDOWN_HOURS = parseInt(
  process.env.LIFE_PATH_COOLDOWN_HOURS || String(DEFAULT_LIFE_PATH_COOLDOWN_HOURS),
  10
);

const DEACTIVATION_GRACE_DAYS = parseInt(
  process.env.LIFE_RESUME_DEACTIVATION_GRACE_DAYS || '30',
  10
);

class ProfileServiceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ProfileServiceError';
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

function formatProfileRow(row) {
  const regionPublicLabel = row.region_public_label || null;
  return {
    accountId: row.account_id,
    username: row.username,
    regionPublicLabel,
    regionUpdatedAt: toIso(row.region_updated_at),
    displayName: formatProfileDisplayName(row.username, regionPublicLabel, row.account_id),
    usernameChangedAt: toIso(row.username_changed_at),
    pageDefaultVisibility: row.page_default_visibility,
    defaultGranteeAccountId: row.default_grantee_account_id,
    defaultEntrySeriesId:
      row.default_entry_series_id != null ? Number(row.default_entry_series_id) : null,
    profileStatus: row.profile_status,
    deactivatedAt: toIso(row.deactivated_at),
    purgeScheduledAt: toIso(row.purge_scheduled_at),
    firstEntryAt: toIso(row.first_entry_at),
    lifePathStatus: row.life_path_status || 'none',
    lifePathDraft: parseLifePathDraftJson(row.life_path_draft_json),
    publishedLifePath: row.life_path_published_text || null,
    lifePathGeneratedAt: toIso(row.life_path_generated_at),
    lifePathPublishedAt: toIso(row.life_path_published_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function enrichProfile(row) {
  const base = formatProfileRow(row);
  const usernameCooldown = assessUsernameChangeCooldown(row.username_changed_at);
  const lifePathCooldown = assessLifePathGenerateCooldown(
    row.life_path_generated_at,
    LIFE_PATH_COOLDOWN_HOURS
  );
  return {
    ...base,
    isDefaultUsername: isDefaultUsernameForAccount(row.account_id, row.username_normalized),
    usernameChangeAllowed: usernameCooldown.ok,
    usernameChangeAvailableAt: usernameCooldown.availableAt
      ? usernameCooldown.availableAt.toISOString()
      : null,
    usernameChangeDaysRemaining: usernameCooldown.ok ? 0 : usernameCooldown.daysRemaining,
    lifePathCooldownHours: LIFE_PATH_COOLDOWN_HOURS,
    lifePathGenerateAllowed: lifePathCooldown.ok,
    lifePathGenerateAvailableAt: lifePathCooldown.availableAt
      ? lifePathCooldown.availableAt.toISOString()
      : null,
  };
}

async function findProfileByAccountId(accountId) {
  const rows = await query('SELECT * FROM life_profiles WHERE account_id = ? LIMIT 1', [accountId]);
  return rows[0] || null;
}

async function getOrCreateProfile(accountId) {
  let row = await findProfileByAccountId(accountId);
  if (row) {
    return row;
  }

  const def = defaultUsernameFromAccountId(accountId);
  try {
    await query(
      `INSERT INTO life_profiles (
        account_id, username, username_normalized, page_default_visibility
      ) VALUES (?, ?, ?, 'public')`,
      [accountId, def.username, def.usernameNormalized]
    );
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      row = await findProfileByAccountId(accountId);
      if (row) return row;
    }
    throw err;
  }

  row = await findProfileByAccountId(accountId);
  if (!row) {
    throw new Error('profile insert succeeded but row missing');
  }
  return row;
}

async function ensureProfileRegionFromIp(accountId, requestIp) {
  const id = String(accountId || '').trim().toUpperCase();
  let row = await findProfileByAccountId(id);
  if (!row) return null;
  if (isPlaceholderClientIp(requestIp)) return row;
  if (!shouldRefreshProfileRegion(row.region_updated_at)) return row;

  const resolved = await resolveRegionFromIp(requestIp);
  if (resolved.ok && resolved.regionPublicLabel) {
    await query(
      `UPDATE life_profiles
       SET region_public_label = ?, region_updated_at = CURRENT_TIMESTAMP(3)
       WHERE account_id = ?`,
      [resolved.regionPublicLabel, id]
    );
  } else {
    await query(
      `UPDATE life_profiles SET region_updated_at = CURRENT_TIMESTAMP(3) WHERE account_id = ?`,
      [id]
    );
  }

  row = await findProfileByAccountId(id);
  return row;
}

async function getProfileForAccount(accountId, opts = {}) {
  const id = String(accountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new ProfileServiceError('INVALID_ACCOUNT_ID', '账号 ID 格式无效', 400);
  }
  let row = await getOrCreateProfile(id);
  if (opts.requestIp) {
    row = (await ensureProfileRegionFromIp(id, opts.requestIp)) || row;
  }
  const profile = enrichProfile(row);
  const entrySeries = await listEntrySeriesForOwner(id);
  return { ...profile, entrySeries };
}

function normalizeGranteeId(raw) {
  if (raw == null || raw === '') return null;
  const id = String(raw).trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new ProfileServiceError(
      'INVALID_GRANTEE_ACCOUNT_ID',
      '特定可见对象 ID 格式错误：首位 0–9，后三位 A–Z 或 0–9'
    );
  }
  return id;
}

async function updateProfileForAccount(accountId, patch = {}) {
  const id = String(accountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new ProfileServiceError('INVALID_ACCOUNT_ID', '账号 ID 格式无效', 400);
  }
  const row = await getOrCreateProfile(id);

  if (row.profile_status === 'deactivated') {
    throw new ProfileServiceError('PROFILE_DEACTIVATED', '账号处于注销冷静期，请先撤销注销后再修改', 403);
  }

  const sets = [];
  const params = [];

  let nextVisibility = row.page_default_visibility;
  if (patch.pageDefaultVisibility !== undefined) {
    const v = String(patch.pageDefaultVisibility || '').trim();
    if (!VISIBILITY_VALUES.has(v)) {
      throw new ProfileServiceError('INVALID_VISIBILITY', '默认权限须为 public、private 或 specific');
    }
    nextVisibility = v;
  }

  let nextGrantee = row.default_grantee_account_id;
  if (patch.defaultGranteeAccountId !== undefined) {
    nextGrantee = normalizeGranteeId(patch.defaultGranteeAccountId);
  }

  if (nextVisibility === 'specific') {
    if (!nextGrantee) {
      throw new ProfileServiceError(
        'INVALID_GRANTEE_ACCOUNT_ID',
        '默认权限为「特定」时须填写对方 4 位 ID'
      );
    }
  } else {
    nextGrantee = null;
  }

  if (nextVisibility !== row.page_default_visibility) {
    sets.push('page_default_visibility = ?');
    params.push(nextVisibility);
  }

  const granteeChanged =
    (nextGrantee || null) !== (row.default_grantee_account_id || null);
  if (granteeChanged) {
    sets.push('default_grantee_account_id = ?');
    params.push(nextGrantee);
  }

  if (patch.username !== undefined) {
    const parsed = validateUsername(patch.username);
    if (!parsed.ok) {
      throw new ProfileServiceError(parsed.code || 'INVALID_USERNAME', parsed.error);
    }

    if (parsed.usernameNormalized !== row.username_normalized) {
      const cooldown = assessUsernameChangeCooldown(row.username_changed_at);
      if (!cooldown.ok) {
        throw new ProfileServiceError(
          'USERNAME_CHANGE_COOLDOWN',
          `用户名每 ${USERNAME_CHANGE_COOLDOWN_DAYS} 天只能修改一次，请稍后再试`
        );
      }
      sets.push('username = ?');
      params.push(parsed.username);
      sets.push('username_normalized = ?');
      params.push(parsed.usernameNormalized);
      sets.push('username_changed_at = CURRENT_TIMESTAMP(3)');
    }
  }

  if (patch.defaultEntrySeriesId !== undefined) {
    const normalized = normalizeEntrySeriesId(patch.defaultEntrySeriesId);
    if (Number.isNaN(normalized)) {
      throw new ProfileServiceError('INVALID_ENTRY_SERIES', '默认系列无效', 400);
    }
    if (normalized != null) {
      await findOwnedSeries(id, normalized);
    }
    const current =
      row.default_entry_series_id != null ? Number(row.default_entry_series_id) : null;
    if (normalized !== current) {
      sets.push('default_entry_series_id = ?');
      params.push(normalized);
    }
  }

  if (sets.length === 0) {
    const profile = enrichProfile(row);
    const entrySeries = await listEntrySeriesForOwner(id);
    return { ...profile, entrySeries };
  }

  params.push(id);
  await query(`UPDATE life_profiles SET ${sets.join(', ')} WHERE account_id = ?`, params);

  const updated = await findProfileByAccountId(id);
  const profile = enrichProfile(updated);
  const entrySeries = await listEntrySeriesForOwner(id);
  return { ...profile, entrySeries };
}

async function deactivateProfileForAccount(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new ProfileServiceError('INVALID_ACCOUNT_ID', '账号 ID 格式无效', 400);
  }

  await getOrCreateProfile(id);
  const result = await query(
    `UPDATE life_profiles SET
      profile_status = 'deactivated',
      deactivated_at = CURRENT_TIMESTAMP(3),
      purge_scheduled_at = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL ? DAY)
     WHERE account_id = ? AND profile_status = 'active'`,
    [DEACTIVATION_GRACE_DAYS, id]
  );

  if (!result.affectedRows) {
    const existing = await findProfileByAccountId(id);
    if (existing && existing.profile_status === 'deactivated') {
      throw new ProfileServiceError('ALREADY_DEACTIVATED', '已处于注销冷静期', 409);
    }
    throw new ProfileServiceError('DEACTIVATE_FAILED', '无法申请注销', 400);
  }

  const updated = await findProfileByAccountId(id);
  return enrichProfile(updated);
}

async function cancelDeactivationForAccount(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new ProfileServiceError('INVALID_ACCOUNT_ID', '账号 ID 格式无效', 400);
  }

  const row = await findProfileByAccountId(id);
  if (!row || row.profile_status !== 'deactivated') {
    throw new ProfileServiceError('NOT_DEACTIVATED', '当前未处于注销冷静期', 400);
  }

  if (row.purge_scheduled_at && new Date(row.purge_scheduled_at) <= new Date()) {
    throw new ProfileServiceError(
      'PURGE_DEADLINE_PASSED',
      '冷静期已结束，无法撤销注销',
      403
    );
  }

  const result = await query(
    `UPDATE life_profiles SET
      profile_status = 'active',
      deactivated_at = NULL,
      purge_scheduled_at = NULL
     WHERE account_id = ? AND profile_status = 'deactivated'`,
    [id]
  );

  if (!result.affectedRows) {
    throw new ProfileServiceError('CANCEL_DEACTIVATION_FAILED', '撤销注销失败', 400);
  }

  const updated = await findProfileByAccountId(id);
  return enrichProfile(updated);
}

module.exports = {
  ProfileServiceError,
  getProfileForAccount,
  updateProfileForAccount,
  deactivateProfileForAccount,
  cancelDeactivationForAccount,
  ensureProfileRegionFromIp,
  enrichProfile,
  findProfileByAccountId,
  DEACTIVATION_GRACE_DAYS,
};
