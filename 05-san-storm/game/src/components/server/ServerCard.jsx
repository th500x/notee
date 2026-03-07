/**
 * 服务器卡片组件 V2 - 卡牌风格
 * 
 * @description 展示单个服务器的信息卡片，采用部队卡牌风格
 * @module components/server/ServerCard
 * 
 * 尺寸: 256 × 384 px (2:3比例)
 * 布局: 竖版卡牌
 */

import React from 'react';
import { SERVER_STATUS_LABELS, SERVER_STATUS_ICONS, SERVER_STATUS_COLORS } from '@/constants';

/**
 * 服务器卡片组件
 * @param {Object} props
 * @param {Object} props.server - 服务器数据
 * @param {Function} props.onSelect - 选择服务器回调
 */
export function ServerCard({ server, onSelect }) {
  const statusLabel = SERVER_STATUS_LABELS[server.status];
  const statusIcon = SERVER_STATUS_ICONS[server.status];
  const statusColor = SERVER_STATUS_COLORS[server.status];
  
  const isFull = server.status === 'full';
  const loadPercentage = (server.activePlayerCount / server.maxPlayers) * 100;

  // 状态对应的渐变色
  const statusGradients = {
    idle: 'from-green-400 to-green-600',
    hot: 'from-orange-400 to-orange-600',
    busy: 'from-red-400 to-red-600',
    full: 'from-gray-400 to-gray-600',
  };

  const statusBorders = {
    idle: 'border-green-500',
    hot: 'border-orange-500',
    busy: 'border-red-500',
    full: 'border-gray-500',
  };

  const statusGlows = {
    idle: 'shadow-green-500/50',
    hot: 'shadow-orange-500/50',
    busy: 'shadow-red-500/50',
    full: 'shadow-gray-500/50',
  };

  return (
    <div className="relative w-[256px] h-[384px] group">
      {/* 卡牌容器 */}
      <div className={`
        relative w-full h-full
        bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
        rounded-xl overflow-hidden
        border-2 ${statusBorders[server.status]}
        shadow-xl ${statusGlows[server.status]}
        transition-all duration-300
        ${isFull ? 'opacity-75' : 'hover:scale-105 hover:shadow-2xl cursor-pointer'}
      `}
      onClick={() => !isFull && onSelect && onSelect(server)}
      >
        
        {/* 顶部：服务器名称 */}
        <div className={`
          relative h-[40px] px-3 py-2
          bg-gradient-to-r ${statusGradients[server.status]}
          flex items-center justify-between
        `}>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎮</span>
            <h3 className="text-white font-bold text-base truncate">
              {server.name}
            </h3>
          </div>
          <div className={`
            px-2 py-0.5 rounded
            bg-black/30 backdrop-blur-sm
            text-xs font-medium text-white
          `}>
            {statusIcon}
          </div>
        </div>

        {/* 中间：服务器图标区域 */}
        <div className="relative h-[120px] bg-gradient-to-b from-gray-800 to-gray-900">
          {/* 背景装饰 */}
          <div className="absolute inset-0 opacity-10">
            <div className={`absolute inset-0 bg-gradient-to-br ${statusGradients[server.status]}`} />
          </div>

          <div className="relative h-full flex items-center p-3 gap-3">
            {/* 左侧：服务器图标 */}
            <div className="relative w-[100px] h-[100px] flex-shrink-0">
              <div className={`
                absolute inset-0 rounded-lg
                border-2 ${statusBorders[server.status]}
                bg-gray-900/50 backdrop-blur-sm
                flex items-center justify-center
                overflow-hidden
              `}>
                {/* 服务器图标 */}
                <div className="text-6xl">
                  {server.status === 'idle' && '🟢'}
                  {server.status === 'hot' && '🔥'}
                  {server.status === 'busy' && '⚡'}
                  {server.status === 'full' && '🔒'}
                </div>
              </div>

              {/* 状态标识 */}
              <div className={`
                absolute -top-1 -right-1
                w-8 h-8 rounded-full
                bg-gradient-to-br ${statusGradients[server.status]}
                border-2 ${statusBorders[server.status]}
                flex items-center justify-center
                text-lg
                shadow-lg
              `}>
                {statusIcon}
              </div>
            </div>

            {/* 右侧：服务器信息 */}
            <div className="flex-1 flex flex-col justify-center gap-2">
              {/* 在线人数 */}
              <div className="flex items-center gap-2">
                <span className="text-blue-400 text-xl">👥</span>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-[10px]">在线</span>
                  <span className="text-white font-bold text-sm">
                    {server.onlinePlayerCount}
                  </span>
                </div>
              </div>

              {/* 负载 */}
              <div className="flex items-center gap-2">
                <span className="text-purple-400 text-xl">📊</span>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-[10px]">负载</span>
                  <span className="text-white font-bold text-sm">
                    {loadPercentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 服务器详情区域 */}
        <div className="relative px-3 py-2 bg-gray-900/90 backdrop-blur-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">赛季</span>
              <span className="text-white font-medium">{server.description}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">状态</span>
              <span className="font-medium" style={{ color: statusColor }}>
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        {/* 负载进度条区域 */}
        <div className="relative px-3 py-2 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700">
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400">玩家容量</span>
              <span className="text-white font-medium">
                {server.activePlayerCount}/{server.maxPlayers}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all bg-gradient-to-r ${statusGradients[server.status]}`}
                style={{ width: `${loadPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* 操作按钮区域 */}
        <div className="relative px-3 py-3 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700">
          <button
            onClick={(e) => {
              e.stopPropagation();
              !isFull && onSelect && onSelect(server);
            }}
            disabled={isFull}
            className={`
              w-full py-2 px-4 rounded-lg font-medium transition-all
              ${isFull
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : `bg-gradient-to-r ${statusGradients[server.status]} text-white hover:shadow-lg`
              }
            `}
          >
            {isFull ? '🔒 服务器已满' : '⚔️ 进入服务器'}
          </button>
        </div>

        {/* 已满遮罩 */}
        {isFull && (
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-2">🔒</div>
              <div className="text-white font-bold text-lg">服务器已满</div>
              <div className="text-gray-400 text-sm">请选择其他服务器</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

