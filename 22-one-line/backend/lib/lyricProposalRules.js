/**
 * Party Catalog title suggestions. Server half of Go `LyricSongProposals`.
 * Inbox only — not a post, not a bag.
 */

const { httpError } = require('./httpError');

const BATCH_MAX = 5;
const FIELD_MAX = 80;
const DAY_MAX = 20;
const LINK_RE = /https?:\/\/|www\./i;

function clipField(raw, required) {
  if (raw == null || raw === undefined || raw === '') {
    if (required) throw httpError(400, '歌名不能为空', 'LYRIC_PROPOSAL_BAD_TITLE');
    return null;
  }
  if (typeof raw !== 'string') {
    throw httpError(400, '字段无效', 'LYRIC_PROPOSAL_BAD_FIELD');
  }
  const text = raw.normalize('NFC').trim();
  if (!text) {
    if (required) throw httpError(400, '歌名不能为空', 'LYRIC_PROPOSAL_BAD_TITLE');
    return null;
  }
  if (Array.from(text).length > FIELD_MAX) {
    throw httpError(400, `最多 ${FIELD_MAX} 字`, 'LYRIC_PROPOSAL_TOO_LONG');
  }
  if (LINK_RE.test(text)) {
    throw httpError(400, '不可含链接', 'LYRIC_PROPOSAL_LINK');
  }
  return text;
}

/**
 * @returns {{ title: string, artist: string|null }[]}
 */
function assertSongs(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.songs)) {
    throw httpError(400, 'songs 须为数组', 'LYRIC_PROPOSAL_BAD_BODY');
  }
  if (body.songs.length > BATCH_MAX) {
    throw httpError(400, `一次最多 ${BATCH_MAX} 首`, 'LYRIC_PROPOSAL_BATCH_MAX');
  }
  const songs = [];
  for (const row of body.songs) {
    if (!row || typeof row !== 'object') continue;
    const title = clipField(row.title, false);
    if (!title) continue;
    songs.push({ title, artist: clipField(row.artist, false) });
  }
  if (songs.length === 0) {
    throw httpError(400, '至少填一首歌名', 'LYRIC_PROPOSAL_NEED_TITLE');
  }
  return songs;
}

module.exports = {
  BATCH_MAX,
  FIELD_MAX,
  DAY_MAX,
  assertSongs,
};
