/**
 * 上阵编组 Extra — A/B/C/D 四套（仅将领1/2，无玩家行）
 * 配置持久化；玩法2；不接开战。形态对齐 GarrisonLineup。
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  usePlayer,
  useCards,
  useAttributeBonusBySlot,
  usePlayerRefresh,
} from '@/contexts/PlayerContext';
import { useLifeStages } from '@/hooks/useLifeStages';
import { useSkillsMap } from '@/hooks/useSkillsMap';
import { useSilentProfilePoll } from '@/hooks/useSilentProfilePoll';
import { lineupExtraAPI } from '@/services/lineupExtraApi';
import { adventureAPI } from '@/services/adventureApi';
import { useGarrisonOccupiedIds } from '@/hooks/useGarrisonOccupiedIds';
import CharacterCard from '@shared/components/card/CharacterCard';
import TroopCard from '@shared/components/card/TroopCard';
import TitleAchievementCard from '@shared/components/card/TitleAchievementCard';
import EquipmentCard from '@shared/components/card/EquipmentCard';
import AncientModal from '@/components/common/AncientModal';
import { toCharCardData, toTroopCardData, toEquipCardData, toTitleCardData, toTreasureCardData } from '@/utils/cardDataTransforms';
import { collectLineupExtraOccupiedInstanceIds } from '@/utils/lineupExtraScopeUtils';
import { isMainCityBarracksStored } from '@/utils/garrisonBarracksTroopPool';
import { isTroopEquippableForLineup } from '@/utils/troopLineupEligibility';
import GarrisonGeneralPanel from '@/components/garrison/GarrisonGeneralPanel';
import GarrisonStatsPanel from '@/components/garrison/GarrisonStatsPanel';
import GarrisonBackpack from '@/components/garrison/GarrisonBackpack';
import TabSubNav from '@/components/game/TabSubNav';
import QuadrantGrid from '@/components/game/QuadrantGrid';
import { useGameTabLandscape } from '@/components/game/TabPageCloseAffordance';
import { buildBadgeRepairCandidates } from '@/utils/troopBadgeRepairCandidates';

const EXTRA_POOL_TABS_BASE = [
  { id: 'A', label: '上阵 A' },
  { id: 'B', label: '上阵 B' },
  { id: 'C', label: '上阵 C' },
  { id: 'D', label: '上阵 D' },
];

const EXTRA_CHAR_TABS = [
  { id: 'char1', label: '将领1' },
  { id: 'char2', label: '将领2' },
];

const POOL_TO_SLOT = { A: 1, B: 2, C: 3, D: 4 };
const CARD_SCALE_DETAIL_MODAL = 0.72;

export default function LineupExtraEditor() {
  const player = usePlayer();
  const cards = useCards();
  const refresh = usePlayerRefresh();
  const attributeBonusBySlot = useAttributeBonusBySlot();
  const { getCharacterLifeStage } = useLifeStages();

  const [activePool, setActivePool] = useState('A');
  const [activeChar, setActiveChar] = useState('char1');
  const [lineupsBySlot, setLineupsBySlot] = useState(() => ({ 1: null, 2: null, 3: null, 4: null }));
  const [extraOccupiedIds, setExtraOccupiedIds] = useState(() => new Set());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailCard, setDetailCard] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState(null);
  const [lockedExtraSlots, setLockedExtraSlots] = useState([]);
  const isLandscape = useGameTabLandscape();

  const skillsMap = useSkillsMap();
  useSilentProfilePoll(refresh);
  const garrisonIds = useGarrisonOccupiedIds(player?.playerId, [cards]);

  const loadAdventureLocks = useCallback(async () => {
    if (!player?.playerId) return;
    try {
      const res = await adventureAPI.getStatus(player.playerId);
      if (res.success) {
        setLockedExtraSlots(res.lockedExtraSlots || []);
      }
    } catch (e) {
      console.error('[LineupExtraEditor] 探险状态加载失败:', e);
    }
  }, [player?.playerId]);

  const loadExtraData = useCallback(async () => {
    if (!player?.playerId) return;
    try {
      const res = await lineupExtraAPI.getAll(player.playerId);
      if (res.success) {
        const rows = res.lineups || [];
        const next = { 1: null, 2: null, 3: null, 4: null };
        rows.forEach((row) => {
          const s = Number(row.lineup_slot);
          if (s >= 1 && s <= 4) next[s] = row;
        });
        setLineupsBySlot(next);
        setExtraOccupiedIds(collectLineupExtraOccupiedInstanceIds(rows));
      }
      await loadAdventureLocks();
    } catch (e) {
      console.error('[LineupExtraEditor] 加载失败:', e);
    }
  }, [player?.playerId, loadAdventureLocks]);

  useEffect(() => { loadExtraData(); }, [loadExtraData]);

  const currentSlotNum = POOL_TO_SLOT[activePool];
  const currentLineup = lineupsBySlot[currentSlotNum] || null;
  const currentSlotLocked = lockedExtraSlots.includes(currentSlotNum);

  const EXTRA_POOL_TABS = useMemo(
    () =>
      EXTRA_POOL_TABS_BASE.map((tab) => {
        const slot = POOL_TO_SLOT[tab.id];
        const locked = lockedExtraSlots.includes(slot);
        return {
          ...tab,
          label: locked ? `${tab.label}·探` : tab.label,
        };
      }),
    [lockedExtraSlots],
  );

  const getCardFromExtra = useCallback((fieldName) => {
    if (!currentLineup) return null;
    const instanceId = currentLineup[fieldName];
    if (!instanceId) return null;
    const card = cards.find((c) => c.instanceId === instanceId) || null;
    if (!card) return null;
    if (card.cardType === 'treasure' && card.usesRemaining != null && Number(card.usesRemaining) <= 0) {
      return null;
    }
    return card;
  }, [currentLineup, cards]);

  const saveExtra = useCallback(async (fieldName, instanceId) => {
    if (!player?.playerId) return;
    if (lockedExtraSlots.includes(currentSlotNum)) {
      setSaveErrorMessage('该 Extra 编组正在探险中，归来并领取报告前不可修改');
      return;
    }
    setSaving(true);
    try {
      let base = {};
      try {
        const slotRes = await lineupExtraAPI.getSlot(player.playerId, currentSlotNum);
        if (slotRes.success && slotRes.lineup) base = { ...slotRes.lineup };
      } catch (_) { /* ignore */ }
      if (!base || Object.keys(base).length === 0) base = { ...(currentLineup || {}) };

      const config = {
        char1_card: base.char1_card || null,
        char1_equipment_card: base.char1_equipment_card || null,
        char1_title: base.char1_title || null,
        char1_achievement: base.char1_achievement || null,
        char1_treasure: base.char1_treasure || null,
        char1_troop1: base.char1_troop1 || null,
        char1_troop2: base.char1_troop2 || null,
        char2_card: base.char2_card || null,
        char2_equipment_card: base.char2_equipment_card || null,
        char2_title: base.char2_title || null,
        char2_achievement: base.char2_achievement || null,
        char2_treasure: base.char2_treasure || null,
        char2_troop1: base.char2_troop1 || null,
        char2_troop2: base.char2_troop2 || null,
      };
      config[fieldName] = instanceId;

      const res = await lineupExtraAPI.save(player.playerId, currentSlotNum, config);
      if (res.success) {
        await loadExtraData();
        await refresh();
      } else {
        setSaveErrorMessage(res.error || '保存失败');
      }
    } catch (e) {
      console.error('[LineupExtraEditor] 保存失败:', e);
      setSaveErrorMessage(e?.message || '保存失败');
    }
    setSaving(false);
  }, [player?.playerId, currentSlotNum, currentLineup, loadExtraData, refresh, lockedExtraSlots]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedSlot(null);
    setDetailCard(null);
  }, []);

  const handleSlotClick = useCallback((slot, content, charKey) => {
    if (!slot.implemented) return;
    if (currentSlotLocked) {
      setSaveErrorMessage('该 Extra 编组正在探险中，归来并领取报告前不可修改');
      return;
    }
    if (content) {
      setDetailCard({ card: content, slot, charKey });
    } else {
      setSelectedSlot({ ...slot, charKey, pool: activePool });
      setDrawerOpen(true);
    }
  }, [activePool, currentSlotLocked]);

  const handleEquip = useCallback(async (card) => {
    if (!selectedSlot) return;
    const { charKey, id: slotId } = selectedSlot;
    const fieldName = slotId === 'character'
      ? `${charKey}_card`
      : slotId === 'equipmentSet'
        ? `${charKey}_equipment_card`
        : `${charKey}_${slotId}`;
    await saveExtra(fieldName, card.instanceId);
    closeDrawer();
  }, [selectedSlot, saveExtra, closeDrawer]);

  const handleEquipCharacter = useCallback(async (card, charKey) => {
    await saveExtra(`${charKey}_card`, card.instanceId);
  }, [saveExtra]);

  const handleGeneralCardClick = useCallback((card, charKey) => {
    setDetailCard({ card, slot: { id: 'character', label: '将领', icon: '👤', implemented: true }, charKey });
  }, []);

  const extraFieldForSlot = useCallback((slot, charKey) => {
    if (!slot || !charKey) return null;
    if (slot.id === 'character') return `${charKey}_card`;
    if (slot.id === 'equipmentSet') return `${charKey}_equipment_card`;
    return `${charKey}_${slot.id}`;
  }, []);

  const resolveDetailCharKey = useCallback(() => {
    if (!detailCard) return null;
    let ck = detailCard.charKey;
    if (!ck && detailCard.slot?.id === 'character' && detailCard.card?.instanceId && currentLineup) {
      const cid = detailCard.card.instanceId;
      if (currentLineup.char1_card === cid) ck = 'char1';
      else if (currentLineup.char2_card === cid) ck = 'char2';
    }
    return ck || null;
  }, [detailCard, currentLineup]);

  const getExtraBonus = useCallback((charKey) => {
    const slotKey = `extra_${currentSlotNum}_${charKey}`;
    return attributeBonusBySlot?.[slotKey] || {};
  }, [attributeBonusBySlot, currentSlotNum]);

  /** Main ∪ 驻地 ∪ Extra 全局占用 */
  const occupiedIds = useMemo(() => {
    const ids = new Set(extraOccupiedIds);
    garrisonIds.forEach((id) => ids.add(id));
    return ids;
  }, [extraOccupiedIds, garrisonIds]);

  const characterCards = cards.filter((c) => c.cardType === 'character');
  const troopCards = cards.filter((c) => c.cardType === 'troop');
  const titleCards = cards.filter((c) => c.cardType === 'title');
  const achievementCards = cards.filter((c) => c.cardType === 'achievement');
  const treasureCards = cards.filter((c) => c.cardType === 'treasure');
  const equipmentSetCards = cards.filter(
    (c) => c.cardType === 'equipmentSet' && c.config?.displayName && String(c.config.displayName).trim(),
  );

  const availableCards = cards.filter((c) => {
    if (c.cardType === 'equipmentSet') return false;
    if (c.isEquipped || occupiedIds.has(c.instanceId)) return false;
    if (c.cardType === 'equipment' && c.boundEquipmentSetInstanceId) return false;
    if (isMainCityBarracksStored(c)) return false;
    return true;
  });
  const encapsulateEquipmentPool = cards.filter(
    (c) => c.cardType === 'equipment' && !c.isEquipped && !occupiedIds.has(c.instanceId),
  );

  const badgeRepairCandidates = useMemo(() => {
    const barracksTroops = availableCards.filter((c) => c.cardType === 'troop');
    const mainTroops = troopCards.filter((c) => c.isEquipped);
    const extraTroops = troopCards.filter((c) => extraOccupiedIds.has(c.instanceId));
    return buildBadgeRepairCandidates({ barracksTroops, mainTroops, extraTroops });
  }, [availableCards, troopCards, extraOccupiedIds]);

  const getAvailableCards = useCallback((type) => {
    const pool = type === 'character' ? characterCards
      : type === 'troop' ? troopCards
      : type === 'title' ? titleCards
      : type === 'achievement' ? achievementCards
      : type === 'treasure' ? treasureCards
      : type === 'equipmentSet' ? equipmentSetCards
      : [];
    return pool.filter((c) => {
      if (c.isEquipped || occupiedIds.has(c.instanceId)) return false;
      if (isMainCityBarracksStored(c)) return false;
      if (type !== 'troop' && type !== 'treasure') return true;
      if (type === 'treasure') {
        if (c.usesRemaining != null && Number(c.usesRemaining) <= 0) return false;
        return true;
      }
      return isTroopEquippableForLineup(c);
    });
  }, [characterCards, troopCards, titleCards, achievementCards, treasureCards, equipmentSetCards, occupiedIds]);

  const getSlotContent = useCallback((slot, charKey) => {
    switch (slot.id) {
      case 'troop1': return getCardFromExtra(`${charKey}_troop1`);
      case 'troop2': return getCardFromExtra(`${charKey}_troop2`);
      case 'equipmentSet': return getCardFromExtra(`${charKey}_equipment_card`);
      case 'title': return getCardFromExtra(`${charKey}_title`);
      case 'achievement': return getCardFromExtra(`${charKey}_achievement`);
      case 'treasure': return getCardFromExtra(`${charKey}_treasure`);
      default: return null;
    }
  }, [getCardFromExtra]);

  const generalPanelSharedProps = (charKey) => ({
    charKey,
    charCard: getCardFromExtra(`${charKey}_card`),
    attributeBonus: getExtraBonus(charKey),
    availableCharacters: getAvailableCards('character'),
    onEquipCharacter: (card) => handleEquipCharacter(card, charKey),
    skillsMap,
    getSlotContent,
    selectedSlot,
    onSlotClick: handleSlotClick,
    onCharCardClick: handleGeneralCardClick,
    garrison: currentLineup,
    cards,
    getCardFromGarrison: getCardFromExtra,
    playerId: player?.playerId,
  });

  const landscapeCells = [
    {
      id: 'extra-quadrant-locked',
      title: '说明',
      content: (
        <div className="flex h-full min-h-[8rem] flex-col items-center justify-center bg-stone-900/50 px-2 text-center">
          <div className="mb-2 text-4xl opacity-40">🔒</div>
          <p className="text-xs leading-snug text-stone-500">额外上阵无需配置玩家角色</p>
        </div>
      ),
    },
    {
      id: 'extra-quadrant-char1',
      title: '将领1',
      content: <GarrisonGeneralPanel {...generalPanelSharedProps('char1')} isLandscape />,
    },
    {
      id: 'extra-quadrant-camp',
      title: '军营',
      content: (
        <GarrisonBackpack
          cards={availableCards}
          skillsMap={skillsMap}
          isLandscape={isLandscape}
          playerId={player?.playerId}
          onAfterEncapsulateChange={refresh}
          encapsulateEquipmentPool={encapsulateEquipmentPool}
          equipmentSetCards={equipmentSetCards}
          badgeRepairCandidates={badgeRepairCandidates}
        />
      ),
    },
    {
      id: 'extra-quadrant-char2',
      title: '将领2',
      content: <GarrisonGeneralPanel {...generalPanelSharedProps('char2')} isLandscape />,
    },
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 shrink-0 border-b border-amber-900/50 bg-stone-900/80">
        <TabSubNav
          tabs={EXTRA_POOL_TABS}
          activeTabId={activePool}
          onTabChange={(id) => {
            setActivePool(id);
            setActiveChar('char1');
            closeDrawer();
          }}
          hideClose
          compact
          embedded
        />
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {isLandscape ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-hidden">
              <QuadrantGrid cells={landscapeCells} />
            </div>
          </div>
        ) : (
          <>
            <TabSubNav
              tabs={EXTRA_CHAR_TABS}
              activeTabId={activeChar}
              onTabChange={(id) => {
                setActiveChar(id);
                closeDrawer();
              }}
              hideClose
            />

            <GarrisonGeneralPanel {...generalPanelSharedProps(activeChar)} isLandscape={false} />

            <GarrisonStatsPanel
              garrison={currentLineup}
              charKey={activeChar}
              cards={cards}
              getCardFromGarrison={getCardFromExtra}
              attributeBonus={getExtraBonus(activeChar)}
              playerId={player?.playerId}
            />

            <GarrisonBackpack
              cards={availableCards}
              skillsMap={skillsMap}
              isLandscape={isLandscape}
              playerId={player?.playerId}
              onAfterEncapsulateChange={refresh}
              encapsulateEquipmentPool={encapsulateEquipmentPool}
              equipmentSetCards={equipmentSetCards}
              badgeRepairCandidates={badgeRepairCandidates}
            />
          </>
        )}
      </div>

      {detailCard && (() => {
        const isCharCard = detailCard.card.cardType === 'character';
        const overlayChar = isCharCard ? toCharCardData(detailCard.card, {}, skillsMap) : null;
        const lifeStageData = overlayChar ? getCharacterLifeStage(overlayChar.id) : null;
        const baseUrl = import.meta.env.BASE_URL;
        return (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
            onClick={() => setDetailCard(null)}
          >
            <div
              className="mx-4 w-full max-w-sm rounded-xl border border-amber-500/30 bg-stone-900 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-amber-400">
                  {detailCard.slot.id === 'character' ? '将领详情' : '卡牌详情'}
                </span>
                <button type="button" onClick={() => setDetailCard(null)} className="text-stone-400 hover:text-white">✕</button>
              </div>
              <div className="mb-3 flex flex-col items-center gap-1">
                {lifeStageData && (
                  <p className="text-center text-[11px] text-stone-500">点击卡牌可翻面查看生涯</p>
                )}
                <div style={{ transform: `scale(${CARD_SCALE_DETAIL_MODAL})`, transformOrigin: 'top center' }}>
                  {detailCard.card.cardType === 'character' ? (
                    <CharacterCard character={overlayChar} skillsMap={skillsMap} showDetails baseUrl={baseUrl} lifeStageData={lifeStageData} disableHoverScale />
                  ) : detailCard.card.cardType === 'troop' ? (
                    <TroopCard troop={toTroopCardData(detailCard.card)} skillsMap={skillsMap} showDetails baseUrl={baseUrl} disableHoverScale />
                  ) : detailCard.card.cardType === 'title' ? (
                    <TitleAchievementCard item={toTitleCardData(detailCard.card)} type="title" baseUrl={baseUrl} />
                  ) : detailCard.card.cardType === 'achievement' ? (
                    <TitleAchievementCard item={toTitleCardData(detailCard.card)} type="achievement" baseUrl={baseUrl} />
                  ) : detailCard.card.cardType === 'treasure' ? (
                    <EquipmentCard equipment={toTreasureCardData(detailCard.card)} baseUrl={baseUrl} disableHoverScale />
                  ) : detailCard.card.cardType === 'equipment' ? (
                    <EquipmentCard equipment={toEquipCardData(detailCard.card)} baseUrl={baseUrl} disableHoverScale />
                  ) : (
                    <div className="py-8 text-center text-sm text-stone-400">卡牌预览</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const ck = resolveDetailCharKey();
                    const field = extraFieldForSlot(detailCard.slot, ck);
                    if (field) saveExtra(field, null);
                    setDetailCard(null);
                  }}
                  className="flex-1 rounded-lg border border-red-700/50 bg-red-900/50 py-2 text-sm text-red-300 hover:bg-red-800/50"
                >
                  卸下
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const charKey = resolveDetailCharKey();
                    setDetailCard(null);
                    if (!charKey) return;
                    setSelectedSlot({ ...detailCard.slot, charKey, pool: activePool });
                    setDrawerOpen(true);
                  }}
                  className="flex-1 rounded-lg border border-amber-700/50 bg-amber-900/50 py-2 text-sm text-amber-300 hover:bg-amber-800/50"
                >
                  更换
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {drawerOpen && selectedSlot && (
        <ExtraDrawer
          slot={selectedSlot}
          cards={getAvailableCards(
            selectedSlot.id === 'character' ? 'character'
              : selectedSlot.id === 'title' ? 'title'
                : selectedSlot.id === 'achievement' ? 'achievement'
                  : selectedSlot.id === 'treasure' ? 'treasure'
                    : selectedSlot.id === 'equipmentSet' ? 'equipmentSet'
                      : 'troop',
          )}
          skillsMap={skillsMap}
          onSelect={handleEquip}
          onClose={closeDrawer}
        />
      )}

      {saveErrorMessage != null && (
        <AncientModal
          isOpen
          type="warning"
          title="保存失败"
          confirmText="确定"
          onConfirm={() => setSaveErrorMessage(null)}
          onClose={() => setSaveErrorMessage(null)}
        >
          <p className="whitespace-pre-wrap text-center text-sm text-gray-800">{saveErrorMessage}</p>
        </AncientModal>
      )}
    </div>
  );
}

