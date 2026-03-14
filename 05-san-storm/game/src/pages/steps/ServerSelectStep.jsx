/**
 * 服务器选择步骤
 */

import { ServerCard } from '@/components/server/ServerCard';

export function ServerSelectStep({ servers, onServerSelect }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">选择服务器</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
        {servers.map(server => (
          <ServerCard 
            key={server.id} 
            server={server}
            onSelect={onServerSelect}
          />
        ))}
      </div>
    </div>
  );
}
