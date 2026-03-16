/**
 * 认证流程Hook
 * 
 * @description 管理服务器选择、注册、登录的流程状态
 */

import { useState, useEffect } from 'react';
import { gameUserAPI } from '@/services/api';

export function useAuthFlow() {
  const [currentStep, setCurrentStep] = useState('serverSelect');
  const [selectedServer, setSelectedServer] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [serverSwitchUser, setServerSwitchUser] = useState(null);
  const [confirmCount, setConfirmCount] = useState(0);

  // 检查用户是否已登录，并验证账号是否仍然存在
  useEffect(() => {
    const savedUser = localStorage.getItem('gameUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      // 向后端验证账号是否仍然存在
      gameUserAPI.verifyUser(user.id).then(result => {
        if (result.success && result.exists) {
          setCurrentUser(user);
        } else {
          // 账号已被删除，清除本地缓存
          console.warn('[useAuthFlow] 本地缓存的账号已不存在，清除登录状态');
          localStorage.removeItem('gameUser');
          setCurrentUser(null);
        }
      }).catch(() => {
        // 网络错误时仍然使用本地缓存（离线容错）
        setCurrentUser(user);
      });
    }
  }, []);

  // 选择服务器
  const handleServerSelect = (server) => {
    setSelectedServer(server);
    setCurrentStep('authChoice');
  };

  // 开始注册流程
  const handleStartRegister = () => {
    setCurrentStep('register');
  };

  // 开始登录流程
  const handleStartLogin = () => {
    setCurrentStep('login');
  };

  // 注册成功
  const handleRegisterSuccess = (userData) => {
    localStorage.setItem('gameUser', JSON.stringify(userData));
    setCurrentUser(userData);
  };

  // 登录成功
  const handleLoginSuccess = (userData) => {
    localStorage.setItem('gameUser', JSON.stringify(userData));
    setCurrentUser(userData);
  };

  // 服务器不匹配，显示警告
  const handleServerMismatch = (user) => {
    setServerSwitchUser(user);
    setConfirmCount(0);
    setCurrentStep('serverWarning');
  };

  // 确认切换服务器
  const handleConfirmServerSwitch = () => {
    if (confirmCount === 0) {
      // 第一次确认
      setConfirmCount(1);
    }
    // 第二次确认在 ServerWarningStep 组件中处理
  };

  // 切换服务器成功
  const handleServerSwitchSuccess = (updatedUser) => {
    localStorage.setItem('gameUser', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    setServerSwitchUser(null);
    setConfirmCount(0);
  };

  // 取消切换服务器
  const handleCancelServerSwitch = () => {
    setServerSwitchUser(null);
    setConfirmCount(0);
    setCurrentStep('serverSelect');
    setSelectedServer(null);
  };

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('gameUser');
    setCurrentUser(null);
    setCurrentStep('serverSelect');
    setSelectedServer(null);
  };

  // 返回上一步
  const handleBack = () => {
    if (currentStep === 'authChoice') {
      setCurrentStep('serverSelect');
      setSelectedServer(null);
    } else if (currentStep === 'register' || currentStep === 'login') {
      setCurrentStep('authChoice');
    }
  };

  return {
    // 状态
    currentStep,
    selectedServer,
    currentUser,
    serverSwitchUser,
    confirmCount,
    
    // 方法
    handleServerSelect,
    handleStartRegister,
    handleStartLogin,
    handleRegisterSuccess,
    handleLoginSuccess,
    handleServerMismatch,
    handleConfirmServerSwitch,
    handleServerSwitchSuccess,
    handleCancelServerSwitch,
    handleLogout,
    handleBack,
  };
}
