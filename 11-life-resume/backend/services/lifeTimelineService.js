/**
 * Public timeline — permission-filtered profile + entries for /u/:accountId
 */

const { query } = require('../database/connection');
const { validateAccountIdFormat } = require('../../shared/utils/lifeResumeUsername.cjs');
const { formatProfileDisplayName } = require('../../shared/utils/lifeResumeProfileRegion.cjs');
const { resolvePublishedLifePathForPublic } = require('../../shared/utils/lifeResumeLifePath.cjs');
const { findProfileByAccountId, ensureProfileRegionFromIp } = require('./lifeProfileService');
const { formatEntryForViewer } = require('./lifeEntryService');
const { attachMediaMapToEntries } = require('./lifeEntryMediaService');
const {
  listCustomSeriesForAccount,
} = require('./lifeEntrySeriesService');
const {
  buildVisibleEntrySeriesList,
} = require('../../shared/utils/lifeResumeEntrySeries.cjs');

class TimelineServiceError extends Error {
  constructor(code, message, status = 404) {
    super(message);
    this.name = 'TimelineServiceError';
    this.code = code;
    this.status = status;
  }
}

function formatPublicProfile(row, publishedLifePath = null) {
  const regionPublicLabel = row.region_public_label || null;
  return {
    accountId: row.account_id,
    username: row.username,
    regionPublicLabel,
    displayName: formatProfileDisplayName(row.username, regionPublicLabel, row.account_id),
    publishedLifePath: publishedLifePath || null,
    defaultEntrySeriesId:
      row.default_entry_series_id != null ? Number(row.default_entry_series_id) : null,
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
 * @param {{ requestIp?: string }} [opts]
 */
async function getPublicTimeline(ownerAccountId, viewerAccountId, opts = {}) {
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

  const profileRowBefore = await findProfileByAccountId(ownerId);
  if (!profileRowBefore || profileRowBefore.profile_status !== 'active') {
    throw new TimelineServiceError('PROFILE_NOT_AVAILABLE', '页面不存在或暂无内容');
  }

  const isOwner = viewerId === ownerId;
  let profileRow = profileRowBefore;
  if (isOwner && opts.requestIp) {
    profileRow = (await ensureProfileRegionFromIp(ownerId, opts.requestIp)) || profileRowBefore;
  }

  const entryRows = isOwner
    ? await listOwnerEntries(ownerId)
    : await listPublishedVisibleEntries(ownerId, viewerId);

  const customSeries = await listCustomSeriesForAccount(ownerId);
  const formattedEntries = entryRows.map((row) => formatEntryForViewer(row, { isOwner }));
  const entriesWithMedia = await attachMediaMapToEntries(formattedEntries, {
    signUrls: true,
    includeOssKey: isOwner,
  });

  const entrySeriesList = buildVisibleEntrySeriesList(
    entriesWithMedia,
    customSeries,
    isOwner
  );

  const publicEntryCount = isOwner
    ? entryRows.filter((row) => row.status === 'published' && row.visibility === 'public').length
    : entryRows.length;
  const publishedLifePath = resolvePublishedLifePathForPublic(profileRow, publicEntryCount > 0);

  return {
    profile: formatPublicProfile(profileRow, publishedLifePath),
    viewer: {
      accountId: viewerId,
      isOwner,
      isLoggedIn: !!viewerId,
    },
    entrySeriesList,
    entries: entriesWithMedia,
  };
}

module.exports = {
  TimelineServiceError,
  getPublicTimeline,
};
