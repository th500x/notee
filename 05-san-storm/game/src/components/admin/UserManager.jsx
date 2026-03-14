/**
 * 用户管理组件
 * 
 * @description 查看和管理已注册用户的工具
 */

import React, { useState, useEffect } from 'react';
import { gameUserAPI } from '@/services/api';

// 获取当前批次信息的函数（与注册系统相同）
const getCurrentBatchInfo = () => {
  const registeredIds = JSON.parse(localStorage.getItem('registeredIds') || '[]');
  const idBatches = JSON.parse(localStorage.getItem('idBatches') || '{}');
  
  // 检查当前批次 (0-9)
  for (let batch = 0; batch <= 9; batch++) {
    if (!idBatches[batch]) {
      // 如果批次不存在，说明还没开始使用这个批次
      return {
        currentBatch: batch,
        availableIds: [],
        totalInBatch: 46656, // 36^3
        usedInBatch: 0
      };
    }
    
    // 检查这个批次是否还有可用ID
    const availableInBatch = idBatches[batch].filter(id => !registeredIds.includes(id));
    if (availableInBatch.length > 0) {
      return {
        currentBatch: batch,
        availableIds: availableInBatch,
        totalInBatch: idBatches[batch].length,
        usedInBatch: idBatches[batch].length - availableInBatch.length
      };
    }
  }
  
  // 所有批次都用完了
  return {
    currentBatch: -1,
    availableIds: [],
    totalInBatch: 46656,
    usedInBatch: 46656
  };
};

