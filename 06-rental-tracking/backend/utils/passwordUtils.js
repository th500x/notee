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
    // bcrypt 验证
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    console.error('[PasswordUtils] 密码验证失败:', error);
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword
};
