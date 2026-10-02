/**
 * GET a public feed or page as text for the collectors (News Notes, City Events).
 * A non-2xx answer throws with `status` set, so callers can tell 404 from a timeout.
 */

const FETCH_TIMEOUT_MS = 15 * 1000;

/**
 * @param {string} url
 * @param {{ userAgent: string, accept: string }} headers
 */
async function fetchText(url, { userAgent, accept }) {
  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent, Accept: accept },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.text();
}

module.exports = {
  fetchText,
};
