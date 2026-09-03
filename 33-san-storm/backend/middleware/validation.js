/**
 * 请求参数校验中间件（CR 必改 #8，2026-04-29 重写）
 *
 * 目标：把每个 route handler 头部"`if (!field) return res.status(400).json({...})`"
 * 这种重复 5–10 行的样板抽掉，改用 schema 驱动 + 走统一 `errorHandler`。
 *
 * ## 设计取舍
 *
 * - **零依赖**：本仓不引入 `joi / zod / express-validator`，原因：
 *   1. 当前实际需要的字段类型有限（string / boolean / integer / enum / id 模式），手写
 *      函数几十行就能覆盖；
 *   2. 与 R3 / Q9 / P3 等本轮自家中间件（`errorHandler` / `httpError` / `wrap500`）一脉相承；
 *   3. 不增加供应链 / 新版本兼容风险。
 * - **失败统一走 errorHandler**：`next(httpError(400, message, 'VALIDATION_FAILED'))`，
 *   响应体 `{ success:false, error, code:'VALIDATION_FAILED' }` 与全仓其余 4xx 一致；不再在
 *   middleware 内部直接 `res.status(400).json(...)`。
 * - **不做隐式类型转换**：本中间件**只负责检测**，不会把 `req.body.count` 从字符串改成数字
 *   （那种转换属于业务层逻辑，避免"中间件偷偷改 payload"的隐性副作用）。
 *
 * ## 用法
 *
 * ```js
 * const { validateBody, validateQuery, validateParams, v } = require('../middleware/validation');
 *
 * router.post('/login',
 *   validateBody({
 *     id:       v.required(v.nonEmptyString()),
 *     password: v.required(v.nonEmptyString({ max: 256 })),
 *   }),
 *   async (req, res, next) => {
 *     // 此处可以直接相信 req.body.id / password 都是非空 string
 *     ...
 *   }
 * );
 * ```
 *
 * 校验失败的响应（首个错误即返回，避免泄漏过多内部 schema 细节）：
 *
 * ```json
 * { "success": false, "error": "缺少必填字段 id", "code": "VALIDATION_FAILED" }
 * ```
 *
 * @see backend/utils/httpError.js
 * @see backend/middleware/errorHandler.js
 * @module middleware/validation
 */

const { httpError } = require('../utils/httpError');

/* ── 字段验证器 ──────────────────────────────────────────────────────────────── */

/**
 * 字段验证器签名：`(value, fieldName) => string | null`
 *   - 返回 `null` 表示通过
 *   - 返回字符串作为错误文案（用户可见）
 * @typedef {(value: any, fieldName: string) => (string | null)} FieldValidator
 */

