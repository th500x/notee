/**
 * Login ids never handed out automatically, in either pool. Uppercase, 4 chars.
 *
 * Two buckets:
 *   - blocked: system / brand / slurs — never grant, even by operator
 *   - lion: quadrupled 0000–9999 and AAAA–ZZZZ — event / admin grant only
 *
 * See notee-go/docs/00-1-Account.md §3.1.
 */

const BLOCKED_LOGIN_IDS = new Set([
  // system / brand
  'NOTE',
  'GOGO',
  'HOST',
  'USER',
  'AUTH',
  'NULL',
  'TRUE',
  'SELF',
  'ROOT',
  'TEST',
  'SYS1',
  // offensive
  'FUCK',
  'SHIT',
  'DICK',
  'PISS',
  'COCK',
  'CUNT',
  'SLUT',
  'ANAL',
  'PORN',
  'RAPE',
  'NAZI',
]);

const DIGITS = '0123456789';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const LION_LOGIN_IDS = new Set([
  ...[...DIGITS].map((ch) => ch.repeat(4)),
  ...[...LETTERS].map((ch) => ch.repeat(4)),
]);

/** Union used by auto-pick + self-register. Operator grant uses [isLionLoginId] only. */
const RESERVED_LOGIN_IDS = new Set([...BLOCKED_LOGIN_IDS, ...LION_LOGIN_IDS]);

function isBlockedLoginId(loginId) {
  return BLOCKED_LOGIN_IDS.has(loginId);
}

function isLionLoginId(loginId) {
  return LION_LOGIN_IDS.has(loginId);
}

function isReservedLoginId(loginId) {
  return RESERVED_LOGIN_IDS.has(loginId);
}

module.exports = {
  BLOCKED_LOGIN_IDS,
  LION_LOGIN_IDS,
  RESERVED_LOGIN_IDS,
  isBlockedLoginId,
  isLionLoginId,
  isReservedLoginId,
};
