/**
 * 管理员权限验证工具
 * 
 * @description 基于机器指纹的管理员身份验证和权限控制
 */

// 管理员机器指纹列表（生产环境使用）
const ADMIN_FINGERPRINTS = [
  'a9wfd5',  // 你的机器指纹
  // 'backup_admin_fingerprint',  // 可以添加更多管理员机器指纹
];

// 获取机器指纹（与注册系统相同的算法）
const getMachineFingerprint = () => {
  try {
    // 只使用最稳定的特征
    const fingerprint = [
      navigator.language,                    // 浏览器语言（稳定）
      screen.colorDepth,                     // 色深（稳定）
      screen.width + 'x' + screen.height,    // 屏幕分辨率（较稳定）
      new Date().getTimezoneOffset(),        // 时区（稳定）
      navigator.hardwareConcurrency || 0,    // CPU核心数（稳定）
      // 注意：不使用 userAgent（浏览器升级会变）
      // 注意：不使用 Canvas（重启后可能变化）
      // 注意：不使用 platform（已弃用的API）
    ].join('|');
    
    // 简单hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  } catch (error) {
    console.error('获取机器指纹失败:', error);
    return 'unknown';
  }
};

/**
 * 检查是否为开发环境
 * @returns {boolean} 是否为开发环境
 */
export const isDevelopment = () => {
  // 只有在本地开发时才返回true
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' ||
         window.location.hostname === '192.168.1.1' ||  // 本地IP
         window.location.port === '5173' ||  // Vite开发服务器端口
         window.location.port === '3000';    // 常见开发端口
};

/**
 * 检查当前机器是否为管理员机器
 * @returns {boolean} 是否为管理员机器
 */
export const isAdminMachine = () => {
  try {
    const currentFingerprint = getMachineFingerprint();
    return ADMIN_FINGERPRINTS.includes(currentFingerprint);
  } catch (error) {
    console.error('管理员权限检查失败:', error);
    return false;
  }
};

/**
 * 管理员权限检查（包含开发环境）
 * @returns {boolean} 是否有管理员权限
 */
export const hasAdminAccess = () => {
  // 开发环境下总是允许访问（方便开发调试）
  if (isDevelopment()) {
    return true;
  }
  
  // 生产环境下检查机器指纹
  return isAdminMachine();
};

/**
 * 获取当前机器指纹（用于配置）
 * @returns {string} 当前机器指纹
 */
export const getCurrentFingerprint = () => {
  return getMachineFingerprint();
};

/**
 * 获取管理员配置信息
 * @returns {object} 管理员配置
 */
export const getAdminConfig = () => {
  const currentFingerprint = getCurrentFingerprint();
  return {
    adminFingerprints: ADMIN_FINGERPRINTS,
    currentFingerprint: currentFingerprint,
    isDev: isDevelopment(),
    hasAccess: hasAdminAccess(),
    isAdminMachine: isAdminMachine()
  };
};