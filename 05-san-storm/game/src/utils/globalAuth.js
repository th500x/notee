/**
 * 全局密码验证系统
 * 
 * @description 统一管理整个网站的密码保护功能，包含尝试次数限制
 * @version 2.1.0
 * @date 2026-03-04
 */

import { authConfig } from '@/config';
import {
  checkLockStatus,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  getLockoutMessage,
  getErrorMessage
} from './passwordAttemptLimiter';

// 全局管理员密码（从配置读取）
const GLOBAL_ADMIN_PASSWORD = authConfig.globalAdminPassword;

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

// 导出常量
export { GLOBAL_ADMIN_PASSWORD };
