/**
 * 注册/登录选择步骤（含找回账号功能）
 */

import { useState, useEffect } from 'react';
import { gameUserAPI } from '@/services/api';
import {
  checkLockStatus,
  recordFailedAttempt,
  recordSuccessfulAttempt,
  getLockoutMessage,
  getErrorMessage
} from '@/utils/passwordAttemptLimiter';

const RECOVER_LIMITER_ID = 'game_recover';

export function AuthChoiceStep({ selectedServer, onStartRegister, onStartLogin, onBack }) {
  const [showRecover, setShowRecover] = useState(false);
  const [recoverPassword, setRecoverPassword] = useState('');
  const [recoverResult, setRecoverResult] = useState(null); // { id, serverId }
  const [recoverError, setRecoverError] = useState('');
  const [recoverLoading, setRecoverLoading] = useState(false);

  // 锁定倒计时
  const [lockRemaining, setLockRemaining] = useState(0);

  useEffect(() => {
    if (!showRecover) return;
    const tick = () => {
      const status = checkLockStatus(RECOVER_LIMITER_ID);
      setLockRemaining(status.isLocked ? status.remainingTime : 0);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [showRecover]);

  const handleRecover = async () => {
    if (!recoverPassword) {
      setRecoverError('请输入密码');
      return;
    }

    const lockStatus = checkLockStatus(RECOVER_LIMITER_ID);
    if (lockStatus.isLocked) {
      setRecoverError(getLockoutMessage(lockStatus.remainingTime));
      return;
    }

    setRecoverLoading(true);
    setRecoverError('');
    setRecoverResult(null);

    try {
      const result = await gameUserAPI.recoverAccount(recoverPassword);

      if (result.success) {
        recordSuccessfulAttempt(RECOVER_LIMITER_ID);
        setRecoverResult(result.data);
        setRecoverError('');
      } else {
        const attemptResult = recordFailedAttempt(RECOVER_LIMITER_ID);
        setRecoverError(result.error || getErrorMessage(attemptResult));
      }
    } catch {
      const attemptResult = recordFailedAttempt(RECOVER_LIMITER_ID);
      setRecoverError(getErrorMessage(attemptResult));
    } finally {
      setRecoverLoading(false);
    }
  };

  const handleCloseRecover = () => {
    setShowRecover(false);
    setRecoverPassword('');
    setRecoverResult(null);
    setRecoverError('');
  };

  const isLocked = lockRemaining > 0;
  const lockMinutes = Math.ceil(lockRemaining / 60000);

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
          欢迎来到《真三风云》
        </h2>
        <p className="text-gray-600 mb-6 text-center">请选择注册或登录</p>
        
        <div className="space-y-4">
          <button
            onClick={onStartRegister}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            🆕 新用户注册
          </button>
          
          <button
            onClick={onStartLogin}
            className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            🔑 已有账号登录
          </button>
        </div>

        {/* 找回账号入口 */}
        {!showRecover ? (
          <button
            onClick={() => setShowRecover(true)}
            className="w-full mt-3 py-2 px-4 text-sm text-blue-500 hover:text-blue-700 transition-colors"
          >
            忘记ID？找回账号
          </button>
        ) : (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">🔍 找回账号</h3>
              <button
                onClick={handleCloseRecover}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">输入你的密码，系统将查找对应的账号ID</p>

            {recoverResult ? (
              /* 找回成功 */
              <div className="text-center py-2">
                <div className="text-green-600 text-sm mb-2">✅ 找到你的账号</div>
                <div className="bg-white border-2 border-green-400 rounded-lg p-3 mb-2">
                  <div className="text-xs text-gray-500">你的游戏ID</div>
                  <div className="text-2xl font-mono font-bold text-gray-900 tracking-widest">
                    {recoverResult.id}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    服务器: {recoverResult.serverId}
                  </div>
                </div>
                <p className="text-xs text-gray-500">请牢记你的ID，然后使用「已有账号登录」</p>
              </div>
            ) : (
              /* 密码输入 */
              <>
                <input
                  type="password"
                  value={recoverPassword}
                  onChange={(e) => setRecoverPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isLocked && handleRecover()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入你的密码"
                  disabled={isLocked}
                />
                {recoverError && (
                  <div className="text-red-600 text-xs mt-2">{recoverError}</div>
                )}
                {isLocked && (
                  <div className="text-orange-600 text-xs mt-2">
                    ⏳ 尝试次数过多，请 {lockMinutes} 分钟后重试
                  </div>
                )}
                <button
                  onClick={handleRecover}
                  disabled={recoverLoading || isLocked}
                  className="w-full mt-3 py-2 px-4 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
                >
                  {recoverLoading ? '查找中...' : '查找账号'}
                </button>
              </>
            )}
          </div>
        )}
        
        <button
          onClick={onBack}
          className="w-full mt-4 py-2 px-4 text-gray-600 hover:text-gray-800 transition-colors"
        >
          ← 返回服务器选择
        </button>
      </div>
    </div>
  );
}
