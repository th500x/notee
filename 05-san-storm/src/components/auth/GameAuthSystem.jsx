/**
 * 游戏注册登录系统组件
 * 
 * @description M2验证模块-2 - 简化注册登录系统（带密码尝试限制）
 */

import { useState, useEffect } from 'react';
import { useServers } from '@/hooks/useServers';
import { ServerCard } from '@/components/server/ServerCard';
import {
  checkLockStatus,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  getLockoutMessage,
  getErrorMessage
} from '@/utils/passwordAttemptLimiter';

// 新的分批次ID生成系统
const generateBatchIds = (batchNumber) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const ids = [];
  const prefix = batchNumber.toString(); // 0, 1, 2, ..., 9
  
  // 生成所有可能的3位组合 (36^3 = 46,656个)
  for (let i = 0; i < chars.length; i++) {
    for (let j = 0; j < chars.length; j++) {
      for (let k = 0; k < chars.length; k++) {
        const id = prefix + chars[i] + chars[j] + chars[k];
        ids.push(id);
      }
    }
  }
  
  // 打乱顺序
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  
  return ids;
};

// 验证ID格式
const validateIdFormat = (id) => {
  if (!id || id.length !== 4) return false;
  
  const firstChar = id[0];
  const restChars = id.slice(1);
  
  // 首位必须是0-9
  if (!/^[0-9]$/.test(firstChar)) return false;
  
  // 后三位必须是A-Z或0-9
  if (!/^[A-Z0-9]{3}$/.test(restChars)) return false;
  
  return true;
};

// 获取当前批次和可用ID
const getCurrentBatchInfo = () => {
  const registeredIds = JSON.parse(localStorage.getItem('registeredIds') || '[]');
  const idBatches = JSON.parse(localStorage.getItem('idBatches') || '{}');
  
  // 检查当前批次 (0-9)
  for (let batch = 0; batch <= 9; batch++) {
    if (!idBatches[batch]) {
      // 生成新批次
      const batchIds = generateBatchIds(batch);
      idBatches[batch] = batchIds;
      localStorage.setItem('idBatches', JSON.stringify(idBatches));
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
    totalInBatch: 0,
    usedInBatch: 0
  };
};

// 获取机器指纹（简化版）
const getMachineFingerprint = () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('Machine fingerprint', 2, 2);
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL()
  ].join('|');
  
  // 简单hash
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

// 获取IP地址（模拟）
const getClientIP = async () => {
  try {
    // 实际项目中应该通过后端API获取
    return '192.168.1.100'; // 模拟IP
  } catch (error) {
    return 'unknown';
  }
};

