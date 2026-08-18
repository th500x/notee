/**
 * Phase 7 smoke: login id candidates → sign-up → sign-in → conflicts → delete releases the id.
 * Usage: node scripts/smoke-login-id.js
 */

const crypto = require('crypto');
const { query, pool } = require('../database/connection');
const {
  authAnonymous,
  pickLoginIdCandidates,
  registerLoginId,
  loginWithLoginId,
  deleteMe,
  purgeIdleSilentAccounts,
} = require('../services/userService');

const PASSWORD = 'smoke-pass-1';
const REGULAR = /^[A-Z][A-Z0-9]{3}$/;

async function expectCode(label, fn) {
  try {
    await fn();
    return { [label]: 'NO_ERROR' };
  } catch (err) {
    return { [label]: err.code || err.message };
  }
}

async function main() {
  const checks = {};
  const deviceA = `smoke-a-${crypto.randomUUID()}`;
  const deviceB = `smoke-b-${crypto.randomUUID()}`;

  const a = await authAnonymous(deviceA);
  const b = await authAnonymous(deviceB);
  checks.silentOpen = Boolean(a.user.id && b.user.id) && a.user.loginId === null;

  const first = await pickLoginIdCandidates({ count: 5 });
  checks.candidateCount = first.loginIds.length === 5 && first.partial === false;
  checks.candidateFormat = first.loginIds.every((id) => REGULAR.test(id));

  const refreshed = await pickLoginIdCandidates({ count: 5, exclude: first.loginIds });
  checks.refreshExcludes = refreshed.loginIds.every((id) => !first.loginIds.includes(id));

  const loginId = first.loginIds[0];
  const registered = await registerLoginId(a.user.id, { loginId, password: PASSWORD });
  checks.registerBindsSameUuid = registered.id === a.user.id && registered.loginId === loginId;

  Object.assign(checks, await expectCode('registerTwice', () =>
    registerLoginId(a.user.id, { loginId: first.loginIds[1], password: PASSWORD })
  ));
  Object.assign(checks, await expectCode('registerTaken', () =>
    registerLoginId(b.user.id, { loginId, password: PASSWORD })
  ));
  Object.assign(checks, await expectCode('registerDigitFirst', () =>
    registerLoginId(b.user.id, { loginId: '1ABC', password: PASSWORD })
  ));
  Object.assign(checks, await expectCode('registerShortPassword', () =>
    registerLoginId(b.user.id, { loginId: first.loginIds[2], password: '12345' })
  ));

  const signedIn = await loginWithLoginId({ loginId, password: PASSWORD });
  checks.loginSameUuid = signedIn.user.id === a.user.id && Boolean(signedIn.token);

  Object.assign(checks, await expectCode('loginWrongPassword', () =>
    loginWithLoginId({ loginId, password: 'not-it' })
  ));
  Object.assign(checks, await expectCode('loginUnknownId', () =>
    loginWithLoginId({ loginId: 'ZZ99', password: PASSWORD })
  ));

  // Device follows the last sign-in, so a later token refresh cannot fall back to B.
  const rebound = await loginWithLoginId({ loginId, password: PASSWORD, deviceKey: deviceB });
  const reopened = await authAnonymous(deviceB);
  checks.loginBindsDevice = rebound.user.id === a.user.id && reopened.user.id === a.user.id;

  await deleteMe(a.user.id);
  const afterDelete = await query('SELECT login_id, password_hash FROM users WHERE id = ?', [a.user.id]);
  checks.deleteClearsCredentials =
    afterDelete[0].login_id === null && afterDelete[0].password_hash === null;

  const reused = await registerLoginId(b.user.id, { loginId, password: PASSWORD });
  checks.idReturnsToPool = reused.loginId === loginId;

  const silentOnly = await authAnonymous(`smoke-s-${crypto.randomUUID()}`);
  Object.assign(checks, await expectCode('deleteSilent', () => deleteMe(silentOnly.user.id)));
  await query(
    `UPDATE users SET last_seen_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 31 DAY) WHERE id = ?`,
    [silentOnly.user.id]
  );
  const idle = await purgeIdleSilentAccounts();
  const silentRow = await query('SELECT status FROM users WHERE id = ?', [silentOnly.user.id]);
  checks.purgeIdleSilent = idle.purged >= 1 && silentRow[0].status === 'deleted';

  await query(
    `UPDATE users SET last_seen_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 31 DAY) WHERE id = ?`,
    [b.user.id]
  );
  await purgeIdleSilentAccounts();
  const bAfterIdle = await query('SELECT status FROM users WHERE id = ?', [b.user.id]);
  checks.registeredSurvivesIdle = bAfterIdle[0].status === 'active';

  await deleteMe(b.user.id);
  await query('DELETE FROM users WHERE id IN (?, ?, ?)', [a.user.id, b.user.id, silentOnly.user.id]);

  const expected = {
    silentOpen: true,
    candidateCount: true,
    candidateFormat: true,
    refreshExcludes: true,
    registerBindsSameUuid: true,
    registerTwice: 'ALREADY_REGISTERED',
    registerTaken: 'LOGIN_ID_TAKEN',
    registerDigitFirst: 'BAD_LOGIN_ID',
    registerShortPassword: 'BAD_PASSWORD',
    loginSameUuid: true,
    loginWrongPassword: 'BAD_CREDENTIALS',
    loginUnknownId: 'BAD_CREDENTIALS',
    loginBindsDevice: true,
    deleteClearsCredentials: true,
    idReturnsToPool: true,
    deleteSilent: 'SILENT_NO_DELETE',
    purgeIdleSilent: true,
    registeredSurvivesIdle: true,
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
