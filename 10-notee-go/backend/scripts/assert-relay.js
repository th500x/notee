/**
 * Offline checks for the scan relay wire and rooms. No sockets, no secrets.
 * Usage: node scripts/assert-relay.js
 */

const assert = require('assert');
const { ERR, LIMITS, control, parseClientText, readHello } = require('../relay/protocol');
const { RelayRooms, CLOSE } = require('../relay/rooms');

const HOST_KEY = 'a'.repeat(32);
const OTHER_KEY = 'b'.repeat(32);

function fakeConn(ip = '10.0.0.1') {
  return {
    ip,
    sent: [],
    closed: null,
    send(text) {
      this.sent.push(text);
    },
    close(code, reason) {
      this.closed = { code, reason };
    },
    /** Control messages received, parsed. */
    controls() {
      return this.sent.filter((t) => t.startsWith('c:')).map((t) => JSON.parse(t.slice(2)));
    },
    last() {
      return this.sent[this.sent.length - 1];
    },
  };
}

function clock(start = 1_000_000) {
  let at = start;
  return { now: () => at, advance: (ms) => { at += ms; } };
}

function errOf(conn) {
  const err = conn.controls().find((m) => m.t === 'err');
  return err ? err.code : null;
}

// --- wire ---------------------------------------------------------------------------------

assert.deepStrictEqual(parseClientText('d:g1:{"a":"b:c"}'), { kind: 'data', peer: 'g1', frame: '{"a":"b:c"}' });
assert.deepStrictEqual(parseClientText('d:h:'), { kind: 'data', peer: 'h', frame: '' });
assert.deepStrictEqual(parseClientText('c:{"t":"ping","at":5}'), { kind: 'control', msg: { t: 'ping', at: 5 } });
['', 'x', 'd:', 'd:g1', 'd:g0:x', 'd:zz:x', 'c:{', 'c:[]', 'c:{"t":1}', 'x:{}'].forEach((text) => {
  assert.strictEqual(parseClientText(text), null, `accepted ${text}`);
});

assert.deepStrictEqual(readHello({ t: 'hello', room: '2ABC', role: 'host', key: HOST_KEY }), {
  role: 'host', room: '2ABC', key: HOST_KEY,
});
assert.deepStrictEqual(readHello({ t: 'hello', room: '9ZZ2', role: 'guest' }), { role: 'guest', room: '9ZZ2' });
[
  { t: 'hello', room: 'ABCD', role: 'guest' }, // a Nearby code never reaches the relay
  { t: 'hello', room: '0ABC', role: 'guest' },
  { t: 'hello', room: '2ABI', role: 'guest' },
  { t: 'hello', room: '2AB', role: 'guest' },
  { t: 'hello', room: '2ABC', role: 'host' }, // host without a key
  { t: 'hello', room: '2ABC', role: 'host', key: 'short' },
  { t: 'hello', room: '2ABC', role: 'judge' },
  { t: 'ping', room: '2ABC', role: 'guest' },
].forEach((msg) => assert.strictEqual(readHello(msg), null, `accepted ${JSON.stringify(msg)}`));

// --- a table: host, guest, frames both ways ------------------------------------------------

{
  const rooms = new RelayRooms({ now: clock().now });
  const host = fakeConn();
  const guest = fakeConn('10.0.0.2');

  assert.strictEqual(rooms.hello(host, { role: 'host', room: '2ABC', key: HOST_KEY }), true);
  assert.deepStrictEqual(host.controls(), [{ t: 'ready', peer: 'h' }]);

  assert.strictEqual(rooms.hello(guest, { role: 'guest', room: '2ABC' }), true);
  assert.deepStrictEqual(guest.controls(), [{ t: 'ready', peer: 'g1' }, { t: 'join', peer: 'h' }]);
  assert.deepStrictEqual(host.controls().pop(), { t: 'join', peer: 'g1' });

  rooms.forward(host, 'g1', 'snap');
  assert.strictEqual(guest.last(), 'd:h:snap');
  rooms.forward(guest, 'h', 'intent');
  assert.strictEqual(host.last(), 'd:g1:intent');

  // A frame for a guest who just left is not an error.
  rooms.forward(host, 'g9', 'late');
  assert.strictEqual(host.closed, null);

  // Guests only ever talk to the host.
  const other = fakeConn();
  rooms.hello(other, { role: 'guest', room: '2ABC' });
  rooms.forward(guest, 'g2', 'sneaky');
  assert.strictEqual(errOf(guest), ERR.BAD_FRAME);
  assert.strictEqual(guest.closed.code, CLOSE.REFUSED);

  // One hello per socket.
  rooms.hello(host, { role: 'host', room: '2ABC', key: HOST_KEY });
  assert.strictEqual(errOf(host), ERR.BAD_HELLO);
}

