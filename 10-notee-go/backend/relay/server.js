/**
 * 10-notee-go scan relay (port 3011): real-time Scan & Play duels over the internet.
 * Forwards frames between a host phone and its guests and stores nothing (notee-go docs/00-4-3).
 *
 * Its own PM2 process (ecosystem.relay.config.cjs → 10-notee-go-relay), loopback only; nginx
 * `location = /sp/ws` fronts it. Shares backend/.env with the API for JWT_SECRET.
 */

require('../utils/loadEnv').loadEnv();

const { assertJwtSecret } = require('../utils/startupChecks');
const { WS_PATH } = require('./protocol');
const { createRelayServer } = require('./relayServer');

assertJwtSecret();

const HOST = '127.0.0.1';
const PORT = parseInt(process.env.RELAY_PORT || '3011', 10);
const SHUTDOWN_GRACE_MS = 500;

const relay = createRelayServer();

relay.server.listen(PORT, HOST, () => {
  console.log(`[notee-go-relay] ws://${HOST}:${PORT}${WS_PATH}  health http://${HOST}:${PORT}/health`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    relay.shutdown();
    setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS);
  });
}
