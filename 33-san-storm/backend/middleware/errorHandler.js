/**
 * 错误处理中间件
 *
 * @description
 *   - `asyncHandler(fn)`：把 async route handler 内部的 reject / throw 自动 `next(err)`，避免每个路由
 *     都重复 `try/catch`；新代码可逐步替换 `try/catch + console.error + res.status(500)` 样板。
 *   - `notFoundHandler`：未匹配路由统一返回 JSON `{ success:false, error:'接口不存在' }`，
 *     避免浏览器看到 HTML `Cannot GET`。
 *   - `errorHandler`：统一错误响应入口。
 *     - 业务 4xx：透出 `err.publicMessage`、`err.code`，原貌呈现给前端；
 *     - 服务端 5xx：仍透出 `err.publicMessage`（由开发者**显式**提供，非 SQL 异常的 `.message`）+ `err.code`；
 *       **不**透出 `err.message`、`err.stack`（PROD 仅服务端 console.error 留底，避免泄露 SQL / 堆栈）。
 *     - DEV (`NODE_ENV !== 'production'`)：额外把 `message` / `stack` 串到响应体，便于本地排错。
 *
 *   响应体规范（Q9 续集，2026-04-29）：
 *     `{ success:false, error:string, code?:string, message?:string(DEV), stack?:string(DEV) }`
 *
 *   配套 helper：`backend/utils/httpError.js` 的 `httpError(status, publicMessage, code)` /
 *   `wrap500(error, publicMessage, code)`。
 *
 * @see backend/utils/httpError.js
 * @see docs/00/00-base/02-architecture-split/40-conventions.md §错误响应
 *
 * @module middleware/errorHandler
 */

const isProd = process.env.NODE_ENV === 'production';

/** 包装 async route handler；handler 内 `throw err` 会自动走到 errorHandler。 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** 未匹配路由统一 JSON 404。 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.originalUrl || req.url,
  });
}

/**
 * 兜底错误处理。
 *
 * 业务规则约定：
 *   - `err.status` / `err.statusCode`（>= 400 < 600）→ HTTP 状态；缺失则 500。
 *   - `err.publicMessage`（开发者显式给的"用户友好文案"）→ 响应 `error` 字段；
 *      缺失时按 status 兜底（>= 500 "服务器内部错误"，4xx "请求失败"）。
 *   - `err.code`（业务码 / "FORBIDDEN" / "BAD_PARAMS" 等）→ 响应 `code`，**PROD 也透出**（业务码非泄露面）。
 *   - 仅 DEV 把 `err.message` / `err.stack` 加到响应；PROD 仅服务端 `console.error` 留底。
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && err.code === 'JWT_SECRET_MISSING') {
    console.error('[ErrorHandler] JWT_SECRET 缺失，拒绝处理请求');
    return res.status(500).json({
      success: false,
      error: '服务端鉴权配置缺失',
      code: 'JWT_SECRET_MISSING',
    });
  }

  const rawStatus = err && (err.status || err.statusCode);
  const status =
    Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus < 600
      ? rawStatus
      : 500;

  // 服务端日志：5xx 一律打 stack；4xx 仅 DEV 打（4xx 是预期业务流，PROD 刷屏意义不大）
  // tag 拼上请求方法 / 路径，让"哪个路由抛错"在日志里可见，**不**需要路由层再 console.error 一次
  const reqTag = req?.method && req?.originalUrl ? ` [${req.method} ${req.originalUrl}]` : '';
  if (status >= 500) {
    const baseTag = err?.publicMessage ? `[${err.publicMessage}]` : '[ErrorHandler]';
    console.error(`${baseTag}${reqTag}`, err && err.stack ? err.stack : err);
  } else if (!isProd) {
    console.warn(`[ErrorHandler 4xx]${reqTag}`, err?.publicMessage || err?.message || err);
  }

  const body = {
    success: false,
    error:
      err?.publicMessage
      || (status >= 500 ? '服务器内部错误' : '请求失败'),
  };
  if (err?.code) body.code = err.code;
  if (!isProd) {
    if (err?.message) body.message = err.message;
    if (err?.stack) body.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = {
  asyncHandler,
  notFoundHandler,
  errorHandler,
};
