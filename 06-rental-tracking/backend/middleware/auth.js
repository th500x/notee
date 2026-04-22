/**
 * 认证中间件
 * 验证JWT token
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'notee-default-secret-change-this';

function isDevSkipJwt() {
  return process.env.RENTAL_TRACKING_DEV_SKIP_JWT === '1';
}

/**
 * 可选解析 JWT（不写入响应）：用于公开列表接口按管理员身份附加数据
 */
function decodeTokenOptional(req) {
  if (isDevSkipJwt()) {
    return { sub: 'rental-dev-jwt-bypass', devBypass: true };
  }
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * 验证token中间件
 */
function verifyToken(req, res, next) {
  if (isDevSkipJwt()) {
    req.auth = { sub: 'rental-dev-jwt-bypass', devBypass: true };
    console.warn('[Auth] RENTAL_TRACKING_DEV_SKIP_JWT=1: JWT verification skipped (local only)');
    return next();
  }
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

module.exports = { verifyToken, decodeTokenOptional };
