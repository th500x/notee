/**
 * backend/.env, then .env.local, then .env.production when NODE_ENV=production — later files win.
 * Every entry point in backend/ (API 3010, scan relay 3011, scripts) loads env through here, so
 * JWT_SECRET and friends have one home.
 */

const path = require('path');
const dotenv = require('dotenv');

const BACKEND_ROOT = path.join(__dirname, '..');

function loadEnv() {
  dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });
  dotenv.config({ path: path.join(BACKEND_ROOT, '.env.local'), override: true });
  if (process.env.NODE_ENV === 'production') {
    dotenv.config({ path: path.join(BACKEND_ROOT, '.env.production'), override: true });
  }
}

module.exports = { loadEnv };
