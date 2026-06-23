/**
 * Purge profiles past deactivation grace period.
 * Usage:
 *   node scripts/purge-deactivated-profiles.js
 *   node scripts/purge-deactivated-profiles.js --dry-run
 *   node scripts/purge-deactivated-profiles.js --limit 10
 *
 * Env: LIFE_RESUME_DEACTIVATION_GRACE_DAYS (default 30) — used only for logging context;
 *      purge uses purge_scheduled_at already stored on profile rows.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local'), override: true });

const { query, transaction, closePool } = require('../database/connection');
const { deleteObjects } = require('../services/ossService');
const { DEACTIVATION_GRACE_DAYS } = require('../services/lifeProfileService');

function parseArgs(argv) {
  const args = { dryRun: false, limit: 100 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    if (argv[i] === '--limit' && argv[i + 1]) {
      args.limit = Math.max(1, parseInt(argv[i + 1], 10) || 100);
      i += 1;
    }
  }
  return args;
}

async function collectOssKeysForAccount(accountId) {
  const rows = await query(
    `SELECT m.oss_key, m.thumb_oss_key
     FROM life_entry_media m
     INNER JOIN life_entries e ON e.id = m.entry_id
     WHERE e.account_id = ?`,
    [accountId]
  );
  const keys = new Set();
  for (const row of rows) {
    if (row.oss_key) keys.add(row.oss_key);
    if (row.thumb_oss_key) keys.add(row.thumb_oss_key);
  }
  return [...keys];
}

async function countEntriesForAccount(accountId) {
  const rows = await query(
    'SELECT COUNT(*) AS entry_count FROM life_entries WHERE account_id = ?',
    [accountId]
  );
  return Number(rows[0]?.entry_count || 0);
}

async function purgeAccount(accountId, { dryRun }) {
  const entryCount = await countEntriesForAccount(accountId);
  const ossKeys = await collectOssKeysForAccount(accountId);

  if (dryRun) {
    console.log(
      `[purge][dry-run] ${accountId}: would delete profile + ${entryCount} entries, ${ossKeys.length} OSS keys`
    );
    return { accountId, entryCount, ossKeyCount: ossKeys.length, purged: false };
  }

  await transaction(async (conn) => {
    const [result] = await conn.execute('DELETE FROM life_profiles WHERE account_id = ?', [
      accountId,
    ]);
    if (!result.affectedRows) {
      throw new Error(`profile row missing for ${accountId}`);
    }
  });

  if (ossKeys.length > 0) {
    await deleteObjects(ossKeys);
  }

  console.log(
    `[purge] OK ${accountId}: removed profile, ${entryCount} entries (CASCADE), ${ossKeys.length} OSS keys`
  );
  return { accountId, entryCount, ossKeyCount: ossKeys.length, purged: true };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[purge] scan due profiles (limit=${args.limit}, dryRun=${args.dryRun}, graceDays=${DEACTIVATION_GRACE_DAYS})`
  );

  const dueRows = await query(
    `SELECT account_id, purge_scheduled_at
     FROM life_profiles
     WHERE profile_status = 'deactivated'
       AND purge_scheduled_at IS NOT NULL
       AND purge_scheduled_at <= NOW(3)
     ORDER BY purge_scheduled_at ASC
     LIMIT ?`,
    [args.limit]
  );

  if (dueRows.length === 0) {
    console.log('[purge] no profiles due');
    await closePool();
    return;
  }

  let purged = 0;
  for (const row of dueRows) {
    try {
      const result = await purgeAccount(row.account_id, { dryRun: args.dryRun });
      if (result.purged || args.dryRun) purged += 1;
    } catch (err) {
      console.error(`[purge] FAILED ${row.account_id}:`, err.message);
    }
  }

  console.log(`[purge] done: processed ${dueRows.length}, purged ${purged}`);
  await closePool();
}

main().catch(async (err) => {
  console.error('[purge] fatal:', err.message);
  try {
    await closePool();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
