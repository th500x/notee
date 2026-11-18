/**
 * Honor rename smoke with fake qualification (docs/00-core/00-1-Account.md §5.1, part 3):
 * Party Pass from the staff grant, Google bound by writing google_sub directly.
 * Real Play purchases and real Google tokens are the licence-tester runs, not this.
 * Usage: node scripts/smoke-honor-rename.js
 */

const crypto = require('crypto');
const { query, pool } = require('../database/connection');
const { getSecret } = require('../middleware/auth');
const { sealTicket } = require('../lib/honorRename');
const {
  authAnonymous,
  pickLoginIdCandidates,
  registerLoginId,
  loginWithLoginId,
  loginWithGoogle,
  bindGoogle,
  getMe,
  deleteMe,
} = require('../services/userService');
const {
  pickHonorCandidates,
  renameToHonorLoginId,
} = require('../services/honorLoginIdService');
const { grantStaff } = require('../services/partyPassService');

// The Google paths below only check what happens before a token reaches Google.
delete process.env.GOOGLE_WEB_CLIENT_ID;

const PASSWORD = 'smoke-pass-1';
const REGULAR = /^[A-Z][A-Z0-9]{3}$/;
const HONOR = /^[0-9][A-Z0-9]{3}$/;

async function codeOf(fn) {
  try {
    await fn();
    return 'NO_ERROR';
  } catch (err) {
    return err.code || err.message;
  }
}

async function registered(label, taken) {
  const opened = await authAnonymous(`smoke-honor-${label}-${crypto.randomUUID()}`);
  const { loginIds } = await pickLoginIdCandidates({ exclude: taken });
  const user = await registerLoginId(opened.user.id, { loginId: loginIds[0], password: PASSWORD });
  taken.push(user.loginId);
  return user;
}

async function fakeGoogle(userId) {
  await query(`UPDATE users SET google_sub = ? WHERE id = ?`, [`smoke-${crypto.randomUUID()}`, userId]);
}

