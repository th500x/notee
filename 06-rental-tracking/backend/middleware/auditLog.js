/**
 * 操作审计日志中间件
 * 
 * @description 记录所有CRUD操作，便于追踪和回滚
 * @module backend/middleware/auditLog
 */

const fs = require('fs');
const path = require('path');

// 日志文件路径
const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'audit.log');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * 写入审计日志
 * @param {Object} logEntry - 日志条目
 */
function writeLog(logEntry) {
  const logLine = JSON.stringify(logEntry) + '\n';
  
  try {
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
  } catch (error) {
    console.error('❌ 写入审计日志失败:', error);
  }
}

/**
 * 审计日志中间件
 * 记录所有修改操作（POST, PUT, DELETE）
 */
function auditLog(req, res, next) {
  // 只记录修改操作
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return next();
  }

  // 保存原始的res.json方法
  const originalJson = res.json.bind(res);

  // 重写res.json方法
  res.json = function(data) {
    // 记录审计日志
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      body: sanitizeBody(req.body), // 移除敏感信息
      response: {
        success: data.success,
        error: data.error
      },
      statusCode: res.statusCode
    };

    writeLog(logEntry);

    // 调用原始的res.json方法
    return originalJson(data);
  };

  next();
}

/**
 * 清理请求体中的敏感信息
 * @param {Object} body - 请求体
 * @returns {Object} 清理后的请求体
 */
function sanitizeBody(body) {
  if (!body) return {};

  const sanitized = { ...body };

  // 移除密码字段
  if (sanitized.password) {
    sanitized.password = '***';
  }
  if (sanitized.adminPassword) {
    sanitized.adminPassword = '***';
  }
  if (sanitized.projectPassword) {
    sanitized.projectPassword = '***';
  }

  // 移除照片数据（太大）
  if (sanitized.project && sanitized.project.properties) {
    sanitized.project.properties = sanitized.project.properties.map(prop => ({
      ...prop,
      records: prop.records ? prop.records.map(record => ({
        ...record,
        photos: record.photos ? `[${record.photos.length} photos]` : undefined
      })) : undefined
    }));
  }

  return sanitized;
}

/**
 * 读取审计日志
 * @param {number} limit - 返回的日志条数
 * @returns {Array} 日志数组
 */
function readLogs(limit = 100) {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return [];
    }

    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    // 返回最新的N条日志
    const logs = lines
      .slice(-limit)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse(); // 最新的在前面

    return logs;
  } catch (error) {
    console.error('❌ 读取审计日志失败:', error);
    return [];
  }
}

/**
 * 清理旧日志（保留最近30天）
 */
function cleanOldLogs() {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return;
    }

    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 过滤出最近30天的日志
    const recentLogs = lines.filter(line => {
      try {
        const log = JSON.parse(line);
        const logDate = new Date(log.timestamp);
        return logDate >= thirtyDaysAgo;
      } catch {
        return false;
      }
    });

    // 重写日志文件
    fs.writeFileSync(LOG_FILE, recentLogs.join('\n') + '\n', 'utf8');
    console.log(`✅ 清理审计日志完成，保留 ${recentLogs.length} 条记录`);
  } catch (error) {
    console.error('❌ 清理审计日志失败:', error);
  }
}

// 每天凌晨2点清理旧日志
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 2 && now.getMinutes() === 0) {
    cleanOldLogs();
  }
}, 60 * 1000); // 每分钟检查一次

module.exports = {
  auditLog,
  readLogs,
  cleanOldLogs
};
