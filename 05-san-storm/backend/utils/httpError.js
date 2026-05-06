/**
 * HTTP 错误 helper
 *
 * @description
 *   配套 `middleware/errorHandler.js`，给路由层提供两个常用入口：
 *
 *   1. **业务级 4xx（"参数错误 / 无权 / 没找到"）**：直接 `throw httpError(400, '中文文案', 'BAD_PARAMS')`，
 *      或路由内 `return next(httpError(...))`；errorHandler 会按 status 透出 `error: 中文文案`、`code`。
 *
 *   2. **服务端 5xx（catch 到的 DB / 系统异常）**：
 *      ```js
 *      } catch (error) {
 *        return next(wrap500(error, '获取头像列表失败'));
 *      }
 *      ```
 *      原 `error` 对象会附上 `status=500` / `publicMessage` / `code`（如指定）后交给 errorHandler。
 *      errorHandler 服务端 `console.error` 会记完整 stack；前端只看到 `error: '获取头像列表失败'`，
 *      **不**会看到 SQL / Stack 原文。DEV 环境额外串 `message` / `stack` 到响应便于本地排错。
 *
 *   设计取舍：
 *   - 不引入新的 Error 子类层次；`HttpError` 仅用于 `throw httpError(...)` 的便捷场景。
 *   - `wrap500` **就地修改** error 的 `status / publicMessage / code` 而非新建对象，保证原 `stack` 完整保留，
 *     err.toString() 在服务端日志里仍能显示真实失败点。
 *
 * @see backend/middleware/errorHandler.js
 *
 * @module utils/httpError
 */

class HttpError extends Error {
  constructor(status, publicMessage, code) {
    super(publicMessage || `HTTP ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.publicMessage = publicMessage;
    if (code) this.code = code;
  }
}

/**
 * 创建一个业务级 HTTP 错误。
 *
 * @param {number} status HTTP 状态码（400 / 401 / 403 / 404 / 409 / ...）
 * @param {string} publicMessage 用户友好的中文文案，将作为响应体的 `error`
 * @param {string} [code] 业务码，将作为响应体的 `code`（PROD 也透出）
 * @returns {HttpError}
 */
function httpError(status, publicMessage, code) {
  return new HttpError(status, publicMessage, code);
}

/**
 * 把 catch 到的原始 error 包装成 500，附带用户友好文案 + 可选 code，再交给 next()。
 *
 * 若 `error` 已经是 HttpError（例如 service 内 throw 的业务错），保留其原 `status / publicMessage / code`，
 * 仅在缺失时填充本调用提供的兜底值——避免误把 service 抛出的 400 转成 500。
 *
 * @param {unknown} error catch 到的原始错误对象
 * @param {string} publicMessage 兜底中文文案
 * @param {string} [code] 兜底业务码
 * @returns {Error}
 */
function wrap500(error, publicMessage, code) {
  if (error && typeof error === 'object') {
    if (!error.status && !error.statusCode) error.status = 500;
    if (publicMessage && !error.publicMessage) error.publicMessage = publicMessage;
    if (code && !error.code) error.code = code;
    return error;
  }
  // 非 Error 实例（throw 字符串 / 数字等罕见场景）：包成 HttpError，原值塞 cause
  const wrapped = httpError(500, publicMessage, code);
  wrapped.cause = error;
  return wrapped;
}

module.exports = {
  HttpError,
  httpError,
  wrap500,
};
