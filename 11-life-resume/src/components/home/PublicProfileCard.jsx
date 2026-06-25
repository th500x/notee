import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatPublishedLifePathDisplayText } from '@shared/utils/lifeResumeLifePath.js';

const LONG_PRESS_MS = 500;

export default function PublicProfileCard({
  accountId,
  displayName,
  username,
  publicEntryCount = 0,
  publishedLifePath = null,
}) {
  const navigate = useNavigate();
  const [showLifePath, setShowLifePath] = useState(false);
  const longPressTimerRef = useRef(null);
  const suppressNavRef = useRef(false);
  const cardRef = useRef(null);
  const panelRef = useRef(null);

  const label = displayName || username || accountId;
  const countLabel =
    publicEntryCount > 0 ? `${publicEntryCount} 条公开片段` : '公开片段';
  const hasLifePath = !!publishedLifePath;
  const lifePathDisplayText = formatPublishedLifePathDisplayText(publishedLifePath);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  useEffect(() => {
    if (!showLifePath) return undefined;

    const handlePointerDown = (event) => {
      if (panelRef.current?.contains(event.target)) return;
      if (cardRef.current?.contains(event.target)) return;
      setShowLifePath(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showLifePath]);

  const handleTouchStart = () => {
    if (!hasLifePath) return;
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      setShowLifePath(true);
      suppressNavRef.current = true;
    }, LONG_PRESS_MS);
  };

  const handleTouchEnd = () => {
    clearLongPressTimer();
  };

  const handleClick = (event) => {
    if (suppressNavRef.current) {
      event.preventDefault();
      suppressNavRef.current = false;
    }
  };

  const handleLifePathWheel = (event) => {
    event.stopPropagation();
    const element = event.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = element;
    const atTop = scrollTop <= 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
    if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
      return;
    }
    event.preventDefault();
  };

  return (
    <div
      ref={cardRef}
      className="relative"
      onMouseEnter={hasLifePath ? () => setShowLifePath(true) : undefined}
      onMouseLeave={hasLifePath ? () => setShowLifePath(false) : undefined}
    >
      <Link
        to={`/u/${accountId}`}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-200 hover:shadow transition-colors"
      >
        <div
          className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold mb-3"
          aria-hidden="true"
        >
          {label.slice(0, 1).toUpperCase()}
        </div>
        <p className="font-semibold text-slate-900 truncate">{label}</p>
        <p className="text-xs text-slate-500 font-mono mt-0.5">{accountId}</p>
        <p className="text-xs text-slate-500 mt-2">{countLabel}</p>
        {hasLifePath && (
          <p className="text-xs text-indigo-600 mt-1">含人生轨迹 · 悬浮或长按查看</p>
        )}
      </Link>

      {hasLifePath && showLifePath && (
        <div
          className="absolute z-20 left-0 right-0 top-full pt-2"
          onMouseEnter={() => setShowLifePath(true)}
          onMouseLeave={() => setShowLifePath(false)}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-label="人生轨迹"
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg max-h-60 overflow-y-auto overscroll-y-contain touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onWheel={handleLifePathWheel}
            onTouchStart={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-xs font-semibold text-slate-500">人生轨迹</p>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-800 shrink-0 sm:hidden"
                onClick={() => setShowLifePath(false)}
              >
                收起
              </button>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {lifePathDisplayText}
            </p>
            <button
              type="button"
              className="mt-3 text-xs text-indigo-600 hover:underline"
              onClick={() => navigate(`/u/${accountId}`)}
            >
              进入时间轴
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
