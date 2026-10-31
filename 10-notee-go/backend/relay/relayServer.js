/**
 * HTTP + WebSocket front of the scan relay. Upgrades only `GET /sp/ws?v=1` that carries a valid
 * player token; everything after the upgrade is RelayRooms. `GET /health` answers on the
 * loopback port and is never routed by nginx.
 */

const http = require('http');
const { WebSocketServer } = require('ws');
const { parseBearer, verifyPlayerToken } = require('../middleware/auth');
const {
  ERR,
  LIMITS,
  PROTOCOL_VERSION,
  ROLE,
  WS_PATH,
  control,
  parseClientText,
  readHello,
} = require('./protocol');
const { RelayRooms } = require('./rooms');

const SERVICE = 'notee-go-relay';

/** Status for an upgrade request: 101 to go ahead, anything else is the refusal. */
function admit(req, wss, limits) {
  let url;
  try {
    url = new URL(req.url, 'http://relay.local');
  } catch {
    return 400;
  }
  if (url.pathname !== WS_PATH) return 404;
  if (url.searchParams.get('v') !== String(PROTOCOL_VERSION)) return 426;
  if (wss.clients.size >= limits.maxSockets) return 503;
  const token = parseBearer(req);
  if (!token) return 401;
  try {
    return verifyPlayerToken(token) ? 101 : 401;
  } catch {
    return 401;
  }
}

function rejectUpgrade(socket, status) {
  socket.end(`HTTP/1.1 ${status} ${http.STATUS_CODES[status]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

/** nginx sets X-Real-IP; the relay only listens on loopback, so nobody else can. */
function clientIp(req) {
  const forwarded = req.headers['x-real-ip'];
  return typeof forwarded === 'string' && forwarded.trim() ? forwarded.trim() : req.socket.remoteAddress;
}

function createRelayServer({ limits = LIMITS, now = Date.now, log = console } = {}) {
  const rooms = new RelayRooms({ now, limits });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: limits.maxFrameBytes,
    perMessageDeflate: false,
  });
  /** ws → { alive } for the ping sweep. */
  const sockets = new Map();

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        service: SERVICE,
        protocol: PROTOCOL_VERSION,
        sockets: sockets.size,
        ...rooms.stats(),
        timestamp: new Date().toISOString(),
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.on('upgrade', (req, socket, head) => {
    const onSocketError = () => socket.destroy();
    socket.on('error', onSocketError);
    const status = admit(req, wss, limits);
    if (status !== 101) {
      rejectUpgrade(socket, status);
      return;
    }
    socket.removeListener('error', onSocketError);
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws, req) => {
    const conn = {
      ip: clientIp(req),
      room: null,
      role: null,
      peer: null,
      send(text) {
        if (ws.readyState === ws.OPEN) ws.send(text);
      },
      close(code, reason) {
        ws.close(code, reason);
      },
    };
    const state = { alive: true, windowStart: now(), count: 0 };
    sockets.set(ws, state);

    const helloTimer = setTimeout(() => {
      if (!conn.role) rooms.refuse(conn, ERR.BAD_HELLO);
    }, limits.helloTimeoutMs);

    ws.on('pong', () => {
      state.alive = true;
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) return rooms.refuse(conn, ERR.BAD_FRAME);
      const at = now();
      if (at - state.windowStart >= 1000) {
        state.windowStart = at;
        state.count = 0;
      }
      state.count += 1;
      const cap = conn.role === ROLE.HOST ? limits.hostMessagesPerSecond : limits.guestMessagesPerSecond;
      if (state.count > cap) return rooms.refuse(conn, ERR.TOO_FAST);

      const parsed = parseClientText(data.toString('utf8'));
      if (!parsed) return rooms.refuse(conn, ERR.BAD_FRAME);
      if (parsed.kind === 'data') return rooms.forward(conn, parsed.peer, parsed.frame);
      return onControl(conn, parsed.msg);
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      sockets.delete(ws);
      rooms.drop(conn);
    });

    ws.on('error', (err) => {
      log.warn(`[${SERVICE}] socket error: ${err.code || err.message}`);
    });
  });

  function onControl(conn, msg) {
    switch (msg.t) {
      case 'hello': {
        const hello = readHello(msg);
        return hello ? rooms.hello(conn, hello) : rooms.refuse(conn, ERR.BAD_HELLO);
      }
      case 'ping':
        // The App's round-trip gauge for the dev overlay; `at` is its own clock, echoed as is.
        if (!Number.isFinite(msg.at)) return rooms.refuse(conn, ERR.BAD_FRAME);
        conn.send(control({ t: 'pong', at: msg.at }));
        return true;
      case 'kick':
        if (typeof msg.peer !== 'string') return rooms.refuse(conn, ERR.BAD_FRAME);
        return rooms.kick(conn, msg.peer);
      default:
        return rooms.refuse(conn, ERR.BAD_FRAME);
    }
  }

  // A phone that walked out of coverage never sends FIN; a missed pong is how the relay finds out.
  const heartbeat = setInterval(() => {
    for (const [ws, state] of sockets) {
      if (!state.alive) {
        ws.terminate();
        continue;
      }
      state.alive = false;
      ws.ping();
    }
  }, limits.heartbeatMs);
  const sweeper = setInterval(() => rooms.sweep(), limits.sweepMs);

  /** Rooms live in memory, so a restart ends every table: say so instead of vanishing. */
  function shutdown() {
    clearInterval(heartbeat);
    clearInterval(sweeper);
    server.close();
    for (const ws of sockets.keys()) ws.close(1001, 'restart');
  }

  return { server, rooms, shutdown };
}

module.exports = { createRelayServer };
