/**
 * 认证流程Hook
 * 
 * @description 管理服务器选择、注册、登录的流程状态
 */

import { useState, useEffect, useRef } from 'react';
import { gameUserAPI } from '@/services/gameUserApi';
import {
  playerTokenManager,
  stripPlayerTokenFields,
  migrateEmbeddedPlayerTokenFromLocalState,
} from '@/utils/playerTokenManager';
import { onSessionExpired } from '@/utils/sessionEvents';

/**
 * 把 localStorage 里的旧 `gameUser` 还原成最小 `selectedServer`，避免软重登时强制让用户再选一次服。
 * 字段对齐 `useServers` 返回项的常用形（id / name）；缺字段时返回 null，由调用方走原 `serverSelect` 步骤。
 */
function buildPrefillServerFromUser(user) {
  if (!user || !user.serverId) return null;
  return {
    id: user.serverId,
    name: user.serverName || user.serverId,
  };
}

export function useAuthFlow() {
  const [currentStep, setCurrentStep] = useState('serverSelect');
  const [selectedServer, setSelectedServer] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [serverSwitchUser, setServerSwitchUser] = useState(null);
  const [confirmCount, setConfirmCount] = useState(0);
  /**
   * "软重登"提示与预填：
   *   - prefillId：登录步骤预填账号；
   *   - reauthReason：触发原因（'NO_TOKEN_LOCAL' / 'NO_TOKEN' / 'BAD_TOKEN' / 'TOKEN_EXPIRED'），LoginStep 用于决定提示文案。
   *
   * 仅在"启动检测到 token 缺失"或"运行时 401+鉴权 code"时被设置；用户成功登录或主动返回后清空。
   */
  const [reauthPrefill, setReauthPrefill] = useState(null);
  /** 引到最新用户态，供 session-expired 监听器使用，避免把 currentUser 放到 effect deps 里反复订阅。 */
  const currentUserRef = useRef(null);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  /**
   * 切换到"软重登"流程：保留账号 ID + 服务器，清掉 token 与登录态，跳到登录步骤。
   * 保留 `gameUser` 中的账号与服务器信息，仅从其中移除 token 字段（与独立 key 一致清空）；
   * 会话接力由用户重新输入密码后由后端签发新 JWT。
   */
  const enterReauth = (user, reason) => {
    if (!user || !user.id) return;
    playerTokenManager.clear();
    // 避免仅清独立 key 后，内嵌在 gameUser 里的旧 JWT 下次启动又被 hydrate，等于绕过软重登。
    try {
      const raw = localStorage.getItem('gameUser');
      if (raw) {
        const u = JSON.parse(raw);
        if (u && typeof u === 'object') {
          localStorage.setItem('gameUser', JSON.stringify(stripPlayerTokenFields(u)));
        }
      }
    } catch (_) {
      /* ignore */
    }
    const prefillServer = buildPrefillServerFromUser(user);
    setReauthPrefill({ id: user.id, reason: reason || 'NO_TOKEN_LOCAL' });
    if (prefillServer) setSelectedServer(prefillServer);
    setCurrentUser(null);
    setCurrentStep(prefillServer ? 'login' : 'serverSelect');
  };

  // 启动检测：旧 localStorage 还在但 token 缺 / 过期 —— 不直接进游戏，引导软重登。
  useEffect(() => {
    const savedUser = localStorage.getItem('gameUser');
    if (!savedUser) return;
    let user;
    try { user = JSON.parse(savedUser); } catch {
      localStorage.removeItem('gameUser');
      return;
    }

    let noTokenReason = 'NO_TOKEN_LOCAL';
    const embExpiry = user && Number(user.tokenExpiresAt);
    if (user && user.token && Number.isFinite(embExpiry) && Date.now() > embExpiry) {
      noTokenReason = 'TOKEN_EXPIRED';
    }

    const { user: userAfterMigrate } = migrateEmbeddedPlayerTokenFromLocalState(user);
    user = userAfterMigrate;

    if (!playerTokenManager.isValid()) {
      console.info('[useAuthFlow] 检测到旧会话无有效 token，引导用户重新登录');
      enterReauth(user, noTokenReason);
      return;
    }

    gameUserAPI.verifyUser(user.id).then(result => {
      if (result.success && result.exists) {
        setCurrentUser(user);
      } else {
        console.warn('[useAuthFlow] 本地缓存的账号已不存在，清除登录状态');
        localStorage.removeItem('gameUser');
        playerTokenManager.clear();
        setCurrentUser(null);
      }
    }).catch(() => {
      setCurrentUser(user);
    });
  }, []);

  // 运行期 session 失效（httpClient 拦到的 401+鉴权 code）：把当前用户引到软重登。
  useEffect(() => {
    return onSessionExpired(({ reason }) => {
      const u = currentUserRef.current
        || (() => {
          const raw = localStorage.getItem('gameUser');
          try { return raw ? JSON.parse(raw) : null; } catch { return null; }
        })();
      if (!u || !u.id) return;
      enterReauth(u, reason || 'TOKEN_EXPIRED');
    });
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
    localStorage.setItem('gameUser', JSON.stringify(stripPlayerTokenFields(userData)));
    setCurrentUser(userData);
  };

  // 登录成功
  const handleLoginSuccess = (userData) => {
    localStorage.setItem('gameUser', JSON.stringify(stripPlayerTokenFields(userData)));
    setCurrentUser(userData);
    setReauthPrefill(null);
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
    localStorage.setItem('gameUser', JSON.stringify(stripPlayerTokenFields(updatedUser)));
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
    playerTokenManager.clear();
    setCurrentUser(null);
    setCurrentStep('serverSelect');
    setSelectedServer(null);
    setReauthPrefill(null);
  };

  // 返回上一步
  const handleBack = () => {
    if (currentStep === 'authChoice') {
      setCurrentStep('serverSelect');
      setSelectedServer(null);
    } else if (currentStep === 'register' || currentStep === 'login') {
      // 软重登模式下从 login 返回 = 完整重置（清 gameUser、回到选服）；
      // 否则按原"返回到 authChoice"逻辑。
      if (reauthPrefill) {
        localStorage.removeItem('gameUser');
        setReauthPrefill(null);
        setSelectedServer(null);
        setCurrentStep('serverSelect');
      } else {
        setCurrentStep('authChoice');
      }
    }
  };

  return {
    // 状态
    currentStep,
    selectedServer,
    currentUser,
    serverSwitchUser,
    confirmCount,
    reauthPrefill,

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
