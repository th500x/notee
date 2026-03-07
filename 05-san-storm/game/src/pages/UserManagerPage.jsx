/**
 * 用户管理页面（管理员专用）
 * 
 * @description 管理员查看和管理已注册用户
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import UserManager from '@/components/admin/UserManager';

function UserManagerPage() {
  const { isLoggedIn, loading, login, logout } = useAdmin();
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const isDev = import.meta.env.DEV;
  
  // 验证密码
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!passwordInput.trim()) {
      setPasswordError('请输入密码');
      return;
    }
    
    const result = await login(passwordInput);
    
    if (result.success) {
      setPasswordError('');
      setPasswordInput('');
    } else {
      setPasswordError(result.error || '登录失败');
      setPasswordInput('');
    }
  };
  
  // 如果未登录，显示登录页面
  if (!isLoggedIn) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">管理员登录</h2>
          <p className="text-gray-600 mb-6">
            请输入管理员密码以访问用户管理功能
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
                disabled={loading}
              />
              {passwordError && (
                <p className="mt-2 text-red-600 text-sm">{passwordError}</p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '登录中...' : '登录'}
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
                管理员密码通过主页（3001端口）的全局认证系统管理<br/>
                Token有效期：30天
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 已登录，显示用户管理页面
  return (
    <div>
      <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green-600">✅</span>
            <span className="text-green-800 font-medium">管理员模式</span>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            登出
          </button>
        </div>
      </div>
      
      <UserManager />
    </div>
  );
}

export default UserManagerPage;
