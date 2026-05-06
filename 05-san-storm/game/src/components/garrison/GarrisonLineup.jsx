/**
 * 驻地编组界面 — 守城卡池A/B配置
 *
 * 每个卡池 = 2将领 + 各2部队 + 称号等
 * 竖屏：Tab 切换驻地A/B，子Tab 将领1/将领2
 * 横屏：2×2 布局（左上锁定 / 右上将领1 / 右下将领2 / 左下军营）
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
import { garrisonAPI } from '@/services/garrisonApi';
import CharacterCard from '@shared/components/card/CharacterCard';
import TroopCard from '@shared/components/card/TroopCard';
import TitleAchievementCard from '@shared/components/card/TitleAchievementCard';
import EquipmentCard from '@shared/components/card/EquipmentCard';
import EncapsulateEquipmentModal from '@/components/game/EncapsulateEquipmentModal';
import AncientModal from '@/components/common/AncientModal';
import { toCharCardData, toTroopCardData, toEquipCardData, toTitleCardData } from '@/utils/cardDataTransforms';
import { collectGarrisonOccupiedInstanceIds } from '@/utils/garrisonScopeUtils';
import { isMainCityBarracksStored } from '@/utils/garrisonBarracksTroopPool';
import GarrisonGeneralPanel from './GarrisonGeneralPanel';
import GarrisonStatsPanel from './GarrisonStatsPanel';
import GarrisonBackpack from './GarrisonBackpack';
import TabSubNav from '@/components/game/TabSubNav';
import QuadrantGrid from '@/components/game/QuadrantGrid';
import { useGameTabLandscape } from '@/components/game/TabPageCloseAffordance';

const GARRISON_POOL_SUB_TABS = [
  { id: 'A', label: '🏰 驻地A' },
  { id: 'B', label: '🏰 驻地B' },
];

const GARRISON_CHAR_SUB_TABS = [
  { id: 'char1', label: '将领1' },
  { id: 'char2', label: '将领2' },
];

const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, core: 4 };

const CARD_SCALE_DETAIL_MODAL = 0.72;

export default function GarrisonLineup({
  onClose,
  /** 保存驻守配置成功后回调（如大地图 bump 以重拉 tooltip 用槽位统计） */
  onAfterMutation,
  /** 须由打开面板的父组件传入（如大地图格上「驻地编组」） */
  cityId,
  cityName = '城池',
}) {
  // CR A7（2026-04-29）：按字段订阅，与 LineupTab 一致
  const player = usePlayer();
  const cards = useCards();
  const refresh = usePlayerRefresh();
  const attributeBonusBySlot = useAttributeBonusBySlot();
  const { getCharacterLifeStage } = useLifeStages();

  const [activePool, setActivePool]         = useState('A');
  const [activeChar, setActiveChar]         = useState('char1');
  const [garrisonA, setGarrisonA]           = useState(null);
  const [garrisonB, setGarrisonB]           = useState(null);
  const [selectedSlot, setSelectedSlot]     = useState(null);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [detailCard, setDetailCard]         = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [activationHint, setActivationHint] = useState(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState(null);
  /** All instance_ids used in any city garrison pool (same source as LineupTab `garrisonAPI.getAll`). */
  const [garrisonOccupiedInstanceIds, setGarrisonOccupiedInstanceIds] = useState(() => new Set());
  const isLandscape = useGameTabLandscape();

  /* ── 共享 hooks（与 LineupTab 共用，CR C5 抽出） ── */
  const skillsMap = useSkillsMap();
  useSilentProfilePoll(refresh);

  /* ── 驻守数据：本城槽位 + 全城池占用实例（与上阵编组 LineupTab 一致用 getAll） ── */
  const loadGarrisonData = useCallback(async () => {
    if (!player?.player_id || !cityId) return;
    try {
      const [byCityRes, allRes] = await Promise.all([
        garrisonAPI.getByCity(player.player_id, cityId),
        garrisonAPI.getAll(player.player_id),
      ]);
      if (byCityRes.success) {
        const list = byCityRes.garrisons || [];
        setGarrisonA(list.find(g => g.garrison_slot === 1) || null);
        setGarrisonB(list.find(g => g.garrison_slot === 2) || null);
      }
      if (allRes.success) {
        const rows = allRes.garrisons || [];
        setGarrisonOccupiedInstanceIds(collectGarrisonOccupiedInstanceIds(rows));
      }
    } catch (e) {
      console.error('[GarrisonLineup] 加载驻守数据失败:', e);
    }
  }, [player?.player_id, cityId]);

  useEffect(() => { loadGarrisonData(); }, [loadGarrisonData]);

  /* ── 切换卡池时清除激活提示 ── */
  useEffect(() => { setActivationHint(null); }, [activePool]);

  const currentGarrison = activePool === 'A' ? garrisonA : garrisonB;
  const currentSlotNum  = activePool === 'A' ? 1 : 2;

  /* ── 当前卡池总兵力 ── */
  const poolTroopTotal = useMemo(() => {
    if (!currentGarrison || !cards?.length) return 0;
    return ['char1_troop1', 'char1_troop2', 'char2_troop1', 'char2_troop2'].reduce((sum, f) => {
      const id = currentGarrison[f];
      if (!id) return sum;
      const c = cards.find(x => x.instance_id === id);
      if (!c) return sum;
      const max = (c.config?.maxTroops || 0) + (c.bonus_max_troops || 0);
      return sum + (c.current_troops ?? max);
    }, 0);
  }, [currentGarrison, cards]);

  /* ── 卡牌辅助查询 ── */
  const getCardFromGarrison = useCallback((fieldName) => {
    if (!currentGarrison) return null;
    const instanceId = currentGarrison[fieldName];
    if (!instanceId) return null;
    return cards.find(c => c.instance_id === instanceId) || null;
  }, [currentGarrison, cards]);

  /* ── 保存驻守配置 ── */
  const saveGarrison = useCallback(async (fieldName, instanceId) => {
    if (!player?.player_id) return;
    setSaving(true);
    try {
      let base = {};
      try {
        const slotRes = await garrisonAPI.getSlot(player.player_id, currentSlotNum, cityId);
        if (slotRes.success && slotRes.garrison) base = { ...slotRes.garrison };
      } catch (_) { /* ignore */ }
      if (!base || Object.keys(base).length === 0) base = { ...(currentGarrison || {}) };

      const config = {
        cityId,
        cityName,
        char1_card: base.char1_card || null, char1_equipment_card: base.char1_equipment_card || null,
        char1_title: base.char1_title || null, char1_achievement: base.char1_achievement || null,
        char1_treasure: base.char1_treasure || null, char1_troop1: base.char1_troop1 || null,
        char1_troop2: base.char1_troop2 || null,
        char2_card: base.char2_card || null, char2_equipment_card: base.char2_equipment_card || null,
        char2_title: base.char2_title || null, char2_achievement: base.char2_achievement || null,
        char2_treasure: base.char2_treasure || null, char2_troop1: base.char2_troop1 || null,
        char2_troop2: base.char2_troop2 || null,
      };
      config[fieldName] = instanceId;

      const res = await garrisonAPI.save(player.player_id, currentSlotNum, config);
      if (res.success) {
        await loadGarrisonData();
        await refresh();
        if (typeof onAfterMutation === 'function') onAfterMutation();
        if (res.belowTroopThreshold) {
          setActivationHint(
            `本卡池总兵力 ${res.garrisonTroopTotal ?? '—'}，需 ≥ ${res.minTroopsForActive ?? 800} 才计入守城并允许作战（已保存，补足后保存即生效）。`
          );
        } else {
          setActivationHint(null);
        }
      } else {
        setSaveErrorMessage(res.error || '保存失败');
      }
    } catch (e) {
      console.error('[GarrisonLineup] 保存失败:', e);
    }
    setSaving(false);
  }, [player?.player_id, currentSlotNum, currentGarrison, loadGarrisonData, refresh, cityId, cityName, onAfterMutation]);

  /* ── 抽屉/详情控制 ── */
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedSlot(null);
    setDetailCard(null);
  }, []);

  const handleSlotClick = useCallback((slot, content, charKey) => {
    if (!slot.implemented) return;
    if (content) {
      setDetailCard({ card: content, slot, charKey });
    } else {
      setSelectedSlot({ ...slot, charKey, pool: activePool });
      setDrawerOpen(true);
    }
  }, [activePool]);

  const handleEquip = useCallback(async (card) => {
    if (!selectedSlot) return;
    const { charKey, id: slotId } = selectedSlot;
    const fieldName = slotId === 'character'
      ? `${charKey}_card`
      : slotId === 'equipmentSet'
        ? `${charKey}_equipment_card`
        : `${charKey}_${slotId}`;
    await saveGarrison(fieldName, card.instance_id);
    closeDrawer();
  }, [selectedSlot, saveGarrison, closeDrawer]);

  const handleEquipCharacter = useCallback(async (card, charKey) => {
    await saveGarrison(`${charKey}_card`, card.instance_id);
  }, [saveGarrison]);

  const handleGeneralCardClick = useCallback((card, charKey) => {
    setDetailCard({ card, slot: { id: 'character', label: '将领', icon: '👤', implemented: true }, charKey });
  }, []);

  const garrisonFieldForSlot = useCallback((slot, charKey) => {
    if (!slot || !charKey) return null;
    if (slot.id === 'character')    return `${charKey}_card`;
    if (slot.id === 'equipmentSet') return `${charKey}_equipment_card`;
    return `${charKey}_${slot.id}`;
  }, []);

  const resolveDetailCharKey = useCallback(() => {
    if (!detailCard) return null;
    let ck = detailCard.charKey;
    if (!ck && detailCard.slot?.id === 'character' && detailCard.card?.instance_id && currentGarrison) {
      const cid = detailCard.card.instance_id;
      if (currentGarrison.char1_card === cid)      ck = 'char1';
      else if (currentGarrison.char2_card === cid) ck = 'char2';
    }
    return ck || null;
  }, [detailCard, currentGarrison]);

  const getGarrisonBonus = useCallback((charKey) => {
    if (!cityId) return {};
    const citySeg = String(cityId).replace(/[^a-zA-Z0-9_]/g, '_');
    const slotKey = `garrison_${citySeg}_${currentSlotNum}_${charKey}`;
    return attributeBonusBySlot?.[slotKey] || {};
  }, [attributeBonusBySlot, currentSlotNum, cityId]);

  /* ── 卡牌分类（占用 = 任意城池驻地槽，与后端 save 冲突检测一致） ── */
  const occupiedIds = garrisonOccupiedInstanceIds;

  const characterCards   = cards.filter(c => c.card_type === 'character');
  const troopCards       = cards.filter(c => c.card_type === 'troop');
  const titleCards       = cards.filter(c => c.card_type === 'title');
  const equipmentSetCards = cards.filter(
    c => c.card_type === 'equipmentSet' && c.config?.displayName && String(c.config.displayName).trim()
  );
  const availableCards = cards.filter(c => {
    if (c.card_type === 'equipmentSet') return false;
    if (c.is_equipped || occupiedIds.has(c.instance_id)) return false;
    if (c.card_type === 'equipment' && c.bound_equipment_set_instance_id) return false;
    if (isMainCityBarracksStored(c)) return false;
    return true;
  });
  const encapsulateEquipmentPool = cards.filter(
    c => c.card_type === 'equipment' && !c.is_equipped && !occupiedIds.has(c.instance_id)
  );

  const getAvailableCards = useCallback((type) => {
    const pool = type === 'character'    ? characterCards
      : type === 'troop'                 ? troopCards
      : type === 'title'                 ? titleCards
      : type === 'equipmentSet'          ? equipmentSetCards
      : [];
    return pool.filter(c => {
      if (c.is_equipped || occupiedIds.has(c.instance_id)) return false;
      if (isMainCityBarracksStored(c)) return false;
      if (type !== 'troop') return true;
      const maxBattle = c.max_battle_count ?? 10;
      const count     = Math.max(0, c.battle_count ?? 0);
      return count < maxBattle || c.rarity === 'legendary';
    });
  }, [characterCards, troopCards, titleCards, equipmentSetCards, occupiedIds]);

  const getSlotContent = useCallback((slot, charKey) => {
    switch (slot.id) {
      case 'troop1':       return getCardFromGarrison(`${charKey}_troop1`);
      case 'troop2':       return getCardFromGarrison(`${charKey}_troop2`);
      case 'equipmentSet': return getCardFromGarrison(`${charKey}_equipment_card`);
      case 'title':        return getCardFromGarrison(`${charKey}_title`);
      default:             return null;
    }
  }, [getCardFromGarrison]);

  /* ── 共用面板 props ── */
  const generalPanelSharedProps = (charKey) => ({
    charKey,
    charCard: getCardFromGarrison(`${charKey}_card`),
    attributeBonus: getGarrisonBonus(charKey),
    availableCharacters: getAvailableCards('character'),
    onEquipCharacter: (card) => handleEquipCharacter(card, charKey),
    skillsMap,
    getSlotContent,
    selectedSlot,
    onSlotClick: handleSlotClick,
    onCharCardClick: handleGeneralCardClick,
    garrison: currentGarrison,
    cards,
    getCardFromGarrison,
    playerId: player?.player_id,
  });

  const garrisonLandscapeCells = [
    {
      id: 'garrison-quadrant-locked',
      title: '说明',
      content: (
        <div className="flex h-full min-h-[8rem] flex-col items-center justify-center bg-stone-900/50 px-2 text-center">
          <div className="mb-2 text-4xl opacity-40">🔒</div>
          <p className="text-xs leading-snug text-stone-500">驻地编组无需配置玩家角色</p>
        </div>
      ),
    },
    {
      id: 'garrison-quadrant-char1',
      title: '将领1',
      content: <GarrisonGeneralPanel {...generalPanelSharedProps('char1')} isLandscape />,
    },
    {
      id: 'garrison-quadrant-camp',
      title: '军营',
      content: (
        <GarrisonBackpack
          cards={availableCards}
          skillsMap={skillsMap}
          isLandscape={isLandscape}
          playerId={player?.player_id}
          onAfterEncapsulateChange={refresh}
          encapsulateEquipmentPool={encapsulateEquipmentPool}
          equipmentSetCards={equipmentSetCards}
        />
      ),
    },
    {
      id: 'garrison-quadrant-char2',
      title: '将领2',
      content: <GarrisonGeneralPanel {...generalPanelSharedProps('char2')} isLandscape />,
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 flex flex-col">

      {/* ── 顶部栏 ── */}
      <div className="flex flex-col border-b border-amber-900/50 bg-stone-900/80 sticky top-0 z-10">
        <div className="px-3 py-1.5 text-[10px] text-stone-500 leading-snug border-b border-stone-700/40 text-left space-y-1">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
            <span>🏯 {cityName}城</span>
            <span className="text-stone-600">|</span>
            <span>卡池A/B 各需将领1+将领2 四路部队总兵力≥800 才激活驻守</span>
            <span className="text-stone-600">|</span>
            <span className="text-amber-400/90">当前卡池兵力合计：{poolTroopTotal}</span>
            <span className="text-stone-600">|</span>
            <span className="text-stone-400">
              当前编辑：卡池{activePool}（{activePool === 'A' ? '首轮防守' : '第二轮防守'}）
            </span>
            {saving && <span className="text-amber-400 animate-pulse">保存中…</span>}
          </div>
          {activationHint && (
            <div className="text-amber-500/90 text-[11px] leading-snug">{activationHint}</div>
          )}
        </div>
        <TabSubNav
          tabs={GARRISON_POOL_SUB_TABS}
          activeTabId={activePool}
          onTabChange={(id) => {
            setActivePool(id);
            setActiveChar('char1');
            closeDrawer();
          }}
          onClose={onClose}
        />
      </div>

      {/* ── 主内容 ── */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {isLandscape ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-hidden">
              <QuadrantGrid cells={garrisonLandscapeCells} />
            </div>
          </div>
        ) : (
          /* ── 竖屏 ── */
          <>
            <TabSubNav
              tabs={GARRISON_CHAR_SUB_TABS}
              activeTabId={activeChar}
              onTabChange={(id) => {
                setActiveChar(id);
                closeDrawer();
              }}
              hideClose
            />

            <GarrisonGeneralPanel {...generalPanelSharedProps(activeChar)} isLandscape={false} />

            <GarrisonStatsPanel
              garrison={currentGarrison}
              charKey={activeChar}
              cards={cards}
              getCardFromGarrison={getCardFromGarrison}
              attributeBonus={getGarrisonBonus(activeChar)}
              playerId={player?.player_id}
            />

            <GarrisonBackpack
              cards={availableCards}
              skillsMap={skillsMap}
              isLandscape={isLandscape}
              playerId={player?.player_id}
              onAfterEncapsulateChange={refresh}
              encapsulateEquipmentPool={encapsulateEquipmentPool}
              equipmentSetCards={equipmentSetCards}
            />
          </>
        )}
      </div>

      {/* ── 卡牌详情浮层 ── */}
      {detailCard && (() => {
        const isCharCard    = detailCard.card.card_type === 'character';
        const overlayChar   = isCharCard ? toCharCardData(detailCard.card, {}, skillsMap) : null;
        const lifeStageData = overlayChar ? getCharacterLifeStage(overlayChar.id) : null;
        const baseUrl = import.meta.env.BASE_URL;
        return (
          <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center"
            onClick={() => setDetailCard(null)}>
            <div className="bg-stone-900 rounded-xl p-4 border border-amber-500/30 max-w-sm w-full mx-4"
              onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-amber-400 text-sm font-bold">
                  {detailCard.slot.id === 'character' ? '将领详情' : '卡牌详情'}
                </span>
                <button onClick={() => setDetailCard(null)} className="text-stone-400 hover:text-white">✕</button>
              </div>
              <div className="flex flex-col items-center mb-3 gap-1">
                {lifeStageData && (
                  <p className="text-stone-500 text-[11px] text-center">点击卡牌可翻面查看生涯</p>
                )}
                <div style={{ transform: `scale(${CARD_SCALE_DETAIL_MODAL})`, transformOrigin: 'top center' }}>
                  {detailCard.card.card_type === 'character' ? (
                    <CharacterCard character={overlayChar} skillsMap={skillsMap} showDetails={true}
                      baseUrl={baseUrl} lifeStageData={lifeStageData} disableHoverScale />
                  ) : detailCard.card.card_type === 'troop' ? (
                    <TroopCard troop={toTroopCardData(detailCard.card)} skillsMap={skillsMap}
                      showDetails={true} baseUrl={baseUrl} disableHoverScale />
                  ) : detailCard.card.card_type === 'title' ? (
                    <TitleAchievementCard item={toTitleCardData(detailCard.card)} type="title" baseUrl={baseUrl} />
                  ) : detailCard.card.card_type === 'equipment' ? (
                    <EquipmentCard equipment={toEquipCardData(detailCard.card)} baseUrl={baseUrl} />
                  ) : (
                    <div className="text-stone-400 text-sm text-center py-8">卡牌预览</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                  const ck    = resolveDetailCharKey();
                  const field = garrisonFieldForSlot(detailCard.slot, ck);
                  if (field) saveGarrison(field, null);
                  setDetailCard(null);
                }}
                  className="flex-1 py-2 rounded-lg bg-red-900/50 border border-red-700/50 text-red-300 text-sm
                    hover:bg-red-800/50 transition-colors">
                  卸下
                </button>
                <button onClick={() => {
                  const charKey = resolveDetailCharKey();
                  setDetailCard(null);
                  if (!charKey) return;
                  setSelectedSlot({ ...detailCard.slot, charKey, pool: activePool });
                  setDrawerOpen(true);
                }}
                  className="flex-1 py-2 rounded-lg bg-amber-900/50 border border-amber-700/50 text-amber-300 text-sm
                    hover:bg-amber-800/50 transition-colors">
                  更换
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 底部抽屉 ── */}
      {drawerOpen && selectedSlot && (
        <GarrisonDrawer
          slot={selectedSlot}
          cards={getAvailableCards(
            selectedSlot.id === 'character'    ? 'character'
            : selectedSlot.id === 'title'      ? 'title'
            : selectedSlot.id === 'equipmentSet' ? 'equipmentSet'
            : 'troop'
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
          <p className="text-center text-gray-800 text-sm whitespace-pre-wrap">{saveErrorMessage}</p>
        </AncientModal>
      )}

    </div>
  );
}


/** 底部抽屉 — 选卡面板（与 `LineupCardDrawer` 一致：将领缩略用 showDetails + minHeight，避免 0.5 缩放下卡面下半截空白） */
function GarrisonDrawer({ slot, cards, skillsMap, onSelect, onClose }) {
  const baseUrl        = import.meta.env.BASE_URL;
  const isCharSlot     = slot.id === 'character';
  const isTitleSlot    = slot.id === 'title';
  const isEquipSetSlot = slot.id === 'equipmentSet';

  const grouped = {};
  cards.forEach(card => {
    const r = card.config?.rarity || card.rarity || 'common';
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push(card);
  });
  const RARITY_ORDER_MAP = { common: 0, rare: 1, epic: 2, legendary: 3, core: 4 };
  const sortedRarities = Object.keys(grouped).sort((a, b) => (RARITY_ORDER_MAP[a] ?? 99) - (RARITY_ORDER_MAP[b] ?? 99));
  const rarityLabel    = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[110]" onClick={onClose} />
      <div className="fixed left-0 right-0 bottom-0 z-[111] bg-stone-900 border-t-2 border-amber-700/50
        rounded-t-2xl flex flex-col top-[4.5rem] sm:top-14">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 flex-shrink-0">
          <h3 className="text-amber-400 text-sm font-bold">{slot.icon} 选择{slot.label}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-white text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {cards.length === 0 ? (
            <div className="text-center py-8 text-stone-500 text-sm">暂无可装备的{slot.label}</div>
          ) : (
            sortedRarities.map(rarity => (
              <div key={rarity} className="mb-3">
                <div className="text-stone-500 text-xs mb-1.5 px-1">{rarityLabel[rarity]}（{grouped[rarity].length}）</div>
                <div className="flex flex-wrap gap-2">
                  {grouped[rarity].map(card => (
                    <div key={card.instance_id} onClick={() => onSelect(card)}
                      className="cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                      style={{
                        width: 128,
                        ...(isCharSlot
                          ? { minHeight: 208 }
                          : { height: isTitleSlot ? 96 : isEquipSetSlot ? 96 : 192 }),
                      }}>
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        {isCharSlot ? (
                          <CharacterCard
                            character={toCharCardData(card, {}, skillsMap)}
                            skillsMap={skillsMap}
                            showDetails
                            baseUrl={baseUrl}
                            disableHoverScale
                          />
                        ) : isTitleSlot ? (
                          <TitleAchievementCard item={toTitleCardData(card)} type="title" baseUrl={baseUrl} />
                        ) : isEquipSetSlot ? (
                          <div className="w-[256px] h-[192px] rounded-xl bg-stone-800 border-2 border-amber-700/40 p-3 flex flex-col justify-between">
                            <div className="text-amber-200 text-sm font-bold truncate">{card.config?.displayName || card.instance_id}</div>
                            <div className="text-stone-400 text-xs">装备卡</div>
                          </div>
                        ) : (
                          <TroopCard troop={toTroopCardData(card)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} disableHoverScale />
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
