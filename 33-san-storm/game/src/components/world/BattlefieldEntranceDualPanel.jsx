/**
 * 郡战场入口四宫格（13-8 / 14-1 / 14-3 / 60-1）：
 * [ 编组探险 | 事件探索 ]
 * [ 匪寨     | 章节战棋 ]
 *
 * 编组探险 / 章节弹层由地图根挂载（关 tooltip 后 DualPanel 会卸载）。
 */
import { useState, useEffect, useMemo } from 'react';
import BanditStrongholdDockPanel from '@/components/event/BanditStrongholdDockPanel';
import ExploreLocationDockPanel from '@/components/event/ExploreLocationDockPanel';
import LineupAdventureDockPanel from '@/components/event/LineupAdventureDockPanel';
import ChapterTacticalDockPanel from '@/components/event/ChapterTacticalDockPanel';
import { filterPlayerItemsForExploreLocation, getActiveExploreChainId } from '@/components/event/eventUtils';
import { PHASE } from '@/components/event/EventConstants';
import { useBanditRaidQuota } from '@/hooks/useBanditRaidQuota';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { validateMainLineupBattleGate } from '@/utils/mainLineupTroops';
import { buildBanditLayerSmallMapPveLoot } from '@shared/utils/banditRaidLayerRewards';
import { banditNpcSlotRaritiesFromLayer } from '@shared/utils/smallMapEnemyRoster';

const COMPACT_DOCK_CLASS = 'max-h-none overflow-y-auto px-2 py-1.5 border-0 text-xs text-stone-200';

/**
 * @param {{
 *   banditTitle: string,
 *   banditPoiId: string,
 *   playerId: string|null,
 *   interactionsLocked?: boolean,
 *   onStartBanditRaid?: (payload: object) => void,
 *   banditRaidStartBlockedReason?: string|null,
 *   postBanditRaidRefreshKey?: number,
 *   exploreInfo?: { battlefieldId: string, displayName: string }|null,
 *   subsidiaryExploreEmbed?: object|null,
 *   closeStrategicCityTooltip?: (() => void)|null,
 *   onOpenLineupAdventure?: (() => void)|null,
 *   onOpenChapterTactical?: (() => void)|null,
 * }} props
 */
