/**
 * 管理员状态Hook
 * 
 * @description 管理管理员权限检查和状态更新
 */

import { useState, useEffect } from 'react';
import { hasAdminAccess } from '@/utils/adminAuth';

/**
 * 使用管理员状态
 * @param {number} checkInterval - 检查间隔（毫秒），默认5000ms
 * @returns {boolean} 是否为管理员用户
 */
export function useAdminStatus(checkInterval = 5000) {
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const checkAdminStatus = () => {
      setIsAdminUser(hasAdminAccess());
    };
    
    // 初始检查
    checkAdminStatus();
    
    // 监听localStorage变化（用户登录/退出时更新权限）
    const handleStorageChange = () => {
      checkAdminStatus();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // 定期检查权限状态（防止localStorage在同一标签页中变化）
    const interval = setInterval(checkAdminStatus, checkInterval);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [checkInterval]);

  return isAdminUser;
}
