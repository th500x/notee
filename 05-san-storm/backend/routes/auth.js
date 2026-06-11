/**
 * 认证路由
 *
 * @description HTTP 映射与状态码；业务逻辑见 services/accountService.js
 */

const express = require('express');
const accountService = require('../services/accountService');
const { loginLimiter, registerCandidatesLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');
const { validateBody, v } = require('../middleware/validation');

const router = express.Router();

/**
 * 鉴权策略：
 *   - 登录注册前置端点（`/register-candidates` / `/register` / `/verify/:id` / `/login`）**不**挂 `requireAuth`，
 *     否则前端尚未拿到 token，登录链路被自我堵死；
 *   - 管理员侧端点（`/users` 列表 / `/ban` / …）：**不挂后端 JWT**；与全站一致，由前端 `useAdmin` +
 *     主站登录写入的 `notee-admin-token` 控制入口显隐（AdminPageGate）。
 */

/**
 * GET /api/auth/register-candidates
 * 返回当前未被 accounts 占用的随机候选 ID（服务端权威，降低与已注册 ID 碰撞概率）
 *
 * Query: count=5（1–20），exclude=id1,id2（可选，刷新时排除本轮已展示）
 */
router.get('/register-candidates', registerCandidatesLimiter, async (req, res, next) => {
  try {
    const count = parseInt(req.query.count, 10) || 5;
    const excludeRaw = req.query.exclude;
    const excludeIds =
      typeof excludeRaw === 'string' && excludeRaw.trim()
        ? excludeRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    const result = await accountService.pickRegisterIdCandidates({
      count,
      excludeIds,
    });

    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        error: result.error,
      });
    }

    return res.json({
      success: true,
      data: {
        ids: result.ids,
        partial: result.partial,
      },
    });
  } catch (error) {
    return next(wrap500(error, '服务器错误'));
  }
});

/**
 * POST /api/auth/register
 */
router.post('/register', loginLimiter, async (req, res, next) => {
  try {
    const result = await accountService.register(req.body, { requestIp: req.ip });
    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        error: result.error,
      });
    }
    return res.json({
      success: true,
      message: '注册成功',
      data: result.accountData,
    });
  } catch (error) {
    return next(wrap500(error, '注册失败'));
  }
});

/**
 * GET /api/auth/verify/:id
 */
router.get('/verify/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const out = await accountService.verifyExists(id);
    if (!out.exists) {
      return res.json({ success: true, exists: false });
    }
    return res.json({
      success: true,
      exists: true,
      status: out.status,
    });
  } catch (error) {
    return next(wrap500(error, '服务器错误'));
  }
});

/**
 * POST /api/auth/login
 */
router.post(
  '/login',
  loginLimiter,
  validateBody({
    id: v.required(v.nonEmptyString({ max: 64 })),
    password: v.required(v.nonEmptyString({ max: 256 })),
  }),
  async (req, res, next) => {
  try {
    const { id, password } = req.body;
    const result = await accountService.login(id, password);
    if (!result.ok) {
      const body = {
        success: false,
        error: result.error,
      };
      if (result.status === 403 && result.banReason !== undefined) {
        body.reason = result.banReason;
        body.banUntil = result.banUntil;
      }
      return res.status(result.status).json(body);
    }
    return res.json({
      success: true,
      message: '登录成功',
      data: result.accountData,
    });
  } catch (error) {
    return next(wrap500(error, '登录失败'));
  }
});

/**
 * POST /api/auth/change-password
 * 已登录玩家修改密码（须 JWT；不校验旧密码）
 */
router.post(
  '/change-password',
  requireAuth,
  validateBody({
    password: v.required(v.nonEmptyString({ max: 256 })),
    confirmPassword: v.required(v.nonEmptyString({ max: 256 })),
  }),
  async (req, res, next) => {
    try {
      if (!req.player?.sub || req.player._devBypass) {
        return res.status(401).json({
          success: false,
          error: '请使用正常登录会话后再修改密码',
          code: 'NO_TOKEN',
        });
      }
      const result = await accountService.changePassword(req.player.sub, req.body);
      if (!result.ok) {
        return res.status(result.status).json({
          success: false,
          error: result.error,
        });
      }
      return res.json({ success: true, message: '密码已更新' });
    } catch (error) {
      return next(wrap500(error, '修改密码失败'));
    }
  },
);

