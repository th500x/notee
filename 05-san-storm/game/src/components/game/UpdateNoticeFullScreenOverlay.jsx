/**
 * 更新公告：大地图首屏全屏层，点击任意处关闭（与开局介绍共用羊皮纸卡片与背景管线）
 * @see docs/30-frontend/32-3-ANNOUNCEMENTS.md
 */

import { useState, useEffect, useCallback } from 'react';
import { ParchmentMessageCard } from '@/components/tutorial/ParchmentMessageCard';
import { getRandomGameIntroBackgroundUrl } from '@/utils/gameIntroBackground';

export default function UpdateNoticeFullScreenOverlay({ notice, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);
  const [bgPath] = useState(() => getRandomGameIntroBackgroundUrl());

  const [isPortrait, setIsPortrait] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );
  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const finish = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => onDismiss?.(), 350);
  }, [isExiting, onDismiss]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  if (!notice) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-notice-title"
      className={`fixed inset-0 z-[210] cursor-pointer transition-opacity duration-300 ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      onClick={finish}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}${bgPath})` }}
      >
        <div className="absolute inset-0 bg-black/55" />
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
        className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-md
          text-amber-100/90 hover:bg-black/40 hover:text-amber-50 text-xl leading-none border border-amber-600/40"
        aria-label="关闭更新公告"
      >
        ×
      </button>

      <div
        className="absolute inset-0 flex items-center justify-center p-4 sm:p-6"
        onClick={finish}
      >
        <div
          className="pointer-events-none w-full flex justify-center"
          style={
            isPortrait
              ? { transform: 'scale(0.88)', transformOrigin: 'center center' }
              : undefined
          }
        >
          <div className="pointer-events-auto w-full max-w-2xl max-h-[min(85vh,40rem)] min-h-0 flex flex-col shadow-2xl">
            <div id="update-notice-title" className="sr-only">
              {notice.title}
            </div>
            <ParchmentMessageCard
              className="min-h-0 flex-1 max-h-[min(85vh,40rem)]"
              icon="📋"
              title={notice.title}
              content={notice.content || ''}
              footer={
                <span className="text-xs text-amber-700/70 animate-pulse">
                  点击任意处关闭
                </span>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
