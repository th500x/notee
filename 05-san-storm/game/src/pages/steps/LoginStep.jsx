/**
 * 登录步骤
 *
 * 支持"软重登"模式：
 *   - `prefillId`：检测到旧 localStorage 没有有效 token / 运行时 401 时由 `useAuthFlow` 注入，
 *     用于预填账号（用户只需输密码）。
 *   - `reauthReason`：'NO_TOKEN_LOCAL' / 'NO_TOKEN' / 'TOKEN_EXPIRED' / 'BAD_TOKEN'（及未列出的服务端原因码时的兜底文案），控制提示文案。
 */

import { useState, useEffect } from 'react';
import { gameUserAPI } from '@/services/api';
import { validateIdFormat } from '@/pages/steps/authUtils';
import {
  checkLockStatus,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  getLockoutMessage,
  getErrorMessage
} from '@/utils/passwordAttemptLimiter';

function reauthHint(reason) {
  if (!reason) return null;
  switch (reason) {
    case 'TOKEN_EXPIRED':
      return '会话已过期，请重新输入密码继续游戏。';
    case 'BAD_TOKEN':
      return '登录凭证无效（常见于服务重启或密钥轮换后旧令牌作废），请重新输入密码。';
    case 'NO_TOKEN':
      return '服务端未识别当前会话，请重新输入密码。';
    case 'NO_TOKEN_LOCAL':
      return '本机未检测到有效登录会话，请重新输入密码。';
    default:
      return '需要重新验证身份，请重新输入密码以继续。';
  }
}

export function LoginStep({ selectedServer, onLoginSuccess, onServerMismatch, onBack, prefillId, reauthReason }) {
  const [loginId, setLoginId] = useState(prefillId ? String(prefillId).toUpperCase() : '');
  const [loginPassword, setLoginPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (prefillId) setLoginId(String(prefillId).toUpperCase());
  }, [prefillId]);

  const reauthMsg = reauthHint(reauthReason);

  const handleSubmit = async () => {
    if (!loginId || !loginPassword) {
      setError('请输入ID和密码');
      return;
    }

    if (!validateIdFormat(loginId)) {
      setError('ID格式错误：应为4位字符，首位为数字0-9，后三位为字母A-Z或数字0-9');
      return;
    }

    const identifier = `game_login_${loginId}`;
    const lockStatus = checkLockStatus(identifier);
    if (lockStatus.isLocked) {
      setError(getLockoutMessage(lockStatus.remainingTime));
      return;
    }

    setLoading(true);
    
    try {
      const result = await gameUserAPI.login(loginId, loginPassword);
      
      if (!result.success) {
        const attemptResult = recordFailedAttempt(identifier);
        setError(result.error || getErrorMessage(attemptResult));
        setLoading(false);
        return;
      }

      recordSuccessfulAttempt(identifier);
      const user = result.data;

      if (user.serverId !== selectedServer.id) {
        onServerMismatch(user);
        setLoading(false);
        return;
      }

      const userData = {
        ...user,
        serverName: selectedServer.name
      };
      
      onLoginSuccess(userData);
      setError('');
    } catch (err) {
      setError('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">账号登录</h2>

        {reauthMsg && (
          <div className="mb-4 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            {reauthMsg}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              游戏ID
            </label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono disabled:bg-gray-100"
              placeholder="请输入4位游戏ID"
              maxLength={4}
              readOnly={Boolean(prefillId)}
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
          
          {error && <div className="text-red-600 text-sm">{error}</div>}
          
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </div>
        
        <button
          onClick={onBack}
          className="w-full mt-4 py-2 px-4 text-gray-600 hover:text-gray-800 transition-colors"
        >
          ← 返回
        </button>
      </div>
    </div>
  );
}
