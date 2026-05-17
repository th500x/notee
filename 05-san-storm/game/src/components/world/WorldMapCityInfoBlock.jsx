/**
 * 大地图单城信息主体：与战略格网 tooltip 同结构。
 * 分段：**城备**（攻城/驻地/披挂等）、**城况**（五维/特色资源/简介）、**荒郊** / **集市**（内嵌 `ExploreLocationDockPanel`）。
 *
 * 规则口径与后端一致：`garrisonService` 驻地槽激活≥800；攻城开战上阵编组≥200；
 * 披挂 PVP 接战条件见 `cityService`。
 */
import { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import ExploreLocationDockPanel from '@/components/event/ExploreLocationDockPanel';
import BanditStrongholdDockPanel from '@/components/event/BanditStrongholdDockPanel';
import { filterPlayerItemsForExploreLocation } from '@/components/event/eventUtils';
import WorldMapCityCombatSummaryBlock from '@/components/world/WorldMapCityCombatSummaryBlock';
import { PHASE } from '@/components/event/EventConstants';
import { useBanditRaidQuota } from '@/hooks/useBanditRaidQuota';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { validateMainLineupBattleGate } from '@/utils/mainLineupTroops';
import { buildBanditLayerSmallMapPveLoot } from '@shared/utils/banditRaidLayerRewards';
import { banditNpcSlotRaritiesFromLayer } from '@shared/utils/smallMapEnemyRoster';

function fmtStat(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return String(n);
}

const MAIN_CITY_CHANGE_COST_SILVER = 500;
const MAIN_CITY_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** 战略格 tooltip：按主城 `city_id` 记住上次停留的荒郊/集市分段，探索返回后重开同城可直达，便于连点探索 */
const lastStrategicSubsidiarySegmentByCityId = new Map();
const PERSIST_STRATEGIC_SUBSIDIARY_SEGMENTS = new Set(['wilderness', 'market']);

/** 由 `WorldStrategicMapGrid` 在探索结束后主动重建城池 portal 前调用，使面板默认落在荒郊/集市 */
export function primeStrategicCityWildernessMarketTab(cityId, segment) {
  if (!cityId || String(cityId).trim() === '') return;
  if (segment === 'wilderness' || segment === 'market') {
    lastStrategicSubsidiarySegmentByCityId.set(String(cityId), segment);
  }
}

export default function WorldMapCityInfoBlock({
  cityTitle,
  /** 副标题一行；无则不占行（仅「城备」分段显示） */
  subtitleText = null,
  factionId = null,
  factionLabel = '中立',
  regionLabel = '',
  /** 长官展示名；无任命时为「暂无」 */
  lordDisplayLabel = '暂无',
  /** `cities.defense`，null 时防守系数显示 — */
  cityDefenseCoefficient = null,
  /** 「城况」分段数据，来自 `worldMapCityOverviewFromRow` */
  cityOverview = null,
  playerId = null,
  siegeQuota = null,
  siegeLoading = false,
  /** null：显示 —（披挂人数未拉到） */
  onDutyCount = null,
  /** null：驻地已用槽显示 — */
  garrisonSlotCount = null,
  garrisonCap = null,
  npcAlive = null,
  npcTotal = '?',
  /** 与玩家同势力为「不可攻打」，否则「可攻打」（worldMapCitySiegeTargetLabel） */
  siegeTargetLabel = '可攻打',
  /** 非空时仅渲染标题 + 错误说明（城况未同步等） */
  syncErrorMessage = null,
  /**
   * 战略格：`true` 时保留完整城况/匪寨信息展示，但隐藏驻军、攻城、荒郊集市探索、匪寨攻打等 **可操作** 入口（角色未立于该 POI）。
   */
  poiInteractionsLocked = false,
  /** 攻打按钮用短城名（`worldMapCityBaseNameFromRow`） */
  cityBaseName = '城池',
  /** 与 buildWorldMapCityPanelProps：同势力且已登录且有 cityId */
  showOwnCityActions = false,
  /** `cities.city_type`，用于「设为主城」仅大城/中城 */
  cityType = null,
  mainCityId = null,
  mainCityChangedAt = null,
  playerSilver = null,
  /** async (cityId) => void */
  onSetMainCityRequest = null,
  onSetMainCityError = null,
  /** 已是主城时「驻军所」入口；`(cityId, cityBaseName?) => void` */
  onOpenBarracksPost = null,
  /** 「三公府」：官职晋升、互动（朝贡等）·朝政占位；`(cityId, cityBaseName?) => void` */
  onOpenSanGongFu = null,
  cityId = null,
  /** 匪寨地图对象 ID（`san_*_bandit_*`）；与行军 `targetPoiId` 同族。匪寨面板勿用 `cityId`。 */
  banditPoiId = null,
  onOpenGarrison,
  playerOnDutyForThisCity = false,
  /** async (cityId, nextOnDuty) => void */
  onToggleDutyRequest,
  onDutyError,
  /** 可选：披挂等操作成功后的额外回调（战略格网已不再用于关 tooltip；见 `WorldStrategicMapGrid`） */
  onAfterOwnCityAction,
  /** 荒郊/集市：`buildWorldMapCityPanelProps` + `cityById` 解析 */
  subsidiaryExplore = null,
  /**
   * 荒郊/集市分段内嵌探索条（`ExploreLocationDockPanel`）。
   * `WorldMap` 注入：`{ quota, eventsLoading, explorePoolAt, startExplore, playerItems, isTutorial, phase, citiesList, itemNameMap }`
   */
  subsidiaryExploreEmbed = null,
  /** 战略 tooltip：开始探索后关闭浮层（可选） */
  closeStrategicCityTooltip = null,
  /**
   * 仅战略格网 tooltip：为 true 时城备内容区固定宽高基准（与阳翟满配一致），不按城逐测 ResizeObserver。
   */
  uniformStrategicPanel = false,
  /** 非己方且可攻打时，由上层注入（战略 tooltip 内发起攻城） */
  onStartSiege = null,
  /** 匪寨：扣次成功后 `(payload) => void`，payload 见攻打按钮内组装 */
  onStartBanditRaid = null,
  /** 与攻城一致的战略门闸；非空时展示在攻打按钮下方 */
  banditRaidStartBlockedReason = null,
  /** 匪寨战后 bump，用于刷新 `useBanditRaidQuota` */
  postBanditRaidRefreshKey = 0,
  /** 为 true 时仅渲染匪寨攻打面板（依赖 **`banditPoiId`**，与行军 `targetPoiId` 同族） */
  isBanditStronghold = false,
  /**
   * PVP 攻方大本营战略格：披挂/驻地固定为无；攻城次数仍按 **`siegeQuotaCityId`**（目标城）桶。
   */
  pvpAttackerBaseCampStrategic = false,
}) {
  const [dutyBusy, setDutyBusy] = useState(false);
  const [mainCityBusy, setMainCityBusy] = useState(false);
  const [segment, setSegment] = useState('garrison');
  /** 供「写入 Map」effect 判断：仅当用户从非城备切到城备时才清记忆，避免挂载时初始 `garrison` 误删 `primeStrategicCityWildernessMarketTab` 写入的值 */
  const prevSegmentForPersistRef = useRef(null);
  /** 以「城备」实测宽高为各分段内容区尺寸，切换标签外框不跳；不设区内滚动（overflow 隐藏溢出） */
  const [tabPaneSizePx, setTabPaneSizePx] = useState(null);
  const garrisonMeasureRef = useRef(null);

  const wild = subsidiaryExplore?.wilderness ?? null;
  const mkt = subsidiaryExplore?.market ?? null;

  const ov = cityOverview ?? {};

  const banditQuota = useBanditRaidQuota(
    isBanditStronghold ? playerId : null,
    isBanditStronghold ? banditPoiId : null,
  );
  const { refresh: refreshBanditQuota } = banditQuota;
  const { cards: lineupCards, player: lineupPlayer } = usePlayerContext();
  const [banditAttackNote, setBanditAttackNote] = useState('');

  useEffect(() => {
    if (!isBanditStronghold || !banditPoiId) return;
    void refreshBanditQuota();
  }, [postBanditRaidRefreshKey, isBanditStronghold, banditPoiId, refreshBanditQuota]);

  const renderSubsidiaryExplorePanel = (kind, info) => {
    if (poiInteractionsLocked && uniformStrategicPanel) {
      return (
        <div className="text-stone-500 text-xs py-6 px-2 text-center leading-snug">
          抵达该城后方可进行荒郊/集市探索。
        </div>
      );
    }
    if (!subsidiaryExploreEmbed || !info?.cityId) return null;
    const loc = info.cityId;
    const subsidiaryKind = kind === 'market' ? 'market' : 'wilderness';
    const poolEvents = subsidiaryExploreEmbed.explorePoolAt(loc, subsidiaryKind);
    const poolLen = poolEvents.length;
    /** 教程链未完成时池内仅 `chain_tutorial_v1`（见 `filterExploreEventsPool`）；按真实 `poolLen` 判空，勿用 `!isTutorial` 伪造可点。 */
    const poolEmpty =
      subsidiaryExploreEmbed.phase === PHASE.IDLE &&
      !subsidiaryExploreEmbed.eventsLoading &&
      poolLen <= 0;
    const canStart =
      subsidiaryExploreEmbed.phase === PHASE.IDLE &&
      !subsidiaryExploreEmbed.eventsLoading &&
      poolLen > 0 &&
      subsidiaryExploreEmbed.quota.canExplore;
    const exploreItems = filterPlayerItemsForExploreLocation(
      subsidiaryExploreEmbed.playerItems,
      loc,
    );
    return (
      <ExploreLocationDockPanel
        title={info.displayName}
        eventsLoading={subsidiaryExploreEmbed.eventsLoading}
        quota={subsidiaryExploreEmbed.quota}
        poolLen={poolLen}
        poolEmpty={poolEmpty}
        exploreItems={exploreItems}
        canStart={canStart}
        onStartExplore={() => {
          if (typeof closeStrategicCityTooltip === 'function') closeStrategicCityTooltip();
          subsidiaryExploreEmbed.startExplore(loc, { subsidiaryKind });
        }}
        colorTheme={kind === 'market' ? 'emerald' : 'amber'}
        startEmoji={kind === 'market' ? '🏪' : '📜'}
        rootClassName="max-h-56 border-0 px-2 py-2"
        showEnemyTroopRarityHint={kind === 'wilderness'}
        exploreLocationId={loc}
        poolEvents={poolEvents}
        wildernessCityType={kind === 'wilderness' ? cityType : null}
        citiesList={subsidiaryExploreEmbed.citiesList ?? null}
        itemNameMap={subsidiaryExploreEmbed.itemNameMap ?? {}}
      />
    );
  };

  useLayoutEffect(() => {
    if (isBanditStronghold || !cityId) {
      prevSegmentForPersistRef.current = null;
      setSegment('garrison');
      return;
    }
    prevSegmentForPersistRef.current = null;
    const saved = lastStrategicSubsidiarySegmentByCityId.get(String(cityId));
    if (PERSIST_STRATEGIC_SUBSIDIARY_SEGMENTS.has(saved)) setSegment(saved);
    else setSegment('garrison');
  }, [cityId, isBanditStronghold]);

  useEffect(() => {
    if (isBanditStronghold || !cityId) return;
    const prev = prevSegmentForPersistRef.current;
    prevSegmentForPersistRef.current = segment;
    if (PERSIST_STRATEGIC_SUBSIDIARY_SEGMENTS.has(segment)) {
      lastStrategicSubsidiarySegmentByCityId.set(String(cityId), segment);
    } else if (segment === 'garrison' && prev != null && prev !== 'garrison') {
      lastStrategicSubsidiarySegmentByCityId.delete(String(cityId));
    }
  }, [cityId, segment, isBanditStronghold]);

  useEffect(() => {
    if (!uniformStrategicPanel) setTabPaneSizePx(null);
  }, [cityId, banditPoiId, uniformStrategicPanel]);

  useEffect(() => {
    setBanditAttackNote('');
  }, [banditPoiId]);

  useLayoutEffect(() => {
    if (uniformStrategicPanel) return undefined;
    if (segment !== 'garrison') return undefined;
    const el = garrisonMeasureRef.current;
    if (!el) return undefined;
    const apply = () => {
      const r = el.getBoundingClientRect();
      const w = Math.ceil(r.width);
      const h = Math.ceil(r.height);
      if (w > 0 && h > 0) setTabPaneSizePx({ width: w, height: h });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [segment, cityId, banditPoiId, uniformStrategicPanel]);

  const canShowSetMainCityBtn =
    showOwnCityActions &&
    cityId &&
    (cityType === 'city_major' || cityType === 'city_medium') &&
    typeof onSetMainCityRequest === 'function';

  const isCurrentMain =
    mainCityId != null && cityId != null && String(mainCityId) === String(cityId);
  const hadMainBefore = mainCityId != null && String(mainCityId).trim() !== '';
  const needsPaidChange = hadMainBefore && !isCurrentMain;
  const silverNum = Number(playerSilver);
  const silverOk = Number.isFinite(silverNum) && silverNum >= MAIN_CITY_CHANGE_COST_SILVER;
  const changedMs =
    mainCityChangedAt != null && mainCityChangedAt !== ''
      ? new Date(mainCityChangedAt).getTime()
      : null;
  const inCooldown =
    needsPaidChange &&
    (changedMs == null ||
      Number.isNaN(changedMs) ||
      Date.now() - changedMs < MAIN_CITY_CHANGE_COOLDOWN_MS);

  /** 仅「设为主城」按钮：已是主城时不展示该按钮，故不含 isCurrentMain */
  const setMainCityButtonDisabled =
    !canShowSetMainCityBtn ||
    (needsPaidChange && (!silverOk || inCooldown));

  let mainCityTitle = '设为本势力大城/中城的主城（存卡）';
  if (isCurrentMain) mainCityTitle = '当前已为主城';
  else if (needsPaidChange && !silverOk)
    mainCityTitle = `银两不足，更换需 ${MAIN_CITY_CHANGE_COST_SILVER} 银两`;
  else if (needsPaidChange && inCooldown) {
    const left =
      changedMs != null && !Number.isNaN(changedMs)
        ? MAIN_CITY_CHANGE_COOLDOWN_MS - (Date.now() - changedMs)
        : MAIN_CITY_CHANGE_COOLDOWN_MS;
    const minLeft = Math.max(1, Math.ceil(left / 60000));
    mainCityTitle = `更换冷却中，约 ${minLeft} 分钟后可再次更换`;
  } else if (needsPaidChange)
    mainCityTitle = `消耗 ${MAIN_CITY_CHANGE_COST_SILVER} 银两更换主城（24 小时内仅可更换一次）`;
  else mainCityTitle = '首次设置主城免费';

  const handleSetMainCityClick = useCallback(async () => {
    if (!cityId || !onSetMainCityRequest || mainCityBusy || isCurrentMain || setMainCityButtonDisabled) return;
    setMainCityBusy(true);
    try {
      await onSetMainCityRequest(cityId);
    } catch (e) {
      onSetMainCityError?.(e?.message || '设置主城失败');
    } finally {
      setMainCityBusy(false);
    }
  }, [
    cityId,
    onSetMainCityRequest,
    mainCityBusy,
    isCurrentMain,
    setMainCityButtonDisabled,
    onSetMainCityError,
  ]);

  const handleOpenBarracksPost = useCallback(() => {
    if (!cityId || typeof onOpenBarracksPost !== 'function') return;
    if (typeof closeStrategicCityTooltip === 'function') closeStrategicCityTooltip();
    onOpenBarracksPost(cityId, cityBaseName);
  }, [cityId, cityBaseName, onOpenBarracksPost, closeStrategicCityTooltip]);

  const handleOpenSanGongFu = useCallback(() => {
    if (!cityId || typeof onOpenSanGongFu !== 'function') return;
    if (typeof closeStrategicCityTooltip === 'function') closeStrategicCityTooltip();
    onOpenSanGongFu(cityId, cityBaseName);
  }, [cityId, cityBaseName, onOpenSanGongFu, closeStrategicCityTooltip]);

  const handleToggleDuty = useCallback(async () => {
    if (!cityId || !onToggleDutyRequest || dutyBusy) return;
    const next = !playerOnDutyForThisCity;
    setDutyBusy(true);
    try {
      const ok = await onToggleDutyRequest(cityId, next);
      if (ok) onAfterOwnCityAction?.();
    } catch (e) {
      onDutyError?.(e?.message || '操作失败');
    } finally {
      setDutyBusy(false);
    }
  }, [
    cityId,
    onToggleDutyRequest,
    dutyBusy,
    playerOnDutyForThisCity,
    onDutyError,
    onAfterOwnCityAction,
  ]);

  const showActions =
    showOwnCityActions &&
    cityId &&
    typeof onOpenGarrison === 'function' &&
    typeof onToggleDutyRequest === 'function';

  const showEnemySiege =
    !showOwnCityActions &&
    !!playerId &&
    typeof onStartSiege === 'function' &&
    (siegeTargetLabel === '可攻打' ||
      (pvpAttackerBaseCampStrategic && siegeTargetLabel === '可出击'));

  const segBtn = (key, label) => (
    <button
      key={key}
      type="button"
      onClick={() => setSegment(key)}
      className={`flex-1 min-w-0 py-1.5 px-1 text-[10px] font-bold transition-colors border-r border-stone-600 last:border-r-0 ${
        segment === key
          ? 'bg-amber-900/70 text-amber-100'
          : 'bg-stone-800/90 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
      }`}
    >
      {label}
    </button>
  );

  if (syncErrorMessage) {
    return (
      <div className="text-sm text-stone-200">
        <div className="font-medium text-red-200/95">
          {cityTitle}
          <span className="text-stone-400 font-normal text-xs ml-1">· {siegeTargetLabel}</span>
        </div>
        <div className="text-stone-400 text-xs mt-0.5">{syncErrorMessage}</div>
      </div>
    );
  }

  if (isBanditStronghold && banditPoiId && uniformStrategicPanel && !playerId) {
    return (
      <div className="text-sm text-stone-200 wm-city-info-block min-w-0 w-full px-3 py-2">
        <div className="font-medium text-amber-200/95 leading-tight">{cityTitle}</div>
        <div className="text-stone-400 text-xs mt-2">登录后可查看攻打次数与敌军稀有度区间。</div>
      </div>
    );
  }

  if (isBanditStronghold && banditPoiId && uniformStrategicPanel) {
    return (
      <div className="text-sm text-stone-200 wm-city-info-block min-w-0 w-full">
        <BanditStrongholdDockPanel
          title={cityTitle}
          difficultyHint={banditQuota.difficultyHint}
          nextLayer={banditQuota.nextLayer}
          personalTotalLayers={banditQuota.personalTotalLayers}
          worldDurability={banditQuota.worldDurability}
          loading={!banditQuota.loaded}
          remaining={banditQuota.remaining}
          max={banditQuota.max}
          minutesUntilRefill={banditQuota.minutesUntilRefill}
          refillPerWindow={banditQuota.refillPerWindow}
          interactionsLocked={!!poiInteractionsLocked}
          canAttack={!!banditQuota.loaded && banditQuota.canBattle}
          onAttack={async () => {
            setBanditAttackNote('');
            if (typeof onStartBanditRaid !== 'function') {
              setBanditAttackNote('攻打入口未就绪');
              return;
            }
            if (banditRaidStartBlockedReason && String(banditRaidStartBlockedReason).trim()) {
              setBanditAttackNote(String(banditRaidStartBlockedReason).trim());
              return;
            }
            if (!banditQuota.loaded || !banditQuota.canBattle) {
              setBanditAttackNote('当前不可攻打（次数、个人塔进度或全服耐久已达上限）');
              return;
            }
            if (banditQuota.towerCompleted) {
              setBanditAttackNote('本寨个人塔已通关。');
              return;
            }
            const attackedLayer = Number(banditQuota.nextLayer);
            if (!Number.isFinite(attackedLayer) || attackedLayer < 1) {
              setBanditAttackNote('层进度异常，请稍后重开面板。');
              return;
            }
            const gate = validateMainLineupBattleGate({
              cards: lineupCards,
              playerUnits: null,
              playerFood: lineupPlayer?.food ?? 0,
            });
            if (!gate.ok) {
              setBanditAttackNote(gate.message || '无法开战');
              return;
            }
            const cr = await banditQuota.consume();
            if (!cr.ok) {
              const err =
                typeof cr.error === 'string' && cr.error.trim()
                  ? cr.error.trim()
                  : '攻打次数不足或条件不满足';
              setBanditAttackNote(err);
              return;
            }
            const enemySlotRarities = banditNpcSlotRaritiesFromLayer(attackedLayer);
            const lootBase = buildBanditLayerSmallMapPveLoot(attackedLayer);
            onStartBanditRaid({
              banditPoiId,
              attackedLayer,
              enemySlotRarities,
              smallMapPveLoot: {
                ...lootBase,
                banditRaidSettlement: { banditPoiId, attackedLayer },
              },
            });
          }}
        />
        {banditAttackNote ? (
          <div className="text-center text-[10px] text-amber-200/90 px-2 py-1">{banditAttackNote}</div>
        ) : null}
      </div>
    );
  }

  const subtitle = siegeLoading ? '准备中...' : subtitleText;

  const garrisonBody = (
    <>
      {subtitle != null && subtitle !== '' ? (
        <div className="text-stone-400 text-xs mt-0.5">{subtitle}</div>
      ) : null}
      <div className="text-stone-300 text-xs mt-2 border-t border-stone-600 pt-2">
        <div className="flex gap-2 items-start">
          <div className="flex-1 min-w-0 space-y-0.5">
            <div>
              长官：<span className="text-amber-200/90">{lordDisplayLabel}</span>
            </div>
            <div>
              势力：
              <span className={factionId ? 'text-amber-200' : 'text-stone-400'}>{factionLabel}</span>
            </div>
            <div>
              州郡：<span className="text-stone-200">{regionLabel || '—'}</span>
            </div>
          </div>
          {canShowSetMainCityBtn ? (
            <div className="shrink-0 self-start flex flex-row flex-wrap gap-1 justify-end max-w-[11rem]">
              <button
                type="button"
                disabled={typeof onOpenSanGongFu !== 'function'}
                title={typeof onOpenSanGongFu === 'function' ? '三公府：官职晋升等' : '敬请期待'}
                onClick={handleOpenSanGongFu}
                className="py-1.5 px-1.5 text-[10px] font-bold rounded-md border border-amber-800/50 bg-stone-800/90 text-amber-100/95 hover:bg-stone-800 hover:border-amber-600/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-stone-800/90"
              >
                三公府
              </button>
              {isCurrentMain ? (
                <button
                  type="button"
                  disabled={typeof onOpenBarracksPost !== 'function'}
                  title={
                    typeof onOpenBarracksPost === 'function'
                      ? '军营与主城驻军所仓库（转入/转出）'
                      : '敬请期待'
                  }
                  onClick={handleOpenBarracksPost}
                  className="py-1.5 px-1.5 text-[10px] font-bold rounded-md border border-stone-600 bg-stone-800/90 text-stone-200 hover:bg-stone-800 hover:text-stone-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-stone-800/90"
                >
                  驻军所
                </button>
              ) : (
                <button
                  type="button"
                  disabled={setMainCityButtonDisabled || mainCityBusy}
                  title={mainCityTitle}
                  onClick={handleSetMainCityClick}
                  className="py-1.5 px-1.5 text-[10px] font-bold rounded-md border border-stone-600 bg-stone-800/90 text-stone-200 hover:bg-stone-800 hover:text-stone-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-stone-800/90"
                >
                  {mainCityBusy ? '…' : '设为主城'}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
      <div className="text-stone-300 text-xs mt-2 border-t border-stone-600 pt-2">
        {!playerId ? (
          <>
            ⚔️ 战斗：<span className="text-stone-400">登录后可见</span>
          </>
        ) : !siegeQuota?.loaded ? (
          <>
            ⚔️ 战斗：<span className="text-stone-400">加载中…</span>
          </>
        ) : (
          <>
            ⚔️ 战斗：
            <span className={siegeQuota.remaining > 0 ? 'text-green-400' : 'text-red-400'}>
              {siegeQuota.remaining}/{siegeQuota.max}
            </span>
            {siegeQuota.remaining < siegeQuota.max && !siegeQuota.inRestPeriod ? (
              <span className="text-stone-500 ml-1">（{siegeQuota.minutesUntilRefill}分后补充）</span>
            ) : null}
          </>
        )}
      </div>
      {playerId ? (
        <div className="text-stone-500 text-[10px] mt-1">
          每小时+{siegeQuota?.refillPerHour ?? 6}次 · 上限{siegeQuota?.max ?? 18}次 · 0:00~8:00💤
        </div>
      ) : null}
      <WorldMapCityCombatSummaryBlock
        className="mt-2"
        pvpAttackerBaseCampStrategic={pvpAttackerBaseCampStrategic}
        onDutyCount={onDutyCount}
        garrisonSlotCount={garrisonSlotCount}
        garrisonCap={garrisonCap}
        npcAlive={npcAlive}
        npcTotal={npcTotal}
        cityDefenseCoefficient={cityDefenseCoefficient}
      />
      {showActions ? (
        <div className="mt-3 space-y-1.5">
          <button
            type="button"
            onClick={onOpenGarrison}
            className="w-full py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-700 to-yellow-700 text-amber-100"
          >
            🏰 驻地编组
          </button>
          <button
            type="button"
            disabled={dutyBusy}
            onClick={handleToggleDuty}
            className={`w-full py-2 rounded-lg text-xs font-bold ${
              playerOnDutyForThisCity
                ? 'bg-gradient-to-r from-green-700 to-emerald-700 text-green-100 flex items-center justify-between gap-2 px-2.5'
                : 'bg-gradient-to-r from-stone-700 to-stone-600 text-stone-300'}`}
          >
            {dutyBusy ? (
              '…'
            ) : playerOnDutyForThisCity ? (
              <>
                <span className="shrink-0">⚔️ 驻守待机中...</span>
                <span className="max-w-[58%] text-right text-[9px] font-normal leading-tight text-green-100/75">
                  （守方兵力≥800；攻方兵力≥200）
                </span>
              </>
            ) : (
              '🛡️ 披挂上阵'
            )}
          </button>
        </div>
      ) : null}
      {showEnemySiege ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => onStartSiege()}
            disabled={siegeLoading || !siegeQuota?.loaded || !siegeQuota.canSiege}
            className="w-full py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-red-700 to-orange-700 text-white disabled:from-stone-700 disabled:text-stone-500"
          >
            {siegeLoading
              ? '准备中...'
              : !siegeQuota?.loaded
                ? '攻城次数加载中…'
                : !siegeQuota.canSiege
                  ? '次数不足'
                  : pvpAttackerBaseCampStrategic
                    ? '⚔️ 攻打大本营'
                    : `⚔️ 攻打${cityBaseName}`}
          </button>
        </div>
      ) : null}
    </>
  );

  const overviewBody = (
    <div className="text-stone-300 text-xs mt-2 space-y-1 border-t border-stone-600 pt-2">
      <div>人口：<span className="text-stone-200">{fmtStat(ov.population)}</span></div>
      <div>商业：<span className="text-stone-200">{fmtStat(ov.trading)}</span></div>
      <div>农业：<span className="text-stone-200">{fmtStat(ov.farming)}</span></div>
      <div>军事：<span className="text-stone-200">{fmtStat(ov.military)}</span></div>
      <div>文化：<span className="text-stone-200">{fmtStat(ov.culture)}</span></div>
      {ov.specialResourceName ? (
        <div>
          特色资源：<span className="text-amber-200/90">{ov.specialResourceName}</span>
        </div>
      ) : null}
      {ov.description ? (
        <div className="pt-1 text-stone-400 leading-snug whitespace-pre-wrap">{ov.description}</div>
      ) : null}
    </div>
  );

  const tabStrip = (
    <div
      className="flex mt-2 rounded-lg overflow-hidden border border-stone-600"
      role="tablist"
      aria-label="城池信息"
    >
      {segBtn('garrison', '城备')}
      {segBtn('overview', '城况')}
      {wild ? segBtn('wilderness', '🌿 荒郊') : null}
      {mkt ? segBtn('market', '🏪 集市') : null}
    </div>
  );

  const tabPaneStyle = uniformStrategicPanel
    ? undefined
    : tabPaneSizePx != null
      ? {
          width: tabPaneSizePx.width,
          height: tabPaneSizePx.height,
          overflow: 'hidden',
        }
      : undefined;

  /** 战略浮层荒郊/集市内嵌探索条：允许纵向滚动，避免固定外框裁切 */
  const tabPaneStyleEffective =
    uniformStrategicPanel &&
    tabPaneSizePx != null &&
    (segment === 'wilderness' || segment === 'market')
      ? {
          width: tabPaneSizePx.width,
          height: tabPaneSizePx.height,
          overflow: 'auto',
        }
      : tabPaneStyle;

  const mainColumn = (
    <div className={`min-w-0 flex flex-col${uniformStrategicPanel ? ' w-full flex-1' : ''}`}>
      <div className={`font-medium text-red-200/95${uniformStrategicPanel ? ' shrink-0' : ''}`}>
        {cityTitle}
        <span className="text-stone-400 font-normal text-xs ml-1">· {siegeTargetLabel}</span>
      </div>

      {uniformStrategicPanel ? (
        <div className="shrink-0">{tabStrip}</div>
      ) : (
        tabStrip
      )}
      <div className="wm-city-panel-tab-pane" style={tabPaneStyleEffective}>
        {segment === 'garrison' ? (
          <div ref={garrisonMeasureRef}>{garrisonBody}</div>
        ) : null}
        {segment === 'overview' ? overviewBody : null}
        {segment === 'wilderness' && wild ? renderSubsidiaryExplorePanel('wilderness', wild) : null}
        {segment === 'market' && mkt ? renderSubsidiaryExplorePanel('market', mkt) : null}
      </div>
    </div>
  );

  return (
    <div
      className={`text-sm text-stone-200 wm-city-info-block min-w-0${uniformStrategicPanel ? ' w-full' : ''}`}
    >
      {mainColumn}
    </div>
  );
}

