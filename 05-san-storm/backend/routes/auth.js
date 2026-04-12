/**
 * 认证路由
 *
 * @description HTTP 映射与状态码；业务逻辑见 services/accountService.js
 */

const express = require('express');
const accountService = require('../services/accountService');

const router = express.Router();

/**
 * GET /api/auth/register-candidates
 * 返回当前未被 accounts 占用的随机候选 ID（服务端权威，降低与已注册 ID 碰撞概率）
 *
 * Query: count=5（1–20），exclude=id1,id2（可选，刷新时排除本轮已展示）
 */
router.get('/register-candidates', async (req, res) => {
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
    console.error('[Auth] register-candidates:', error);
    return res.status(500).json({
      success: false,
      error: '服务器错误',
    });
  }
});

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const result = await accountService.register(req.body);
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
    console.error('[Auth] 注册失败:', error);
    return res.status(500).json({
      success: false,
      error: '注册失败',
      message: error.message,
    });
  }
});

/**
 * GET /api/auth/verify/:id
 */
router.get('/verify/:id', async (req, res) => {
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
    console.error('验证账号失败:', error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
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
    console.error('[Auth] 登录失败:', error);
    return res.status(500).json({
      success: false,
      error: '登录失败',
      message: error.message,
    });
  }
});

/**
 * GET /api/auth/users
 */
router.get('/users', async (req, res) => {
  try {
    const accounts = await accountService.listAccountsWithServerName();
    return res.json({
      success: true,
      data: accounts,
      total: accounts.length,
    });
  } catch (error) {
    console.error('[Auth] 获取用户列表失败:', error);
    return res.status(500).json({
      success: false,
      error: '获取用户列表失败',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/ban
 */
router.post('/ban', async (req, res) => {
  try {
    const { userId, reason, duration } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少用户ID' });
    }
    await accountService.banUser(userId, reason, duration);
    return res.json({ success: true, message: '用户已被封禁' });
  } catch (error) {
    console.error('[Auth] 封禁用户失败:', error);
    return res.status(500).json({
      success: false,
      error: '封禁用户失败',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/unban
 */
router.post('/unban', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少用户ID' });
    }
    await accountService.unbanUser(userId);
    return res.json({ success: true, message: '用户已解封' });
  } catch (error) {
    console.error('[Auth] 解封用户失败:', error);
    return res.status(500).json({
      success: false,
      error: '解封用户失败',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/auth/user/:userId/game-data
 */
router.delete('/user/:userId/game-data', async (req, res) => {
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
    console.error('[Auth] 清除用户游戏数据失败:', error);
    return res.status(500).json({
      success: false,
      error: '清除游戏数据失败',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/auth/user/:userId
 */
router.delete('/user/:userId', async (req, res) => {
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
    console.error('[Auth] 删除用户失败:', error);
    return res.status(500).json({
      success: false,
      error: '删除用户失败',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/users/ban-inactive
 * 封禁「游戏内最后活跃」已超过指定天数的账号（默认 14 天）
 */
router.post('/users/ban-inactive', async (req, res) => {
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
    console.error('[Auth] 一键标记（封禁长期未活跃）失败:', error);
    return res.status(500).json({
      success: false,
      error: '操作失败',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/auth/users/banned
 */
router.delete('/users/banned', async (req, res) => {
  try {
    const result = await accountService.deleteAllBannedAccounts();
    return res.json({
      success: true,
      message: result.message,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('[Auth] 一键删除封禁账号失败:', error);
    return res.status(500).json({
      success: false,
      error: '操作失败',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/auth/users/purge-all
 */
router.delete('/users/purge-all', async (req, res) => {
  try {
    const { deletedCounts, nullifiedCounts } = await accountService.purgeAllPlayerData();
    return res.json({
      success: true,
      message: '所有用户的玩家数据已清除',
      deletedCounts,
      nullifiedCounts,
    });
  } catch (error) {
    console.error('[Auth] 一键清除所有玩家数据失败:', error);
    return res.status(500).json({
      success: false,
      error: '操作失败',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/switch-server
 */
router.post('/switch-server', async (req, res) => {
  try {
    const { userId, newServerId } = req.body;
    if (!userId || !newServerId) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }
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
    console.error('[Auth] 切换服务器失败:', error);
    return res.status(500).json({
      success: false,
      error: '切换服务器失败',
      message: error.message,
    });
  }
});

module.exports = router;
