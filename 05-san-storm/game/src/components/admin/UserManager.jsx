/**
 * 用户管理组件
 * 
 * @description 查看和管理已注册用户的工具
 * 右上角：刷新 / 一键清除（清除所有玩家数据） / 一键删除（删除所有banned账号）
 * 每行：封禁/解封、清除、删除
 */

import { useState, useEffect } from 'react';
import { gameUserAPI } from '@/services/api';

// 获取当前批次信息的函数（与注册系统相同）
const getCurrentBatchInfo = () => {
  const registeredIds = JSON.parse(localStorage.getItem('registeredIds') || '[]');
  const idBatches = JSON.parse(localStorage.getItem('idBatches') || '{}');
  
  for (let batch = 0; batch <= 9; batch++) {
    if (!idBatches[batch]) {
      return {
        currentBatch: batch,
        availableIds: [],
        totalInBatch: 46656,
        usedInBatch: 0
      };
    }
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
  
  return {
    currentBatch: -1,
    availableIds: [],
    totalInBatch: 46656,
    usedInBatch: 46656
  };
};

const UserManager = () => {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [batchInfo, setBatchInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // 2步确认弹窗状态
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'purge'|'deleteBanned', step: 1|2 }

  // 统计数据
  const totalCount = users.length;
  const activeCount = users.filter(u => u.status === 'active').length;
  const bannedCount = users.filter(u => u.status === 'banned').length;

  // 加载用户数据
  const loadUserData = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await gameUserAPI.getAllUsers();
      if (result.success) {
        setUsers(result.data);
        // 同步已注册ID到localStorage（用于ID生成系统）
        const ids = result.data.map(user => user.id);
        localStorage.setItem('registeredIds', JSON.stringify(ids));
      } else {
        setError(result.error || '加载用户数据失败');
      }
      // 获取当前登录用户
      const current = JSON.parse(localStorage.getItem('gameUser') || 'null');
      setCurrentUser(current);
      // 获取批次信息
      setBatchInfo(getCurrentBatchInfo());
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

  // ========== 2步确认弹窗逻辑 ==========

  const openConfirmModal = (type) => {
    setConfirmModal({ type, step: 1 });
  };

  const handleConfirmStep = async () => {
    if (!confirmModal) return;

    if (confirmModal.step === 1) {
      // 第一步 → 进入第二步
      setConfirmModal({ ...confirmModal, step: 2 });
      return;
    }

    // 第二步 → 执行操作
    setLoading(true);
    setConfirmModal(null);

    try {
      if (confirmModal.type === 'purge') {
        const result = await gameUserAPI.purgeAllUsers();
        if (result.success) {
          alert('所有用户的玩家数据已清除');
          loadUserData();
        } else {
          alert('操作失败：' + result.error);
        }
      } else if (confirmModal.type === 'deleteBanned') {
        const result = await gameUserAPI.deleteBannedUsers();
        if (result.success) {
          alert(`成功删除 ${result.deletedCount} 个封禁账号`);
          // 检查当前登录用户是否在被删除的范围内（banned状态的都被删了）
          const current = JSON.parse(localStorage.getItem('gameUser') || 'null');
          if (current) {
            // 删除后重新查询，如果当前用户已不存在则清除本地登录状态
            const checkResult = await gameUserAPI.getAllUsers();
            if (checkResult.success) {
              const stillExists = checkResult.data.some(u => u.id === current.id);
              if (!stillExists) {
                localStorage.removeItem('gameUser');
                setCurrentUser(null);
              }
            }
          }
          loadUserData();
        } else {
          alert('操作失败：' + result.error);
        }
      }
    } catch (err) {
      alert('操作失败，请重试');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ========== 单用户操作 ==========

  const deleteUser = async (userId) => {
    if (!window.confirm(`确定要删除用户 ${userId} 吗？\n\n此操作不可恢复！`)) return;
    setLoading(true);
    const result = await gameUserAPI.deleteUser(userId);
    setLoading(false);
    if (result.success) {
      alert('删除成功');
      // 如果删除的是当前登录用户，清除登录状态
      const current = JSON.parse(localStorage.getItem('gameUser') || 'null');
      if (current && current.id === userId) {
        localStorage.removeItem('gameUser');
        setCurrentUser(null);
      }
      loadUserData();
    } else {
      alert('删除失败：' + result.error);
    }
  };

  const clearUserData = async (userId) => {
    if (!window.confirm(`确定要清除用户 ${userId} 的游戏数据吗？\n\n将删除角色、卡牌、进度等数据，但保留账号。`)) return;
    setLoading(true);
    const result = await gameUserAPI.clearUserData(userId);
    setLoading(false);
    if (result.success) {
      alert('游戏数据已清除');
      loadUserData();
    } else {
      alert('清除失败：' + result.error);
    }
  };

  const banUser = async (userId) => {
    const reason = prompt('请输入封禁原因：', '违反用户协议');
    if (!reason) return;
    const durationStr = prompt('请输入封禁天数（0表示永久封禁）：', '7');
    const duration = parseInt(durationStr);
    if (isNaN(duration) || duration < 0) {
      alert('封禁天数必须是非负整数');
      return;
    }
    if (!window.confirm(`确定要封禁用户 ${userId} 吗？\n原因：${reason}\n时长：${duration === 0 ? '永久' : duration + '天'}`)) return;
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

  const unbanUser = async (userId) => {
    if (!window.confirm(`确定要解封用户 ${userId} 吗？`)) return;
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

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleString('zh-CN');
  };

  // ========== 确认弹窗配置 ==========
  const modalConfig = {
    purge: {
      title: '一键清除 - 清除所有玩家数据',
      icon: '🧹',
      step1Warning: '此操作将清除所有用户的玩家数据（角色、卡牌、进度、装备等），但保留账号。世界级别数据中的玩家引用将显示为"未知玩家"。',
      step2Warning: '最后确认：确定要清除所有用户的玩家数据吗？此操作不可撤销！',
      step1Btn: '我已了解，继续清除（1/2）',
      step2Btn: '确认清除所有玩家数据（2/2）',
    },
    deleteBanned: {
      title: '一键删除 - 删除所有封禁账号',
      icon: '🗑️',
      step1Warning: `此操作将永久删除所有封禁状态的账号（共 ${bannedCount} 个），包括账号信息和所有关联数据。`,
      step2Warning: `最后确认：确定要永久删除 ${bannedCount} 个封禁账号吗？此操作不可撤销！`,
      step1Btn: '我已了解，继续删除（1/2）',
      step2Btn: `确认删除 ${bannedCount} 个封禁账号（2/2）`,
    },
  };

  return (
    <div className="space-y-6">
      {/* 加载状态 */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
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
          {/* 顶部：标题 + 统计 + 按钮 */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">用户管理</h2>
              <div className="flex items-center gap-3 mt-2 text-sm">
                <span className="bg-blue-50 px-3 py-1 rounded-full">
                  <span className="text-blue-600">总计: </span>
                  <span className="text-blue-900 font-bold">{totalCount}</span>
                </span>
                <span className="bg-green-50 px-3 py-1 rounded-full">
                  <span className="text-green-600">活跃: </span>
                  <span className="text-green-900 font-bold">{activeCount}</span>
                </span>
                <span className="bg-red-50 px-3 py-1 rounded-full">
                  <span className="text-red-600">封禁: </span>
                  <span className="text-red-900 font-bold">{bannedCount}</span>
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadUserData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔄 刷新
              </button>
              <button
                onClick={() => openConfirmModal('purge')}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                🧹 一键清除
              </button>
              <button
                onClick={() => openConfirmModal('deleteBanned')}
                disabled={bannedCount === 0}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  bannedCount === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                🗑️ 一键删除
              </button>
            </div>
          </div>

          {/* 批次信息详情 */}
          {batchInfo && (
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
                    currentUser.status === 'banned' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {currentUser.status === 'active' ? '活跃' : 
                     currentUser.status === 'banned' ? '封禁' : currentUser.status}
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
              <div className="p-8 text-center text-gray-500">暂无注册用户</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">服务器</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">生日月份</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">账号状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">登录次数</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">机器指纹</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user, index) => (
                      <tr key={user.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-lg">{user.id}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.serverName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                            {user.birthMonth || '-'}月
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.status === 'active' ? 'bg-green-100 text-green-800' :
                            user.status === 'banned' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {user.status === 'active' ? '活跃' : user.status === 'banned' ? '封禁' : user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-medium">{user.loginCount || 1}</span> 次
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {user.machineId ? user.machineId.substring(0, 8) + '...' : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            {user.status === 'banned' ? (
                              <button onClick={() => unbanUser(user.id)} className="text-green-600 hover:text-green-900 transition-colors">解封</button>
                            ) : (
                              <button onClick={() => banUser(user.id)} className="text-orange-600 hover:text-orange-900 transition-colors">封禁</button>
                            )}
                            <button onClick={() => clearUserData(user.id)} className="text-purple-600 hover:text-purple-900 transition-colors">清除</button>
                            <button onClick={() => deleteUser(user.id)} className="text-red-600 hover:text-red-900 transition-colors">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* 2步确认弹窗 */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">{modalConfig[confirmModal.type].icon}</div>
              <h3 className="text-xl font-bold text-gray-900">{modalConfig[confirmModal.type].title}</h3>
            </div>

            <div className={`border-2 rounded-lg p-4 mb-6 ${
              confirmModal.step === 1
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-red-50 border-red-300'
            }`}>
              <p className={`font-medium ${
                confirmModal.step === 1 ? 'text-yellow-900' : 'text-red-900'
              }`}>
                {confirmModal.step === 1
                  ? modalConfig[confirmModal.type].step1Warning
                  : modalConfig[confirmModal.type].step2Warning
                }
              </p>
            </div>

            {confirmModal.step === 1 && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4">
                <p className="text-yellow-900 text-sm text-center">⚠️ 此操作不可撤销！请仔细考虑后再继续</p>
              </div>
            )}

            {confirmModal.step === 2 && (
              <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-3 mb-4 animate-pulse">
                <p className="text-orange-900 font-bold text-center">🚨 这是最后一步确认！</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleConfirmStep}
                className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
                  confirmModal.step === 1
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                }`}
              >
                {confirmModal.step === 1
                  ? `⚠️ ${modalConfig[confirmModal.type].step1Btn}`
                  : `🚨 ${modalConfig[confirmModal.type].step2Btn}`
                }
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                className="w-full py-3 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManager;