async function main() {
  const checks = {};
  const taken = [];
  const a = await registered('a', taken);
  const b = await registered('b', taken);
  const d = await registered('d', taken);
  const silent = await authAnonymous(`smoke-honor-s-${crypto.randomUUID()}`);
  const newcomer = await authAnonymous(`smoke-honor-e-${crypto.randomUUID()}`);
  const userIds = [a.id, b.id, d.id, silent.user.id, newcomer.user.id];
  const oldA = a.loginId;

  checks.noPass = await codeOf(() => pickHonorCandidates(a.id));
  await grantStaff(oldA, '99');
  checks.pass99 = await codeOf(() => pickHonorCandidates(a.id));
  await grantStaff(oldA, '499');
  checks.pass499NoGoogle = await codeOf(() => pickHonorCandidates(a.id));
  checks.stateNeedsGoogle = (await getMe(a.id)).honorRename;

  checks.bindSilent = await codeOf(() => bindGoogle(silent.user.id, { idToken: 'x' }));
  checks.bindUnconfigured = await codeOf(() => bindGoogle(a.id, { idToken: 'x' }));
  checks.loginUnconfigured = await codeOf(() => loginWithGoogle({ idToken: 'x' }));

  await fakeGoogle(a.id);
  const readyA = await getMe(a.id);
  checks.stateReady = readyA.honorRename === 'ready' && readyA.googleBound === true;

  const first = await pickHonorCandidates(a.id);
  checks.firstBatch =
    first.loginIds.length === 9 &&
    first.loginIds.every((id) => HONOR.test(id) && id[0] === first.loginIds[0][0]) &&
    typeof first.ticket === 'string';
  const second = await pickHonorCandidates(a.id, { ticket: first.ticket });
  checks.refreshExcludes = second.loginIds.every((id) => !first.loginIds.includes(id));
  checks.secondRefresh = await codeOf(() => pickHonorCandidates(a.id, { ticket: second.ticket }));

  const strayPrefix = first.loginIds[0][0] === '9' ? '8' : '9';
  checks.selfMadeId = await codeOf(() =>
    renameToHonorLoginId(a.id, { loginId: `${strayPrefix}ZQ7`, ticket: second.ticket })
  );
  checks.otherAccountsTicket = await codeOf(() =>
    renameToHonorLoginId(b.id, { loginId: first.loginIds[0], ticket: second.ticket })
  );

  // Two accounts submit the same digit id at once. B's ticket is forged with the server secret
  // only so both requests can race for one id; the app can never build one.
  await grantStaff(b.loginId, '499');
  await fakeGoogle(b.id);
  const contested = first.loginIds[0];
  const ticketB = sealTicket({ userId: b.id, loginIds: [contested], round: 1 }, getSecret());
  const race = await Promise.all([
    codeOf(() => renameToHonorLoginId(a.id, { loginId: contested, ticket: second.ticket })),
    codeOf(() => renameToHonorLoginId(b.id, { loginId: contested, ticket: ticketB })),
  ]);
  checks.raceOneWins = race.filter((r) => r === 'NO_ERROR').length === 1 && race.includes('LOGIN_ID_TAKEN');
  const winnerIsA = race[0] === 'NO_ERROR';
  const renamed = winnerIsA ? a : b;
  const loser = winnerIsA ? b : a;
  const oldRenamed = renamed.loginId;
  checks.loserKeepsEligibility = (await getMe(loser.id)).honorRename === 'ready';

  const after = await getMe(renamed.id);
  checks.sameUuidNewId = after.id === renamed.id && after.loginId === contested && after.honorRename === 'used';
  checks.oldIdLogin = await codeOf(() => loginWithLoginId({ loginId: oldRenamed, password: PASSWORD }));
  const signedIn = await loginWithLoginId({ loginId: contested, password: PASSWORD });
  checks.newIdLogin = signedIn.user.id === renamed.id;
  checks.doubleSubmit = await codeOf(() =>
    renameToHonorLoginId(renamed.id, {
      loginId: contested,
      ticket: winnerIsA ? second.ticket : ticketB,
    })
  );
  checks.renameAgain = await codeOf(() => pickHonorCandidates(renamed.id));

  // A newcomer claims the released letter id, so the refund below must hand out a fresh one.
  const reclaimed = await registerLoginId(newcomer.user.id, { loginId: oldRenamed, password: PASSWORD });
  checks.oldIdBackInPool = reclaimed.loginId === oldRenamed;

  await grantStaff(contested, 'none');
  const refunded = await getMe(renamed.id);
  const freed = await query(`SELECT id FROM users WHERE login_id = ?`, [contested]);
  checks.refundFreshLetter =
    REGULAR.test(refunded.loginId) && refunded.loginId !== oldRenamed && refunded.id === renamed.id;
  checks.refundFreesDigit = freed.length === 0;
  checks.refundStaysUsed = refunded.honorRename === 'used' && refunded.googleBound === true;

  // D renames, then refunds while its old letter id is still free.
  await grantStaff(d.loginId, '499');
  await fakeGoogle(d.id);
  const dBatch = await pickHonorCandidates(d.id);
  await renameToHonorLoginId(d.id, { loginId: dBatch.loginIds[0], ticket: dBatch.ticket });
  await grantStaff(dBatch.loginIds[0], 'none');
  checks.refundRestoresOld = (await getMe(d.id)).loginId === d.loginId;

  await deleteMe(renamed.id);
  const deletedRow = await query(
    `SELECT google_sub, regular_login_id, login_id FROM users WHERE id = ?`,
    [renamed.id]
  );
  checks.deleteUnbindsGoogle =
    deletedRow[0].google_sub === null && deletedRow[0].regular_login_id === null && deletedRow[0].login_id === null;

  await query(`DELETE FROM party_purchases WHERE user_id IN (?)`, [userIds]);
  await query(`DELETE FROM users WHERE id IN (?)`, [userIds]);

  const expected = {
    noPass: 'HONOR_NOT_ELIGIBLE',
    pass99: 'HONOR_NOT_ELIGIBLE',
    pass499NoGoogle: 'HONOR_NEEDS_GOOGLE',
    stateNeedsGoogle: 'needs_google',
    bindSilent: 'GOOGLE_NEEDS_LOGIN_ID',
    bindUnconfigured: 'GOOGLE_AUTH_UNAVAILABLE',
    loginUnconfigured: 'GOOGLE_AUTH_UNAVAILABLE',
    stateReady: true,
    firstBatch: true,
    refreshExcludes: true,
    secondRefresh: 'HONOR_REFRESH_USED',
    selfMadeId: 'HONOR_TICKET_INVALID',
    otherAccountsTicket: 'HONOR_TICKET_INVALID',
    raceOneWins: true,
    loserKeepsEligibility: true,
    sameUuidNewId: true,
    oldIdLogin: 'BAD_CREDENTIALS',
    newIdLogin: true,
    doubleSubmit: 'NO_ERROR',
    renameAgain: 'HONOR_USED',
    oldIdBackInPool: true,
    refundFreshLetter: true,
    refundFreesDigit: true,
    refundStaysUsed: true,
    refundRestoresOld: true,
    deleteUnbindsGoogle: true,
  };

  const failed = Object.keys(expected).filter((k) => checks[k] !== expected[k]);
  console.log(JSON.stringify({ ok: failed.length === 0, failed, checks }, null, 2));

  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
