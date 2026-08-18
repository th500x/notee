/**
 * Login ids never handed out, in either pool. Uppercase, 4 chars.
 * Minimal on purpose: system/brand words plus four-letter slurs that would read as
 * an official or offensive handle. Not a profanity engine.
 */

const RESERVED_LOGIN_IDS = new Set([
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

function isReservedLoginId(loginId) {
  return RESERVED_LOGIN_IDS.has(loginId);
}

module.exports = {
  RESERVED_LOGIN_IDS,
  isReservedLoginId,
};