/**
 * GET /api/auth/users
 */
router.get('/users', async (req, res, next) => {
  try {
    const accounts = await accountService.listAccountsWithServerName();
    return res.json({
      success: true,
      data: accounts,
      total: accounts.length,
    });
  } catch (error) {
    return next(wrap500(error, '获取用户列表失败'));
  }
});

/**
 * POST /api/auth/ban
 */
router.post(
  '/ban',
  validateBody({
    userId: v.required(v.nonEmptyString({ max: 64 })),
    reason: v.optional(v.string({ max: 1024 })),
    duration: v.optional(v.integer({ min: 0, max: 365 * 24 * 60 * 60 })),
  }),
  async (req, res, next) => {
  try {
    const { userId, reason, duration } = req.body;
    await accountService.banUser(userId, reason, duration);
    return res.json({ success: true, message: '用户已被封禁' });
  } catch (error) {
    return next(wrap500(error, '封禁用户失败'));
  }
});

/**
 * POST /api/auth/unban
 */
router.post(
  '/unban',
  validateBody({
    userId: v.required(v.nonEmptyString({ max: 64 })),
  }),
  async (req, res, next) => {
  try {
    const { userId } = req.body;
    await accountService.unbanUser(userId);
    return res.json({ success: true, message: '用户已解封' });
  } catch (error) {
    return next(wrap500(error, '解封用户失败'));
  }
});

/**
 * DELETE /api/auth/user/:userId/game-data
 */
router.delete('/user/:userId/game-data', async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少用户ID' });
    }
    const result = await accountService.clearPlayerGameData(userId);
    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        error: result.error,
      });
    }
    return res.json({
      success: true,
      message: '游戏数据已清除',
      deletedCounts: result.deletedCounts,
      nullifiedCounts: result.nullifiedCounts,
    });
  } catch (error) {
    return next(wrap500(error, '清除游戏数据失败'));
  }
});

/**
 * DELETE /api/auth/user/:userId
 */
router.delete('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少用户ID' });
    }
    const result = await accountService.deleteAccount(userId);
    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        error: result.error,
      });
    }
    return res.json({ success: true, message: '用户已删除' });
  } catch (error) {
    return next(wrap500(error, '删除用户失败'));
  }
});

/**
 * POST /api/auth/users/ban-inactive
 * 封禁「游戏内最后活跃」已超过指定天数的账号（默认 14 天）
 */
router.post('/users/ban-inactive', async (req, res, next) => {
  try {
    const days = req.body.days != null ? req.body.days : 14;
    const reason = req.body.reason;
    const result = await accountService.banAccountsInactiveLongerThan(days, reason);
    return res.json({
      success: true,
      bannedCount: result.bannedCount,
      userIds: result.userIds,
    });
  } catch (error) {
    return next(wrap500(error, '操作失败'));
  }
});

/**
 * DELETE /api/auth/users/banned
 */
router.delete('/users/banned', async (req, res, next) => {
  try {
    const result = await accountService.deleteAllBannedAccounts();
    return res.json({
      success: true,
      message: result.message,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return next(wrap500(error, '操作失败'));
  }
});

/**
 * DELETE /api/auth/users/purge-all
 */
router.delete('/users/purge-all', async (req, res, next) => {
  try {
    const { deletedCounts, nullifiedCounts } = await accountService.purgeAllPlayerData();
    return res.json({
      success: true,
      message: '所有用户的玩家数据已清除',
      deletedCounts,
      nullifiedCounts,
    });
  } catch (error) {
    return next(wrap500(error, '操作失败'));
  }
});

/**
 * POST /api/auth/switch-server
 */
router.post(
  '/switch-server',
  validateBody({
    userId: v.required(v.nonEmptyString({ max: 64 })),
    newServerId: v.required(v.nonEmptyString({ max: 64 })),
  }),
  async (req, res, next) => {
  try {
    const { userId, newServerId } = req.body;
    const result = await accountService.switchServer(userId, newServerId);
    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        error: result.error,
      });
    }
    return res.json({
      success: true,
      message: '服务器切换成功',
      data: result.data,
    });
  } catch (error) {
    return next(wrap500(error, '切换服务器失败'));
  }
});

module.exports = router;
