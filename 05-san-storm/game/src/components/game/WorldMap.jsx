/**
 * 大地图组件
 * 
 * @description 显示大地图背景 + 可探索区域标记
 *              探索点直接在地图上显示，点击触发事件系统
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import useEventSystem from '@/hooks/useEventSystem';
import useTutorialEvents from '@/hooks/useTutorialEvents';
import ExplorePanel from '@/components/event/ExplorePanel';
import TutorialPreDialog from '@/components/event/TutorialPreDialog';
import { PHASE } from '@/components/event/EventConstants';
import { playerAPI } from '@/services/playerApi';

const BG_CACHE_KEY = 'game_intro_bg';
const BG_DIR = 'assets/san_1_map/illus_bg/';
const DEFAULT_BG = 'av1_00001_.png';
const LONG_PRESS_MS = 400; // 长按阈值（毫秒）

/** 从 localStorage 读取缓存的背景图路径 */
function getCachedBg() {
  try {
    const cached = localStorage.getItem(BG_CACHE_KEY);
    if (cached) {
      const { file } = JSON.parse(cached);
      if (file) return BG_DIR + file;
    }
  } catch {}
  return BG_DIR + DEFAULT_BG;
}

export default function WorldMap({ onEventBusyChange }) {
  const bgPath = getCachedBg();
  const baseUrl = import.meta.env.BASE_URL;

  const { player, cards, refresh } = usePlayerContext();
  const eventSystem = useEventSystem(player, cards);
  const tutorialSystem = useTutorialEvents(player, cards);
  const isTutorial = tutorialSystem.isActive;

  // 当前活跃的事件系统（tutorial 优先）
  const activeSystem = isTutorial ? tutorialSystem : eventSystem;
  const { phase } = activeSystem;
  const { quota, eventsLoading, exploreEvents, startExplore } = eventSystem;

  const [showTooltip, setShowTooltip] = useState(false);
  const canClick = !isTutorial && phase === PHASE.IDLE && !eventsLoading && exploreEvents.length > 0 && quota.canExplore;

  // 新手指引完成时，给满探索次数
  const prevTutorialRef = useRef(isTutorial);
  useEffect(() => {
    if (prevTutorialRef.current && !isTutorial) {
      // tutorial 刚从 active 变为 inactive → 新手指引完成
      quota.fillMax();
    }
    prevTutorialRef.current = isTutorial;
  }, [isTutorial]);

  // 加载玩家道具
  const [playerItems, setPlayerItems] = useState([]);
  const fetchItems = useCallback(() => {
    if (!player?.player_id) return;
    playerAPI.getItems(player.player_id)
      .then(res => {
        if (res.success) setPlayerItems(res.data.items || []);
      })
      .catch(() => {});
  }, [player?.player_id]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // 奖励发放后刷新道具列表和玩家资源
  useEffect(() => {
    if (phase === PHASE.RETURNING) {
      fetchItems();
      refresh();
    }
  }, [phase, fetchItems, refresh]);

  // 通知父组件事件是否进行中（隐藏底部Tab）
  useEffect(() => {
    const busy = [PHASE.EVENT, PHASE.ROLLING, PHASE.RESULT, PHASE.BATTLE, PHASE.REWARD, PHASE.MINIGAME, PHASE.RETURNING].includes(phase)
      || tutorialSystem.showPreDialog;
    onEventBusyChange?.(busy);
  }, [phase, tutorialSystem.showPreDialog, onEventBusyChange]);

  // 长按支持：区分长按（显示tooltip）和短按（触发探索）
  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);

  const handleTouchStart = useCallback((e) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setShowTooltip(true);
    }, LONG_PRESS_MS);
  }, []);

  const handleTouchEnd = useCallback((e) => {
    clearTimeout(longPressTimer.current);
    if (isLongPress.current) {
      // 长按结束 → 隐藏tooltip，不触发探索
      setShowTooltip(false);
      e.preventDefault(); // 阻止后续click事件
    }
    // 短按 → 不做处理，让onClick正常触发探索
  }, []);

  const handleTouchMove = useCallback(() => {
    // 手指移动 → 取消长按
    clearTimeout(longPressTimer.current);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* 背景地图 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${baseUrl}${bgPath})` }}
      />
      <div className="absolute inset-0 bg-black/10" />

      {/* 探索点：南阳荒郊 */}
      <div
        className="absolute z-10 cursor-pointer group"
        style={{ left: '35%', top: '55%' }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onClick={canClick ? startExplore : undefined}
      >
        {/* 脉冲动画 */}
        {canClick && (
          <div className="absolute inset-0 -m-4 rounded-full bg-amber-400/30 animate-ping" />
        )}
        <div className={`relative text-4xl select-none transition-transform
          ${canClick ? 'hover:scale-125 active:scale-95' : 'opacity-50'}`}>
          📜
        </div>
        {/* 悬浮提示（含探索次数） */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/80 rounded-lg backdrop-blur-sm whitespace-nowrap">
            <div className="text-white text-sm font-medium">南阳荒郊</div>
            <div className="text-white/60 text-xs">
              {eventsLoading ? '加载中...'
                : !quota.canExplore ? '探索次数不足'
                : `点击探索（${exploreEvents.length}种事件）`}
            </div>
            <div className="text-white/80 text-xs mt-1 border-t border-white/20 pt-1">
              🔍 探索：<span className={quota.remaining > 0 ? 'text-green-400' : 'text-red-400'}>
                {quota.remaining}/{quota.max}
              </span>
              {quota.remaining < quota.max && !quota.inRestPeriod && (
                <span className="text-white/40 ml-1">（{quota.minutesUntilRefill}分后补充）</span>
              )}
              {quota.inRestPeriod && (
                <span className="text-white/40 ml-1">（💤{quota.minutesUntilRefill}分后恢复）</span>
              )}
            </div>
            <div className="text-white/30 text-[10px] mt-1">
              每小时+{quota.refillPerHour}次 · 上限{quota.max}次 · 0:00~8:00💤
            </div>
            {playerItems.length > 0 && (
              <div className="text-white/80 text-xs mt-1 border-t border-white/20 pt-1">
                🎒 道具：
                {playerItems.map((item, i) => (
                  <span key={item.itemId} className="text-amber-300">
                    {i > 0 && '、'}{item.name}×{item.quantity}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 新手事件前置对话 */}
      {tutorialSystem.showPreDialog && tutorialSystem.preDialog && (
        <TutorialPreDialog
          dialog={tutorialSystem.preDialog}
          onClose={tutorialSystem.closePreDialog}
        />
      )}

      {/* 官职装配动画（新手事件获得官职后） */}
      {tutorialSystem.positionAnimation && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
          <div className="text-center animate-bounce">
            <div className="text-6xl mb-4">👑</div>
            <div className="text-amber-400 text-2xl font-bold mb-2">
              官职授予
            </div>
            <div className="text-white text-lg">
              {tutorialSystem.positionAnimation.positionName}
            </div>
            <div className="text-amber-300/60 text-sm mt-2">
              Lv.{tutorialSystem.positionAnimation.positionLevel}
            </div>
          </div>
        </div>
      )}

      {/* 编组引导（新手事件3结束后，引导玩家去编组） */}
      {tutorialSystem.showLineupGuide && (
        <div className="fixed inset-0 z-[150] pointer-events-none">
          {/* 半透明遮罩 */}
          <div className="absolute inset-0 bg-black/40" />
          {/* 提示文字 */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-center pointer-events-auto">
            <div className="bg-stone-900/90 border border-amber-500/50 rounded-xl px-6 py-4 shadow-2xl">
              <div className="text-amber-400 text-lg font-bold mb-2">⚔️ 编组部队</div>
              <div className="text-stone-300 text-sm mb-1">在继续征程之前，先装备你的将领和部队吧！</div>
              <div className="text-stone-400 text-xs">至少装备 1 支部队</div>
            </div>
          </div>
          {/* 指向左下角编组按钮的箭头 */}
          <div className="absolute bottom-20 left-24 pointer-events-none animate-bounce">
            <div className="text-4xl">👇</div>
            <div className="text-amber-400 text-xs font-bold mt-1">点击编组</div>
          </div>
        </div>
      )}

      {/* 事件面板（tutorial 或 explore） */}
      <ExplorePanel eventSystem={activeSystem} />
    </div>
  );
}