const GameAuthSystem = () => {
  const { servers, loading: serversLoading } = useServers();
  const [currentStep, setCurrentStep] = useState('serverSelect'); // serverSelect, authChoice, register, login, game
  const [selectedServer, setSelectedServer] = useState(null);
  const [availableIds, setAvailableIds] = useState([]);
  const [batchInfo, setBatchInfo] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 检查用户是否已登录
  useEffect(() => {
    const savedUser = localStorage.getItem('gameUser');
    if (savedUser) {
      setCurrentStep('game');
    }
  }, []);

  // 生成可用ID列表
  const generateIdOptions = () => {
    const batchInfo = getCurrentBatchInfo();
    
    if (batchInfo.availableIds.length === 0) {
      return { ids: [], batchInfo }; // 所有ID都用完了
    }
    
    // 随机返回5个可用ID
    const shuffled = [...batchInfo.availableIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return { 
      ids: shuffled.slice(0, 5),
      batchInfo
    };
  };

  // 选择服务器
  const handleServerSelect = (server) => {
    setSelectedServer(server);
    setCurrentStep('authChoice');
  };

  // 开始注册流程
  const handleStartRegister = () => {
    const result = generateIdOptions();
    setAvailableIds(result.ids);
    setBatchInfo(result.batchInfo);
    setCurrentStep('register');
    setError('');
  };

  // 选择ID
  const handleIdSelect = (id) => {
    setSelectedId(id);
  };

  // 注册提交
  const handleRegisterSubmit = async () => {
    if (!selectedId) {
      setError('请选择一个ID');
      return;
    }
    
    if (!password) {
      setError('请输入密码');
      return;
    }
    
    if (password.length < 6) {
      setError('密码至少需要6位');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    
    try {
      // 获取机器指纹和IP
      const machineId = getMachineFingerprint();
      const clientIP = await getClientIP();
      
      // 检查是否已经注册过
      const existingUsers = JSON.parse(localStorage.getItem('gameUsers') || '[]');
      const duplicateUser = existingUsers.find(user => 
        user.machineId === machineId || user.clientIP === clientIP
      );
      
      if (duplicateUser) {
        setError('检测到重复注册，每个设备只能注册一个账号');
        setLoading(false);
        return;
      }

      // 创建新用户
      const newUser = {
        id: selectedId,
        password: password, // 实际项目中应该加密
        serverId: selectedServer.id,
        serverName: selectedServer.name,
        machineId: machineId,
        clientIP: clientIP,
        registeredAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      // 保存到localStorage（模拟数据库）
      const users = [...existingUsers, newUser];
      localStorage.setItem('gameUsers', JSON.stringify(users));
      
      // 更新已注册ID列表
      const registeredIds = JSON.parse(localStorage.getItem('registeredIds') || '[]');
      registeredIds.push(selectedId);
      localStorage.setItem('registeredIds', JSON.stringify(registeredIds));
      
      // 保存当前用户
      localStorage.setItem('gameUser', JSON.stringify(newUser));
      
      setCurrentStep('game');
      setError('');
    } catch (error) {
      setError('注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 登录提交（带密码尝试限制）
  const handleLoginSubmit = async () => {
    if (!loginId || !loginPassword) {
      setError('请输入ID和密码');
      return;
    }

    // 验证ID格式
    if (!validateIdFormat(loginId)) {
      setError('ID格式错误：应为4位字符，首位为数字0-9，后三位为字母A-Z或数字0-9');
      return;
    }

    // 检查是否被锁定
    const identifier = `game_login_${loginId}`;
    const lockStatus = checkLockStatus(identifier);
    if (lockStatus.isLocked) {
      setError(getLockoutMessage(lockStatus.remainingTime));
      return;
    }

    setLoading(true);
    
    try {
      const users = JSON.parse(localStorage.getItem('gameUsers') || '[]');
      const user = users.find(u => u.id === loginId && u.password === loginPassword);
      
      if (!user) {
        // 密码错误，记录失败尝试
        const result = recordFailedAttempt(identifier);
        setError(getErrorMessage(result));
        setLoading(false);
        return;
      }

      // 登录成功，清除尝试记录
      recordSuccessfulAttempt(identifier);

      // 更新最后登录时间
      user.lastLoginAt = new Date().toISOString();
      const updatedUsers = users.map(u => u.id === user.id ? user : u);
      localStorage.setItem('gameUsers', JSON.stringify(updatedUsers));
      localStorage.setItem('gameUser', JSON.stringify(user));
      
      setCurrentStep('game');
      setError('');
    } catch (error) {
      setError('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('gameUser');
    setCurrentStep('serverSelect');
    setSelectedServer(null);
    setError('');
  };

  // 返回上一步
  const handleBack = () => {
    if (currentStep === 'authChoice') {
      setCurrentStep('serverSelect');
      setSelectedServer(null);
    } else if (currentStep === 'register' || currentStep === 'login') {
      setCurrentStep('authChoice');
    }
    setError('');
  };

  if (serversLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">加载服务器列表...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 服务器选择 */}
      {currentStep === 'serverSelect' && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">选择服务器</h2>
          <p className="text-gray-600 mb-6">请选择一个服务器开始游戏</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
            {servers.map(server => (
              <ServerCard 
                key={server.id} 
                server={server}
                onSelect={handleServerSelect}
              />
            ))}
          </div>
        </div>
      )}

      {/* 注册/登录选择 */}
      {currentStep === 'authChoice' && (
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
              欢迎来到 {selectedServer?.name}
            </h2>
            <p className="text-gray-600 mb-6 text-center">请选择注册或登录</p>
            
            <div className="space-y-4">
              <button
                onClick={handleStartRegister}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                🆕 新用户注册
              </button>
              
              <button
                onClick={() => setCurrentStep('login')}
                className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                🔑 已有账号登录
              </button>
            </div>
            
            <button
              onClick={handleBack}
              className="w-full mt-4 py-2 px-4 text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← 返回服务器选择
            </button>
          </div>
        </div>
      )}

      {/* 注册页面 */}
      {currentStep === 'register' && (
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">注册新账号</h2>
            

            
            {!selectedId ? (
              <div>
                {availableIds.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">😱</div>
                    <h3 className="text-lg font-bold text-red-900 mb-2">所有ID已用完！</h3>
                    <p className="text-red-700 text-sm mb-4">
                      所有10批次的ID都已被注册完毕<br/>
                      (总计 466,560 个ID)
                    </p>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-bold text-red-800 mb-2">批次使用情况:</h4>
                      <div className="text-xs text-red-700 space-y-1">
                        {Array.from({length: 10}, (_, i) => (
                          <div key={i} className="flex justify-between">
                            <span>批次 {i}: {i}XXX</span>
                            <span className="font-mono">46,656 / 46,656 (100%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-600 mb-4">请选择你的游戏ID：</p>
                    <div className="space-y-2 mb-6">
                      {availableIds.map(id => (
                        <button
                          key={id}
                          onClick={() => handleIdSelect(id)}
                          className="w-full py-3 px-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left font-mono text-lg"
                        >
                          <span className="text-blue-600 font-bold">{id[0]}</span>
                          <span className="text-gray-800">{id.slice(1)}</span>
                        </button>
                      ))}
                    </div>
                    
                    <button
                      onClick={handleStartRegister}
                      className="w-full py-2 px-4 text-blue-600 hover:text-blue-800 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors text-sm"
                    >
                      🔄 刷新ID选项
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">已选择ID：</p>
                  <p className="text-xl font-mono font-bold text-blue-900">{selectedId}</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      设置密码（至少6位）
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="请输入密码"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      确认密码
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="请再次输入密码"
                    />
                  </div>
                  
                  {error && (
                    <div className="text-red-600 text-sm">{error}</div>
                  )}
                  
                  <button
                    onClick={handleRegisterSubmit}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
                  >
                    {loading ? '注册中...' : '完成注册'}
                  </button>
                  
                  <button
                    onClick={() => setSelectedId('')}
                    className="w-full py-2 px-4 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    ← 重新选择ID
                  </button>
                </div>
              </div>
            )}
            
            <button
              onClick={handleBack}
              className="w-full mt-4 py-2 px-4 text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← 返回
            </button>
          </div>
        </div>
      )}

      {/* 登录页面 */}
      {currentStep === 'login' && (
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">账号登录</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  游戏ID
                </label>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="请输入4位游戏ID"
                  maxLength={4}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  密码
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入密码"
                />
              </div>
              
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}
              
              <button
                onClick={handleLoginSubmit}
                disabled={loading}
                className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium"
              >
                {loading ? '登录中...' : '登录'}
              </button>
            </div>
            
            <button
              onClick={handleBack}
              className="w-full mt-4 py-2 px-4 text-gray-600 hover:text-gray-800 transition-colors"
            >
              ← 返回
            </button>
          </div>
        </div>
      )}

      {/* 游戏主界面 */}
      {currentStep === 'game' && (
        <div className="text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-green-900 mb-2">🎉 登录成功！</h2>
            <p className="text-green-700">
              欢迎进入游戏，玩家ID: <span className="font-mono font-bold">{JSON.parse(localStorage.getItem('gameUser') || '{}').id}</span>
            </p>
            <p className="text-green-600 text-sm mt-2">
              服务器: {JSON.parse(localStorage.getItem('gameUser') || '{}').serverName}
            </p>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-600">游戏主界面将在这里显示...</p>
            <p className="text-gray-500 text-sm">（后续可以集成部队编组系统等功能）</p>
            
            <button
              onClick={handleLogout}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameAuthSystem;