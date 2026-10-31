/**
 * Scan relay rooms, in memory only (notee-go docs/00-4-3 §5–§6). Nothing here touches a socket
 * or a timer: relayServer.js hands in connections and calls sweep(); tests hand in fakes and a
 * clock.
 *
 * A connection is `{ ip, send(text), close(code, reason) }`. Once its hello is accepted this
 * module writes `room`, `peer` and `role` onto it, and clears `room` again when it lets go.
 *
 * The relay never decides anything about a game. It only knows who is in which room, so a host
 * that disappears is a socket event to pass on, not a seat to free — the host phone does that.
 */

const { ERR, HOST_PEER, LIMITS, ROLE, control, dataFrame } = require('./protocol');

/** WebSocket close codes the App can tell apart from a network death. */
const CLOSE = Object.freeze({ REFUSED: 4000, KICKED: 4001, REPLACED: 4002 });

const IP_WINDOW_MS = 60_000;

class RelayRooms {
  constructor({ now = Date.now, limits = LIMITS } = {}) {
    this.now = now;
    this.limits = limits;
    /** code → room */
    this.rooms = new Map();
    /** ip → timestamps of rooms opened in the last minute */
    this.opensByIp = new Map();
    /** err code → times sent, for /health */
    this.refusals = {};
  }

  /** Seats an accepted hello, or refuses it and closes the socket. True when seated. */
  hello(conn, hello) {
    if (conn.role) return this.refuse(conn, ERR.BAD_HELLO);
    return hello.role === ROLE.HOST ? this.helloHost(conn, hello) : this.helloGuest(conn, hello);
  }

  helloHost(conn, { room: code, key }) {
    const existing = this.rooms.get(code);
    if (existing) {
      if (existing.hostKey !== key) return this.refuse(conn, ERR.ROOM_TAKEN);
      this.attachHost(existing, conn);
      return true;
    }
    if (this.rooms.size >= this.limits.maxRooms || !this.allowOpen(conn.ip)) {
      return this.refuse(conn, ERR.BUSY);
    }
    const now = this.now();
    const room = {
      code,
      hostKey: key,
      host: null,
      hostGoneAt: null,
      guests: new Map(),
      nextGuest: 1,
      createdAt: now,
      quietSince: now,
    };
    this.rooms.set(code, room);
    this.attachHost(room, conn);
    return true;
  }

  /**
   * The same phone (same key) is back: a redial after a blip, or a fresh socket while the old
   * one is still half-open. The newest socket wins. Guests that never noticed the host go hear it
   * leave and return, which is what makes them say hello again — the host room wrote every seat
   * off as dropped when its own socket died.
   */
  attachHost(room, conn) {
    const previous = room.host;
    if (previous) {
      previous.room = null;
      previous.close(CLOSE.REPLACED, 'replaced');
      this.tellGuests(room, { t: 'left', peer: HOST_PEER });
    }
    room.host = conn;
    room.hostGoneAt = null;
    seat(conn, room, ROLE.HOST, HOST_PEER);
    conn.send(control({ t: 'ready', peer: HOST_PEER }));
    for (const [peer, guest] of room.guests) {
      conn.send(control({ t: 'join', peer }));
      guest.send(control({ t: 'join', peer: HOST_PEER }));
    }
  }

  helloGuest(conn, { room: code }) {
    const room = this.rooms.get(code);
    if (!room) return this.refuse(conn, ERR.NO_ROOM);
    if (room.guests.size >= this.limits.maxGuestsPerRoom) return this.refuse(conn, ERR.ROOM_FULL);
    const peer = `g${room.nextGuest}`;
    room.nextGuest += 1;
    room.guests.set(peer, conn);
    room.quietSince = null;
    seat(conn, room, ROLE.GUEST, peer);
    conn.send(control({ t: 'ready', peer }));
    if (room.host) {
      room.host.send(control({ t: 'join', peer }));
      conn.send(control({ t: 'join', peer: HOST_PEER }));
    }
    return true;
  }

