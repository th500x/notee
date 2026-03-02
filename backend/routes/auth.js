/**
 * 全局认证路由
 * 提供跨项目的统一认证服务
 * 
 * @module routes/auth
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

// 从环境变量读取配置
const GLOBAL_PASSWORD_HASH = process.env.GLOBAL_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET || 'notee-default-secret-change-this';
const TOKEN_EXPIRY = '30d'; // 单用户场景，设置为30天

/**
 * 全局密码登录
 * POST /api/auth/login
 * 
 * @body {string} password - 用户输入的密码
 * @body {string} [project] - 项目标识（可选）
 * @returns {Object} { success, token, expiresIn }
 */
router.post('/login', async (req, res) => {
  try {
    const { password, project } = req.body;
    
    // 验证输入
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '请输入密码' 
      });
    }
    
    if (password.length > 100) {
      return res.status(400).json({ 
        success: false, 
        error: '密码长度不能超过100个字符' 
      });
    }
    
    // 验证密码
    const isValid = await bcrypt.compare(password, GLOBAL_PASSWORD_HASH);
    
    if (isValid) {
      // 生成JWT token
      const token = jwt.sign(
        { 
          type: 'global',
          project: project || 'all',
          access: 'granted',
          timestamp: Date.now()
        },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );
      
      console.log(`[Auth] ✅ 全局密码验证成功 - 项目: ${project || 'all'}`);
      
      res.json({ 
        success: true, 
        token,
        expiresIn: 30 * 24 * 60 * 60 // 30天（秒）
      });
    } else {
      console.warn('[Auth] ❌ 全局密码验证失败');
      res.status(401).json({ 
        success: false, 
        error: '密码错误' 
      });
    }
  } catch (error) {
    console.error('[Auth] 登录错误:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误' 
    });
  }
});

/**
 * 验证token有效性
 * POST /api/auth/verify
 * 
 * @header {string} Authorization - Bearer token
 * @returns {Object} { success, valid, data }
 */
router.post('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        valid: false,
        error: '未提供token' 
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    res.json({ 
      success: true, 
      valid: true,
      data: {
        type: decoded.type,
        project: decoded.project,
        access: decoded.access
      }
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        valid: false,
        error: 'Token已过期' 
      });
    }
    
    res.status(401).json({ 
      success: false, 
      valid: false,
      error: 'Token无效' 
    });
  }
});

/**
 * 刷新token
 * POST /api/auth/refresh
 * 
 * @header {string} Authorization - Bearer token
 * @returns {Object} { success, token, expiresIn }
 */
router.post('/refresh', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: '未提供token' 
      });
    }
    
    // 验证旧token（即使过期也允许刷新，但不能太久）
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    
    // 检查token是否过期超过30天（不允许刷新）
    const tokenAge = Date.now() - decoded.timestamp;
    if (tokenAge > 30 * 24 * 60 * 60 * 1000) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token过期时间过长，请重新登录' 
      });
    }
    
    // 生成新token
    const newToken = jwt.sign(
      { 
        type: decoded.type,
        project: decoded.project,
        access: decoded.access,
        timestamp: Date.now()
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    
    console.log(`[Auth] 🔄 Token刷新成功 - 项目: ${decoded.project}`);
    
    res.json({ 
      success: true, 
      token: newToken,
      expiresIn: 30 * 24 * 60 * 60 // 30天（秒）
    });
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      error: 'Token无效' 
    });
  }
});

module.exports = router;
