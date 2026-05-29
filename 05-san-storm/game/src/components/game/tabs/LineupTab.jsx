/**
 * 上阵编组 Tab — 暗黑风装备界面（CR C5，2026-04-29 二次拆分后版本）
 *
 * 子 Tab：玩家 / 将领1 / 将领2，每行中央一张角色卡 + 左右各 3 个槽位。
 * - 玩家行：部队 / 官职 / 装备卡 / 称号 / 成就(未实装) / 宝物(未实装)
 * - 将领行：部队1 / 部队2 / 装备卡 / 称号 / 成就(未实装) / 宝物(未实装)
 *
 * 本主组件只负责：状态机（当前子 Tab、抽屉 / 详情浮层）、装备 / 卸下回调、
 * 横竖屏布局组装。其它原本住在同一文件的子组件已拆到 `tabs/lineup/`。
 *
 * @see 22-2-TROOP_LINEUP_SYSTEM.md
 * @see 24-1-EQUIPMENT_SYSTEM.md
 */

import { useState, useCallback } from 'react';
import {
  usePlayer,
  useCards,
  useAttributeBonusBySlot,
  usePlayerRefresh,
  usePlayerLoadStatus,
} from '@/contexts/PlayerContext';
import { useLifeStages } from '@/hooks/useLifeStages';
import { playerAPI } from '@/services/playerApi';
import { useSkillsMap } from '@/hooks/useSkillsMap';
import { useSilentProfilePoll } from '@/hooks/useSilentProfilePoll';
import { useGarrisonOccupiedIds } from '@/hooks/useGarrisonOccupiedIds';
import { isMainCityBarracksStored } from '@/utils/garrisonBarracksTroopPool';
import GarrisonGeneralNotRecruited from '@/components/garrison/GarrisonGeneralNotRecruited';
import GarrisonBackpack from '@/components/garrison/GarrisonBackpack';
import { TabPageCloseButton, useGameTabLandscape } from '@/components/game/TabPageCloseAffordance';
import TabSubNav from '@/components/game/TabSubNav';
import QuadrantGrid from '@/components/game/QuadrantGrid';
import { PLAYER_SLOTS, GENERAL_SLOTS, sortCardsByRarity } from './lineup/lineupSlots';
import { LandscapeQuadrant, EquipmentLayout } from './lineup/LineupEquipmentLayout';
import LineupStatsPanel from './lineup/LineupStatsPanel';
import LineupCardDrawer from './lineup/LineupCardDrawer';
import LineupCardDetailOverlay from './lineup/LineupCardDetailOverlay';

