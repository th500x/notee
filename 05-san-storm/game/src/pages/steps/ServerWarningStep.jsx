/**
 * 服务器切换警告步骤
 */

import { useState } from 'react';
import { gameUserAPI } from '@/services/api';
import AncientModal from '@/components/common/AncientModal';

export function ServerWarningStep({ 
  serverSwitchUser, 
  selectedServer, 
  confirmCount,
  onConfirm, 
  onSuccess,
  onCancel 
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  const handleConfirm = async () => {
    if (confirmCount === 0) {
      // 第一次确认
      onConfirm();
      setError('');
    } else if (confirmCount === 1) {
      // 第二次确认，执行切换
      setLoading(true);
      
      try {
        const result = await gameUserAPI.switchServer(serverSwitchUser.id, selectedServer.id);
        
        if (result.success) {
          const updatedUser = {
            ...serverSwitchUser,
            serverId: selectedServer.id,
            serverName: selectedServer.name
          };
          
          onSuccess(updatedUser);
          setSuccessModalOpen(true);
        } else {
          setError('切换服务器失败：' + result.error);
        }
      } catch (err) {
        setError('切换服务器失败，请重试');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
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
        
        {error && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}
        
        <div className="space-y-3">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
              confirmCount === 0 
                ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                : 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
            } disabled:bg-gray-400`}
          >
            {loading ? '处理中...' : (
              confirmCount === 0 
                ? '⚠️ 我已了解，继续切换（1/2）' 
                : '🚨 确认清除数据并切换服务器（2/2）'
            )}
          </button>
          
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full py-3 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors font-medium"
          >
            ← 取消，返回服务器选择
          </button>
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>💡 提示：如果您想在多个服务器游玩，请注册不同的账号</p>
        </div>
      </div>

      <AncientModal
        isOpen={successModalOpen}
        type="info"
        title="切换成功"
        confirmText="确定"
        onConfirm={() => setSuccessModalOpen(false)}
        onClose={() => setSuccessModalOpen(false)}
      >
        <p className="text-center text-gray-800 text-sm whitespace-pre-line">
          {'✅ 服务器切换成功！\n\n当前赛季的游戏数据已清除，您可以在新服务器重新开始游戏。'}
        </p>
      </AncientModal>
    </div>
  );
}