// --- codes, keys and capacity ---------------------------------------------------------------

{
  const rooms = new RelayRooms({ now: clock().now });
  rooms.hello(fakeConn(), { role: 'host', room: '2ABC', key: HOST_KEY });

  const stranger = fakeConn();
  assert.strictEqual(rooms.hello(stranger, { role: 'host', room: '2ABC', key: OTHER_KEY }), false);
  assert.strictEqual(errOf(stranger), ERR.ROOM_TAKEN);

  const lost = fakeConn();
  assert.strictEqual(rooms.hello(lost, { role: 'guest', room: '3XYZ' }), false);
  assert.strictEqual(errOf(lost), ERR.NO_ROOM);

  for (let i = 0; i < LIMITS.maxGuestsPerRoom; i += 1) {
    assert.strictEqual(rooms.hello(fakeConn(), { role: 'guest', room: '2ABC' }), true);
  }
  const late = fakeConn();
  assert.strictEqual(rooms.hello(late, { role: 'guest', room: '2ABC' }), false);
  assert.strictEqual(errOf(late), ERR.ROOM_FULL);
}

{
  const rooms = new RelayRooms({ now: clock().now, limits: { ...LIMITS, maxRooms: 1 } });
  rooms.hello(fakeConn(), { role: 'host', room: '2ABC', key: HOST_KEY });
  const second = fakeConn('10.0.0.9');
  assert.strictEqual(rooms.hello(second, { role: 'host', room: '3ABC', key: HOST_KEY }), false);
  assert.strictEqual(errOf(second), ERR.BUSY);
}

{
  const time = clock();
  const rooms = new RelayRooms({ now: time.now, limits: { ...LIMITS, roomsPerIpPerMinute: 2 } });
  assert.ok(rooms.hello(fakeConn(), { role: 'host', room: '2AAA', key: HOST_KEY }));
  assert.ok(rooms.hello(fakeConn(), { role: 'host', room: '2AAB', key: HOST_KEY }));
  const third = fakeConn();
  assert.strictEqual(rooms.hello(third, { role: 'host', room: '2AAC', key: HOST_KEY }), false);
  assert.strictEqual(errOf(third), ERR.BUSY);
  assert.ok(rooms.hello(fakeConn('10.0.0.7'), { role: 'host', room: '2AAD', key: HOST_KEY }));
  time.advance(60_000);
  rooms.sweep();
  assert.ok(rooms.hello(fakeConn(), { role: 'host', room: '2AAE', key: HOST_KEY }));
}

// --- the host drops and comes back -----------------------------------------------------------

{
  const time = clock();
  const rooms = new RelayRooms({ now: time.now });
  const host = fakeConn();
  const guest = fakeConn();
  rooms.hello(host, { role: 'host', room: '2ABC', key: HOST_KEY });
  rooms.hello(guest, { role: 'guest', room: '2ABC' });

  rooms.drop(host);
  assert.deepStrictEqual(guest.controls().pop(), { t: 'left', peer: 'h' });

  // The guest redials into the waiting room (its old socket closed when it relinked).
  rooms.drop(guest);
  const back = fakeConn();
  rooms.hello(back, { role: 'guest', room: '2ABC' });
  assert.deepStrictEqual(back.controls(), [{ t: 'ready', peer: 'g2' }]);

  time.advance(LIMITS.hostGraceMs - 1);
  rooms.sweep();
  const returning = fakeConn();
  assert.strictEqual(rooms.hello(returning, { role: 'host', room: '2ABC', key: HOST_KEY }), true);
  assert.deepStrictEqual(returning.controls(), [{ t: 'ready', peer: 'h' }, { t: 'join', peer: 'g2' }]);
  assert.deepStrictEqual(back.controls().pop(), { t: 'join', peer: 'h' });
}

