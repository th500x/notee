/**
 * 用户管理组件
 * 
 * @description 查看和管理已注册用户的工具
 */

import React, { useState, useEffect } from 'react';

const UserManager = () => {
  const [users, setUsers] = useState([]);
  const [registeredIds, setRegisteredIds] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // 加载用户数据
  const loadUserData = () => {
    const gameUsers = JSON.parse(localStorage.getItem('gameUsers') || '[]');
    const regIds = JSON.parse(localStorage.getItem('registeredIds') || '[]');
    const current = JSON.parse(localStorage.getItem('gameUser') || 'null');
    
    setUsers(gameUsers);
    setRegisteredIds(regIds);
    setCurrentUser(current);
  };

  useEffect(() => {
    loadUserData();
  }, []);

  // 清除所有用户数据
  const clearAllUsers = () => {
    if (window.confirm('确定要清除所有用户数据吗？此操作不可恢复！')) {
      localStorage.removeItem('gameUsers');
      localStorage.removeItem('registeredIds');
      localStorage.removeItem('gameUser');
      loadUserData();
    }
  };

  // 删除单个用户
  const deleteUser = (userId) => {
    if (window.confirm(`确定要删除用户 ${userId} 吗？`)) {
      const updatedUsers = users.filter(user => user.id !== userId);
      const updatedIds = registeredIds.filter(id => id !== userId);
      
      localStorage.setItem('gameUsers', JSON.stringify(updatedUsers));
      localStorage.setItem('registeredIds', JSON.stringify(updatedIds));
      
      // 如果删除的是当前用户，也要清除当前用户缓存
      if (currentUser && currentUser.id === userId) {
        localStorage.removeItem('gameUser');
      }
      
      loadUserData();
    }
  };

  // 格式化时间
  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">用户管理</h2>
          <p className="text-gray-600">查看和管理已注册用户</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadUserData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 刷新数据
          </button>
          <button
            onClick={clearAllUsers}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            🗑️ 清除所有数据
          </button>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-900">{users.length}</div>
          <div className="text-blue-700">已注册用户</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-900">{registeredIds.length}</div>
          <div className="text-green-700">已占用ID</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-900">
            {currentUser ? '1' : '0'}
          </div>
          <div className="text-purple-700">当前登录用户</div>
        </div>
      </div>

      {/* 当前登录用户 */}
      {currentUser && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">🔑 当前登录用户</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">用户ID:</span> 
              <span className="font-mono ml-2">{currentUser.id}</span>
            </div>
            <div>
              <span className="font-medium">服务器:</span> 
              <span className="ml-2">{currentUser.serverName}</span>
            </div>
            <div>
              <span className="font-medium">注册时间:</span> 
              <span className="ml-2">{formatTime(currentUser.registeredAt)}</span>
            </div>
            <div>
              <span className="font-medium">最后登录:</span> 
              <span className="ml-2">{formatTime(currentUser.lastLoginAt)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 用户列表 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h3 className="text-lg font-semibold text-gray-900">所有注册用户</h3>
        </div>
        
        {users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            暂无注册用户
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用户ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    服务器
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    注册时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最后登录
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    机器指纹
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP地址
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user, index) => (
                  <tr key={user.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="font-mono font-bold text-lg">{user.id}</span>
                        {currentUser && currentUser.id === user.id && (
                          <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                            当前用户
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.serverName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(user.registeredAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(user.lastLoginAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {user.machineId.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.clientIP}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 已占用ID列表 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">已占用ID列表</h3>
        {registeredIds.length === 0 ? (
          <div className="text-gray-500">暂无已占用ID</div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {registeredIds.map(id => (
              <div
                key={id}
                className="px-3 py-2 bg-gray-100 rounded text-center font-mono text-sm"
              >
                {id}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 开发者工具 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🛠️ 开发者工具</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <div>
            <strong>localStorage 键值:</strong>
          </div>
          <div className="ml-4">
            • <code>gameUsers</code>: 存储所有注册用户信息
          </div>
          <div className="ml-4">
            • <code>registeredIds</code>: 存储已占用的ID列表
          </div>
          <div className="ml-4">
            • <code>gameUser</code>: 存储当前登录用户信息
          </div>
          <div className="mt-2">
            <strong>浏览器控制台查看:</strong>
          </div>
          <div className="ml-4 font-mono text-xs bg-gray-100 p-2 rounded">
            console.log(JSON.parse(localStorage.getItem('gameUsers')))
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManager;