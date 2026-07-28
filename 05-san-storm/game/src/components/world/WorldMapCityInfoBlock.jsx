/**
 * 大地图单城信息主体：与战略格网 tooltip 同结构。
 * 展示城备（攻城、五维与简介；右上「三公府」+「设为主城 / 驻军所」）及匪寨面板。
 *
 * 规则口径与后端一致：`garrisonService` 驻地槽激活≥800；攻城开战上阵编组≥200。
 * 驻地编组仅主城，入口在「驻军所」。
 */
import { useState, useCallback, useEffect } from 'react';
import BanditStrongholdDockPanel from '@/components/event/BanditStrongholdDockPanel';
import WorldMapCityCombatSummaryBlock from '@/components/world/WorldMapCityCombatSummaryBlock';
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

export default function WorldMapCityInfoBlock({
  cityTitle,
  /** 副标题一行；无则不占行 */
  subtitleText = null,
  factionId = null,
  factionLabel = '中立',
  regionLabel = '',
  /** 长官展示名；无任命时为「暂无」 */
  lordDisplayLabel = '暂无',
  /** `cities.defense`，null 时防守系数显示 — */
  cityDefenseCoefficient = null,
  /** 五维 / 特色 / 简介，展示于城备底部 */
  cityOverview = null,
  playerId = null,
  siegeQuota = null,
  siegeLoading = false,
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
   * 战略格：`true` 时保留完整城备/匪寨信息展示，但隐藏驻军、攻城、匪寨攻打等 **可操作** 入口（角色未立于该 POI）。
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
  /** 战略 tooltip：开始操作后关闭浮层（可选） */
  closeStrategicCityTooltip = null,
  /**
   * 仅战略格网 tooltip：为 true 时外框固定宽高基准（与阳翟满配一致）。
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
   * PVP 攻方大本营战略格：驻地固定为无；开战消耗仍按兵符（与目标城攻打同源）。
   */
  pvpAttackerBaseCampStrategic = false,
}) {
  const [mainCityBusy, setMainCityBusy] = useState(false);
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

  useEffect(() => {
    setBanditAttackNote('');
  }, [banditPoiId]);

  const canShowSetMainCityBtn =
    showOwnCityActions &&
    cityId &&
    (cityType === 'city_major' || cityType === 'city_medium') &&
    typeof onSetMainCityRequest === 'function';

  /** 己方大/中城：右上「三公府」（原城备底栏主按钮） */
  const canShowSanGongFuBtn =
    showOwnCityActions &&
    cityId &&
    (cityType === 'city_major' || cityType === 'city_medium') &&
    typeof onOpenSanGongFu === 'function';

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

  const showActions =
    showOwnCityActions &&
    cityId &&
    (canShowSanGongFuBtn ||
      (isCurrentMain && typeof onOpenBarracksPost === 'function') ||
      canShowSetMainCityBtn);

  const showEnemySiege =
    !showOwnCityActions &&
    !!playerId &&
    typeof onStartSiege === 'function' &&
    (siegeTargetLabel === '可攻打' ||
      (pvpAttackerBaseCampStrategic && siegeTargetLabel === '可出击'));

  if (syncErrorMessage) {
    return (
      <div className="text-sm text-stone-200">
        <div className="font-medium text-xs leading-tight text-red-200/95">
          {cityTitle}
          <span className="text-stone-400 font-normal text-[10px] ml-1">· {siegeTargetLabel}</span>
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
          costPerBattle={banditQuota.costPerBattle}
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
              setBanditAttackNote('当前不可攻打（兵符不足）');
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
                  : '兵符不足或条件不满足';
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

  const showSideActionBtns =
    showActions &&
    (canShowSanGongFuBtn ||
      (isCurrentMain && typeof onOpenBarracksPost === 'function') ||
      (canShowSetMainCityBtn && !isCurrentMain));

  const garrisonBody = (
    <>
      {subtitle != null && subtitle !== '' ? (
        <div className="text-stone-400 text-xs mt-0.5">{subtitle}</div>
      ) : null}
      <div className="text-stone-300 text-xs mt-2 border-t border-stone-600 pt-2">
        <div className="flex gap-2 items-stretch">
          <div className="min-w-0 flex-1 space-y-0.5">
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
          {showSideActionBtns ? (
            <div className="shrink-0 flex flex-col gap-1 justify-center w-[5.75rem]">
              {canShowSanGongFuBtn ? (
                <button
                  type="button"
                  onClick={handleOpenSanGongFu}
                  title="三公府：官职晋升、朝贡、封赏等"
                  className="w-full py-1 px-1 rounded-md text-[10px] font-bold leading-tight bg-gradient-to-r from-amber-700 to-yellow-700 text-amber-100"
                >
                  🏛️ 三公府
                </button>
              ) : null}
              {isCurrentMain && typeof onOpenBarracksPost === 'function' ? (
                <button
                  type="button"
                  onClick={handleOpenBarracksPost}
                  title="驻地编组 · 军营与主城驻军所仓库"
                  className="w-full py-1 px-1 rounded-md text-[10px] font-bold leading-tight bg-gradient-to-r from-stone-700 to-stone-600 text-stone-200 hover:from-stone-600 hover:to-stone-500"
                >
                  🏛️ 驻军所
                </button>
              ) : canShowSetMainCityBtn && !isCurrentMain ? (
                <button
                  type="button"
                  disabled={setMainCityButtonDisabled || mainCityBusy}
                  title={mainCityTitle}
                  onClick={handleSetMainCityClick}
                  className="w-full py-1 px-1 rounded-md text-[10px] font-bold leading-tight bg-gradient-to-r from-stone-700 to-stone-600 text-stone-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {mainCityBusy ? '…' : '🏰 设为主城'}
                </button>
              ) : null}
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
            ⚔️ 兵符：
            <span className={siegeQuota.remaining > 0 ? 'text-green-400' : 'text-red-400'}>
              {siegeQuota.remaining}
            </span>
            <span className="text-stone-500 ml-1">
              （每次攻打消耗 {siegeQuota.costPerBattle ?? 1}）
            </span>
          </>
        )}
      </div>
      {playerId ? (
        <div className="text-stone-500 text-[10px] mt-1">
          与匪寨攻打同源：消耗兵符道具，无小时恢复次数
        </div>
      ) : null}
      <WorldMapCityCombatSummaryBlock
        className="mt-2"
        pvpAttackerBaseCampStrategic={pvpAttackerBaseCampStrategic}
        garrisonSlotCount={garrisonSlotCount}
        garrisonCap={garrisonCap}
        npcAlive={npcAlive}
        npcTotal={npcTotal}
      />
      {showEnemySiege ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => onStartSiege()}
            disabled={siegeLoading || !siegeQuota?.loaded || !siegeQuota.canSiege}
            className="w-full py-1 rounded-md text-xs font-bold leading-tight bg-gradient-to-r from-red-700 to-orange-700 text-white disabled:from-stone-700 disabled:text-stone-500"
          >
            {siegeLoading
              ? '准备中...'
              : !siegeQuota?.loaded
                ? '兵符加载中…'
                : !siegeQuota.canSiege
                  ? '兵符不足'
                  : pvpAttackerBaseCampStrategic
                    ? '⚔️ 攻打大本营'
                    : `⚔️ 攻打${cityBaseName}`}
          </button>
          {pvpAttackerBaseCampStrategic ? (
            <div className="text-center text-[10px] text-amber-200/90 mt-1.5 px-1">
              攻打大本营的粮草消耗为2倍
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="text-stone-300 text-xs mt-2 border-t border-stone-600 pt-2">
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <div>
            防守系数：
            <span className="text-stone-200">
              {cityDefenseCoefficient != null && Number.isFinite(Number(cityDefenseCoefficient))
                ? String(cityDefenseCoefficient)
                : '—'}
            </span>
          </div>
          <div>
            人口：<span className="text-stone-200">{fmtStat(ov.population)}</span>
          </div>
          <div>
            商业：<span className="text-stone-200">{fmtStat(ov.trading)}</span>
          </div>
          <div>
            农业：<span className="text-stone-200">{fmtStat(ov.farming)}</span>
          </div>
          <div>
            军事：<span className="text-stone-200">{fmtStat(ov.military)}</span>
          </div>
          <div>
            文化：<span className="text-stone-200">{fmtStat(ov.culture)}</span>
          </div>
        </div>
        {ov.specialResourceName ? (
          <div className="mt-1">
            特色资源：<span className="text-amber-200/90">{ov.specialResourceName}</span>
          </div>
        ) : null}
        {ov.description ? (
          <div className="mt-1 text-stone-400 leading-snug whitespace-pre-wrap">{ov.description}</div>
        ) : null}
      </div>
    </>
  );

  return (
    <div
      className={`text-sm text-stone-200 wm-city-info-block min-w-0${uniformStrategicPanel ? ' w-full' : ''}`}
    >
      <div className={`min-w-0 flex flex-col${uniformStrategicPanel ? ' w-full flex-1' : ''}`}>
        <div className={`font-medium text-xs leading-tight text-red-200/95${uniformStrategicPanel ? ' shrink-0' : ''}`}>
          {cityTitle}
          <span className="text-stone-400 font-normal text-[10px] ml-1">· {siegeTargetLabel}</span>
        </div>
        <div className="wm-city-panel-tab-pane">{garrisonBody}</div>
      </div>
    </div>
  );
}
