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

// 获取机器指纹（改进版 - 更稳定）
const getMachineFingerprint = () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('Machine fingerprint', 2, 2);
  
  const fingerprint = [
    navigator.language,                    // 浏览器语言（稳定）
    screen.colorDepth,                     // 色深（稳定）
    screen.width + 'x' + screen.height,    // 屏幕分辨率（较稳定）
    new Date().getTimezoneOffset(),        // 时区（稳定）
    navigator.hardwareConcurrency || 0,    // CPU核心数（稳定）
    canvas.toDataURL()                     // Canvas指纹（辅助）
    // 注意：不使用 userAgent（浏览器升级会变）
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

// 获取IP地址和地理位置
const getClientIPAndLocation = async () => {
  try {
    // 使用免费的IP地理位置API
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    
    return {
      ip: data.ip || 'unknown',
      province: data.region || '未知', // region字段通常是省份
      city: data.city || '未知',
      country: data.country_name || '未知'
    };
  } catch (error) {
    console.error('获取IP地理位置失败:', error);
    // 如果API失败，尝试备用方案
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return {
        ip: data.ip || 'unknown',
        province: '未知',
        city: '未知',
        country: '未知'
      };
    } catch (err) {
      return {
        ip: 'unknown',
        province: '未知',
        city: '未知',
        country: '未知'
      };
    }
  }
};

