/**
 * 密码工具函数
 * 使用 bcrypt 进行密码加密和验证
 */

const bcrypt = require('bcrypt');

/**
 * 加密密码
 * @param {string} password - 明文密码
 * @returns {Promise<string|null>} 加密后的密码哈希
 */
async function hashPassword(password) {
  if (!password || password.trim() === '') {
    return null;
  }
  
  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    return hash;
  } catch (error) {
    console.error('[PasswordUtils] 密码加密失败:', error);
    throw new Error('密码加密失败');
  }
}

/**
 * 验证密码
 * @param {string} password - 明文密码
 * @param {string} hash - 密码哈希
 * @returns {Promise<boolean>} 是否匹配
 */
async function verifyPassword(password, hash) {
  if (!password || !hash) {
    return false;
  }
  
  try {
    // 检查是否为旧的明文密码（兼容性处理）
    if (hash === password) {
      console.log('[PasswordUtils] 检测到旧密码格式，建议升级');
      return true;
    }
    
    // bcrypt 验证
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    console.error('[PasswordUtils] 密码验证失败:', error);
    return false;
  }
}

/**
 * 检查密码是否需要升级（从明文升级到加密）
 * @param {string} hash - 当前存储的密码
 * @returns {boolean} 是否需要升级
 */
function needsUpgrade(hash) {
  if (!hash) return false;
  
  // bcrypt 哈希总是以 $2a$, $2b$, 或 $2y$ 开头
  return !hash.startsWith('$2');
}

module.exports = {
  hashPassword,
  verifyPassword,
  needsUpgrade
};
