/**
 * 用户管理页面（管理员专用）
 * 
 * @description 管理员查看和管理已注册用户
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { hasAdminAccess } from '@/utils/adminAuth';
import AdminSetup from '@/components/admin/AdminSetup';
import UserManager from '@/components/admin/UserManager';

function UserManagerPage() {
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const adminAccess = hasAdminAccess();
  const isDev = process.env.NODE_ENV === 'development';
  
  // 验证密码（带尝试次数限制）
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const { verifyGlobalPassword } = await import('@/utils/globalAuth');
      const result = verifyGlobalPassword(passwordInput);
      
      if (result.success) {
        setPasswordVerified(true);
        setPasswordError('');
      } else {
        setPasswordError(result.message);
        setPasswordInput('');
      }
    } catch (error) {
      setPasswordError('验证失败，请重试');
      setPasswordInput('');
    }
  };
  
  // 如果没有管理员权限（机器指纹验证失败），显示无权限页面
  if (!adminAccess) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">访问被拒绝</h2>
          <p className="text-gray-600 mb-6">
            此页面仅限管理员访问。您的机器未被授权。
          </p>
          <Link 
            to="/" 
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  // 如果机器指纹验证通过，但密码未验证，显示密码输入页面
  if (!passwordVerified) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">管理员密码验证</h2>
          <p className="text-gray-600 mb-6">
            请输入全局管理员密码以访问用户管理功能
          </p>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="请输入管理员密码"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {passwordError && (
                <p className="mt-2 text-red-600 text-sm">{passwordError}</p>
              )}
            </div>
            
            <button
              type="submit"
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              验证密码
            </button>
            
            <Link 
              to="/" 
              className="block text-gray-600 hover:text-gray-900 text-sm"
            >
              返回首页
            </Link>
          </form>
          
          {isDev && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
              <p className="text-xs text-yellow-800">
                <strong>开发提示：</strong><br/>
                全局管理员密码：notee.vip.2026<br/>
                尝试限制：5次/10分钟
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 密码验证通过，显示用户管理页面
  return (
    <div>
      <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <span className="text-green-600">✅</span>
          <span className="text-green-800 font-medium">管理员模式</span>
          <span className="text-green-600 text-sm">
            - 机器指纹已验证 | 密码已验证
          </span>
        </div>
      </div>
      
      <AdminSetup />
      <UserManager />
    </div>
  );
}

export default UserManagerPage;
