/**
 * 全局密码验证系统
 * 
 * @description 统一管理整个网站的密码保护功能，包含尝试次数限制
 * @version 2.0.0
 * @date 2026-02-12
 */

import {
  checkLockStatus,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  getLockoutMessage,
  getErrorMessage
} from './passwordAttemptLimiter.js';

// 全局管理员密码
const GLOBAL_ADMIN_PASSWORD = 'notee.vip.2026';

// 密码尝试标识符
const IDENTIFIER = 'global_admin';

/**
 * 验证全局管理员密码（带尝试次数限制）
 * @param {string} inputPassword - 用户输入的密码
 * @returns {Object} { success: boolean, message: string }
 */
export const verifyGlobalPassword = (inputPassword) => {
  // 检查是否被锁定
  const lockStatus = checkLockStatus(IDENTIFIER);
  if (lockStatus.isLocked) {
    return {
      success: false,
      message: getLockoutMessage(lockStatus.remainingTime)
    };
  }
  
  // 验证密码
  if (inputPassword === GLOBAL_ADMIN_PASSWORD) {
    // 密码正确，清除尝试记录
    recordSuccessfulAttempt(IDENTIFIER);
    return {
      success: true,
      message: '验证成功'
    };
  }
  
  // 密码错误，记录失败尝试
  const result = recordFailedAttempt(IDENTIFIER);
  return {
    success: false,
    message: getErrorMessage(result)
  };
};

/**
 * 获取全局密码（仅用于开发调试）
 * @returns {string} 全局密码
 */
export const getGlobalPassword = () => {
  return '***';
};

/**
 * 密码保护的功能列表
 */
export const PROTECTED_FEATURES = {
  GUESTBOOK_DELETE: '留言板删除',
  TALE_GAME_TEXT: '佚事雜錄-游戏文本',
  TALE_PERSONAL: '佚事雜錄-个人私密',
  SAN_STORM_USER_MANAGEMENT: '真三风云-用户管理'
};

/**
 * 检查功能是否需要密码保护
 * @param {string} feature - 功能标识
 * @returns {boolean} 是否需要密码保护
 */
export const isFeatureProtected = (feature) => {
  return Object.keys(PROTECTED_FEATURES).includes(feature);
};

/**
 * 生成密码提示信息
 * @param {string} feature - 功能标识
 * @returns {string} 提示信息
 */
export const getPasswordPrompt = (feature) => {
  const featureName = PROTECTED_FEATURES[feature] || '该功能';
  return `请输入管理员密码以访问${featureName}`;
};

// 导出常量
export { GLOBAL_ADMIN_PASSWORD };