function ExtraDrawer({ slot, cards, skillsMap, onSelect, onClose }) {
  const baseUrl = import.meta.env.BASE_URL;
  const isCharSlot = slot.id === 'character';
  const isTitleSlot = slot.id === 'title';
  const isAchievementSlot = slot.id === 'achievement';
  const isTreasureSlot = slot.id === 'treasure';
  const isEquipSetSlot = slot.id === 'equipmentSet';

  const grouped = {};
  cards.forEach((card) => {
    const r = card.config?.rarity || card.rarity || 'common';
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push(card);
  });
  const RARITY_ORDER_MAP = { common: 0, rare: 1, epic: 2, legendary: 3, core: 4 };
  const sortedRarities = Object.keys(grouped).sort((a, b) => (RARITY_ORDER_MAP[a] ?? 99) - (RARITY_ORDER_MAP[b] ?? 99));
  const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };

  return (
    <>
      <div className="fixed inset-0 z-[110] bg-black/50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 top-[4.5rem] z-[111] flex flex-col rounded-t-2xl border-t-2 border-amber-700/50 bg-stone-900 sm:top-14">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-stone-700 px-4 py-3">
          <h3 className="text-sm font-bold text-amber-400">{slot.icon} 选择{slot.label}</h3>
          <button type="button" onClick={onClose} className="text-lg text-stone-400 hover:text-white">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {cards.length === 0 ? (
            <div className="py-8 text-center text-sm text-stone-500">暂无可装备的{slot.label}</div>
          ) : (
            sortedRarities.map((rarity) => (
              <div key={rarity} className="mb-3">
                <div className="mb-1.5 px-1 text-xs text-stone-500">{rarityLabel[rarity]}（{grouped[rarity].length}）</div>
                <div className="flex flex-wrap gap-2">
                  {grouped[rarity].map((card) => (
                    <div
                      key={card.instanceId}
                      onClick={() => onSelect(card)}
                      className="cursor-pointer transition-all hover:brightness-110 active:scale-95"
                      style={{
                        width: 128,
                        ...(isCharSlot
                          ? { minHeight: 208 }
                          : { height: (isTitleSlot || isAchievementSlot || isTreasureSlot) ? 96 : isEquipSetSlot ? 96 : 192 }),
                      }}
                    >
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        {isCharSlot ? (
                          <CharacterCard character={toCharCardData(card, {}, skillsMap)} skillsMap={skillsMap} showDetails baseUrl={baseUrl} disableHoverScale />
                        ) : isTitleSlot || isAchievementSlot ? (
                          <TitleAchievementCard item={toTitleCardData(card)} type={isAchievementSlot ? 'achievement' : 'title'} baseUrl={baseUrl} />
                        ) : isTreasureSlot ? (
                          <EquipmentCard equipment={toTreasureCardData(card)} baseUrl={baseUrl} />
                        ) : isEquipSetSlot ? (
                          <div className="flex h-[192px] w-[256px] flex-col justify-between rounded-xl border-2 border-amber-700/40 bg-stone-800 p-3">
                            <div className="truncate text-sm font-bold text-amber-200">{card.config?.displayName || card.instanceId}</div>
                            <div className="text-xs text-stone-400">装备卡</div>
                          </div>
                        ) : (
                          <TroopCard troop={toTroopCardData(card)} skillsMap={skillsMap} showDetails baseUrl={baseUrl} disableHoverScale />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
