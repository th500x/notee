/**
 * Honor rename state, candidate tickets, and Google ID token checks. No database, no network.
 * Usage: node scripts/assert-honor-rename.js
 */

const assert = require('assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  TICKET_TTL_MS,
  honorRenameState,
  sealTicket,
  openTicket,
} = require('../lib/honorRename');
const { verifySignedIdToken } = require('../lib/googleIdToken');

function code(fn) {
  try {
    fn();
    return 'NO_ERROR';
  } catch (err) {
    return err.code || err.message;
  }
}

function testState() {
  const base = { tier: '499', loginId: 'AB12', googleBound: true, renamed: false };
  assert.strictEqual(honorRenameState(base), 'ready');
  assert.strictEqual(honorRenameState({ ...base, tier: 'ultra' }), 'ready');
  assert.strictEqual(honorRenameState({ ...base, googleBound: false }), 'needs_google');
  assert.strictEqual(honorRenameState({ ...base, tier: '99' }), 'none');
  assert.strictEqual(honorRenameState({ ...base, tier: 'none' }), 'none');
  assert.strictEqual(honorRenameState({ ...base, loginId: null }), 'none');
  assert.strictEqual(honorRenameState({ ...base, loginId: 'AAAA' }), 'none', 'lions do not rename');
  assert.strictEqual(honorRenameState({ ...base, loginId: '0AB1' }), 'none', 'honor → honor is out');
  assert.strictEqual(honorRenameState({ ...base, renamed: true }), 'used');
  assert.strictEqual(
    honorRenameState({ ...base, tier: 'none', loginId: 'CD34', renamed: true }),
    'used',
    'a refund back to a letter id does not reopen the rename'
  );
}

function testTicket() {
  const secret = 'assert-honor-secret-0123456789';
  const nowMs = Date.parse('2026-11-18T00:00:00Z');
  const ticket = sealTicket({ userId: 'u1', loginIds: ['0AB1', '0CD2'], round: 1, nowMs }, secret);
  const opened = openTicket(ticket, { userId: 'u1', secret, nowMs });
  assert.deepStrictEqual(opened.loginIds, ['0AB1', '0CD2']);
  assert.strictEqual(opened.round, 1);

  assert.strictEqual(
    code(() => openTicket(ticket, { userId: 'u2', secret, nowMs })),
    'HONOR_TICKET_INVALID',
    'another account cannot use this ticket'
  );
  assert.strictEqual(
    code(() => openTicket(ticket, { userId: 'u1', secret: 'another-secret-0123456789', nowMs })),
    'HONOR_TICKET_INVALID'
  );
  assert.strictEqual(
    code(() => openTicket(ticket, { userId: 'u1', secret, nowMs: nowMs + TICKET_TTL_MS })),
    'HONOR_TICKET_INVALID',
    'expired'
  );

  const [body, mac] = ticket.split('.');
  const forged = Buffer.from(
    JSON.stringify({ userId: 'u1', loginIds: ['9ZZZ'], round: 1, expiresAt: nowMs + 1000 }),
    'utf8'
  ).toString('base64url');
  assert.strictEqual(
    code(() => openTicket(`${forged}.${mac}`, { userId: 'u1', secret, nowMs })),
    'HONOR_TICKET_INVALID',
    'ids are signed'
  );
  assert.strictEqual(code(() => openTicket(body, { userId: 'u1', secret, nowMs })), 'HONOR_TICKET_INVALID');
  assert.strictEqual(code(() => openTicket(null, { userId: 'u1', secret, nowMs })), 'HONOR_TICKET_INVALID');
}

function testGoogleToken() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const audience = 'web-client.apps.googleusercontent.com';
  const sign = (claims, options = {}) =>
    jwt.sign(
      { iss: 'https://accounts.google.com', aud: audience, sub: '1234567890', ...claims },
      privateKey,
      { algorithm: 'RS256', keyid: 'k1', expiresIn: 600, ...options }
    );

  assert.deepStrictEqual(verifySignedIdToken(sign({}), publicKey, audience), { sub: '1234567890' });
  assert.deepStrictEqual(
    verifySignedIdToken(sign({ iss: 'accounts.google.com' }), publicKey, audience),
    { sub: '1234567890' }
  );
  assert.strictEqual(
    code(() => verifySignedIdToken(sign({ aud: 'someone-else' }), publicKey, audience)),
    'BAD_GOOGLE_TOKEN'
  );
  assert.strictEqual(
    code(() => verifySignedIdToken(sign({ iss: 'https://evil.example' }), publicKey, audience)),
    'BAD_GOOGLE_TOKEN'
  );
  assert.strictEqual(
    code(() => verifySignedIdToken(sign({}, { expiresIn: -120 }), publicKey, audience)),
    'BAD_GOOGLE_TOKEN'
  );
  assert.strictEqual(
    code(() => verifySignedIdToken(sign({ sub: '' }), publicKey, audience)),
    'BAD_GOOGLE_TOKEN'
  );

  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const wrongKey = jwt.sign(
    { iss: 'https://accounts.google.com', aud: audience, sub: '1' },
    other.privateKey,
    { algorithm: 'RS256', expiresIn: 600 }
  );
  assert.strictEqual(code(() => verifySignedIdToken(wrongKey, publicKey, audience)), 'BAD_GOOGLE_TOKEN');

  const hmac = jwt.sign(
    { iss: 'https://accounts.google.com', aud: audience, sub: '1' },
    'shared-secret-not-google',
    { algorithm: 'HS256', expiresIn: 600 }
  );
  assert.strictEqual(code(() => verifySignedIdToken(hmac, publicKey, audience)), 'BAD_GOOGLE_TOKEN');
}

testState();
testTicket();
testGoogleToken();
console.log('honor rename ok');