const v = {
  /**
   * 字符串：检查类型，并按 `min / max` 字符长度区间约束。
   * @param {{ min?: number, max?: number }} [opts]
   */
  string({ min = 0, max = Number.POSITIVE_INFINITY } = {}) {
    return (val, name) => {
      if (typeof val !== 'string') return `${name} 必须为字符串`;
      if (val.length < min) return `${name} 长度不能少于 ${min} 个字符`;
      if (val.length > max) return `${name} 长度不能超过 ${max} 个字符`;
      return null;
    };
  },

  /** 非空字符串（trim 后非空）；上限默认 256，避免巨型 payload。 */
  nonEmptyString({ max = 256 } = {}) {
    const inner = v.string({ min: 1, max });
    return (val, name) => {
      const e = inner(val, name);
      if (e) return e;
      if (val.trim() === '') return `${name} 不能为空`;
      return null;
    };
  },

  /** 严格 boolean 类型（不接受 'true' / 'false' 字符串，避免转义混淆）。 */
  boolean() {
    return (val, name) => (typeof val === 'boolean' ? null : `${name} 必须为 boolean`);
  },

  /**
   * 整数（含范围）。`Number.isInteger` 严格判定，不接受 `'10'` 字符串。
   * @param {{ min?: number, max?: number }} [opts]
   */
  integer({ min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
    return (val, name) => {
      if (typeof val !== 'number' || !Number.isInteger(val)) return `${name} 必须为整数`;
      if (val < min) return `${name} 不能小于 ${min}`;
      if (val > max) return `${name} 不能大于 ${max}`;
      return null;
    };
  },

  /** 枚举：值必须严格等于给定列表中之一。 */
  enum(values) {
    return (val, name) => (values.includes(val) ? null : `${name} 必须为 ${values.join(' / ')} 之一`);
  },

  /** 字面量：值必须严格等于给定常量（如 `confirmFoodCost: true`）。 */
  literal(value) {
    return (val, name) => (val === value ? null : `${name} 必须为 ${JSON.stringify(value)}`);
  },

  /** `null` 或普通对象（非数组）；用于 `sessionLock: null` 清空锁。 */
  nullableObject() {
    return (val, name) => {
      if (val === null) return null;
      if (typeof val === 'object' && !Array.isArray(val)) return null;
      return `${name} 须为对象或 null`;
    };
  },

  /** 普通对象（非 null、非数组）。 */
  plainObject() {
    return (val, name) => {
      if (typeof val !== 'object' || val === null || Array.isArray(val)) return `${name} 必须为对象`;
      return null;
    };
  },

  /**
   * 数组（含长度与可选元素校验）。元素校验失败时字段名形如 `path[2].x`。
   * @param {{ minLength?: number, maxLength?: number, itemValidator?: FieldValidator }} [opts]
   */
  array({ minLength = 0, maxLength = Number.POSITIVE_INFINITY, itemValidator = null } = {}) {
    return (val, name) => {
      if (!Array.isArray(val)) return `${name} 必须为数组`;
      if (val.length < minLength) return `${name} 至少需要 ${minLength} 个元素`;
      if (val.length > maxLength) return `${name} 不能超过 ${maxLength} 个元素`;
      if (itemValidator) {
        for (let i = 0; i < val.length; i++) {
          const err = itemValidator(val[i], `${name}[${i}]`);
          if (err) return err;
        }
      }
      return null;
    };
  },

  /** 通用 ID 模式 `[a-zA-Z0-9_-]+`，并按可选最大长度约束。 */
  idLike({ max = 128 } = {}) {
    const re = /^[a-zA-Z0-9_-]+$/;
    return (val, name) => {
      if (typeof val !== 'string') return `${name} 必须为字符串`;
      if (!re.test(val)) return `${name} 含非法字符`;
      if (val.length > max) return `${name} 长度超过限制`;
      return null;
    };
  },

  /** 自定义正则匹配（用于 `san_\d+_player_\d+` 等专用格式）。 */
  pattern(re, hint) {
    return (val, name) => {
      if (typeof val !== 'string') return `${name} 必须为字符串`;
      if (!re.test(val)) return `${name} 格式无效${hint ? `（应为 ${hint}）` : ''}`;
      return null;
    };
  },

  /* ── 包装器 ─────────────────────────────────────────────────────────────── */

  /**
   * 必填：缺失（undefined / null）或为空字符串时直接判失败；非空时再走 inner。
   * @param {FieldValidator} inner
   */
  required(inner) {
    return (val, name) => {
      if (val === undefined || val === null) return `缺少必填字段 ${name}`;
      return inner(val, name);
    };
  },

  /**
   * 可选：缺失（undefined / null）时跳过校验；存在时走 inner。
   * @param {FieldValidator} inner
   */
  optional(inner) {
    return (val, name) => {
      if (val === undefined || val === null) return null;
      return inner(val, name);
    };
  },
};

/* ── schema 执行器 + 中间件工厂 ──────────────────────────────────────────── */

/**
 * 跑一份 schema：返回**首个**错误文案，全通过返回 null。
 *
 * 选"首个错误"而非"全部错误"是有意：避免一次响应暴露过多内部 schema 细节给攻击者；
 * 调用方可通过日志拼出全部错误用于本地调试，但响应体只给一条用户可见 hint。
 *
 * @param {Record<string, FieldValidator>} schema
 * @param {Record<string, any>} payload
 * @returns {string | null}
 */
function runSchema(schema, payload) {
  const obj = payload || {};
  for (const [field, validator] of Object.entries(schema)) {
    const err = validator(obj[field], field);
    if (err) return err;
  }
  return null;
}

/**
 * 校验 `req.body` 的中间件工厂。
 *
 * @param {Record<string, FieldValidator>} schema
 * @returns {import('express').RequestHandler}
 */
function validateBody(schema) {
  return (req, res, next) => {
    const err = runSchema(schema, req.body);
    if (err) return next(httpError(400, err, 'VALIDATION_FAILED'));
    next();
  };
}

/**
 * 校验 `req.params` 的中间件工厂。
 */
function validateParams(schema) {
  return (req, res, next) => {
    const err = runSchema(schema, req.params);
    if (err) return next(httpError(400, err, 'VALIDATION_FAILED'));
    next();
  };
}

/**
 * 校验 `req.query` 的中间件工厂。
 *
 * 注：query 参数都是字符串（除非 Express 特殊配置），所以**不要**对 query 字段
 * 直接用 `v.integer()` —— 应在业务层 `parseInt(req.query.count)` 后自行检查。
 * 本中间件主要给 query 用 `v.enum(...)` / `v.pattern(...)` / `v.nonEmptyString()`
 * 这类"字符串维度"的约束。
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const err = runSchema(schema, req.query);
    if (err) return next(httpError(400, err, 'VALIDATION_FAILED'));
    next();
  };
}

/** 要求 `req.body` 本身为 JSON 对象（创角进度等「整包 body」端点）。 */
function validateBodyIsPlainObject() {
  return (req, res, next) => {
    const err = v.plainObject()(req.body, 'body');
    if (err) return next(httpError(400, err, 'VALIDATION_FAILED'));
    next();
  };
}

/* ── 兼容：旧的 troop 校验 ────────────────────────────────────────────────────
 * `routes/config.js` 仍在 import 这两个名字；继续保留导出，不动其调用方。
 * 内部改写为新的 schema 形式后管道统一。
 */

const VALID_RARITIES = ['common', 'rare', 'epic', 'legendary', 'core'];
const VALID_TROOP_TYPES = ['infantry', 'cavalry', 'archer', 'special'];

const validateTroopQuery = validateQuery({
  rarity: v.optional(v.enum(VALID_RARITIES)),
  troopType: v.optional(v.enum(VALID_TROOP_TYPES)),
  season: v.optional(v.pattern(/^san_\d+$/, 'san_1 / san_2 ...')),
});

const validateTroopId = validateParams({
  id: v.required(v.pattern(/^san_\d+_troop_\d+$/, 'san_1_troop_1001')),
});

module.exports = {
  v,
  validateBody,
  validateParams,
  validateQuery,
  validateBodyIsPlainObject,
  // 兼容：旧导出
  validateTroopQuery,
  validateTroopId,
};