const GameAuthSystem = () => {
  const { servers, loading: serversLoading } = useServers();
  const [currentStep, setCurrentStep] = useState('serverSelect'); // serverSelect, authChoice, register, login, game, serverWarning
  const [selectedServer, setSelectedServer] = useState(null);
  const [availableIds, setAvailableIds] = useState([]);
  const [batchInfo, setBatchInfo] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthMonth, setBirthMonth] = useState(''); // 新增：生日月份
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverSwitchUser, setServerSwitchUser] = useState(null); // 需要切换服务器的用户
  const [confirmCount, setConfirmCount] = useState(0); // 确认次数

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
    
    if (!birthMonth) {
      setError('请选择生日月份');
      return;
    }

    setLoading(true);
    
    try {
      // 获取机器指纹、IP和地理位置
      const machineId = getMachineFingerprint();
      const locationData = await getClientIPAndLocation();
      
      // 检查是否已经注册过（IP或机器指纹任一重复即禁止）
      const existingUsers = JSON.parse(localStorage.getItem('gameUsers') || '[]');
      const duplicateByMachine = existingUsers.find(user => user.machineId === machineId);
      const duplicateByIP = existingUsers.find(user => user.clientIP === locationData.ip);
      
      if (duplicateByMachine) {
        setError('检测到重复注册：此设备已注册过账号');
        setLoading(false);
        return;
      }
      
      if (duplicateByIP) {
        setError('检测到重复注册：此IP地址已注册过账号');
        setLoading(false);
        return;
      }

      // 创建新用户
      const newUser = {
        id: selectedId,
        password: password, // 实际项目中应该加密
        birthMonth: parseInt(birthMonth), // 生日月份（1-12）
        serverId: selectedServer.id,
        serverName: selectedServer.name,
        province: locationData.province, // 自动获取的省份
        city: locationData.city, // 城市信息
        machineId: machineId,
        clientIP: locationData.ip,
        status: 'active', // 账号状态
        loginCount: 1, // 登录次数
        registeredAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
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

      // 检查用户的服务器是否与当前选择的服务器一致
      if (user.serverId !== selectedServer.id) {
        // 服务器不一致，显示警告
        setServerSwitchUser(user);
        setConfirmCount(0);
        setCurrentStep('serverWarning');
        setLoading(false);
        return;
      }

      // 服务器一致，正常登录
      user.lastLoginAt = new Date().toISOString();
      user.lastActiveAt = new Date().toISOString();
      user.loginCount = (user.loginCount || 0) + 1;
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

  // 确认切换服务器
  const handleConfirmServerSwitch = () => {
    if (confirmCount === 0) {
      // 第一次确认
      setConfirmCount(1);
      setError('');
    } else if (confirmCount === 1) {
      // 第二次确认，执行切换
      const users = JSON.parse(localStorage.getItem('gameUsers') || '[]');
      const user = serverSwitchUser;
      
      // 更新用户的服务器信息
      user.serverId = selectedServer.id;
      user.serverName = selectedServer.name;
      user.lastLoginAt = new Date().toISOString();
      user.lastActiveAt = new Date().toISOString();
      user.loginCount = (user.loginCount || 0) + 1;
      
      // TODO: 清除用户的当前赛季游戏数据（部队、装备等）
      // 注意：不清除历史赛季的继承数据（season_inheritances表）
      // 目前M2阶段只有基础账号信息，暂时不需要清除
      // 
      // 未来实现时需要清除的数据：
      // - player_cards 表中的当前赛季卡牌
      // - player_equipment 表中的装备槽
      // - player_progress 表中的任务进度
      // - players 表中的资源、声望等（保留基础属性）
      // 
      // 不清除的数据：
      // - users 表（账号基础信息）
      // - season_inheritances 表（历史赛季继承物，跨服务器）
      // - season_records 表（历史赛季统计，用于成绩展示）
      
      const updatedUsers = users.map(u => u.id === user.id ? user : u);
      localStorage.setItem('gameUsers', JSON.stringify(updatedUsers));
      localStorage.setItem('gameUser', JSON.stringify(user));
      
      setCurrentStep('game');
      setError('');
      setServerSwitchUser(null);
      setConfirmCount(0);
    }
  };

  // 取消切换服务器
  const handleCancelServerSwitch = () => {
    setServerSwitchUser(null);
    setConfirmCount(0);
    setCurrentStep('serverSelect');
    setSelectedServer(null);
    setLoginId('');
    setLoginPassword('');
    setError('');
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
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      生日月份 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">请选择生日月份</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                        <option key={month} value={month}>
                          {month}月
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">用于每月自动发放生日礼物</p>
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

      {/* 服务器切换警告 */}
      {currentStep === 'serverWarning' && serverSwitchUser && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-red-900 mb-2">服务器切换警告</h2>
            </div>
            
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-6">
              <div className="space-y-4 text-left">
                <div className="flex items-start gap-3">
                  <span className="text-red-600 text-xl mt-1">🔴</span>
                  <div>
                    <p className="font-bold text-red-900 mb-1">当前账号信息：</p>
                    <p className="text-red-800">
                      用户ID: <span className="font-mono font-bold">{serverSwitchUser.id}</span>
                    </p>
                    <p className="text-red-800">
                      原服务器: <span className="font-bold">{serverSwitchUser.serverName}</span>
                    </p>
                    <p className="text-red-800">
                      目标服务器: <span className="font-bold">{selectedServer.name}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="text-red-600 text-xl mt-1">⚡</span>
                  <div>
                    <p className="font-bold text-red-900 mb-1">将被清除的数据：</p>
                    <p className="text-red-800">
                      切换服务器后，您在原服务器的<span className="font-bold underline">当前赛季</span>游戏数据将被永久清除，包括：
                    </p>
                    <ul className="list-disc list-inside text-red-800 mt-2 space-y-1 ml-4">
                      <li>当前赛季的所有部队卡牌</li>
                      <li>当前赛季的所有将领卡牌</li>
                      <li>当前赛季的所有装备和道具</li>
                      <li>当前赛季的游戏进度和任务</li>
                      <li>当前赛季的资源（粮草、银两、贡献等）</li>
                    </ul>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <span className="text-green-600 text-xl mt-1">✅</span>
                  <div>
                    <p className="font-bold text-green-900 mb-1">保留的数据：</p>
                    <ul className="list-disc list-inside text-green-800 mt-2 space-y-1 ml-4">
                      <li>账号基础信息（用户ID、密码、生日月份等）</li>
                      <li className="font-bold">历史赛季的继承物（装备卡、成就卡、称号卡、宝物卡等）</li>
                    </ul>
                    <p className="text-green-700 text-sm mt-2 italic">
                      💡 您的赛季继承物是跨服务器的，不会因为切换服务器而丢失
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {confirmCount === 0 && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
                <p className="text-yellow-900 font-medium text-center">
                  ⚠️ 此操作不可撤销！请仔细考虑后再继续
                </p>
              </div>
            )}
            
            {confirmCount === 1 && (
              <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-4 mb-6 animate-pulse">
                <p className="text-orange-900 font-bold text-center text-lg">
                  🚨 最后确认：您确定要清除所有游戏数据并切换服务器吗？
                </p>
              </div>
            )}
            
            <div className="space-y-3">
              <button
                onClick={handleConfirmServerSwitch}
                className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
                  confirmCount === 0 
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                    : 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                }`}
              >
                {confirmCount === 0 ? '⚠️ 我已了解，继续切换（1/2）' : '🚨 确认清除数据并切换服务器（2/2）'}
              </button>
              
              <button
                onClick={handleCancelServerSwitch}
                className="w-full py-3 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                ← 取消，返回服务器选择
              </button>
            </div>
            
            <div className="mt-6 text-center text-sm text-gray-500">
              <p>💡 提示：如果您想在多个服务器游玩，请注册不同的账号</p>
            </div>
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