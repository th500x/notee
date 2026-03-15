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
      {/* 炫彩金色边框（渐变背景作为边框） */}
      <div 
        className={`
          relative w-full h-full
          rounded-xl p-[3px]
          shadow-xl
          transition-all duration-300
          ${isFull ? 'opacity-75' : 'hover:scale-105 hover:shadow-2xl cursor-pointer'}
        `}
        style={{
          background: 'linear-gradient(135deg, #d4a017, #f5d060, #b8860b, #f5d060, #d4a017, #f5d060, #b8860b)',
        }}
        onClick={() => !isFull && onSelect && onSelect(server)}
      >
      {/* 卡牌内容 */}
      <div className="relative w-full h-full rounded-[10px] overflow-hidden bg-[#f8f6f0]">
        
        {/* 顶部：服务器名称 */}
        <div className={`
          relative h-[40px] px-5 py-2
          bg-black/10 backdrop-blur-sm
          flex items-center justify-between
        `}>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎮</span>
            <h3 className="text-gray-900 font-bold text-base truncate">
              {server.name}
            </h3>
          </div>
          <div className={`
            px-2 py-0.5 rounded
            bg-black/20 backdrop-blur-sm
            text-xs font-medium text-gray-900
          `}>
            {statusIcon}
          </div>
        </div>

        {/* 中间：服务器图标区域 */}
        <div className="relative h-[120px]">
          {/* 背景装饰 */}
          <div className="absolute inset-0 opacity-5">
            <div className={`absolute inset-0 bg-gradient-to-br ${statusGradients[server.status]}`} />
          </div>

          <div className="relative h-full flex items-center px-5 py-3 gap-3">
            {/* 左侧：服务器图标 */}
            <div className="relative w-[100px] h-[100px] flex-shrink-0">
              <div className={`
                absolute inset-0 rounded-lg
                border-2 border-gray-500
                bg-gray-700/80 backdrop-blur-sm
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
            </div>

            {/* 右侧：服务器信息 */}
            <div className="flex-1 flex flex-col justify-center items-start gap-2">
              {/* 在线人数 */}
              <div className="flex items-center gap-2">
                <span className="text-blue-400 text-xl">👥</span>
                <div className="flex flex-col items-start">
                  <span className="text-gray-700 text-sm">在线</span>
                  <span className="text-gray-900 font-bold text-sm">
                    {server.onlinePlayerCount}
                  </span>
                </div>
              </div>

              {/* 负载 */}
              <div className="flex items-center gap-2">
                <span className="text-purple-400 text-xl">📊</span>
                <div className="flex flex-col items-start">
                  <span className="text-gray-700 text-sm">负载</span>
                  <span className="text-gray-900 font-bold text-sm">
                    {loadPercentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 服务器详情区域 */}
        <div className="relative px-5 py-2 border-t-2 border-gray-400/40">
          <div className="flex items-center justify-start text-sm">
            <span className="text-gray-900 font-medium">{server.description}</span>
          </div>
        </div>

        {/* 负载进度条区域 */}
        <div className="relative px-5 py-2 border-t-2 border-gray-400/40">
          <div className="mb-2">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-700">玩家数量</span>
              <span className="text-gray-900 font-medium">
                {server.activePlayerCount}/{server.maxPlayers}
              </span>
            </div>
            <div className="w-full bg-gray-700/30 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all bg-gradient-to-r ${statusGradients[server.status]}`}
                style={{ width: `${loadPercentage}%` }}
              />
            </div>
          </div>
          
          {/* AI玩家数 */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700">AI玩家数</span>
            <span className="text-gray-900 font-medium">990</span>
          </div>
        </div>

        {/* 操作按钮区域 */}
        <div className="relative px-5 py-3 border-t-2 border-gray-400/40">
          <button
            onClick={(e) => {
              e.stopPropagation();
              !isFull && onSelect && onSelect(server);
            }}
            disabled={isFull}
            className={`
              w-full py-2 px-4 rounded-lg font-medium transition-all
              border-2 border-yellow-600
              ${isFull
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-transparent text-gray-900 hover:bg-yellow-600/20 hover:shadow-lg'
              }
            `}
          >
            {isFull ? '🔒 服务器已满' : '⚔️ 选择服务器'}
          </button>
        </div>

        {/* 已满遮罩 */}
        {isFull && (
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center rounded-[10px]">
            <div className="text-center">
              <div className="text-6xl mb-2">🔒</div>
              <div className="text-white font-bold text-lg">服务器已满</div>
              <div className="text-gray-400 text-sm">请选择其他服务器</div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

