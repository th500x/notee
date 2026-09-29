/**
 * Insert a 1–5 song suggestion batch for the operator inbox.
 */

const { randomUUID } = require('crypto');
const { query, transaction } = require('../database/connection');
const { httpError } = require('../lib/httpError');
const { dayKeyFromDate } = require('../lib/dayKey');
const { DAY_MAX, assertSongs } = require('../lib/lyricProposalRules');
const { requireActiveUser } = require('./userService');

async function createBatch(userId, body) {
  await requireActiveUser(userId);
  const songs = assertSongs(body);
  const dayKey = dayKeyFromDate();
  const batchId = randomUUID();

  await transaction(async (conn) => {
    const [countRows] = await conn.execute(
      `SELECT COUNT(*) AS n FROM lyric_proposals WHERE user_id = ? AND day_key = ?`,
      [userId, dayKey]
    );
    const used = Number(countRows[0] && countRows[0].n) || 0;
    if (used + songs.length > DAY_MAX) {
      throw httpError(429, '今天提议次数已满', 'LYRIC_PROPOSAL_DAY_QUOTA');
    }
    for (const song of songs) {
      await conn.execute(
        `INSERT INTO lyric_proposals
          (id, batch_id, user_id, day_key, title, artist, status)
         VALUES (?, ?, ?, ?, ?, ?, 'open')`,
        [randomUUID(), batchId, userId, dayKey, song.title, song.artist]
      );
    }
  });

  return { batchId, count: songs.length };
}

module.exports = {
  createBatch,
};
