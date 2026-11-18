/**
 * Honor rename rules without the database (notee-go docs/00-core/00-1-Account.md §5).
 *
 * State on the user row, one vocabulary for the API and the app:
 *   none          the tier does not carry the rename, or the account holds no letter id
 *   needs_google  Party Pass 499 / Ultra on a letter id, Google not bound yet
 *   ready         may rename now
 *   used          renamed once already; a refund or a second purchase does not reopen it
 *
 * Candidates travel in a signed ticket: the rename accepts only ids this server offered,
 * and the ticket counts the one refresh.
 */

const crypto = require('crypto');
const { httpError } = require('./httpError');
const { isRegularLoginId } = require('./loginId');
const { hasHonorRename } = require('./partyPass');

const TICKET_TTL_MS = 30 * 60 * 1000;
/** First batch plus one refresh (§3.1). */
const TICKET_ROUNDS = 2;
const TICKET_PURPOSE = 'honor-ticket';

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

module.exports = {
  TICKET_TTL_MS,
  TICKET_ROUNDS,
  honorRenameState,
  sealTicket,
  openTicket,
};
