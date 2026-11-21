/**
 * Honor rename rules without the database (notee-go docs/00-core/00-1-Account.md §5).
 *
 * State on the user row, one vocabulary for the API and the app:
 *   none          the tier does not carry the rename, or the account holds no letter id
 *   needs_google  Party Pass 499 / Ultra on a letter id, Google not bound yet
 *   ready         may rename now
 *   used          renamed once already; a refund or a second purchase does not reopen it
 *
 * Candidates travel in a signed ticket: the rename accepts only ids this server offered.
 * The batches themselves stay on the user row. Closing the dialog does not draw again.
 */

const crypto = require('crypto');
const { httpError } = require('./httpError');
const { isHonorLoginId, isRegularLoginId } = require('./loginId');
const { hasHonorRename } = require('./partyPass');

const TICKET_TTL_MS = 30 * 60 * 1000;
/** First batch plus one refresh (§3.1). */
const TICKET_ROUNDS = 2;
const TICKET_PURPOSE = 'honor-ticket';
/** One stored batch. Nine is the full grid; fewer is a short pool, never a second draw. */
const OFFER_MAX = 9;

/**
 * @param {{ tier: string, loginId: string|null, googleBound: boolean, renamed: boolean }} facts
 * @returns {'none'|'needs_google'|'ready'|'used'}
 */
function honorRenameState({ tier, loginId, googleBound, renamed }) {
  if (renamed) return 'used';
  if (!hasHonorRename(tier) || !loginId || !isRegularLoginId(loginId)) return 'none';
  if (!googleBound) return 'needs_google';
  return 'ready';
}

function mac(body, secret) {
  return crypto.createHmac('sha256', secret).update(`${TICKET_PURPOSE}.${body}`).digest('base64url');
}

/**
 * @param {{ userId: string, loginIds: string[], round: number, nowMs?: number }} fields
 * @param {string} secret
 */
function sealTicket({ userId, loginIds, round, nowMs = Date.now() }, secret) {
  const body = Buffer.from(
    JSON.stringify({ userId, loginIds, round, expiresAt: nowMs + TICKET_TTL_MS }),
    'utf8'
  ).toString('base64url');
  return `${body}.${mac(body, secret)}`;
}

/**
 * @returns {{ userId: string, loginIds: string[], round: number, expiresAt: number }}
 */
function openTicket(raw, { userId, secret, nowMs = Date.now() }) {
  const invalid = () => httpError(400, '这批号已过期，请重新打开', 'HONOR_TICKET_INVALID');
  if (typeof raw !== 'string') throw invalid();
  const parts = raw.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw invalid();
  const [body, given] = parts;
  const expected = Buffer.from(mac(body, secret));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw invalid();
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (err) {
    throw invalid();
  }
  const ok =
    payload &&
    payload.userId === userId &&
    Array.isArray(payload.loginIds) &&
    Number.isInteger(payload.round) &&
    Number(payload.expiresAt) > nowMs;
  if (!ok) throw invalid();
  return payload;
}

/** @returns {string[]|null} null when this batch was never drawn */
function decodeOffer(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string' || !raw) {
    throw httpError(500, '已记下的号读不出来', 'HONOR_OFFER_BROKEN');
  }
  return assertOffer(raw.split(','));
}

/** @param {string[]} loginIds */
function encodeOffer(loginIds) {
  return assertOffer(loginIds).join(',');
}

/**
 * A ticket that already contains both batches can be split back into the second one.
 * Anything else is not a stored batch.
 * @returns {string[]|null}
 */
function secondOfferFromTicket(batch1, ticketIds) {
  if (!Array.isArray(batch1) || !Array.isArray(ticketIds)) return null;
  const extra = ticketIds.filter((id) => !batch1.includes(id));
  if (extra.length === 0) return null;
  try {
    return assertOffer(extra);
  } catch (err) {
    if (err && err.code === 'HONOR_OFFER_BROKEN') return null;
    throw err;
  }
}

function assertOffer(loginIds) {
  const broken = () => httpError(500, '已记下的号读不出来', 'HONOR_OFFER_BROKEN');
  if (!Array.isArray(loginIds) || loginIds.length < 1 || loginIds.length > OFFER_MAX) throw broken();
  const seen = new Set();
  for (const id of loginIds) {
    if (typeof id !== 'string' || !isHonorLoginId(id) || seen.has(id)) throw broken();
    seen.add(id);
  }
  return loginIds;
}

module.exports = {
  TICKET_TTL_MS,
  TICKET_ROUNDS,
  OFFER_MAX,
  honorRenameState,
  sealTicket,
  openTicket,
  decodeOffer,
  encodeOffer,
  secondOfferFromTicket,
};
