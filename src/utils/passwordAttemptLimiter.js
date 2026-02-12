/**
 * 密码尝试限制工具
 * 
 * @description 统一管理密码尝试次数限制，防止暴力破解
 * @module utils/passwordAttemptLimiter
 * 
 * 使用场景：
 * - 02页面：上锁分类登录、删除留言
 * - 05页面：用户管理登录、玩家游戏登录
 * - 其他需要密码验证的场景
 * 
 * 限制规则：
 * - 短期内最多尝试5次
 * - 超过5次后锁定10分钟
 * - 10分钟后自动解锁
 */

// 配置常量
const MAX_ATTEMPTS = 5;           // 最大尝试次数
const LOCKOUT_DURATION = 10 * 60 * 1000;  // 锁定时长（10分钟，单位：毫秒）
const STORAGE_KEY_PREFIX = 'pwd_attempt_';  // localStorage键前缀

/**
 * 获取尝试记录
 * @param {string} identifier - 标识符（如：'global_admin', 'game_login', 'delete_message'）
 * @returns {Object} 尝试记录
 */
function getAttemptRecord(identifier) {
  const key = STORAGE_KEY_PREFIX + identifier;
  const record = localStorage.getItem(key);
  
  if (!record) {
    return {
      attempts: 0,
      lockedUntil: null
    };
  }
  
  try {
    return JSON.parse(record);
  } catch (e) {
    return {
      attempts: 0,
      lockedUntil: null
    };
  }
}

/**
 * 保存尝试记录
 * @param {string} identifier - 标识符
 * @param {Object} record - 尝试记录
 */
function saveAttemptRecord(identifier, record) {
  const key = STORAGE_KEY_PREFIX + identifier;
  localStorage.setItem(key, JSON.stringify(record));
}

/**
 * 检查是否被锁定
 * @param {string} identifier - 标识符
 * @returns {Object} { isLocked: boolean, remainingTime: number }
 */
export function checkLockStatus(identifier) {
  const record = getAttemptRecord(identifier);
  
  if (!record.lockedUntil) {
    return { isLocked: false, remainingTime: 0 };
  }
  
  const now = Date.now();
  const remainingTime = record.lockedUntil - now;
  
  // 如果锁定时间已过，自动解锁
  if (remainingTime <= 0) {
    saveAttemptRecord(identifier, {
      attempts: 0,
      lockedUntil: null
    });
    return { isLocked: false, remainingTime: 0 };
  }
  
  return { isLocked: true, remainingTime };
}

/**
 * 记录失败尝试
 * @param {string} identifier - 标识符
 * @returns {Object} { isLocked: boolean, remainingAttempts: number, remainingTime: number }
 */
export function recordFailedAttempt(identifier) {
  const record = getAttemptRecord(identifier);
  
  // 增加尝试次数
  record.attempts += 1;
  
  // 检查是否达到最大尝试次数
  if (record.attempts >= MAX_ATTEMPTS) {
    // 锁定账号
    record.lockedUntil = Date.now() + LOCKOUT_DURATION;
    saveAttemptRecord(identifier, record);
    
    return {
      isLocked: true,
      remainingAttempts: 0,
      remainingTime: LOCKOUT_DURATION
    };
  }
  
  // 未达到最大次数，保存记录
  saveAttemptRecord(identifier, record);
  
  return {
    isLocked: false,
    remainingAttempts: MAX_ATTEMPTS - record.attempts,
    remainingTime: 0
  };
}

/**
 * 记录成功尝试（清除记录）
 * @param {string} identifier - 标识符
 */
export function recordSuccessfulAttempt(identifier) {
  saveAttemptRecord(identifier, {
    attempts: 0,
    lockedUntil: null
  });
}

/**
 * 格式化剩余时间
 * @param {number} milliseconds - 毫秒数
 * @returns {string} 格式化的时间字符串
 */
export function formatRemainingTime(milliseconds) {
  const minutes = Math.ceil(milliseconds / 60000);
  return `${minutes}分钟`;
}

/**
 * 获取错误提示信息
 * @param {Object} result - recordFailedAttempt 的返回结果
 * @returns {string} 错误提示信息
 */
export function getErrorMessage(result) {
  if (result.isLocked) {
    const timeStr = formatRemainingTime(result.remainingTime);
    return `密码错误次数过多，请${timeStr}后重试`;
  }
  
  return `密码错误，还可以尝试 ${result.remainingAttempts} 次`;
}

/**
 * 获取锁定提示信息
 * @param {number} remainingTime - 剩余锁定时间（毫秒）
 * @returns {string} 锁定提示信息
 */
export function getLockoutMessage(remainingTime) {
  const timeStr = formatRemainingTime(remainingTime);
  return `密码错误次数过多，请${timeStr}后重试`;
}

/**
 * 重置尝试记录（管理员功能）
 * @param {string} identifier - 标识符
 */
export function resetAttemptRecord(identifier) {
  const key = STORAGE_KEY_PREFIX + identifier;
  localStorage.removeItem(key);
}

/**
 * 获取所有尝试记录（调试用）
 * @returns {Object} 所有尝试记录
 */
export function getAllAttemptRecords() {
  const records = {};
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(STORAGE_KEY_PREFIX)) {
      const identifier = key.replace(STORAGE_KEY_PREFIX, '');
      records[identifier] = getAttemptRecord(identifier);
    }
  }
  
  return records;
}

// 导出配置常量（供外部使用）
export const PASSWORD_ATTEMPT_CONFIG = {
  MAX_ATTEMPTS,
  LOCKOUT_DURATION,
  LOCKOUT_DURATION_MINUTES: LOCKOUT_DURATION / 60000
};
