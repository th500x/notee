/**
 * 认证路由
 * 
 * @description 处理用户注册和登录
 */

const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../database/connection');
const { getIPPattern } = require('../utils/ipUtils');

const router = express.Router();

/**
 * POST /api/auth/register
 * 用户注册
 */
router.post('/register', async (req, res) => {
  try {
    const { 
      id, 
      password, 
      birthMonth, 
      serverId, 
      machineId, 
      clientIP,
      province,
      city
    } = req.body;

    // 数据验证
    if (!id || !password || !birthMonth || !serverId || !machineId || !clientIP) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    // 检查ID是否已存在
    const [existingId] = await pool.query(
      'SELECT id FROM accounts WHERE id = ?',
      [id]
    );
    if (existingId.length > 0) {
      return res.status(400).json({ success: false, error: 'ID已被使用' });
    }

    // 检查机器指纹是否已注册
    const [existingMachine] = await pool.query(
      'SELECT id FROM accounts WHERE machineId = ?',
      [machineId]
    );
    if (existingMachine.length > 0) {
      return res.status(400).json({ success: false, error: '该设备已注册过账号' });
    }

    // 检查IP是否已注册（IPv6使用前缀匹配）
    const ipPattern = getIPPattern(clientIP);
    const [existingIP] = await pool.query(
      'SELECT id FROM accounts WHERE clientIP LIKE ?',
      [ipPattern]
    );
    if (existingIP.length > 0) {
      return res.status(400).json({ success: false, error: '该网络已注册过账号' });
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);

    // 查询服务器配置，获取当前赛季
    const [serverConfig] = await pool.query(
      'SELECT current_season FROM config_servers WHERE server_id = ?',
      [serverId]
    );
    
    // 如果找不到服务器配置，使用默认值
    const currentSeason = serverConfig.length > 0 ? serverConfig[0].current_season : 'san_0_m1/san_1';

    // 插入账号数据
    await pool.query(`
      INSERT INTO accounts (
        id, password, birthMonth, serverId, 
        current_season, machineId, clientIP, 
        province, city, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [
      id, 
      hashedPassword, 
      birthMonth, 
      serverId,
      currentSeason, // 从服务器配置中动态获取当前赛季
      machineId, 
      clientIP,
      province || null,
      city || null
    ]);

    res.json({ 
      success: true, 
      message: '注册成功',
      data: { id, serverId }
    });

  } catch (error) {
    console.error('[Auth] 注册失败:', error);
    res.status(500).json({ 
      success: false,
      error: '注册失败',
      message: error.message 
    });
  }
});

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', async (req, res) => {
  try {
    const { id, password } = req.body;

    // 数据验证
    if (!id || !password) {
      return res.status(400).json({ success: false, error: '请输入ID和密码' });
    }

    // 查询账号
    const [accounts] = await pool.query(
      'SELECT * FROM accounts WHERE id = ?',
      [id]
    );

    if (accounts.length === 0) {
      return res.status(401).json({ success: false, error: 'ID或密码错误' });
    }

    const account = accounts[0];

    // 检查账号状态
    if (account.status === 'banned') {
      return res.status(403).json({ 
        success: false,
        error: '账号已被封禁',
        reason: account.banReason,
        banUntil: account.banUntil
      });
    }

    // 验证密码
    const passwordMatch = await bcrypt.compare(password, account.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'ID或密码错误' });
    }

    // 更新登录信息
    await pool.query(`
      UPDATE accounts 
      SET 
        lastLoginAt = NOW(),
        lastActiveAt = NOW(),
        loginCount = loginCount + 1,
        status = 'active'
      WHERE id = ?
    `, [id]);

    // 返回账号信息（不包含密码）
    const { password: _, ...accountData } = account;
    
    res.json({ 
      success: true, 
      message: '登录成功',
      data: accountData
    });

  } catch (error) {
    console.error('[Auth] 登录失败:', error);
    res.status(500).json({ 
      success: false,
      error: '登录失败',
      message: error.message 
    });
  }
});

/**
 * GET /api/auth/users
 * 获取所有用户列表（管理员功能）
 */
router.get('/users', async (req, res) => {
  try {
    // 查询所有账号（不包含密码），并关联服务器名称
    const [accounts] = await pool.query(`
      SELECT 
        a.id, a.birthMonth, a.serverId, a.current_season,
        a.machineId, a.clientIP, a.province, a.city,
        a.status, a.banReason, a.banUntil,
        a.registeredAt, a.lastLoginAt, a.lastActiveAt, a.loginCount,
        COALESCE(s.server_name, a.serverId) as serverName
      FROM accounts a
      LEFT JOIN config_servers s ON a.serverId = s.server_id
      ORDER BY a.registeredAt DESC
    `);

    res.json({ 
      success: true,
      data: accounts,
      total: accounts.length
    });

  } catch (error) {
    console.error('[Auth] 获取用户列表失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取用户列表失败',
      message: error.message 
    });
  }
});

/**
 * POST /api/auth/ban
 * 封禁用户（管理员功能）
 */
router.post('/ban', async (req, res) => {
  try {
    const { userId, reason, duration } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少用户ID' });
    }

    // 计算封禁到期时间
    let banUntil = null;
    if (duration && duration > 0) {
      banUntil = new Date(Date.now() + duration * 24 * 60 * 60 * 1000); // duration是天数
    }

    // 更新用户状态
    await pool.query(`
      UPDATE accounts 
      SET 
        status = 'banned',
        banReason = ?,
        banUntil = ?
      WHERE id = ?
    `, [reason || '违反用户协议', banUntil, userId]);

    res.json({ 
      success: true, 
      message: '用户已被封禁'
    });

  } catch (error) {
    console.error('[Auth] 封禁用户失败:', error);
    res.status(500).json({ 
      success: false,
      error: '封禁用户失败',
      message: error.message 
    });
  }
});

/**
 * POST /api/auth/unban
 * 解封用户（管理员功能）
 */
router.post('/unban', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少用户ID' });
    }

    // 更新用户状态
    await pool.query(`
      UPDATE accounts 
      SET 
        status = 'active',
        banReason = NULL,
        banUntil = NULL
      WHERE id = ?
    `, [userId]);

    res.json({ 
      success: true, 
      message: '用户已解封'
    });

  } catch (error) {
    console.error('[Auth] 解封用户失败:', error);
    res.status(500).json({ 
      success: false,
      error: '解封用户失败',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/auth/user/:userId
 * 删除用户（管理员功能）
 */
router.delete('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少用户ID' });
    }

    // 检查用户是否存在
    const [users] = await pool.query(
      'SELECT id FROM accounts WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    // 删除用户（级联删除会自动删除关联的玩家数据）
    await pool.query('DELETE FROM accounts WHERE id = ?', [userId]);

    res.json({ 
      success: true, 
      message: '用户已删除'
    });

  } catch (error) {
    console.error('[Auth] 删除用户失败:', error);
    res.status(500).json({ 
      success: false,
      error: '删除用户失败',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/auth/users/all
 * 清除所有用户（管理员功能 - 危险操作）
 */
router.delete('/users/all', async (req, res) => {
  try {
    // 删除所有账号（级联删除会自动删除关联的玩家数据）
    const [result] = await pool.query('DELETE FROM accounts');

    res.json({ 
      success: true, 
      message: '所有用户已清除',
      deletedCount: result.affectedRows
    });

  } catch (error) {
    console.error('[Auth] 清除所有用户失败:', error);
    res.status(500).json({ 
      success: false,
      error: '清除所有用户失败',
      message: error.message 
    });
  }
});

/**
 * POST /api/auth/switch-server
 * 切换服务器（清除当前赛季数据）
 */
router.post('/switch-server', async (req, res) => {
  try {
    const { userId, newServerId } = req.body;

    if (!userId || !newServerId) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    // 检查用户是否存在
    const [users] = await pool.query(
      'SELECT * FROM accounts WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const user = users[0];

    // 检查是否真的需要切换
    if (user.serverId === newServerId) {
      return res.status(400).json({ success: false, error: '已在目标服务器' });
    }

    // 开始事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. 更新账号的服务器ID
      await connection.query(`
        UPDATE accounts 
        SET serverId = ?
        WHERE id = ?
      `, [newServerId, userId]);

      // 2. 删除当前赛季的玩家数据（如果存在players表）
      // 注意：这里假设有players表，如果没有则跳过
      // 由于外键级联删除，删除players会自动删除相关的卡牌、装备等数据
      await connection.query(`
        DELETE FROM players WHERE player_id = ?
      `, [userId]);

      // 提交事务
      await connection.commit();
      connection.release();

      res.json({ 
        success: true, 
        message: '服务器切换成功',
        data: {
          userId,
          oldServerId: user.serverId,
          newServerId
        }
      });

    } catch (error) {
      // 回滚事务
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (error) {
    console.error('[Auth] 切换服务器失败:', error);
    res.status(500).json({ 
      success: false,
      error: '切换服务器失败',
      message: error.message 
    });
  }
});

module.exports = router;
