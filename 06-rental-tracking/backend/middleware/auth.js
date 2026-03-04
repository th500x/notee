/**
 * 认证中间件
 * 验证JWT token
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'notee-default-secret-change-this';

/**
 * 验证token中间件
 */
function verifyToken(req, res, next) {
  try {
    // 从请求头获取token
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: '未提供认证token'
      });
    }
    
    // 提取Bearer token
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: '无效的token格式'
      });
    }
    
    // 验证token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 将解码后的信息附加到请求对象
    req.auth = decoded;
    
    console.log('[Auth Middleware] ✅ Token验证成功');
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token已过期，请重新登录'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token无效'
      });
    }
    
    console.error('[Auth Middleware] Token验证失败:', error);
    res.status(401).json({
      success: false,
      error: '认证失败'
    });
  }
}

module.exports = { verifyToken };
