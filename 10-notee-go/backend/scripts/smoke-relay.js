/**
 * Real sockets against a throwaway relay on a random loopback port. Mints its own JWT_SECRET for
 * the run, so it never reads backend/.env and never needs a real token.
 * Usage: node scripts/smoke-relay.js
 */

const assert = require('assert');
const crypto = require('crypto');
const WebSocket = require('ws');

process.env.JWT_SECRET = crypto.randomBytes(24).toString('hex');

const { signPlayerToken } = require('../middleware/auth');
const { WS_PATH, PROTOCOL_VERSION } = require('../relay/protocol');
const { createRelayServer } = require('../relay/relayServer');

const HOST_KEY = crypto.randomBytes(16).toString('hex');
const STEP_MS = 2_000;

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

/** Resolves with the HTTP status of a refused upgrade. */
function refusedStatus(url, headers) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    ws.on('unexpected-response', (req, res) => {
      resolve(res.statusCode);
      req.destroy();
    });
    ws.on('open', () => reject(new Error(`upgrade should have been refused: ${url}`)));
    ws.on('error', () => {});
  });
}

/** A client that queues every text frame so the test can await the next one. */
function client(url, token) {
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } });
  const inbox = [];
  const waiters = [];
  ws.on('message', (data) => {
    const text = data.toString('utf8');
    const waiter = waiters.shift();
    if (waiter) waiter(text);
    else inbox.push(text);
  });
  const next = () => new Promise((resolve, reject) => {
    if (inbox.length > 0) {
      resolve(inbox.shift());
      return;
    }
    const timer = setTimeout(() => reject(new Error('no frame within step')), STEP_MS);
    waiters.push((text) => {
      clearTimeout(timer);
      resolve(text);
    });
  });
  const opened = new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
  const closed = new Promise((resolve) => ws.on('close', (code) => resolve(code)));
  return { ws, next, opened, closed, send: (text) => ws.send(text) };
}

async function main() {
  const relay = createRelayServer();
  const port = await listen(relay.server);
  const base = `ws://127.0.0.1:${port}${WS_PATH}`;
  const url = `${base}?v=${PROTOCOL_VERSION}`;
  const hostToken = signPlayerToken({ id: 'smoke-host' }).token;
  const guestToken = signPlayerToken({ id: 'smoke-guest' }).token;

  assert.strictEqual(await refusedStatus(url, {}), 401);
  assert.strictEqual(await refusedStatus(url, { Authorization: 'Bearer not-a-token' }), 401);
  assert.strictEqual(await refusedStatus(`${base}?v=99`, { Authorization: `Bearer ${hostToken}` }), 426);
  assert.strictEqual(await refusedStatus(`ws://127.0.0.1:${port}/elsewhere?v=1`, {}), 404);

  const host = client(url, hostToken);
  await host.opened;
  host.send(`c:${JSON.stringify({ t: 'hello', room: '7KQ2', role: 'host', key: HOST_KEY })}`);
  assert.strictEqual(await host.next(), 'c:{"t":"ready","peer":"h"}');

  const guest = client(url, guestToken);
  await guest.opened;
  guest.send('c:{"t":"hello","room":"7KQ2","role":"guest"}');
  assert.strictEqual(await guest.next(), 'c:{"t":"ready","peer":"g1"}');
  assert.strictEqual(await guest.next(), 'c:{"t":"join","peer":"h"}');
  assert.strictEqual(await host.next(), 'c:{"t":"join","peer":"g1"}');

  guest.send('d:h:{"k":"hello"}');
  assert.strictEqual(await host.next(), 'd:g1:{"k":"hello"}');
  host.send('d:g1:{"k":"welcome","s":1}');
  assert.strictEqual(await guest.next(), 'd:h:{"k":"welcome","s":1}');

  guest.send('c:{"t":"ping","at":12345}');
  assert.strictEqual(await guest.next(), 'c:{"t":"pong","at":12345}');

  const stranger = client(url, guestToken);
  await stranger.opened;
  stranger.send('c:{"t":"hello","room":"8MNP","role":"guest"}');
  assert.strictEqual(await stranger.next(), 'c:{"t":"err","code":"NO_ROOM"}');
  assert.strictEqual(await stranger.closed, 4000);

  guest.ws.close(1000);
  assert.strictEqual(await host.next(), 'c:{"t":"left","peer":"g1"}');

  host.ws.close(1000);
  await host.closed;
  relay.shutdown();
  console.log('smoke-relay: OK');
}

main().catch((err) => {
  console.error('smoke-relay: FAILED', err);
  process.exit(1);
});
