/**
 * 认证中间件
 * 用于保护需要认证的路由
 * 
 * @module middleware/authenticate
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'notee-default-secret-change-this';

/**
 * 验证全局token中间件
 * 
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @param {Function} next - 下一个中间件
 */
function authenticateGlobal(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: '未授权：缺少token' 
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type !== 'global' || decoded.access !== 'granted') {
      return res.status(403).json({ 
        success: false, 
        error: '无权访问' 
      });
    }
    
    // 将用户信息附加到请求对象
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token已过期，请重新登录' 
      });
    }
    
    res.status(401).json({ 
      success: false, 
      error: 'Token无效' 
    });
  }
}

module.exports = {
  authenticateGlobal
};