{
  // A second socket with the same key replaces a half-open one; guests hear the host cycle.
  const rooms = new RelayRooms({ now: clock().now });
  const stale = fakeConn();
  const guest = fakeConn();
  rooms.hello(stale, { role: 'host', room: '2ABC', key: HOST_KEY });
  rooms.hello(guest, { role: 'guest', room: '2ABC' });
  const fresh = fakeConn();
  rooms.hello(fresh, { role: 'host', room: '2ABC', key: HOST_KEY });
  assert.strictEqual(stale.closed.code, CLOSE.REPLACED);
  assert.deepStrictEqual(guest.controls().slice(-2), [{ t: 'left', peer: 'h' }, { t: 'join', peer: 'h' }]);
  rooms.drop(stale); // its close event arrives later and must not orphan the room
  rooms.forward(guest, 'h', 'still here');
  assert.strictEqual(fresh.last(), 'd:g1:still here');
}

{
  const time = clock();
  const rooms = new RelayRooms({ now: time.now });
  const host = fakeConn();
  const guest = fakeConn();
  rooms.hello(host, { role: 'host', room: '2ABC', key: HOST_KEY });
  rooms.hello(guest, { role: 'guest', room: '2ABC' });
  rooms.drop(host);
  time.advance(LIMITS.hostGraceMs);
  rooms.sweep();
  assert.strictEqual(errOf(guest), ERR.ROOM_GONE);
  assert.strictEqual(rooms.stats().rooms, 0);
  const lateGuest = fakeConn();
  rooms.hello(lateGuest, { role: 'guest', room: '2ABC' });
  assert.strictEqual(errOf(lateGuest), ERR.NO_ROOM);
}

// --- guests leave, get kicked, rooms go quiet -------------------------------------------------

{
  const time = clock();
  const rooms = new RelayRooms({ now: time.now });
  const host = fakeConn();
  const guest = fakeConn();
  const kicked = fakeConn();
  rooms.hello(host, { role: 'host', room: '2ABC', key: HOST_KEY });
  rooms.hello(guest, { role: 'guest', room: '2ABC' });
  rooms.hello(kicked, { role: 'guest', room: '2ABC' });

  rooms.drop(guest);
  assert.deepStrictEqual(host.controls().pop(), { t: 'left', peer: 'g1' });

  const before = host.sent.length;
  rooms.kick(host, 'g2');
  assert.strictEqual(kicked.closed.code, CLOSE.KICKED);
  rooms.drop(kicked);
  assert.strictEqual(host.sent.length, before, 'a kick must not echo a left back to the host');

  time.advance(LIMITS.quietRoomMs - 1);
  rooms.sweep();
  assert.strictEqual(rooms.stats().rooms, 1);
  time.advance(1);
  rooms.sweep();
  assert.strictEqual(errOf(host), ERR.ROOM_GONE);
  assert.strictEqual(rooms.stats().rooms, 0);
}

{
  const rooms = new RelayRooms({ now: clock().now });
  const guest = fakeConn();
  rooms.forward(guest, 'h', 'before hello');
  assert.strictEqual(errOf(guest), ERR.BAD_HELLO);
  const notHost = fakeConn();
  rooms.hello(fakeConn(), { role: 'host', room: '2ABC', key: HOST_KEY });
  rooms.hello(notHost, { role: 'guest', room: '2ABC' });
  rooms.kick(notHost, 'g1');
  assert.strictEqual(errOf(notHost), ERR.BAD_FRAME);
}

assert.strictEqual(control({ t: 'pong', at: 7 }), 'c:{"t":"pong","at":7}');

console.log('assert-relay: OK');
