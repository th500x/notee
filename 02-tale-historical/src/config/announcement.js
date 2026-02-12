// 公告配置文件
// 你可以在这里自定义公告内容

export const announcement = {
  // 公告日期
  date: '2026/02/04',
  
  // 公告内容（支持较长文本，会自动截断显示）
  content: '欢迎来到佚事雜錄！这里记录着游戏世界的点点滴滴，每一段文字都承载着独特的记忆...',
  
  // 是否显示公告栏（true显示，false隐藏）
  enabled: true
}

// 分类配置
export const categories = [
  {
    id: 'all',
    name: '全部',
    icon: '📚'
  },
  {
    id: 'game-history',
    name: '游戏史记',
    icon: '🎮'
  },
  {
    id: 'game-text',
    name: '游戏文本',
    icon: '📖'
  },
  {
    id: 'personal',
    name: '个人私密',
    icon: '🔒'
  }
]

// 全局密码验证系统（优先使用环境变量，带尝试次数限制）
import {
  checkLockStatus,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  getLockoutMessage,
  getErrorMessage
} from '../utils/passwordAttemptLimiter';

export const GLOBAL_ADMIN_PASSWORD = process.env.REACT_APP_GLOBAL_ADMIN_PASSWORD || 'notee.vip.2026';

// 密码尝试标识符
const IDENTIFIER = 'tale_global_admin';

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
