/**
 * Lightweight service error with HTTP status + machine code.
 */

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

module.exports = { httpError };
