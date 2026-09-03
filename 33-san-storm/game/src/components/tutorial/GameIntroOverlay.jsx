/**
 * 游戏特色介绍对话框（步骤1.5）
 * 
 * @description 角色创建完成后，进入游戏大地图时自动显示
 * 围绕屏幕中心点，按四方位（左上→右上→右下→左下）轮转显示
 * 卡片尺寸固定 256×384，与将领卡/部队卡统一
 * @see docs/00/10-core-system/10-1-TUTORIAL_SYSTEM.md 步骤1.5
 */

import { useState, useEffect, useCallback } from 'react';
import { gameIntroMessages } from '@/data/texts/gameIntroMessages';
import { ParchmentMessageCard } from '@/components/tutorial/ParchmentMessageCard';
import { getRandomGameIntroBackgroundUrl } from '@/utils/gameIntroBackground';

// 卡片固定尺寸（与将领卡/部队卡一致）
const CARD_W = 256;
const CARD_H = 384;
const GAP = 8; // 卡片与中心点的间距

// 四方位：围绕屏幕中心点
// 左上 → 右上 → 右下 → 左下 循环
const QUADRANTS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

/**
 * 根据象限计算卡片位置（围绕屏幕中心）
 * 返回 CSS transform 的 translate 值
 */
function getCardStyle(quadrant) {
  switch (quadrant) {
    case 'top-left':
      return { transform: `translate(calc(-50% - ${CARD_W / 2 + GAP}px), calc(-50% - ${CARD_H / 2 + GAP}px))` };
    case 'top-right':
      return { transform: `translate(calc(-50% + ${CARD_W / 2 + GAP}px), calc(-50% - ${CARD_H / 2 + GAP}px))` };
    case 'bottom-right':
      return { transform: `translate(calc(-50% + ${CARD_W / 2 + GAP}px), calc(-50% + ${CARD_H / 2 + GAP}px))` };
    case 'bottom-left':
      return { transform: `translate(calc(-50% - ${CARD_W / 2 + GAP}px), calc(-50% + ${CARD_H / 2 + GAP}px))` };
    default: // 空position → 居中
      return { transform: 'translate(-50%, -50%)' };
  }
}

// ========== 对话框卡片（固定尺寸 256×384） ==========
const IntroCard = ({ message, isVisible, quadrant }) => {
  const posStyle = getCardStyle(quadrant);

  return (
    <div
      className={`absolute top-1/2 left-1/2 transition-all duration-500 ease-out
        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
      style={{ width: CARD_W, height: CARD_H, ...posStyle }}
    >
      <ParchmentMessageCard
        className="w-full h-full"
        icon={message.icon}
        title={message.title}
        content={message.content}
        footer={<span className="text-xs text-amber-700/60 animate-pulse">点击继续 ▸</span>}
      />
    </div>
  );
};

// ========== 进度指示器 ==========
const ProgressDots = ({ total, current }) => (
  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        className={`w-2 h-2 rounded-full transition-all duration-300 ${
          i === current
            ? 'bg-amber-400 scale-125'
            : i < current ? 'bg-amber-600/60' : 'bg-white/30'
        }`}
      />
    ))}
  </div>
);

// ========== 主组件 ==========
const GameIntroOverlay = ({ onComplete }) => {
  // 每次显示4张卡片（一组），按组推进
  const [groupIndex, setGroupIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [bgPath] = useState(() => getRandomGameIntroBackgroundUrl());

  // 响应式：竖屏时缩小卡片
  const [isPortrait, setIsPortrait] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const messages = gameIntroMessages;

  // 将消息按4个一组分组，最后不足4个的单独一组
  const groups = [];
  for (let i = 0; i < messages.length; i += 4) {
    groups.push(messages.slice(i, i + 4));
  }
  const currentGroup = groups[groupIndex] || [];
  const isLastGroup = groupIndex >= groups.length - 1;

  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setIsVisible(false);
    const t = setTimeout(() => setIsVisible(true), 150);
    return () => clearTimeout(t);
  }, [groupIndex]);

  const handleClick = useCallback(() => {
    if (isExiting) return;
    if (isLastGroup) {
      setIsExiting(true);
      setIsVisible(false);
      setTimeout(() => onComplete?.(), 500);
    } else {
      setGroupIndex(prev => prev + 1);
    }
  }, [isLastGroup, isExiting, onComplete]);

  const handleSkip = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    setIsVisible(false);
    setTimeout(() => onComplete?.(), 500);
  }, [isExiting, onComplete]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClick, handleSkip]);

  if (currentGroup.length === 0) return null;

  return (
    <div
      className={`fixed inset-0 z-[220] cursor-pointer transition-opacity duration-500 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleClick}
    >
      {/* 背景图 + 遮罩 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}${bgPath})` }}
      >
        <div className="absolute inset-0 bg-black/55" />
      </div>

      {/* 跳过按钮 */}
      <button
        onClick={(e) => { e.stopPropagation(); handleSkip(); }}
        className="absolute top-4 right-4 z-10 px-3 py-1.5 text-xs text-white/50 
          hover:text-white/90 hover:bg-white/10 rounded transition-colors"
      >
        跳过全部 ✕
      </button>

      {/* 同时显示当前组的所有卡片 — 竖屏时整体缩放 */}
      <div
        className="absolute inset-0"
        style={isPortrait ? {
          transform: 'scale(0.58)',
          transformOrigin: 'center center'
        } : undefined}
      >
        {currentGroup.map((msg, i) => (
          <IntroCard
            key={msg.id}
            message={msg}
            isVisible={isVisible}
            quadrant={msg.position || ''}
          />
        ))}
      </div>

      {/* 进度指示器（按组） */}
      <ProgressDots total={groups.length} current={groupIndex} />
    </div>
  );
};

export default GameIntroOverlay;