const UserManager = () => {
  const [users, setUsers] = useState([]);
  const [registeredIds, setRegisteredIds] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [batchInfo, setBatchInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 加载用户数据
  const loadUserData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // 从API获取用户列表
      const result = await gameUserAPI.getAllUsers();
      
      if (result.success) {
        setUsers(result.data);
        
        // 提取所有已注册的ID
        const ids = result.data.map(user => user.id);
        setRegisteredIds(ids);
        
        // 同步到localStorage（用于ID生成系统）
        localStorage.setItem('registeredIds', JSON.stringify(ids));
      } else {
        setError(result.error || '加载用户数据失败');
      }
      
      // 获取当前登录用户
      const current = JSON.parse(localStorage.getItem('gameUser') || 'null');
      setCurrentUser(current);
      
      // 获取批次信息
      const batch = getCurrentBatchInfo();
      setBatchInfo(batch);
      
    } catch (err) {
      setError('加载用户数据失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  // 清除所有用户数据
  const clearAllUsers = async () => {
    if (!window.confirm('⚠️ 警告：此操作将删除所有注册用户数据，且不可恢复！\n\n确定要继续吗？')) {
      return;
    }
    
    if (!window.confirm('⚠️ 最后确认：真的要删除所有用户数据吗？')) {
      return;
    }
    
    setLoading(true);
    const result = await gameUserAPI.deleteAllUsers();
    setLoading(false);
    
    if (result.success) {
      alert(`成功删除 ${result.deletedCount} 个用户`);
      // 清除localStorage
      localStorage.removeItem('registeredIds');
      localStorage.removeItem('idBatches');
      localStorage.removeItem('gameUser');
      // 重新加载数据
      loadUserData();
    } else {
      alert('清除失败：' + result.error);
    }
  };

  // 删除单个用户
  const deleteUser = async (userId) => {
    if (!window.confirm(`确定要删除用户 ${userId} 吗？\n\n此操作不可恢复！`)) {
      return;
    }
    
    setLoading(true);
    const result = await gameUserAPI.deleteUser(userId);
    setLoading(false);
    
    if (result.success) {
      alert('删除成功');
      
      // 如果删除的是当前登录用户，清除登录状态
      if (currentUser && currentUser.id === userId) {
        localStorage.removeItem('gameUser');
        setCurrentUser(null);
      }
      
      // 从localStorage中移除该ID
      const ids = JSON.parse(localStorage.getItem('registeredIds') || '[]');
      const newIds = ids.filter(id => id !== userId);
      localStorage.setItem('registeredIds', JSON.stringify(newIds));
      
      // 重新加载数据
      loadUserData();
    } else {
      alert('删除失败：' + result.error);
    }
  };

  // 封禁用户
  const banUser = async (userId) => {
    const reason = prompt('请输入封禁原因：', '违反用户协议');
    if (!reason) return;
    
    const durationStr = prompt('请输入封禁天数（0表示永久封禁）：', '7');
    const duration = parseInt(durationStr);
    
    if (isNaN(duration) || duration < 0) {
      alert('封禁天数必须是非负整数');
      return;
    }
    
    if (!window.confirm(`确定要封禁用户 ${userId} 吗？\n原因：${reason}\n时长：${duration === 0 ? '永久' : duration + '天'}`)) {
      return;
    }
    
    setLoading(true);
    const result = await gameUserAPI.banUser(userId, reason, duration === 0 ? null : duration);
    setLoading(false);
    
    if (result.success) {
      alert('封禁成功');
      loadUserData();
    } else {
      alert('封禁失败：' + result.error);
    }
  };

  // 解封用户
  const unbanUser = async (userId) => {
    if (!window.confirm(`确定要解封用户 ${userId} 吗？`)) {
      return;
    }
    
    setLoading(true);
    const result = await gameUserAPI.unbanUser(userId);
    setLoading(false);
    
    if (result.success) {
      alert('解封成功');
      loadUserData();
    } else {
      alert('解封失败：' + result.error);
    }
  };

  // 格式化时间
  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* 加载状态 */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">加载用户数据...</p>
        </div>
      )}
      
      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">❌ {error}</p>
          <button
            onClick={loadUserData}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            重试
          </button>
        </div>
      )}
      
      {!loading && !error && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">用户管理</h2>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <div className="bg-blue-50 px-3 py-1 rounded-full">
                  <span className="text-blue-600 font-medium">注册用户数: </span>
                  <span className="text-blue-900 font-bold">{users.length}</span>
                </div>
                <div className="bg-green-50 px-3 py-1 rounded-full">
                  <span className="text-green-600 font-medium">登录用户数: </span>
                  <span className="text-green-900 font-bold">{currentUser ? '1' : '0'}</span>
                </div>
              </div>
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
        </>
      )}

      {/* 批次信息详情 */}
      {!loading && !error && batchInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">📊 ID批次使用情况</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-3 border">
              <div className="text-sm text-blue-600">当前批次</div>
              <div className="font-bold text-blue-900">
                {batchInfo.currentBatch === -1 ? '全部批次已满' : `第 ${batchInfo.currentBatch} 批`}
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 border">
              <div className="text-sm text-blue-600">批次进度</div>
              <div className="font-bold text-blue-900">
                {batchInfo.usedInBatch.toLocaleString()} / {batchInfo.totalInBatch.toLocaleString()}
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 border">
              <div className="text-sm text-blue-600">使用率</div>
              <div className="font-bold text-blue-900">
                {((batchInfo.usedInBatch / batchInfo.totalInBatch) * 100).toFixed(2)}%
              </div>
            </div>
          </div>
          
          {/* 进度条 */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-blue-700 mb-1">
              <span>批次使用进度</span>
              <span>{batchInfo.availableIds.length.toLocaleString()} 个ID剩余</span>
            </div>
            <div className="bg-blue-100 rounded-full h-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${(batchInfo.usedInBatch / batchInfo.totalInBatch * 100)}%` }}
              ></div>
            </div>
          </div>
          
          {batchInfo.currentBatch === -1 && (
            <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">⚠️ 所有批次已满</p>
              <p className="text-red-700 text-sm">总计 466,560 个ID已全部分配完毕</p>
            </div>
          )}
        </div>
      )}

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
              <span className="font-medium">生日月份:</span> 
              <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                {currentUser.birthMonth || '-'}月
              </span>
            </div>
            <div>
              <span className="font-medium">账号状态:</span> 
              <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                currentUser.status === 'active' ? 'bg-green-100 text-green-800' :
                currentUser.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                'bg-red-100 text-red-800'
              }`}>
                {currentUser.status === 'active' ? '活跃' : 
                 currentUser.status === 'inactive' ? '未激活' : '封禁'}
              </span>
            </div>
            <div>
              <span className="font-medium">登录次数:</span> 
              <span className="ml-2 font-bold">{currentUser.loginCount || 1}</span> 次
            </div>
            <div>
              <span className="font-medium">地理位置:</span> 
              <span className="ml-2">
                {currentUser.province || '未知'}
                {currentUser.city && ` - ${currentUser.city}`}
              </span>
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
                    生日月份
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    账号状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    登录次数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    地理位置
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                        {user.birthMonth || '-'}月
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.status === 'active' ? 'bg-green-100 text-green-800' :
                        user.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {user.status === 'active' ? '活跃' : 
                         user.status === 'inactive' ? '未激活' : '封禁'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-medium">{user.loginCount || 1}</span> 次
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{user.province || '未知'}</div>
                        {user.city && <div className="text-xs text-gray-500">{user.city}</div>}
                      </div>
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
                      <div className="flex gap-2">
                        {user.status === 'banned' ? (
                          <button
                            onClick={() => unbanUser(user.id)}
                            className="text-green-600 hover:text-green-900 transition-colors"
                          >
                            解封
                          </button>
                        ) : (
                          <button
                            onClick={() => banUser(user.id)}
                            className="text-orange-600 hover:text-orange-900 transition-colors"
                          >
                            封禁
                          </button>
                        )}
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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