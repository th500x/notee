/**
 * 全局密码验证系统
 * 
 * @description 统一管理整个网站的密码保护功能
 * @version 1.0.0
 * @date 2026-02-12
 */

// 全局管理员密码（优先使用环境变量）
const GLOBAL_ADMIN_PASSWORD = process.env.GLOBAL_ADMIN_PASSWORD || 'notee.vip.2026';

/**
 * 验证全局管理员密码
 * @param {string} inputPassword - 用户输入的密码
 * @returns {boolean} 密码是否正确
 */
export const verifyGlobalPassword = (inputPassword) => {
  return inputPassword === GLOBAL_ADMIN_PASSWORD;
};

/**
 * 获取全局密码（仅用于开发调试）
 * @returns {string} 全局密码
 */
export const getGlobalPassword = () => {
  if (process.env.NODE_ENV === 'development') {
    return GLOBAL_ADMIN_PASSWORD;
  }
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