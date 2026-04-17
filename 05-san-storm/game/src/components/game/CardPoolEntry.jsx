/**
 * 卡池入口组件
 *
 * @description 大地图视图中，公告栏下方居中显示两个卡池入口（将领 / 部队）。
 *              属性重随入口已迁至编组 Tab → 玩家官职槽详情底部。
 *              PC 端 hover / 竖屏长按显示说明悬浮窗。
 *
 * 外层 `pointer-events-none`：本行在 GamePage 顶栏浮层（z-40）内占满宽度，若整行 `pointer-events-auto`
 * 会吞掉左侧大地图（州郡跳转等）的点击；仅各卡池按钮容器 `pointer-events-auto`。
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const LONG_PRESS_MS = 400;
const TOOLTIP_TEXT = '正式赛季根据势力城市发展度决定卡池质量/次数（概率），本次测试阶段固定卡池质量/次数（概率）';

function PoolButton({ icon, label, remaining, dailyLimit, onClick, tooltip, drawerOpen }) {
  const [showTip, setShowTip] = useState(false);
  const longTimer = useRef(null);
  const isLong = useRef(false);

  useEffect(() => {
    if (drawerOpen) setShowTip(false);
  }, [drawerOpen]);

  const onTouchStart = useCallback(() => {
    isLong.current = false;
    longTimer.current = setTimeout(() => { isLong.current = true; setShowTip(true); }, LONG_PRESS_MS);
  }, []);
  const onTouchEnd = useCallback((e) => {
    clearTimeout(longTimer.current);
    if (isLong.current) { setShowTip(false); e.preventDefault(); }
  }, []);
  const onTouchMove = useCallback(() => { clearTimeout(longTimer.current); }, []);

  const tipText = tooltip || TOOLTIP_TEXT;

  return (
    <div
      className="relative pointer-events-auto"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
    >
      <button
        onClick={onClick}
        className="relative w-[100px] h-[72px] rounded-xl overflow-hidden
                   border-2 border-amber-400/70 shadow-lg shadow-amber-500/30
                   bg-gradient-to-br from-amber-900/90 via-yellow-800/80 to-amber-900/90
                   hover:border-amber-300 hover:shadow-amber-400/50 active:scale-95
                   transition-all"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/20 to-transparent animate-shimmer" />
        <div className="relative flex flex-col items-center justify-center h-full">
          <span className="text-2xl">{icon}</span>
          <span className="text-amber-200 text-[10px] font-bold mt-0.5">{label}</span>
          <span className="text-amber-400/70 text-[9px]">{remaining}/{dailyLimit}</span>
        </div>
      </button>

      {showTip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50
                        w-56 px-3 py-2 bg-black/85 backdrop-blur-sm rounded-lg
                        text-amber-100/90 text-[10px] leading-relaxed
                        border border-amber-700/30 shadow-lg pointer-events-none">
          {tipText}
        </div>
      )}
    </div>
  );
}

export default function CardPoolEntry({
  troopRemaining,
  charRemaining,
  dailyLimit,
  onOpenPool,
  drawerOpen = false,
}) {
  return (
    <div className="pointer-events-none flex justify-center gap-4 mt-2">
      <PoolButton icon="🎴" label="将领卡池" remaining={charRemaining} dailyLimit={dailyLimit}
        drawerOpen={drawerOpen}
        onClick={() => onOpenPool('character')} />
      <PoolButton icon="⚔️" label="部队卡池" remaining={troopRemaining} dailyLimit={dailyLimit}
        drawerOpen={drawerOpen}
        onClick={() => onOpenPool('troop')} />
    </div>
  );
}