export default function BattlefieldEntranceDualPanel({
  banditTitle,
  banditPoiId,
  playerId,
  interactionsLocked = false,
  onStartBanditRaid = null,
  banditRaidStartBlockedReason = null,
  postBanditRaidRefreshKey = 0,
  exploreInfo = null,
  subsidiaryExploreEmbed = null,
  closeStrategicCityTooltip = null,
  onOpenLineupAdventure = null,
  onOpenChapterTactical = null,
}) {
  const banditQuota = useBanditRaidQuota(playerId, banditPoiId);
  const { refresh: refreshBanditQuota } = banditQuota;
  const { cards: lineupCards, player: lineupPlayer } = usePlayerContext();
  const [banditAttackNote, setBanditAttackNote] = useState('');
  const [adventureRefreshKey, setAdventureRefreshKey] = useState(0);

  useEffect(() => {
    if (!banditPoiId) return;
    void refreshBanditQuota();
  }, [postBanditRaidRefreshKey, banditPoiId, refreshBanditQuota]);

  const embed = subsidiaryExploreEmbed;
  const loc = exploreInfo?.battlefieldId ? String(exploreInfo.battlefieldId).trim() : '';

  const activeChainId = useMemo(() => {
    if (!embed?.allExploreEvents) return null;
    return getActiveExploreChainId(
      embed.allExploreEvents,
      embed.completedEvents || {},
      embed.playerItemCounts || {},
    );
  }, [embed?.allExploreEvents, embed?.completedEvents, embed?.playerItemCounts]);

  let explorePanel = null;
  const emptyQuota = embed?.quota || {
    remaining: 0,
    canExplore: false,
    costKind: 'tactic_token',
    costPerChain: 1,
  };
  const exploreTitle = '事件探索';
  if (interactionsLocked) {
    explorePanel = (
      <ExploreLocationDockPanel
        title={exploreTitle}
        eventsLoading={false}
        quota={emptyQuota}
        poolLen={0}
        poolEmpty
        exploreItems={[]}
        canStart={false}
        onStartExplore={() => {}}
        colorTheme="amber"
        startEmoji="📜"
        rootClassName={COMPACT_DOCK_CLASS}
        showEnemyTroopRarityHint
        poolEvents={[]}
        statusOverride="抵达战场入口后方可探索"
      />
    );
  } else if (loc && embed) {
    const poolEvents = embed.explorePoolAt(loc, null);
    const poolLen = poolEvents.length;
    const poolEmpty = embed.phase === PHASE.IDLE && !embed.eventsLoading && poolLen <= 0;
    const canAffordOrResume = !!embed.quota?.canExplore || !!activeChainId;
    const canStart =
      embed.phase === PHASE.IDLE && !embed.eventsLoading && poolLen > 0 && canAffordOrResume;
    const exploreItems = filterPlayerItemsForExploreLocation(embed.playerItems, loc);
    explorePanel = (
      <ExploreLocationDockPanel
        title={exploreTitle}
        eventsLoading={embed.eventsLoading}
        quota={embed.quota}
        poolLen={poolLen}
        poolEmpty={poolEmpty}
        exploreItems={exploreItems}
        canStart={canStart}
        onStartExplore={() => {
          if (typeof closeStrategicCityTooltip === 'function') closeStrategicCityTooltip();
          void embed.startExplore(loc, {
            continueChain: !!activeChainId,
          });
        }}
        colorTheme="amber"
        startEmoji="📜"
        rootClassName={COMPACT_DOCK_CLASS}
        showEnemyTroopRarityHint
        exploreLocationId={loc}
        poolEvents={poolEvents}
        wildernessCityType={null}
        citiesList={embed.citiesList ?? null}
        itemNameMap={embed.itemNameMap ?? {}}
      />
    );
  } else {
    explorePanel = (
      <ExploreLocationDockPanel
        title={exploreTitle}
        eventsLoading={false}
        quota={emptyQuota}
        poolLen={0}
        poolEmpty
        exploreItems={[]}
        canStart={false}
        onStartExplore={() => {}}
        colorTheme="amber"
        startEmoji="📜"
        rootClassName={COMPACT_DOCK_CLASS}
        showEnemyTroopRarityHint
        poolEvents={[]}
        statusOverride="暂无战场探索配置"
      />
    );
  }

  return (
    <div className="bf-entrance-dual grid grid-cols-2 gap-1 w-full min-h-0 text-stone-200">
      <div className="bf-entrance-dual__cell min-w-0 min-h-0">
        <LineupAdventureDockPanel
          playerId={playerId}
          interactionsLocked={!!interactionsLocked}
          refreshKey={adventureRefreshKey}
          rootClassName={COMPACT_DOCK_CLASS}
          onOpen={() => {
            if (typeof onOpenLineupAdventure === 'function') {
              onOpenLineupAdventure();
              setAdventureRefreshKey((k) => k + 1);
            }
          }}
        />
      </div>
      <div className="bf-entrance-dual__cell min-w-0 min-h-0">{explorePanel}</div>
      <div className="bf-entrance-dual__cell min-w-0 min-h-0">
        <BanditStrongholdDockPanel
          title={banditTitle || '匪寨挑战'}
          difficultyHint={banditQuota.difficultyHint}
          nextLayer={banditQuota.nextLayer}
          personalTotalLayers={banditQuota.personalTotalLayers}
          worldDurability={banditQuota.worldDurability}
          loading={!banditQuota.loaded}
          remaining={banditQuota.remaining}
          costPerBattle={banditQuota.costPerBattle}
          interactionsLocked={!!interactionsLocked}
          rootClassName={COMPACT_DOCK_CLASS}
          canAttack={!!banditQuota.loaded && banditQuota.canBattle && !interactionsLocked}
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
      <div className="bf-entrance-dual__cell bf-entrance-dual__cell--chapter min-w-0 min-h-0">
        <ChapterTacticalDockPanel
          interactionsLocked={!!interactionsLocked}
          rootClassName={COMPACT_DOCK_CLASS}
          onOpen={
            typeof onOpenChapterTactical === 'function'
              ? () => {
                  if (typeof closeStrategicCityTooltip === 'function') closeStrategicCityTooltip();
                  onOpenChapterTactical();
                }
              : null
          }
        />
      </div>
    </div>
  );
}
