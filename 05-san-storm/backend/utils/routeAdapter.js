/**
 * 路由 HTTP 适配 helper（O3-B1）：统一 Service 结果 → JSON 响应。
 */
const { wrap500 } = require('./httpError');

function replyServiceOut(res, out, { notFoundMessage = '不存在' } = {}) {
  if (out?.notFound) {
    return res.status(404).json({ success: false, error: out.error || notFoundMessage });
  }
  if (out?.ok === false) {
    if (out.json) return res.status(out.status || 400).json(out.json);
    const body = { success: false, error: out.error };
    if (out.code) body.code = out.code;
    return res.status(out.status || 400).json(body);
  }
  if (out?.badRequest) {
    return res.status(400).json({ success: false, error: out.badRequest });
  }
  if (out?.insufficientSilver) {
    return res.status(400).json({
      success: false,
      error: `银两不足，需要${out.cost}银两才能重新随机`,
    });
  }
  const payload = { success: true };
  if (out?.data !== undefined) payload.data = out.data;
  if (out?.message) payload.message = out.message;
  if (out?.factions) payload.data = { factions: out.factions };
  return res.json(payload);
}

function withRoute(label, handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      const code = Number(err?.statusCode);
      if (code >= 400 && code < 500) {
        return res.status(code).json({ success: false, error: err.message });
      }
      return next(wrap500(err, label));
    }
  };
}

module.exports = { replyServiceOut, withRoute };
