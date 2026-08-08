/**
 * Map service errors → JSON; never leak stack to clients.
 */

function sendServiceError(res, err, logTag = '[one-line]') {
  const status = err.status || 500;
  if (status >= 500) {
    console.error(logTag, err.message);
    return res.status(500).json({ success: false, error: '服务器内部错误' });
  }
  return res.status(status).json({
    success: false,
    error: err.message || '请求失败',
    code: err.code,
  });
}

module.exports = { sendServiceError };
