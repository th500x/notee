/**
 * 认证流程页面
 * 
 * @description 统一管理服务器选择、注册、登录流程
 */

import React from 'react';
import { useServers } from '@/hooks/useServers';
import { usePlayer } from '@/hooks/usePlayer';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { ServerSelectStep } from '@/pages/steps/ServerSelectStep';
import { AuthChoiceStep } from '@/pages/steps/AuthChoiceStep';
import { RegisterStep } from '@/pages/steps/RegisterStep';
import { LoginStep } from '@/pages/steps/LoginStep';
import { ServerWarningStep } from '@/pages/steps/ServerWarningStep';
import CharacterCreationPage from '@/pages/CharacterCreationPage';

function AuthFlowPage() {
  const { servers, loading: serversLoading, error: serversError } = useServers();
  const {
    currentStep,
    selectedServer,
    currentUser,
    serverSwitchUser,
    confirmCount,
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
  } = useAuthFlow();

  const { player, loading: playerLoading, hasCharacter, refresh: refreshPlayer } = usePlayer(currentUser?.id);

  // 角色创建完成
  const handleCharacterCreated = (player) => {
    console.log('角色创建成功:', player);
    refreshPlayer();
  };

  // 加载中
  if (serversLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">加载服务器列表...</p>
      </div>
    );
  }

  // 加载失败
  if (serversError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">❌ 加载失败: {serversError}</p>
      </div>
    );
  }

  // 已登录但玩家数据加载中 - 显示加载状态（防止闪烁到认证页面）
  if (currentUser && playerLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">加载角色数据...</p>
      </div>
    );
  }

  // 已登录且有角色 - 显示游戏主界面
  if (currentUser && hasCharacter && player) {
    return (
      <div className="text-center">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-green-900 mb-2">🎉 欢迎回来！</h2>
          <p className="text-green-800">
            玩家 <span className="font-mono font-bold">{currentUser.id}</span> - {player.character_name}
          </p>
          <p className="text-green-700 text-sm mt-2">
            服务器：{currentUser.serverName}
          </p>
        </div>
        
        <div className="space-y-4">
          <p className="text-gray-600">游戏主界面开发中...</p>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            退出登录
          </button>
        </div>
      </div>
    );
  }

  // 已登录但没有角色 - 显示角色创建页面
  if (currentUser && !hasCharacter) {
    return (
      <div>
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">创建你的角色</h1>
          <p className="text-gray-600">
            欢迎，玩家 <span className="font-mono font-bold">{currentUser.id}</span>
          </p>
        </div>
        <CharacterCreationPage 
          user={currentUser} 
          onComplete={handleCharacterCreated}
        />
      </div>
    );
  }

  // 未登录 - 显示认证流程
  return (
    <div className="space-y-6">
      {currentStep === 'serverSelect' && (
        <ServerSelectStep 
          servers={servers}
          onServerSelect={handleServerSelect}
        />
      )}

      {currentStep === 'authChoice' && (
        <AuthChoiceStep
          selectedServer={selectedServer}
          onStartRegister={handleStartRegister}
          onStartLogin={handleStartLogin}
          onBack={handleBack}
        />
      )}

      {currentStep === 'register' && (
        <RegisterStep
          selectedServer={selectedServer}
          onRegisterSuccess={handleRegisterSuccess}
          onBack={handleBack}
        />
      )}

      {currentStep === 'login' && (
        <LoginStep
          selectedServer={selectedServer}
          onLoginSuccess={handleLoginSuccess}
          onServerMismatch={handleServerMismatch}
          onBack={handleBack}
        />
      )}

      {currentStep === 'serverWarning' && serverSwitchUser && (
        <ServerWarningStep
          serverSwitchUser={serverSwitchUser}
          selectedServer={selectedServer}
          confirmCount={confirmCount}
          onConfirm={handleConfirmServerSwitch}
          onSuccess={handleServerSwitchSuccess}
          onCancel={handleCancelServerSwitch}
        />
      )}
    </div>
  );
}

export default AuthFlowPage;
