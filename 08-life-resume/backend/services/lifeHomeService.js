/**
 * Home Hub cards — own profile + owners who shared specific entries with viewer.
 */

const { query } = require('../database/connection');
const { validateAccountIdFormat } = require('../../shared/utils/lifeResumeUsername.cjs');
const { formatProfileDisplayName } = require('../../shared/utils/lifeResumeProfileRegion.cjs');
const { resolvePublishedLifePathForPublic } = require('../../shared/utils/lifeResumeLifePath.cjs');
const { getProfileForAccount, ProfileServiceError } = require('./lifeProfileService');

class HomeServiceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'HomeServiceError';
    this.code = code;
    this.status = status;
  }
}

function formatHomeCard(row) {
  const regionPublicLabel = row.region_public_label || null;
  return {
    accountId: row.account_id,
    username: row.username,
    regionPublicLabel,
    displayName: formatProfileDisplayName(row.username, regionPublicLabel, row.account_id),
    accessibleEntryCount: Number(row.accessible_entry_count || row.entry_count || 0),
  };
}

async function listSharedOwnerCards(viewerAccountId) {
  const rows = await query(
    `SELECT p.account_id, p.username, p.region_public_label, COUNT(e.id) AS accessible_entry_count
     FROM life_entries e
     INNER JOIN life_profiles p ON p.account_id = e.account_id
     WHERE e.grantee_account_id = ?
       AND e.visibility = 'specific'
       AND e.status = 'published'
       AND p.profile_status = 'active'
       AND e.account_id <> ?
     GROUP BY p.account_id, p.username, p.region_public_label
     ORDER BY p.username ASC, p.account_id ASC`,
    [viewerAccountId, viewerAccountId]
  );
  return rows.map(formatHomeCard);
}

async function listPublicProfileCards(limit = 30) {
  const rows = await query(
    `SELECT p.account_id, p.username, p.region_public_label,
            p.life_path_status, p.life_path_published_text,
            COUNT(e.id) AS public_entry_count,
            MAX(e.published_at) AS latest_published_at
     FROM life_profiles p
     INNER JOIN life_entries e ON e.account_id = p.account_id
     WHERE p.profile_status = 'active'
       AND e.status = 'published'
       AND e.visibility = 'public'
     GROUP BY p.account_id, p.username, p.region_public_label,
              p.life_path_status, p.life_path_published_text
     ORDER BY latest_published_at DESC, p.account_id ASC
     LIMIT ?`,
    [Math.min(Math.max(Number(limit) || 30, 1), 100)]
  );
  return rows.map((row) => {
    const regionPublicLabel = row.region_public_label || null;
    const publicEntryCount = Number(row.public_entry_count || 0);
    return {
      accountId: row.account_id,
      username: row.username,
      regionPublicLabel,
      displayName: formatProfileDisplayName(row.username, regionPublicLabel, row.account_id),
      publicEntryCount,
      publishedLifePath: resolvePublishedLifePathForPublic(row, publicEntryCount > 0),
      latestPublishedAt: row.latest_published_at
        ? new Date(row.latest_published_at).toISOString()
        : null,
    };
  });
}

async function getHomeCards(accountId, opts = {}) {
  const viewerId = String(accountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(viewerId)) {
    throw new HomeServiceError('INVALID_ACCOUNT_ID', '账号 ID 格式无效', 400);
  }

  const profile = await getProfileForAccount(viewerId, { requestIp: opts.requestIp });
  if (profile.profileStatus === 'deactivated') {
    throw new HomeServiceError('PROFILE_DEACTIVATED', '账号处于注销冷静期', 403);
  }

  const sharedWithMe = await listSharedOwnerCards(viewerId);

  return {
    mine: {
      accountId: profile.accountId,
      username: profile.username,
      regionPublicLabel: profile.regionPublicLabel,
      displayName: profile.displayName,
      isDefaultUsername: profile.isDefaultUsername,
    },
    sharedWithMe,
  };
}

module.exports = {
  HomeServiceError,
  getHomeCards,
  listPublicProfileCards,
};
