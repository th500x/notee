/**
 * Public timeline — permission-filtered profile + entries for /u/:accountId
 */

const { query } = require('../database/connection');
const { validateAccountIdFormat } = require('../../../05-san-storm/shared/utils/lifeResumeUsername.cjs');
const { findProfileByAccountId } = require('./lifeProfileService');
const { formatEntryForViewer } = require('./lifeEntryService');
const { attachMediaMapToEntries } = require('./lifeEntryMediaService');

class TimelineServiceError extends Error {
  constructor(code, message, status = 404) {
    super(message);
    this.name = 'TimelineServiceError';
    this.code = code;
    this.status = status;
  }
}

function formatPublicProfile(row) {
  return {
    accountId: row.account_id,
    username: row.username,
  };
}

async function listOwnerEntries(accountId) {
  const rows = await query(
    `SELECT * FROM life_entries
     WHERE account_id = ?
     ORDER BY is_pinned DESC, timeline_sort_key ASC, id ASC`,
    [accountId]
  );
  return rows;
}

async function listPublishedVisibleEntries(ownerAccountId, viewerAccountId) {
  const params = [ownerAccountId];
  let visibilityClause = `e.visibility = 'public'`;

  if (viewerAccountId) {
    visibilityClause = `(e.visibility = 'public' OR (e.visibility = 'specific' AND e.grantee_account_id = ?))`;
    params.push(viewerAccountId);
  }

  const rows = await query(
    `SELECT e.* FROM life_entries e
     INNER JOIN life_profiles p ON p.account_id = e.account_id
     WHERE e.account_id = ?
       AND p.profile_status = 'active'
       AND e.status = 'published'
       AND ${visibilityClause}
     ORDER BY e.is_pinned DESC, e.timeline_sort_key ASC, e.id ASC`,
    params
  );
  return rows;
}

/**
 * @param {string} ownerAccountId
 * @param {string|null|undefined} viewerAccountId — JWT sub if logged in
 */
async function getPublicTimeline(ownerAccountId, viewerAccountId) {
  const ownerId = String(ownerAccountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(ownerId)) {
    throw new TimelineServiceError('PROFILE_NOT_AVAILABLE', '页面不存在或暂无内容');
  }

  const viewerId =
    viewerAccountId != null && viewerAccountId !== ''
      ? String(viewerAccountId).trim().toUpperCase()
      : null;
  if (viewerId && !validateAccountIdFormat(viewerId)) {
    throw new TimelineServiceError('PROFILE_NOT_AVAILABLE', '页面不存在或暂无内容');
  }

  const profileRow = await findProfileByAccountId(ownerId);
  if (!profileRow || profileRow.profile_status !== 'active') {
    throw new TimelineServiceError('PROFILE_NOT_AVAILABLE', '页面不存在或暂无内容');
  }

  const isOwner = viewerId === ownerId;
  const entryRows = isOwner
    ? await listOwnerEntries(ownerId)
    : await listPublishedVisibleEntries(ownerId, viewerId);

  return {
    profile: formatPublicProfile(profileRow),
    viewer: {
      accountId: viewerId,
      isOwner,
      isLoggedIn: !!viewerId,
    },
    entries: await attachMediaMapToEntries(
      entryRows.map((row) => formatEntryForViewer(row, { isOwner })),
      { signUrls: true, includeOssKey: isOwner }
    ),
  };
}

module.exports = {
  TimelineServiceError,
  getPublicTimeline,
};
