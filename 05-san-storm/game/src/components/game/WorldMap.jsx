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
import BattleArena from '@/components/battle/BattleArena';
import { buildPlayerUnitsFromContext } from '@/utils/battlePlayerBuilder';
import { useSiegeQuota } from '@/hooks/useSiegeQuota';
import { PHASE } from '@/components/event/EventConstants';
import { playerAPI } from '@/services/playerApi';
import { API_CONFIG } from '@/constants';

const BG_CACHE_KEY = 'game_intro_bg';
const BG_DIR = 'assets/san_1_map/illus_bg/';
const DEFAULT_BG = 'av1_00001_.png';
const LONG_PRESS_MS = 400; // 长按阈值（毫秒）

const FACTION_NAMES = {
  san_1_faction_1001: '刘备', san_1_faction_2001: '曹操', san_1_faction_3001: '孙坚',
  san_1_faction_4001: '袁绍', san_1_faction_5001: '董卓', san_1_faction_6001: '汉室',
  san_1_faction_7001: '黄巾',
};
const FACTION_COLORS = {
  san_1_faction_1001: '#ef4444', san_1_faction_2001: '#3b82f6', san_1_faction_3001: '#22c55e',
  san_1_faction_4001: '#a855f7', san_1_faction_5001: '#f97316', san_1_faction_6001: '#eab308',
  san_1_faction_7001: '#78716c',
};

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
  const [cityTooltip, setCityTooltip] = useState(false);
  const canClick = !isTutorial && phase === PHASE.IDLE && !eventsLoading && exploreEvents.length > 0 && quota.canExplore;

  // ── 城市攻城状态 ──
  const CITY_ID = 'san_1_city_3_xinye';
  const siegeQuota = useSiegeQuota(player?.player_id, CITY_ID);
  const [cityInfo, setCityInfo] = useState(null);
  const [siegeData, setSiegeData] = useState(null); // 非null时进入战斗
  const [siegeResult, setSiegeResult] = useState(null); // 战斗结算
  const [siegeLoading, setSiegeLoading] = useState(false);
  const canSiege = !isTutorial && phase === PHASE.IDLE && siegeQuota.canSiege && !siegeData;

  // 加载城市信息 + 战事排行
  const [warData, setWarData] = useState(null);
  const refreshCity = useCallback(async () => {
    try {
      const [cityRes, warRes] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/cities/${CITY_ID}`).then(r => r.json()),
        fetch(`${API_CONFIG.BASE_URL}/cities/${CITY_ID}/active-war`).then(r => r.json()),
      ]);
      if (cityRes.success) setCityInfo(cityRes.data);
      if (warRes.success) setWarData(warRes.data);
    } catch {}
  }, []);
  useEffect(() => { refreshCity(); }, [refreshCity]);
  // tooltip 打开时刷新
  useEffect(() => { if (cityTooltip) refreshCity(); }, [cityTooltip]);

  // 发起攻城
  const startSiege = useCallback(async () => {
    if (!canSiege || !player?.player_id) return;
    setSiegeLoading(true);
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/cities/${CITY_ID}/siege`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player.player_id }),
      }).then(r => r.json());
      if (res.success) { siegeQuota.consume(); setSiegeData(res.data); setSiegeResult(null); }
    } catch {}
    setSiegeLoading(false);
  }, [canSiege, player, siegeQuota]);

  // 战斗结束
  const handleSiegeEnd = useCallback(async (result, silverSpent, scoreResult, killedIndices) => {
    if (!siegeData) return;
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/cities/siege-result`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warId: siegeData.warId, playerId: player.player_id,
          factionId: siegeData.playerFaction,
          killedIndices: killedIndices || [],
          result: result === 'victory' ? 'win' : 'lose',
          silverSpent: silverSpent || 0,
        }),
      }).then(r => r.json());
      if (res.success) {
        setSiegeResult(res.data);
      } else {
        // 后端报错，仍然显示结算页（无奖励数据）
        setSiegeResult({ npcKilled: 0, npcTotal: 0, silverReward: 0, error: res.error });
      }
    } catch (err) {
      console.error('[Siege] 结算请求失败:', err);
      setSiegeResult({ npcKilled: 0, npcTotal: 0, silverReward: 0, error: '结算请求失败' });
    }
    refreshCity();
    refresh();
  }, [siegeData, player, refreshCity, refresh]);

  const closeSiegeResult = useCallback(() => { setSiegeData(null); setSiegeResult(null); }, []);

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
      || tutorialSystem.showPreDialog || !!siegeData;
    onEventBusyChange?.(busy);
  }, [phase, tutorialSystem.showPreDialog, onEventBusyChange, siegeData]);

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
        className={`absolute cursor-pointer group ${showTooltip ? 'z-50' : 'z-30'}`}
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

      {/* 城市点：新野 */}
      <div
        className={`absolute cursor-pointer group ${cityTooltip ? 'z-50' : 'z-30'}`}
        style={{ left: '60%', top: '40%' }}
        onMouseEnter={() => setCityTooltip(true)}
        onMouseLeave={() => setCityTooltip(false)}
        onClick={() => { if (!isTutorial && phase === PHASE.IDLE) setCityTooltip(prev => !prev); }}
      >
        {!isTutorial && phase === PHASE.IDLE && (
          <div className="absolute inset-0 -m-4 rounded-full bg-red-400/30 animate-ping" />
        )}
        <div className={`relative text-4xl select-none transition-transform
          ${!isTutorial && phase === PHASE.IDLE ? 'hover:scale-125 active:scale-95' : 'opacity-50'}`}>
          🏯
        </div>
        {cityTooltip && (() => {
          const factionKills = warData?.faction_kills || {};
          const sortedFactions = Object.entries(factionKills).sort((a, b) => b[1] - a[1]);
          return (
            <>
              {/* 主 tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/80 rounded-lg backdrop-blur-sm whitespace-nowrap z-50">
                <div className="text-white text-sm font-medium">新野城</div>
                <div className="text-white/60 text-xs">
                  {siegeLoading ? '准备中...' : !siegeQuota.canSiege ? '攻城次数不足' : '小城 · 点击下方按钮攻打'}
                </div>
                <div className="text-white/80 text-xs mt-1 border-t border-white/20 pt-1">
                  ⚔️ 战斗：<span className={siegeQuota.remaining > 0 ? 'text-green-400' : 'text-red-400'}>
                    {siegeQuota.remaining}/{siegeQuota.max}
                  </span>
                  {siegeQuota.remaining < siegeQuota.max && !siegeQuota.inRestPeriod && (
                    <span className="text-white/40 ml-1">（{siegeQuota.minutesUntilRefill}分后补充）</span>
                  )}
                </div>
                <div className="text-white/30 text-[10px] mt-1">
                  每小时+{siegeQuota.refillPerHour}次 · 上限{siegeQuota.max}次 · 0:00~8:00💤
                </div>
                <div className="text-white/80 text-xs mt-1 border-t border-white/20 pt-1">
                  新野 · 小城
                  <br />NPC守军：<span className="text-amber-400">{cityInfo?.npc_garrison_alive ?? '?'}</span> / {cityInfo?.npc_garrison?.length ?? '?'}
                  <br />所属势力：<span className={cityInfo?.faction_id ? 'text-red-400' : 'text-gray-400'}>{cityInfo?.faction_id ? (FACTION_NAMES[cityInfo.faction_id] || '已占领') : '中立'}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); if (canSiege) startSiege(); }}
                  disabled={!canSiege || siegeLoading}
                  className="mt-2 w-full py-1.5 rounded text-xs font-bold transition-all
                    bg-gradient-to-r from-red-700 to-orange-700 text-white
                    hover:from-red-600 hover:to-orange-600
                    disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                  {siegeLoading ? '准备中...' : !siegeQuota.canSiege ? '次数不足' : '⚔️ 攻打新野'}
                </button>
              </div>
              {/* 势力击杀排行（tooltip 右侧） */}
              {sortedFactions.length > 0 && (
                <div className="absolute bottom-full left-full ml-2 mb-2 px-3 py-2 bg-black/80 rounded-lg backdrop-blur-sm whitespace-nowrap z-50">
                  <div className="text-amber-200 text-xs font-bold mb-1">⚔️ 势力战况</div>
                  {sortedFactions.map(([fid, kills], i) => (
                    <div key={fid} className="flex items-center justify-between gap-3 text-xs py-0.5">
                      <span style={{ color: FACTION_COLORS[fid] || '#ccc' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`} {FACTION_NAMES[fid] || '未知'}
                      </span>
                      <span className="text-amber-400 font-bold">{kills}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* 攻城战斗（复用 BattleArena） */}
      {siegeData && !siegeResult && (
        <BattleArena
          playerUnits={buildPlayerUnitsFromContext(player, cards)}
          enemyUnits={siegeData.npcGarrison}
          silverAmount={player?.silver ?? 0}
          playerId={player?.player_id}
          battleType="pve_siege"
          opponentName={`${siegeData.cityName}守军`}
          onBattleEnd={handleSiegeEnd}
        />
      )}

      {/* 攻城结算 */}
      {siegeResult && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-gray-900/95 rounded-xl p-6 border border-amber-500/30 max-w-sm w-full mx-4 text-center space-y-3">
            <div className="text-4xl">{siegeResult.npcKilled > (siegeResult.npcTotal - siegeResult.npcKilled) ? '⚔️' : '💀'}</div>
            <div className="text-xl font-bold text-amber-400">战斗结算</div>
            {siegeResult.silverReward > 0 && <div className="text-amber-300 text-sm">💰 获得 {siegeResult.silverReward} 银两</div>}
            {siegeResult.reputationReward > 0 && <div className="text-yellow-300 text-sm">⭐ 获得 {siegeResult.reputationReward} 声望</div>}
            {siegeResult.equipmentDrop && <div className="text-purple-300 text-sm">🎁 获得装备：{siegeResult.equipmentDrop.name}（{siegeResult.equipmentDrop.rarity}）</div>}
            <div className="text-sm text-gray-300">NPC守军：{siegeResult.npcKilled}/{siegeResult.npcTotal} 已消灭</div>
            {siegeResult.siegeCompleted && (
              <div className="bg-amber-900/50 border border-amber-500/30 rounded-lg p-3">
                <div className="text-amber-400 font-bold">🏰 城池攻破！</div>
              </div>
            )}
            <button onClick={closeSiegeResult}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-700 to-yellow-700 text-amber-100 font-bold text-sm">
              返回
            </button>
          </div>
        </div>
      )}

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
