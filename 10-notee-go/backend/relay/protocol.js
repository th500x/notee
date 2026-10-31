/**
 * Scan & Play relay wire (notee-go docs/00-4-3 §5). The relay forwards a game frame without
 * reading it; the only thing it reads is the `c:` control channel.
 *
 *   d:<peer>:<frame>   game bytes. Client → relay names the target; relay → client names the sender.
 *   c:{json}           control: hello / ready / join / left / kick / ping / pong / err.
 *
 * Peer ids: the host is always `h`; guests are `g1`, `g2`, … in arrival order and never reused
 * inside one room. The App mirrors these rules in ScanRelayProtocol.kt.
 */

const PROTOCOL_VERSION = 1;
const WS_PATH = '/sp/ws';
const HOST_PEER = 'h';

const ROLE = Object.freeze({ HOST: 'host', GUEST: 'guest' });

/** Relay codes start with a digit, Nearby codes with a letter (App ScanIds.isRelayCode). */
const ROOM_CODE_RE = /^[2-9][A-HJ-NP-Z2-9]{3}$/;
/** The host's reconnect proof: 16 random bytes as hex, minted per table on the phone. */
const HOST_KEY_RE = /^[0-9a-f]{32}$/;
const GUEST_PEER_RE = /^g[1-9][0-9]{0,5}$/;

/** `c:{"t":"err","code":…}` codes. The socket closes right after one. */
const ERR = Object.freeze({
  /** Missing, malformed or second hello — or none within `helloTimeoutMs`. */
  BAD_HELLO: 'BAD_HELLO',
  /** Host: the code is live under another key. The phone mints another. */
  ROOM_TAKEN: 'ROOM_TAKEN',
  /** Guest: no such table. */
  NO_ROOM: 'NO_ROOM',
  ROOM_FULL: 'ROOM_FULL',
  /** The room expired, or its host did not come back within `hostGraceMs`. */
  ROOM_GONE: 'ROOM_GONE',
  /** Relay-wide room cap, or this address opened too many rooms this minute. */
  BUSY: 'BUSY',
  TOO_FAST: 'TOO_FAST',
  BAD_FRAME: 'BAD_FRAME',
});

const LIMITS = Object.freeze({
  /** App caps a payload at 4096 chars (ScanLimits.MAX_PAYLOAD_CHARS); the envelope rides on top. */
  maxFrameBytes: 8 * 1024,
  maxRooms: 200,
  maxSockets: 1000,
  /** Three seats, plus stragglers whose dead socket has not been noticed yet. */
  maxGuestsPerRoom: 6,
  /** Per client address. Carrier NAT puts many phones behind one, so this only stops a loop. */
  roomsPerIpPerMinute: 20,
  /** The host sends one frame per guest per beat: 3 guests × (20 Hz + intent replies) ≈ 105/s. */
  hostMessagesPerSecond: 160,
  /**
   * Taps leave the phone unthrottled (the host drops what is over ScanLimits.MAX_INTENTS_PER_SECOND),
   * plus 5 acks/s and a ping. Four fingers mashing Pet Dash stay under this; a runaway loop does not.
   */
  guestMessagesPerSecond: 80,
  helloTimeoutMs: 5_000,
  /** The App's host redials for 20 s (ScanLimits.RELAY_RECONNECT_WINDOW_MS); a little slack on top. */
  hostGraceMs: 30_000,
  /** Longer than the App's own 10-minute idle, so the phone always closes an empty table first. */
  quietRoomMs: 15 * 60_000,
  maxRoomAgeMs: 2 * 60 * 60_000,
  heartbeatMs: 20_000,
  sweepMs: 5_000,
});

function control(msg) {
  return `c:${JSON.stringify(msg)}`;
}

function dataFrame(peer, frame) {
  return `d:${peer}:${frame}`;
}

function isPeerId(peer) {
  return peer === HOST_PEER || GUEST_PEER_RE.test(peer);
}

/**
 * What a client sent: `{ kind: 'data', peer, frame }` or `{ kind: 'control', msg }`; null when it
 * is neither. A data frame is split off at the second colon and never looked inside.
 */
function parseClientText(text) {
  if (typeof text !== 'string' || text.length < 3 || text[1] !== ':') return null;
  if (text[0] === 'd') {
    const cut = text.indexOf(':', 2);
    if (cut < 0) return null;
    const peer = text.slice(2, cut);
    if (!isPeerId(peer)) return null;
    return { kind: 'data', peer, frame: text.slice(cut + 1) };
  }
  if (text[0] === 'c') {
    let msg;
    try {
      msg = JSON.parse(text.slice(2));
    } catch {
      return null;
    }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return null;
    return { kind: 'control', msg };
  }
  return null;
}

/** A hello the relay can act on — `{ role, room, key? }` — or null. */
function readHello(msg) {
  if (!msg || msg.t !== 'hello') return null;
  if (typeof msg.room !== 'string' || !ROOM_CODE_RE.test(msg.room)) return null;
  if (msg.role === ROLE.HOST) {
    if (typeof msg.key !== 'string' || !HOST_KEY_RE.test(msg.key)) return null;
    return { role: ROLE.HOST, room: msg.room, key: msg.key };
  }
  if (msg.role === ROLE.GUEST) return { role: ROLE.GUEST, room: msg.room };
  return null;
}

module.exports = {
  PROTOCOL_VERSION,
  WS_PATH,
  HOST_PEER,
  ROLE,
  ROOM_CODE_RE,
  ERR,
  LIMITS,
  control,
  dataFrame,
  isPeerId,
  parseClientText,
  readHello,
};