  /**
   * One game frame: host → one guest, guest → host. A target that is not there right now is
   * not an error — it just left, and the `left` notice is already on its way.
   */
  forward(conn, peer, frame) {
    const room = conn.room;
    if (!room) return this.refuse(conn, ERR.BAD_HELLO);
    if (conn.role === ROLE.HOST) {
      const target = room.guests.get(peer);
      if (target) target.send(dataFrame(HOST_PEER, frame));
      return true;
    }
    if (peer !== HOST_PEER) return this.refuse(conn, ERR.BAD_FRAME);
    if (room.host) room.host.send(dataFrame(conn.peer, frame));
    return true;
  }

  /** The host hangs up on a guest. It has already written the seat off, so no `left` goes back. */
  kick(conn, peer) {
    const room = conn.room;
    if (!room || conn.role !== ROLE.HOST) return this.refuse(conn, ERR.BAD_FRAME);
    const target = room.guests.get(peer);
    if (!target) return true;
    this.removeGuest(room, peer);
    target.room = null;
    target.close(CLOSE.KICKED, 'kicked');
    return true;
  }

  /** The socket closed or errored. */
  drop(conn) {
    const room = conn.room;
    if (!room) return;
    conn.room = null;
    if (conn.role === ROLE.HOST) {
      room.host = null;
      room.hostGoneAt = this.now();
      this.tellGuests(room, { t: 'left', peer: HOST_PEER });
      return;
    }
    this.removeGuest(room, conn.peer);
    if (room.host) room.host.send(control({ t: 'left', peer: conn.peer }));
  }

  /** Expires rooms and per-address counters. relayServer.js calls this every few seconds. */
  sweep() {
    const now = this.now();
    for (const room of this.rooms.values()) {
      const hostGone = room.host === null && now - room.hostGoneAt >= this.limits.hostGraceMs;
      const quiet = room.quietSince !== null && now - room.quietSince >= this.limits.quietRoomMs;
      const tooOld = now - room.createdAt >= this.limits.maxRoomAgeMs;
      if (hostGone || quiet || tooOld) this.closeRoom(room);
    }
    for (const [ip, stamps] of this.opensByIp) {
      const fresh = stamps.filter((at) => now - at < IP_WINDOW_MS);
      if (fresh.length > 0) this.opensByIp.set(ip, fresh);
      else this.opensByIp.delete(ip);
    }
  }

  /** Sends `err` and closes. Always false, so a caller can `return this.refuse(…)`. */
  refuse(conn, code) {
    this.refusals[code] = (this.refusals[code] || 0) + 1;
    conn.send(control({ t: 'err', code }));
    conn.close(CLOSE.REFUSED, code);
    return false;
  }

  stats() {
    let guests = 0;
    let hostless = 0;
    for (const room of this.rooms.values()) {
      guests += room.guests.size;
      if (!room.host) hostless += 1;
    }
    return { rooms: this.rooms.size, guests, hostless, refusals: { ...this.refusals } };
  }

  closeRoom(room) {
    this.rooms.delete(room.code);
    const everyone = [...room.guests.values()];
    if (room.host) everyone.push(room.host);
    room.guests.clear();
    room.host = null;
    for (const conn of everyone) {
      conn.room = null;
      this.refuse(conn, ERR.ROOM_GONE);
    }
  }

  removeGuest(room, peer) {
    room.guests.delete(peer);
    if (room.guests.size === 0) room.quietSince = this.now();
  }

  tellGuests(room, msg) {
    const text = control(msg);
    for (const guest of room.guests.values()) guest.send(text);
  }

  allowOpen(ip) {
    const now = this.now();
    const stamps = (this.opensByIp.get(ip) || []).filter((at) => now - at < IP_WINDOW_MS);
    const allowed = stamps.length < this.limits.roomsPerIpPerMinute;
    if (allowed) stamps.push(now);
    this.opensByIp.set(ip, stamps);
    return allowed;
  }
}

function seat(conn, room, role, peer) {
  conn.room = room;
  conn.role = role;
  conn.peer = peer;
}

module.exports = { RelayRooms, CLOSE };
