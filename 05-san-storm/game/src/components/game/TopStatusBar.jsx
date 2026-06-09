/**
 * 顶部状态栏
 *
 * @description 显示子页标题或大地图历法 + 四大资源 + 设置。窄屏（<sm）双行：
 * 上行标题/日期 + ⚙️，下行资源条，避免与资源横向挤占。
 */

import { useState, useEffect, useMemo } from 'react';
import { useGameTime } from '@/contexts/PlayerContext';
import { computeDisplayGameDate } from '@/utils/gameTime';
import PlayerTopResourceBadges from '@/components/game/PlayerTopResourceBadges';
import TabNotifyDot from '@/components/game/TabNotifyDot';

const TAB_TITLES = {
  lineup: '编组配置',
  faction: '势力',
  city: '主城',
  map: '世界地图',
};

function getXunLabel(day) {
  if (day <= 10) return '上旬';
  if (day <= 20) return '中旬';
  return '下旬';
}

const MAP_HUD_TOGGLE_BTN_CLASS =
  'shrink-0 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] sm:text-xs font-bold text-amber-100 bg-stone-900/75 border border-amber-600/50 shadow-sm active:scale-[0.98] transition-transform';

export default function TopStatusBar({
  activeTab,
  onOpenSidebar,
  mapHudButtonsVisible = true,
  onToggleMapHudButtons,
  personalCenterNotifyDot = false,
  onOpenDailyReport,
  dailyReportNotifyDot = false,
  seasonSettlementEntryVisible = false,
  onOpenSeasonSettlement,
}) {
  // CR A7（2026-04-29）：本组件只读 gameTime，用细粒度 hook 显式声明；
  // 待未来切到 selector 引擎后，玩家粮草滴答等不会再触发顶栏重渲染。
  const gameTime = useGameTime();
  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTimeTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const title = activeTab == null ? null : TAB_TITLES[activeTab] || '真三風雲';

  const mapGameDate = useMemo(() => {
    void timeTick;
    if (activeTab !== null || !gameTime) return null;
    return computeDisplayGameDate(gameTime);
  }, [activeTab, gameTime, timeTick]);

  const dateTitle = gameTime
    ? `锚点：${gameTime.anchorAt} · ${gameTime.realHoursPerGameDay}现实小时/游戏日`
    : undefined;

  const settingsBtn = (className = '') => (
    <button
      type="button"
      onClick={onOpenSidebar}
      className={`flex-shrink-0 text-xl text-white/80 hover:text-white active:scale-95 transition-all ${className}`}
      aria-label={personalCenterNotifyDot ? '个人中心，有可领取成就' : '个人中心'}
    >
      <span
        className={`relative inline-flex leading-none ${
          personalCenterNotifyDot ? 'pt-1 pr-1' : ''
        }`}
      >
        ⚙️
        {personalCenterNotifyDot ? <TabNotifyDot /> : null}
      </span>
    </button>
  );

  return (
    <div className="fixed top-0 left-0 right-0 z-50 overflow-hidden bg-gradient-to-r from-amber-900 to-amber-800 shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between sm:h-14 min-h-[4.5rem] sm:min-h-0 px-3 py-1 sm:py-0 gap-1 sm:gap-3">
      {/* 上行（窄屏）：标题/日期 + ⚙️；宽屏：仅左组 */}
      <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0 w-full sm:w-auto">
        <div className="flex items-center min-w-0 gap-2">
          {title != null && title !== '' && (
            <span className="text-white text-lg font-bold truncate">{title}</span>
          )}
          {mapGameDate && (
            <>
              <span
                className="sm:hidden text-amber-100/90 text-[11px] font-semibold tabular-nums truncate"
                title={dateTitle}
              >
                公元{mapGameDate.year}年{mapGameDate.month}月{getXunLabel(mapGameDate.day)}
              </span>
              <span
                className="hidden sm:inline text-amber-100/90 text-xs sm:text-sm font-semibold whitespace-nowrap tabular-nums shrink-0"
                title={dateTitle}
              >
                公元{mapGameDate.year}年{mapGameDate.month}月{getXunLabel(mapGameDate.day)}
              </span>
              {activeTab === null && typeof onOpenDailyReport === 'function' && (
                <button
                  type="button"
                  onClick={() => onOpenDailyReport()}
                  className={MAP_HUD_TOGGLE_BTN_CLASS}
                  aria-label={dailyReportNotifyDot ? '真三日报，今日尚未签到' : '真三日报'}
                >
                  <span
                    className={`relative inline-flex whitespace-nowrap ${
                      dailyReportNotifyDot ? 'pt-1 pr-1' : ''
                    }`}
                  >
                    真三日报
                    {dailyReportNotifyDot ? <TabNotifyDot /> : null}
                  </span>
                </button>
              )}
              {activeTab === null && typeof onToggleMapHudButtons === 'function' && (
                <button
                  type="button"
                  onClick={() => onToggleMapHudButtons()}
                  className={MAP_HUD_TOGGLE_BTN_CLASS}
                  aria-label={mapHudButtonsVisible ? '隐藏地图角按钮' : '显示地图角按钮'}
                >
                  <span className="whitespace-nowrap">
                    {mapHudButtonsVisible ? '隐藏按钮' : '显示按钮'}
                  </span>
                </button>
              )}
              {activeTab === null && seasonSettlementEntryVisible && typeof onOpenSeasonSettlement === 'function' && (
                <button
                  type="button"
                  onClick={() => onOpenSeasonSettlement()}
                  className={MAP_HUD_TOGGLE_BTN_CLASS}
                  aria-label="赛季结算"
                >
                  <span className="whitespace-nowrap">🏛️ 赛季结算</span>
                </button>
              )}
            </>
          )}
        </div>
        {settingsBtn('sm:hidden')}
      </div>

      {/* 下行（窄屏）= 资源；宽屏 = 与左组同一行 */}
      <div className="flex flex-1 items-center justify-between sm:justify-end gap-1 sm:gap-2 min-w-0 w-full sm:w-auto pb-0.5 sm:pb-0">
        <PlayerTopResourceBadges variant="map" />
        {settingsBtn('hidden sm:flex ml-1')}
      </div>
    </div>
  );
}
