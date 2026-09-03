/**
 * 服务器选择页面
 * 
 * @description 展示所有游戏服务器，允许玩家选择服务器
 */

import React from 'react';
import { useServers } from '@/hooks/useServers';
import { ServerCard } from '@/components/server/ServerCard';
import { useAdminToast } from '@/components/admin/useAdminToast';

function ServersPage() {
  const { servers, loading, error } = useServers();
  const { showToast, Toast } = useAdminToast();

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">加载服务器列表...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">❌ 加载失败: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <Toast />
      <h2 className="text-3xl font-bold text-gray-900 mb-6">服务器选择</h2>
      <p className="text-gray-600 mb-6">
        选择一个服务器开始游戏。建议选择空闲或热门状态的服务器。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
        {servers.map(server => (
          <ServerCard 
            key={server.id} 
            server={server}
            onSelect={(server) => showToast(`已选择服务器：${server.name}`, 'info')}
          />
        ))}
      </div>
    </div>
  );
}

export default ServersPage;