export default function LineupTab({ onClose, onOpenAttributeReroll }) {
  // CR A7（2026-04-29）：按字段订阅，每个 hook 显式声明本组件读了哪些 ctx 字段，方便未来切到 selector 引擎
  const player = usePlayer();
  const cards = useCards();
  const refresh = usePlayerRefresh();
  const attributeBonusBySlot = useAttributeBonusBySlot();
  const { loading, error } = usePlayerLoadStatus();
  const { getCharacterLifeStage } = useLifeStages();
  const [activeSubTab, setActiveSubTab] = useState('player');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailCard, setDetailCard] = useState(null); // 详情浮层：{ card, slot, slotOwner }

  /* ── 共享 hooks（与 GarrisonLineup 共用） ── */
  useSilentProfilePoll(refresh);
  const skillsMap = useSkillsMap();
  /**
   * 驻地占用实例集（14 字段口径，与 `garrisonAPI.save` 后端冲突检测一致）。
   * 历史上这里只扫 8 字段，漏 `equipment_card / achievement / treasure`，
   * 装备卡装到驻地后仍可能在上阵选卡列表里出现；CR C5（2026-04-29）一并修复。
   * 第二参数传 `[cards]` 让"装备 / 卸下后 cards 变化"重新拉取，与原行为一致。
   */
  const garrisonIds = useGarrisonOccupiedIds(player?.playerId, [cards]);

  const isLandscape = useGameTabLandscape();

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedSlot(null);
    setDetailCard(null);
  }, []);

  // 点击槽位：空槽 → 选卡抽屉；已装备 → 详情浮层
  // slotOwner：横屏 4 象限下 activeSubTab 仍可能是 player，必须显式记录该槽位归属
  const handleSlotClick = useCallback((slot, content, slotOwner) => {
    if (!slot.implemented) return;
    if (slot.id === 'position') {
      // 官职槽：有官职时显示详情（只读），无官职时不处理
      if (content) setDetailCard({ card: content, slot });
      return;
    }
    if (content) {
      setDetailCard({ card: content, slot, slotOwner });
    } else {
      setSelectedSlot({ ...slot, slotOwner });
      setDrawerOpen(true);
    }
  }, []);

  // 装备将领卡到将领槽（点击"未招募"占位时由 GarrisonGeneralNotRecruited 触发）
  const handleEquipCharacter = useCallback(async (card, subTab) => {
    const equippedBy = subTab === 'char1' ? 'character1' : 'character2';
    try {
      const result = await playerAPI.equipCard(player.playerId, card.instanceId, equippedBy, 'character');
      if (result.success) refresh();
      else console.error('[LineupTab] 装备将领失败:', result.error);
    } catch (err) {
      console.error('[LineupTab] 装备将领请求失败:', err);
    }
  }, [player, refresh]);

  // 横屏四象限下 activeSubTab 可能仍为 player，必须传 char1/char2，否则"更换"会误装到玩家槽
  const handleGeneralCardClick = useCallback((card, slotOwner) => {
    const virtualSlot = { id: 'character', label: '将领', icon: '👤', implemented: true };
    const owner = slotOwner ?? activeSubTab;
    setDetailCard({ card, slot: virtualSlot, slotOwner: owner });
  }, [activeSubTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 m-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-center">
        ❌ {error}
      </div>
    );
  }

  /* ── 卡牌分类（按上阵装备情况切片） ── */
  const troopCards = cards.filter((c) => c.cardType === 'troop');
  const titleCards = cards.filter((c) => c.cardType === 'title');
  const characterCards = cards.filter((c) => c.cardType === 'character');

  const playerTroops = troopCards.filter((c) => c.equippedBy === 'player' && c.isEquipped && c.equippedSlot === 'troop');
  const playerTitles = titleCards.filter((c) => c.equippedBy === 'player' && c.isEquipped && c.equippedSlot === 'title');

  const char1Troops = troopCards.filter((c) => c.equippedBy === 'character1' && c.isEquipped && (c.equippedSlot === 'troop1' || c.equippedSlot === 'troop2'));
  const char1Titles = titleCards.filter((c) => c.equippedBy === 'character1' && c.isEquipped && c.equippedSlot === 'title');
  const char1Character = characterCards.find((c) => c.equippedBy === 'character1' && c.isEquipped && c.equippedSlot === 'character');

  const char2Troops = troopCards.filter((c) => c.equippedBy === 'character2' && c.isEquipped && (c.equippedSlot === 'troop1' || c.equippedSlot === 'troop2'));
  const char2Titles = titleCards.filter((c) => c.equippedBy === 'character2' && c.isEquipped && c.equippedSlot === 'title');
  const char2Character = characterCards.find((c) => c.equippedBy === 'character2' && c.isEquipped && c.equippedSlot === 'character');

  /* ── 可装备池（已排除被驻地占用的实例 + 主城驻军所仓库内卡） ── */
  const unequippedTroops = troopCards.filter((c) => {
    if (c.isEquipped || garrisonIds.has(c.instanceId)) return false;
    if (isMainCityBarracksStored(c)) return false;
    return true;
  });
  const unequippedTitles = titleCards.filter((c) => !c.isEquipped && !garrisonIds.has(c.instanceId));
  const unequippedCharacters = characterCards.filter((c) => !c.isEquipped && !garrisonIds.has(c.instanceId));
  const unequippedEquipmentSets = cards.filter(
    (c) =>
      c.cardType === 'equipmentSet' &&
      c.config?.displayName &&
      String(c.config.displayName).trim() &&
      !c.isEquipped &&
      !garrisonIds.has(c.instanceId)
  );
  const allUnequipped = cards.filter((c) => {
    if (c.cardType === 'equipmentSet') return false;
    if (c.isEquipped || garrisonIds.has(c.instanceId)) return false;
    if (c.cardType === 'equipment' && c.boundEquipmentSetInstanceId) return false;
    if (isMainCityBarracksStored(c)) return false;
    return true;
  });
  const encapsulateEquipmentPool = cards.filter(
    (c) => c.cardType === 'equipment' && !c.isEquipped && !garrisonIds.has(c.instanceId)
  );
  const equipmentSetCards = cards.filter(
    (c) =>
      c.cardType === 'equipmentSet' &&
      c.config?.displayName &&
      String(c.config.displayName).trim()
  );

  const isGeneralRecruited = (subTab) => {
    if (subTab === 'char1') return !!char1Character;
    if (subTab === 'char2') return !!char2Character;
    return false;
  };
  const isGeneral = activeSubTab !== 'player';
  const slots = isGeneral ? GENERAL_SLOTS : PLAYER_SLOTS;
  const leftSlots = slots.filter((s) => s.side === 'left');
  const rightSlots = slots.filter((s) => s.side === 'right');

  /* ── 槽位 → 当前内容（按子 Tab 切片） ── */
  const getSlotContent = (slot, subTab = activeSubTab) => {
    if (subTab === 'player') {
      switch (slot.id) {
        case 'troop':
          return playerTroops[0] || null;
        case 'equipmentSet':
          return cards.find(
            (c) =>
              c.cardType === 'equipmentSet' &&
              c.isEquipped &&
              c.equippedBy === 'player' &&
              c.equippedSlot === 'equipmentSet'
          ) || null;
        case 'title':
          return playerTitles[0] || null;
        case 'position':
          return player?.positionConfig || (player?.currentPositionName
            ? { name: player.currentPositionName, level: player.positionLevel }
            : null);
        default:
          return null;
      }
    }
    // 将领：精确匹配 equipped_slot
    const troops = subTab === 'char1' ? char1Troops : char2Troops;
    const titles = subTab === 'char1' ? char1Titles : char2Titles;
    const equipmentSet = cards.find(
      (c) =>
        c.cardType === 'equipmentSet' &&
        c.isEquipped &&
        c.equippedBy === (subTab === 'char1' ? 'character1' : 'character2') &&
        c.equippedSlot === 'equipmentSet'
    );
    switch (slot.id) {
      case 'troop1': return troops.find((c) => c.equippedSlot === 'troop1') || null;
      case 'troop2': return troops.find((c) => c.equippedSlot === 'troop2') || null;
      case 'equipmentSet': return equipmentSet || null;
      case 'title': return titles[0] || null;
      default: return null;
    }
  };

  /* ── 抽屉的可选卡牌（耐久过期：白蓝紫不再列出；橙归 0 仍可上阵；金归 0 不可再装） ── */
  const getAvailableCards = () => {
    if (!selectedSlot) return [];
    if (selectedSlot.id === 'character') {
      return sortCardsByRarity(unequippedCharacters);
    }
    if (selectedSlot.id === 'troop' || selectedSlot.id === 'troop1' || selectedSlot.id === 'troop2') {
      return unequippedTroops.filter((c) => {
        const maxBattle = c.maxBattleCount ?? 10;
        const count = Math.max(0, c.battleCount ?? 0);
        const isExpired = count >= maxBattle;
        if (!isExpired) return true;
        return c.rarity === 'legendary';
      });
    }
    if (selectedSlot.id === 'title') return unequippedTitles;
    if (selectedSlot.id === 'equipmentSet') return unequippedEquipmentSets;
    return [];
  };

  const playerLineupTabLabel = `[${player?.characterName || '玩家'}]`;
  const lineupSubNavTabs = [
    { id: 'player', label: playerLineupTabLabel },
    { id: 'char1', label: '将领1' },
    { id: 'char2', label: '将领2' },
  ];

  /* ── 横屏 4 象限单元 ── */
  const lineupLandscapeCells = [
    {
      id: 'lineup-quadrant-player',
      title: playerLineupTabLabel,
      content: (
        <LandscapeQuadrant
          player={player}
          activeSubTab="player"
          slots={PLAYER_SLOTS}
          getSlotContent={(slot) => getSlotContent(slot, 'player')}
          onSlotClick={handleSlotClick}
          selectedSlot={selectedSlot}
          skillsMap={skillsMap}
          statsPanel={playerTroops.length > 0 ? (
            <LineupStatsPanel player={player} troops={playerTroops} compact
              playerId={player?.playerId} rankBucket="main:player" />
          ) : null}
          attributeBonus={attributeBonusBySlot.player}
        />
      ),
    },
    {
      id: 'lineup-quadrant-char1',
      title: '将领1',
      content: isGeneralRecruited('char1') ? (
        <LandscapeQuadrant
          player={player}
          activeSubTab="char1"
          slots={GENERAL_SLOTS}
          getSlotContent={(slot) => getSlotContent(slot, 'char1')}
          onSlotClick={handleSlotClick}
          selectedSlot={selectedSlot}
          skillsMap={skillsMap}
          statsPanel={char1Troops.length > 0 ? (
            <LineupStatsPanel player={player} troops={char1Troops} compact
              attrs={char1Character?.config ? { combat: char1Character.config.combat, command: char1Character.config.command, courage: char1Character.config.courage, luck: char1Character.config.luck } : null}
              playerId={player?.playerId} rankBucket="main:character1" />
          ) : null}
          attributeBonus={attributeBonusBySlot.character1}
          generalCard={char1Character}
          onGeneralCardClick={handleGeneralCardClick}
        />
      ) : (
        <GarrisonGeneralNotRecruited label="将领1" unequippedCharacters={unequippedCharacters}
          onEquipCharacter={(card) => handleEquipCharacter(card, 'char1')} skillsMap={skillsMap}
          emptyStatusText="尚未招募" />
      ),
    },
    {
      id: 'lineup-quadrant-camp',
      title: '军营',
      content: (
        <GarrisonBackpack
          cards={allUnequipped}
          skillsMap={skillsMap}
          isLandscape={isLandscape}
          playerId={player?.playerId}
          onAfterEncapsulateChange={refresh}
          encapsulateEquipmentPool={encapsulateEquipmentPool}
          equipmentSetCards={equipmentSetCards}
          footerNote={null}
        />
      ),
    },
    {
      id: 'lineup-quadrant-char2',
      title: '将领2',
      content: isGeneralRecruited('char2') ? (
        <LandscapeQuadrant
          player={player}
          activeSubTab="char2"
          slots={GENERAL_SLOTS}
          getSlotContent={(slot) => getSlotContent(slot, 'char2')}
          onSlotClick={handleSlotClick}
          selectedSlot={selectedSlot}
          skillsMap={skillsMap}
          statsPanel={char2Troops.length > 0 ? (
            <LineupStatsPanel player={player} troops={char2Troops} compact
              attrs={char2Character?.config ? { combat: char2Character.config.combat, command: char2Character.config.command, courage: char2Character.config.courage, luck: char2Character.config.luck } : null}
              playerId={player?.playerId} rankBucket="main:character2" />
          ) : null}
          attributeBonus={attributeBonusBySlot.character2}
          generalCard={char2Character}
          onGeneralCardClick={handleGeneralCardClick}
        />
      ) : (
        <GarrisonGeneralNotRecruited label="将领2" unequippedCharacters={unequippedCharacters}
          onEquipCharacter={(card) => handleEquipCharacter(card, 'char2')} skillsMap={skillsMap}
          emptyStatusText="尚未招募" />
      ),
    },
  ];

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900">
      {!isLandscape && (
        <TabSubNav
          tabs={lineupSubNavTabs}
          activeTabId={activeSubTab}
          onTabChange={(id) => { setActiveSubTab(id); closeDrawer(); }}
          onClose={onClose}
        />
      )}

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {isLandscape ? (
          <div className="flex h-full min-h-0 flex-col">
            <TabPageCloseButton onClose={onClose} variant="corner" />
            <div className="min-h-0 flex-1 overflow-hidden">
              <QuadrantGrid cells={lineupLandscapeCells} />
            </div>
          </div>
        ) : (
          <>
            {activeSubTab !== 'player' && !isGeneralRecruited(activeSubTab) ? (
              <GarrisonGeneralNotRecruited label={activeSubTab === 'char1' ? '将领1' : '将领2'}
                unequippedCharacters={unequippedCharacters}
                onEquipCharacter={(card) => handleEquipCharacter(card, activeSubTab)} skillsMap={skillsMap}
                emptyStatusText="尚未招募" />
            ) : (
              <EquipmentLayout
                player={player}
                activeSubTab={activeSubTab}
                leftSlots={leftSlots}
                rightSlots={rightSlots}
                getSlotContent={getSlotContent}
                onSlotClick={handleSlotClick}
                selectedSlot={selectedSlot}
                skillsMap={skillsMap}
                attributeBonus={attributeBonusBySlot[activeSubTab === 'player' ? 'player' : activeSubTab === 'char1' ? 'character1' : 'character2']}
                generalCard={activeSubTab === 'char1' ? char1Character : activeSubTab === 'char2' ? char2Character : null}
                onGeneralCardClick={handleGeneralCardClick}
              />
            )}

            {/* 数据分析区域 — 显示当前子 Tab 对应的部队卡数据 */}
            {(() => {
              const subTroops = activeSubTab === 'player' ? playerTroops
                : activeSubTab === 'char1' ? char1Troops
                : char2Troops;
              const generalCard = activeSubTab === 'char1' ? char1Character : activeSubTab === 'char2' ? char2Character : null;
              const generalAttrs = generalCard?.config ? {
                combat: generalCard.config.combat, command: generalCard.config.command,
                courage: generalCard.config.courage, luck: generalCard.config.luck,
              } : null;
              const rankBucket = activeSubTab === 'player' ? 'main:player'
                : activeSubTab === 'char1' ? 'main:character1' : 'main:character2';
              return subTroops.length > 0 ? (
                <LineupStatsPanel player={player} troops={subTroops} attrs={generalAttrs}
                  playerId={player?.playerId} rankBucket={rankBucket} />
              ) : null;
            })()}

            <GarrisonBackpack
              cards={allUnequipped}
              skillsMap={skillsMap}
              isLandscape={isLandscape}
              playerId={player?.playerId}
              onAfterEncapsulateChange={refresh}
              encapsulateEquipmentPool={encapsulateEquipmentPool}
              equipmentSetCards={equipmentSetCards}
              footerNote={null}
            />
          </>
        )}
      </div>

      {/* 详情浮层：已装备卡牌的完整展示 */}
      {detailCard && (
        <LineupCardDetailOverlay
          card={detailCard.card}
          slot={detailCard.slot}
          skillsMap={skillsMap}
          allCards={cards}
          getCharacterLifeStage={getCharacterLifeStage}
          onOpenAttributeReroll={onOpenAttributeReroll}
          onClose={() => setDetailCard(null)}
          onReplace={() => {
            // 关闭详情 → 打开选卡抽屉（保留 slotOwner；横屏时 activeSubTab 可能仍为 player，按实例兜底到 char1/char2）
            const slot = detailCard.slot;
            let owner = detailCard.slotOwner;
            if (!owner && slot?.id === 'character' && detailCard.card) {
              const cid = detailCard.card.instanceId;
              if (char1Character?.instanceId === cid) owner = 'char1';
              else if (char2Character?.instanceId === cid) owner = 'char2';
            }
            setDetailCard(null);
            setSelectedSlot({ ...slot, slotOwner: owner || activeSubTab });
            setDrawerOpen(true);
          }}
          onUnequip={async () => {
            try {
              const result = await playerAPI.unequipCard(player.playerId, detailCard.card.instanceId);
              if (result.success) {
                await refresh();
              } else {
                console.error('[LineupTab] 卸下失败:', result.error);
              }
            } catch (err) {
              console.error('[LineupTab] 卸下请求失败:', err);
            }
            setDetailCard(null);
          }}
        />
      )}

      {/* 底部抽屉：可装备卡牌列表 */}
      {drawerOpen && (
        <LineupCardDrawer
          slot={selectedSlot}
          cards={getAvailableCards()}
          allCards={cards}
          skillsMap={skillsMap}
          onSelect={async (card) => {
            const owner = selectedSlot?.slotOwner || activeSubTab;
            const equippedBy = owner === 'player' ? 'player'
              : owner === 'char1' ? 'character1' : 'character2';
            try {
              const result = await playerAPI.equipCard(player.playerId, card.instanceId, equippedBy, selectedSlot.id);
              if (result.success) {
                await refresh();
              } else {
                console.error('[LineupTab] 装备失败:', result.error);
              }
            } catch (err) {
              console.error('[LineupTab] 装备请求失败:', err);
            }
            closeDrawer();
          }}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}
