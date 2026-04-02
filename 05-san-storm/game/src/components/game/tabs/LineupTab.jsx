/**
 * 编组Tab（Lineup）- 暗黑破坏神风格装备界面
 * 
 * @description 将领配置页面：玩家角色 / 将领1 / 将领2 三个子Tab
 *              中央角色卡 + 左右各3个装备槽位
 *              玩家: 部队卡/官职卡/装备卡(左) + 称号卡/成就卡/宝物卡(右)
 *              将领: 部队卡1/部队卡2/装备卡(左) + 称号卡/成就卡/宝物卡(右)
 * @see 22-2-TROOP_LINEUP_SYSTEM.md
 * @see 24-1-EQUIPMENT_SYSTEM.md
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useLifeStages } from '@/hooks/useLifeStages';
import { loadSharedData } from '@/services/dataService';
import { playerAPI } from '@/services/playerApi';
import { garrisonAPI } from '@/services/garrisonApi';

/** 从官职等级获取对应稀有度 */
function getPositionRarity(level) {
  if (level == null) return 'common';
  if (level <= 3) return 'core';
  if (level === 4) return 'legendary';
  if (level === 5) return 'epic';
  if (level <= 7) return 'rare';
  return 'common';
}
import CharacterCard from '@shared/components/card/CharacterCard';
import TroopCard from '@shared/components/card/TroopCard';
import EquipmentCard from '@shared/components/card/EquipmentCard';
import TitleAchievementCard from '@shared/components/card/TitleAchievementCard';
import PositionCard from '@shared/components/card/PositionCard';
import EncapsulateEquipmentModal from '@/components/game/EncapsulateEquipmentModal';
import { useCharacterRank } from '@/hooks/useCharacterRank';

/** 编组页打开期间：轻量拉档案，使兵力自然恢复等随时间更新（无需整页刷新） */
const LINEUP_PROFILE_POLL_MS = 60_000;

const SUB_TABS = [
  { id: 'player', label: null }, // 动态生成：[玩家名]
  { id: 'char1',  label: '将领1' },
  { id: 'char2',  label: '将领2' },
];

/** 与军营「将领」行一致：灰 < 蓝 < 紫 < 橙 < 金 */
const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, core: 4 };

function sortCardsByRarity(cards) {
  if (!cards?.length) return [];
  return [...cards].sort(
    (a, b) =>
      (RARITY_ORDER[a.config?.rarity || a.rarity || 'common'] ?? 99) -
      (RARITY_ORDER[b.config?.rarity || b.rarity || 'common'] ?? 99)
  );
}

/** 槽位定义 */
const PLAYER_SLOTS = [
  // 左侧
  { id: 'troop',     label: '部队',   icon: '⚔️', side: 'left',  implemented: true },
  { id: 'position',  label: '官职',   icon: '👑', side: 'left',  implemented: true },
  { id: 'equipmentSet', label: '装备卡', icon: '🛡️', side: 'left',  implemented: true },
  // 右侧
  { id: 'title',       label: '称号', icon: '🎖️', side: 'right', implemented: true },
  { id: 'achievement', label: '成就', icon: '🏆', side: 'right', implemented: false },
  { id: 'treasure',    label: '宝物', icon: '💎', side: 'right', implemented: false },
];

const GENERAL_SLOTS = [
  // 左侧 — 将领用第二个部队卡替代官职卡
  { id: 'troop1',    label: '部队1',  icon: '⚔️', side: 'left',  implemented: true },
  { id: 'troop2',    label: '部队2',  icon: '⚔️', side: 'left',  implemented: true },
  { id: 'equipmentSet', label: '装备卡', icon: '🛡️', side: 'left',  implemented: true },
  // 右侧
  { id: 'title',       label: '称号', icon: '🎖️', side: 'right', implemented: true },
  { id: 'achievement', label: '成就', icon: '🏆', side: 'right', implemented: false },
  { id: 'treasure',    label: '宝物', icon: '💎', side: 'right', implemented: false },
];

export default function LineupTab({ onClose }) {
  const { player, cards, loading, error, refresh, attributeBonusBySlot } = usePlayerContext();
  const { getCharacterLifeStage } = useLifeStages();
  const [activeSubTab, setActiveSubTab] = useState('player');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailCard, setDetailCard] = useState(null); // 详情浮层：{ card, slot }
  const [skillsMap, setSkillsMap] = useState({});
  const [garrisonIds, setGarrisonIds] = useState(new Set()); // 被驻守占用的 instance_id

  // 打开编组时静默拉最新档案；停留期间每分钟再拉一次（兵力自然恢复等）
  useEffect(() => {
    refresh({ silent: true });
    const id = setInterval(() => refresh({ silent: true }), LINEUP_PROFILE_POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // 横屏检测：宽度≥768px 且 宽>高
  const [isLandscape, setIsLandscape] = useState(
    () => window.innerWidth >= 768 && window.innerWidth > window.innerHeight
  );
  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth >= 768 && window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 加载技能数据（用于TroopCard显示）
  useEffect(() => {
    const loadSkills = async () => {
      try {
        const skillsData = await loadSharedData('skills');
        if (skillsData?.skills) {
          const map = {};
          skillsData.skills.forEach(s => { map[s.id] = s; });
          setSkillsMap(map);
        }
      } catch (err) {
        console.error('[LineupTab] 加载技能数据失败:', err);
      }
    };
    loadSkills();
  }, []);

  // 加载驻守数据 → 获取被驻守占用的 instance_id（排除在可装备列表中）
  useEffect(() => {
    if (!player?.player_id) return;
    garrisonAPI.getAll(player.player_id).then(res => {
      if (res.success) {
        const ids = new Set();
        const fields = [
          'char1_card', 'char1_troop1', 'char1_troop2', 'char1_title',
          'char2_card', 'char2_troop1', 'char2_troop2', 'char2_title',
        ];
        res.garrisons.forEach(g => {
          fields.forEach(f => { if (g[f]) ids.add(g[f]); });
        });
        setGarrisonIds(ids);
      }
    }).catch(() => {});
  }, [player?.player_id, cards]); // cards变化时重新加载（驻守操作后refresh会更新cards）

  // 关闭抽屉/详情
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedSlot(null);
    setDetailCard(null);
  }, []);

  // 点击槽位：空槽→选择抽屉，已装备→详情浮层
  // slotOwner: 标记槽位所属的子Tab（横屏模式下需要区分象限）
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

  // 装备将领卡到将领槽
  const handleEquipCharacter = useCallback(async (card, subTab) => {
    const equippedBy = subTab === 'char1' ? 'character1' : 'character2';
    try {
      const result = await playerAPI.equipCard(player.player_id, card.instance_id, equippedBy, 'character');
      if (result.success) refresh();
      else console.error('[LineupTab] 装备将领失败:', result.error);
    } catch (err) {
      console.error('[LineupTab] 装备将领请求失败:', err);
    }
  }, [player, refresh]);

  // 点击将领角色卡 → 显示详情浮层（可卸下将领）
  // 横屏四象限下 activeSubTab 可能仍为 player，必须传 char1/char2，否则「更换」会误装到玩家槽
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

  // 分类卡牌
  const troopCards = cards.filter(c => c.card_type === 'troop');
  const titleCards = cards.filter(c => c.card_type === 'title');
  const characterCards = cards.filter(c => c.card_type === 'character');
  const playerTroops = troopCards.filter(c => c.equipped_by === 'player' && c.is_equipped && c.equipped_slot === 'troop');
  const playerTitles = titleCards.filter(c => c.equipped_by === 'player' && c.is_equipped && c.equipped_slot === 'title');
  const char1Troops = troopCards.filter(c => c.equipped_by === 'character1' && c.is_equipped && (c.equipped_slot === 'troop1' || c.equipped_slot === 'troop2'));
  const char1Titles = titleCards.filter(c => c.equipped_by === 'character1' && c.is_equipped && c.equipped_slot === 'title');
  const char1Character = characterCards.find(c => c.equipped_by === 'character1' && c.is_equipped && c.equipped_slot === 'character');
  const char2Troops = troopCards.filter(c => c.equipped_by === 'character2' && c.is_equipped && (c.equipped_slot === 'troop1' || c.equipped_slot === 'troop2'));
  const char2Titles = titleCards.filter(c => c.equipped_by === 'character2' && c.is_equipped && c.equipped_slot === 'title');
  const char2Character = characterCards.find(c => c.equipped_by === 'character2' && c.is_equipped && c.equipped_slot === 'character');
  const unequippedTroops = troopCards.filter(c => !c.is_equipped && !garrisonIds.has(c.instance_id));
  const unequippedTitles = titleCards.filter(c => !c.is_equipped && !garrisonIds.has(c.instance_id));
  const unequippedCharacters = characterCards.filter(c => !c.is_equipped && !garrisonIds.has(c.instance_id));
  const unequippedEquipmentSets = cards.filter(
    (c) =>
      c.card_type === 'equipmentSet' &&
      c.config?.displayName &&
      String(c.config.displayName).trim() &&
      !c.is_equipped &&
      !garrisonIds.has(c.instance_id)
  );
  const allUnequipped = cards.filter(c => {
    if (c.card_type === 'equipmentSet') return false;
    if (c.is_equipped || garrisonIds.has(c.instance_id)) return false;
    if (c.card_type === 'equipment' && c.bound_equipment_set_instance_id) return false;
    return true;
  });
  const encapsulateEquipmentPool = cards.filter(
    c => c.card_type === 'equipment' && !c.is_equipped && !garrisonIds.has(c.instance_id)
  );
  const equipmentSetCards = cards.filter(
    (c) =>
      c.card_type === 'equipmentSet' &&
      c.config?.displayName &&
      String(c.config.displayName).trim()
  );

  // 将领是否已招募（检查是否有将领卡装备到对应槽位）
  const isGeneralRecruited = (subTab) => {
    if (subTab === 'char1') return !!char1Character;
    if (subTab === 'char2') return !!char2Character;
    return false;
  };
  const isGeneral = activeSubTab !== 'player';
  const slots = isGeneral ? GENERAL_SLOTS : PLAYER_SLOTS;
  const leftSlots = slots.filter(s => s.side === 'left');
  const rightSlots = slots.filter(s => s.side === 'right');

  // 获取槽位内容
  const getSlotContent = (slot, subTab = activeSubTab) => {
    if (subTab === 'player') {
      switch (slot.id) {
        case 'troop':
          return playerTroops[0] || null;
        case 'equipmentSet':
          return cards.find(
            (c) =>
              c.card_type === 'equipmentSet' &&
              c.is_equipped &&
              c.equipped_by === 'player' &&
              c.equipped_slot === 'equipmentSet'
          ) || null;
        case 'title':
          return playerTitles[0] || null;
        case 'position':
          return player?.position_config || (player?.current_position_name
            ? { name: player.current_position_name, level: player.position_level }
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
        c.card_type === 'equipmentSet' &&
        c.is_equipped &&
        c.equipped_by === (subTab === 'char1' ? 'character1' : 'character2') &&
        c.equipped_slot === 'equipmentSet'
    );
    switch (slot.id) {
      case 'troop1': return troops.find(c => c.equipped_slot === 'troop1') || null;
      case 'troop2': return troops.find(c => c.equipped_slot === 'troop2') || null;
      case 'equipmentSet': return equipmentSet || null;
      case 'title': return titles[0] || null;
      default: return null;
    }
  };

  // 获取可装备的卡牌列表（用于抽屉）
  // 耐久耗尽：白/蓝/紫不列出；橙(legendary) 归 0 仍可上阵；金(core) 归 0 不可再装（纪念/下赛季继承）
  const getAvailableCards = () => {
    if (!selectedSlot) return [];
    if (selectedSlot.id === 'character') {
      return sortCardsByRarity(unequippedCharacters);
    }
    if (selectedSlot.id === 'troop' || selectedSlot.id === 'troop1' || selectedSlot.id === 'troop2') {
      return unequippedTroops.filter(c => {
        const maxBattle = c.max_battle_count ?? 10;
        const count = Math.max(0, c.battle_count ?? 0);
        const isExpired = count >= maxBattle;
        if (!isExpired) return true;
        return c.rarity === 'legendary';
      });
    }
    if (selectedSlot.id === 'title') {
      return unequippedTitles;
    }
    if (selectedSlot.id === 'equipmentSet') {
      return unequippedEquipmentSets;
    }
    return [];
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900">
      {/* 竖屏：子Tab切换栏 / 横屏：隐藏（三列并排不需要切换） */}
      {!isLandscape && (
        <div className="flex items-center border-b border-amber-900/50 bg-stone-900/80 sticky top-0 z-10">
          <div className="flex flex-1">
            {SUB_TABS.map(tab => {
              const label = tab.id === 'player'
                ? `[${player?.character_name || '玩家'}]`
                : tab.label;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveSubTab(tab.id); closeDrawer(); }}
                  className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative
                    ${activeSubTab === tab.id
                      ? 'text-amber-400'
                      : 'text-stone-500 hover:text-stone-300'}`}
                >
                  {label}
                  {activeSubTab === tab.id && (
                    <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-amber-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
          {/* 关闭按钮 — TODO: 返回大地图（尚未实装） */}
          <button
            onClick={onClose}
            className="flex-shrink-0 px-3 py-3 text-stone-500 hover:text-white transition-colors"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
      )}

      {/* 主内容 */}
      <div className="flex-1 overflow-y-auto">
        {isLandscape ? (
          /* ===== 横屏：2×2 四象限布局 ===== */
          /* 左上=玩家(卡牌|槽位+数据) | 右上=将领1 | 左下=军营 | 右下=将领2 */
          <>
            {/* 横屏：关闭按钮（absolute 悬浮右上角） */}
            <button
              onClick={onClose}
              className="absolute top-1 right-2 z-20 text-stone-500 hover:text-white transition-colors px-2 py-1"
              aria-label="关闭"
            >
              ✕
            </button>

            <div className="grid grid-cols-2 grid-rows-2 h-full">
              {/* 左上：玩家角色 — 左卡牌 | 右(槽位+编组数据) */}
              <div className="border-r border-b border-stone-700/40 overflow-y-auto p-1">
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
                      playerId={player?.player_id} rankBucket="main:player" />
                  ) : null}
                  attributeBonus={attributeBonusBySlot.player}
                />
              </div>

              {/* 右上：将领1 */}
              <div className="border-b border-stone-700/40 overflow-y-auto p-1">
                {isGeneralRecruited('char1') ? (
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
                        playerId={player?.player_id} rankBucket="main:character1" />
                    ) : null}
                    attributeBonus={attributeBonusBySlot.character1}
                    generalCard={char1Character}
                    onGeneralCardClick={handleGeneralCardClick}
                  />
                ) : (
                  <GeneralNotRecruited label="将领1" unequippedCharacters={unequippedCharacters}
                    onEquipCharacter={(card) => handleEquipCharacter(card, 'char1')} skillsMap={skillsMap} />
                )}
              </div>

              {/* 左下：军营 */}
              <div className="border-r border-stone-700/40 overflow-y-auto">
                <BackpackSection
                  cards={allUnequipped}
                  skillsMap={skillsMap}
                  isLandscape={isLandscape}
                  playerId={player?.player_id}
                  onAfterEncapsulateChange={refresh}
                  encapsulateEquipmentPool={encapsulateEquipmentPool}
                  equipmentSetCards={equipmentSetCards}
                />
              </div>

              {/* 右下：将领2 */}
              <div className="overflow-y-auto p-1">
                {isGeneralRecruited('char2') ? (
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
                        playerId={player?.player_id} rankBucket="main:character2" />
                    ) : null}
                    attributeBonus={attributeBonusBySlot.character2}
                    generalCard={char2Character}
                    onGeneralCardClick={handleGeneralCardClick}
                  />
                ) : (
                  <GeneralNotRecruited label="将领2" unequippedCharacters={unequippedCharacters}
                    onEquipCharacter={(card) => handleEquipCharacter(card, 'char2')} skillsMap={skillsMap} />
                )}
              </div>
            </div>
          </>
        ) : (
          /* ===== 竖屏：原有单Tab布局 ===== */
          <>
            {activeSubTab !== 'player' && !isGeneralRecruited(activeSubTab) ? (
              <GeneralNotRecruited label={activeSubTab === 'char1' ? '将领1' : '将领2'}
                unequippedCharacters={unequippedCharacters}
                onEquipCharacter={(card) => handleEquipCharacter(card, activeSubTab)} skillsMap={skillsMap} />
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

            {/* 数据分析区域 — 显示当前子Tab对应的部队卡数据 */}
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
                  playerId={player?.player_id} rankBucket={rankBucket} />
              ) : null;
            })()}

            {/* 军营区域 */}
            <BackpackSection
              cards={allUnequipped}
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

      {/* 详情浮层：已装备卡牌的完整展示 */}
      {detailCard && (
        <CardDetailOverlay
          card={detailCard.card}
          slot={detailCard.slot}
          skillsMap={skillsMap}
          allCards={cards}
          getCharacterLifeStage={getCharacterLifeStage}
          onClose={() => setDetailCard(null)}
          onReplace={() => {
            // 关闭详情 → 打开选择抽屉（保留 slotOwner；横屏时 activeSubTab 可能仍为 player，按实例兜底到 char1/char2）
            const slot = detailCard.slot;
            let owner = detailCard.slotOwner;
            if (!owner && slot?.id === 'character' && detailCard.card) {
              const cid = detailCard.card.instance_id;
              if (char1Character?.instance_id === cid) owner = 'char1';
              else if (char2Character?.instance_id === cid) owner = 'char2';
            }
            setDetailCard(null);
            setSelectedSlot({ ...slot, slotOwner: owner || activeSubTab });
            setDrawerOpen(true);
          }}
          onUnequip={async () => {
            try {
              const result = await playerAPI.unequipCard(
                player.player_id, detailCard.card.instance_id
              );
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
        <CardDrawer
          slot={selectedSlot}
          cards={getAvailableCards()}
          allCards={cards}
          skillsMap={skillsMap}
          onSelect={async (card) => {
            const owner = selectedSlot?.slotOwner || activeSubTab;
            const equippedBy = owner === 'player' ? 'player'
              : owner === 'char1' ? 'character1' : 'character2';
            try {
              const result = await playerAPI.equipCard(
                player.player_id, card.instance_id, equippedBy, selectedSlot.id
              );
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

/** 将领未招募 → 显示将领选择界面 */
function GeneralNotRecruited({ label, unequippedCharacters, onEquipCharacter, skillsMap }) {
  const baseUrl = import.meta.env.BASE_URL;
  if (!unequippedCharacters || unequippedCharacters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 rounded-full border-2 border-dashed border-stone-600 flex items-center justify-center mb-4">
          <span className="text-3xl opacity-40">🎴</span>
        </div>
        <p className="text-stone-500 text-sm">{label} — 尚未招募</p>
        <p className="text-stone-600 text-xs mt-1">暂无可用将领卡</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center py-4">
      <p className="text-amber-400 text-sm font-bold mb-3">选择{label}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {sortCardsByRarity(unequippedCharacters).map(card => (
          <div key={card.instance_id} className="cursor-pointer hover:brightness-110 active:scale-95 transition-all"
            style={{ width: 128, height: 192 }}
            onClick={() => onEquipCharacter(card)}>
            <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
              <CharacterCard character={toCharacterCardData(card)} skillsMap={skillsMap} showDetails={false} baseUrl={baseUrl} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 横屏象限布局：左=角色卡 | 右=2×3槽位网格 */
function LandscapeQuadrant({ player, activeSubTab, slots, getSlotContent, onSlotClick, selectedSlot, skillsMap, statsPanel, attributeBonus = {}, generalCard = null, onGeneralCardClick }) {
  const baseUrl = import.meta.env.BASE_URL;
  const cardScale = 0.82;
  const cardHeight = Math.round(384 * cardScale); // ~315px

  // 构建角色卡数据：玩家用player数据，将领用generalCard的config数据
  const charData = (() => {
    if (activeSubTab === 'player' && player) {
      return {
        id: player.player_id,
        name: player.character_name,
        avatar: player.avatar,
        rarity: getPositionRarity(player.position_level),
        luck: player.luck / 10,
        courage: player.courage / 10,
        combat: player.combat / 10,
        command: player.command / 10,
        intelligence: player.intelligence / 10,
        politics: player.politics / 10,
        charm: player.charm / 10,
        skills: [player.skill_1, player.skill_2].filter(Boolean),
        morale: player.morale ?? 70,
        attributeBonus,
      };
    }
    if (generalCard) {
      return toCharacterCardData(generalCard, attributeBonus);
    }
    return null;
  })();

  return (
    <div className="flex items-stretch h-full">
      {/* 左侧：角色卡（占满象限高度） */}
      <div className="flex-shrink-0 overflow-hidden cursor-pointer" onClick={() => {
        if (generalCard && onGeneralCardClick) onGeneralCardClick(generalCard, activeSubTab);
      }}>
        {charData ? (
          <div style={{ transform: `scale(${cardScale})`, transformOrigin: 'top left', height: `${cardHeight}px` }}>
            <CharacterCard
              character={charData}
              skillsMap={skillsMap}
              showDetails={true}
              baseUrl={baseUrl}
            />
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-stone-600 
                          flex items-center justify-center bg-stone-800/50"
               style={{ width: `${Math.round(256 * cardScale)}px`, height: '100%' }}>
            <span className="text-4xl opacity-30">🎴</span>
          </div>
        )}
      </div>

      {/* 右侧：上方槽位 + 下方编组数据，w-fit让容器收缩到grid实际宽度 */}
      <div className="ml-1">
        {/* 2行×3列 槽位网格 */}
        <div className="grid grid-cols-3 gap-3">
          {slots.map(slot => {
            const content = getSlotContent(slot);
            return (
              <EquipSlot
                key={slot.id}
                slot={slot}
                content={content}
                isSelected={selectedSlot?.id === slot.id && selectedSlot?.slotOwner === activeSubTab}
                onClick={() => onSlotClick(slot, content, activeSubTab)}
                baseUrl={baseUrl}
                skillsMap={skillsMap}
                mini
              />
            );
          })}
        </div>

        {/* 编组数据（同一容器，自动和网格同宽） */}
        {statsPanel && <div className="mt-3">{statsPanel}</div>}
      </div>
    </div>
  );
}

/** 暗黑风格装备布局：左3槽 + 中央角色卡 + 右3槽 */
function EquipmentLayout({ player, activeSubTab, leftSlots, rightSlots, getSlotContent, onSlotClick, selectedSlot, skillsMap, compact = false, attributeBonus = {}, generalCard = null, onGeneralCardClick }) {
  const baseUrl = import.meta.env.BASE_URL;
  const cardScale = compact ? 0.52 : 0.72;
  const cardHeight = Math.round(384 * cardScale);
  const slotHeight = compact ? `${cardHeight}px` : '276px';

  // 构建角色卡数据：玩家用player数据，将领用generalCard的config数据
  const charData = (() => {
    if (activeSubTab === 'player' && player) {
      return {
        id: player.player_id,
        name: player.character_name,
        avatar: player.avatar,
        rarity: getPositionRarity(player.position_level),
        luck: player.luck / 10,
        courage: player.courage / 10,
        combat: player.combat / 10,
        command: player.command / 10,
        intelligence: player.intelligence / 10,
        politics: player.politics / 10,
        charm: player.charm / 10,
        skills: [player.skill_1, player.skill_2].filter(Boolean),
        morale: player.morale ?? 70,
        attributeBonus,
      };
    }
    if (generalCard) {
      return toCharacterCardData(generalCard, attributeBonus);
    }
    return null;
  })();

  return (
    <div className={compact ? 'px-1 py-2' : 'px-1 py-4'}>
      {compact ? (
        /* ===== 横屏 compact：仅角色卡（槽位在外部右侧渲染） ===== */
        <div className="flex items-start justify-center">
          <div className="flex-shrink-0" style={{ height: `${cardHeight}px`, overflow: 'hidden' }}>
            {charData ? (
              <div style={{ transform: `scale(${cardScale})`, transformOrigin: 'top left' }}
                className={generalCard ? 'cursor-pointer' : ''}
                onClick={() => { if (generalCard && onGeneralCardClick) onGeneralCardClick(generalCard, activeSubTab); }}>
                <CharacterCard
                  character={charData}
                  skillsMap={skillsMap}
                  showDetails={true}
                  baseUrl={baseUrl}
                />
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-stone-600 
                              flex items-center justify-center bg-stone-800/50"
                   style={{ width: `${Math.round(256 * cardScale)}px`, height: `${cardHeight}px` }}>
                <span className="text-4xl opacity-30">🎴</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ===== 竖屏：左3槽 + 角色卡 + 右3槽 ===== */
        <div className="flex items-start justify-center">
          {/* 左侧槽位 */}
          <div className="flex flex-col justify-between w-[64px] -mr-4" style={{ height: '276px' }}>
            {leftSlots.map(slot => {
              const content = getSlotContent(slot);
              return (
                <EquipSlot
                  key={slot.id}
                  slot={slot}
                  content={content}
                  isSelected={selectedSlot?.id === slot.id}
                  onClick={() => onSlotClick(slot, content, activeSubTab)}
                  baseUrl={baseUrl}
                  skillsMap={skillsMap}
                />
              );
            })}
          </div>

          {/* 中央角色卡 */}
          <div className="flex-shrink-0" style={{ height: '276px', overflow: 'hidden' }}>
            {charData ? (
              <div className={`transform scale-[0.72] origin-top ${generalCard ? 'cursor-pointer' : ''}`}
                onClick={() => { if (generalCard && onGeneralCardClick) onGeneralCardClick(generalCard, activeSubTab); }}>
                <CharacterCard
                  character={charData}
                  skillsMap={skillsMap}
                  showDetails={true}
                  baseUrl={baseUrl}
                />
              </div>
            ) : (
              <div className="w-[184px] h-[276px] rounded-lg border-2 border-dashed border-stone-600 
                              flex items-center justify-center bg-stone-800/50">
                <span className="text-4xl opacity-30">🎴</span>
              </div>
            )}
          </div>

          {/* 右侧槽位 */}
          <div className="flex flex-col justify-between w-[64px] -ml-4" style={{ height: '276px' }}>
            {rightSlots.map(slot => {
              const content = getSlotContent(slot);
              return (
                <EquipSlot
                  key={slot.id}
                  slot={slot}
                  content={content}
                  isSelected={selectedSlot?.id === slot.id}
                  onClick={() => onSlotClick(slot, content, activeSubTab)}
                  baseUrl={baseUrl}
                  skillsMap={skillsMap}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 数据分析面板 — 显示组合战力、将领排名、粮草消耗
 * 
 * 战力公式参考 17-1-COMBAT_SYSTEM.md:
 *   单兵攻击力 = 部队攻击力 + (将领武力 × 6)
 *   勇气加成 = 1 + (勇气 / 40)
 *   单兵防御力 = 部队防御力 + (统帅 × 5 + 武力 × 3)
 *   综合战力 = (攻击力 + 防御力) × 兵力 / 1000
 * 
 * 粮草公式参考 22-1-TROOP_SYSTEM.md / 26-RESOURCE_SYSTEM.md:
 *   出征消耗 = 当前兵力 / 20
 *   恢复消耗 = 需要恢复的兵力 / 10
 */
function LineupStatsPanel({ player, troops, compact = false, attrs = null, playerId = null, rankBucket = null }) {
  const rankInfo = useCharacterRank(playerId, rankBucket);
  if (!player && !attrs) return null;

  // attrs 优先（将领传入），否则从 player 取
  const combat = attrs?.combat ?? (player ? player.combat / 10 : 0);
  const command = attrs?.command ?? (player ? player.command / 10 : 0);
  const courage = attrs?.courage ?? (player ? player.courage / 10 : 0);
  const luck = attrs?.luck ?? (player ? player.luck / 10 : 0);
  const food = player?.food ?? 0;

  let totalPower = 0;
  let totalDeployCost = 0;
  let totalRecoverCost = 0;

  const troopStats = troops.map(card => {
    const cfg = card.config || {};
    const atk = cfg.attack || 0;
    const def = cfg.defense || 0;
    const maxTroops = (cfg.maxTroops || 0) + (card.bonus_max_troops || 0);
    const currentTroops = card.current_troops ?? maxTroops;
    const lostTroops = Math.max(0, maxTroops - currentTroops);

    const unitAtk = (atk + combat * 6) * (1 + courage / 40);
    const unitDef = def + command * 5 + combat * 3;
    const power = Math.round((unitAtk + unitDef) * currentTroops / 1000);
    const deployCost = Math.ceil(currentTroops / 20);
    const recoverCost = lostTroops > 0 ? Math.ceil(lostTroops / 10) : 0;
    // 剩余恢复时间 = 当前缺口 / 10（后端已结算，current_troops是最新值）
    const remainingMin = lostTroops > 0 ? Math.ceil(lostTroops / 10) : 0;

    totalPower += power;
    totalDeployCost += deployCost;
    totalRecoverCost += recoverCost;

    return { equippedBy: card.equipped_by, power, deployCost, recoverCost, remainingMin, currentTroops, maxTroops };
  });

  // 按 equippedBy 分组，每组取最长恢复时间（将领有2张部队卡时取较长的）
  const groupedRemaining = {};
  troopStats.forEach(t => {
    const key = t.equippedBy || 'player';
    groupedRemaining[key] = Math.max(groupedRemaining[key] || 0, t.remainingMin);
  });
  // 总恢复时间 = 所有组中最长的（玩家+将领1+将领2 同时恢复，取最慢的）
  const maxRemainingMin = Math.max(0, ...Object.values(groupedRemaining));

  // 暴击率
  const critRate = ((courage + luck) / 80 * 100).toFixed(1);
  // 闪避率
  const dodgeRate = (luck).toFixed(1);

  return (
    <div className={`${compact ? 'mx-0 mt-1 mb-1 p-2' : 'mx-3 mt-2 mb-2 p-3'} bg-stone-800/50 rounded-lg border border-stone-700/30`}>
      <h4 className="text-stone-400 text-xs font-medium mb-2">📊 编组数据</h4>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {/* 组合战力 */}
        <div className="flex items-center justify-between">
          <span className="text-stone-500">⚔️ 组合战力</span>
          <span className="text-amber-400 font-bold">{totalPower || '—'}</span>
        </div>

        {/* 暴击率 */}
        <div className="flex items-center justify-between">
          <span className="text-stone-500">💥 暴击率</span>
          <span className="text-orange-400">{critRate}%</span>
        </div>

        {/* 出征粮草 */}
        <div className="flex items-center justify-between">
          <span className="text-stone-500">🌾 出征消耗</span>
          <span className="text-green-400">{totalDeployCost || '—'} 粮</span>
        </div>

        {/* 闪避率 */}
        <div className="flex items-center justify-between">
          <span className="text-stone-500">🎲 闪避率</span>
          <span className="text-cyan-400">{dodgeRate}%</span>
        </div>

        {/* 恢复时间 */}
        <div className="flex items-center justify-between">
          <span className="text-stone-500">⏱️ 恢复时间</span>
          {maxRemainingMin > 0 ? (
            food >= totalRecoverCost ? (
              <span className="text-yellow-400 text-right leading-tight">
                余{maxRemainingMin}分钟<br/>（{totalRecoverCost}粮）
              </span>
            ) : (
              <span className="text-red-400">⚠️粮草不足</span>
            )
          ) : (
            <span className="text-stone-600">满编</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-stone-500">🏅 将领排名</span>
          {rankInfo ? (
            <span className="text-amber-400 font-medium text-[10px]">
              第 {rankInfo.rank} / {rankInfo.total} 名
            </span>
          ) : (
            <span className="text-stone-600 text-[10px]">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** 将卡牌原始数据转换为TroopCard组件格式 */
function toTroopCardData(card) {
  const cfg = card.config || {};
  // 后端profile端点已返回camelCase格式的config
  // attack/defense已经除以10，直接使用
  return {
    id: cfg.id || card.card_id,
    name: cfg.name || card.card_id,
    rarity: cfg.rarity || card.rarity,
    troopType: cfg.troopType,
    weaponType: cfg.weaponType,
    faction: cfg.faction,
    attack: cfg.attack || 0,
    defense: cfg.defense || 0,
    speed: cfg.speed,
    movement: cfg.movement,
    range: cfg.range,
    maxTroops: (cfg.maxTroops || 0) + (card.bonus_max_troops || 0),
    currentTroops: card.current_troops,
    skills: cfg.skills || [],
    description: cfg.description,
    battleCount: card.battle_count ?? 0,
    maxBattleCount: card.max_battle_count ?? 10,
    infantryCounter: cfg.infantryCounter,
    cavalryCounter: cfg.cavalryCounter,
    archerCounter: cfg.archerCounter,
    siegeCounter: cfg.siegeCounter,
    plainAdapt: cfg.plainAdapt,
    hillAdapt: cfg.hillAdapt,
    forestAdapt: cfg.forestAdapt,
    siegeAdapt: cfg.siegeAdapt,
  };
}

/** 将卡牌原始数据转换为EquipmentCard组件格式 */
function toEquipmentCardData(card) {
  const cfg = card.config || {};
  // 构建bonus数组
  const bonusKeys = ['luck', 'courage', 'combat', 'command', 'intelligence', 'politics', 'charm'];
  const bonus = bonusKeys
    .filter(k => cfg[`${k}Bonus`])
    .map(k => ({ key: k, value: cfg[`${k}Bonus`] }));
  return {
    id: cfg.equipmentId || card.card_id,
    name: cfg.equipmentName || card.card_id,
    rarity: cfg.rarity || card.rarity || 'common',
    equipmentType: cfg.equipmentType || 'weapon',
    bonus,
    specialEffect: cfg.specialEffect,
    specialEffectDesc: cfg.specialEffectDesc,
    description: cfg.description,
  };
}

/** 将卡牌原始数据转换为TitleAchievementCard组件格式 */
function toTitleCardData(card) {
  const cfg = card.config || {};
  return {
    id: cfg.id || card.card_id,
    name: cfg.name || card.card_id,
    rarity: cfg.rarity || card.rarity || 'common',
    description: cfg.description,
    attributeBonus: cfg.attributeBonus || {},
    specialEffect: cfg.specialEffect,
    specialEffectDesc: cfg.specialEffectDesc,
  };
}

/** 将卡牌原始数据转换为CharacterCard组件格式 */
function toCharacterCardData(card, attributeBonus) {
  const cfg = card.config || {};
  return {
    id: cfg.id || card.card_id,
    name: cfg.name || card.card_id,
    rarity: cfg.rarity || card.rarity || 'common',
    stage: cfg.stage,
    luck: cfg.luck,
    courage: cfg.courage,
    combat: cfg.combat,
    command: cfg.command,
    intelligence: cfg.intelligence,
    politics: cfg.politics,
    charm: cfg.charm,
    troopAffinity: cfg.troopAffinity,
    trait: cfg.trait,
    traitModifier: cfg.traitModifier,
    skills: cfg.skills || [],
    bond: cfg.bond,
    biography: cfg.biography,
    description: cfg.description,
    avatar: cfg.avatar,
    morale: card.morale ?? null,
    attributeBonus: attributeBonus || {},
  };
}



/**
 * 裁剪版部队卡 — 渲染TroopCard上半部分（到技能栏为止）
 * header(40) + icon区(90) + 技能区(~55) ≈ 185px → 接近正方形裁剪
 */
function TroopCardCropped({ card, skillsMap, baseUrl, scale = 1 }) {
  const troopData = toTroopCardData(card);
  const cropH = 185; // header + icon + skills ≈ 正方形
  const w = 256;

  return (
    <div
      style={{
        width: w * scale,
        height: cropH * scale,
      }}
      className="overflow-hidden rounded-lg"
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: w,
          height: cropH,
        }}
        className="overflow-hidden"
      >
        <TroopCard
          troop={troopData}
          skillsMap={skillsMap}
          showDetails={true}
          compactMode={true}
          baseUrl={baseUrl}
        />
      </div>
    </div>
  );
}

/** 装备槽位组件 */
function EquipSlot({ slot, content, isSelected, onClick, baseUrl, skillsMap, mini = false }) {
  const isEmpty = !content;
  const isLocked = !slot.implemented;
  const isTroopSlot = slot.id === 'troop' || slot.id === 'troop1' || slot.id === 'troop2';

  // mini尺寸（横屏compact用）vs 标准尺寸
  const slotW = mini ? 96 : 64;
  const slotH = mini ? 96 : 64;

  // 已装备部队卡 — 纯文字摘要显示
  if (!isLocked && !isEmpty && isTroopSlot) {
    const cfg = content.config || {};
    const name = cfg.name || content.card_id;
    const rarity = cfg.rarity || content.rarity || 'common';
    const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
    const rarityColor = { common: 'text-gray-300', rare: 'text-blue-400', epic: 'text-purple-400', legendary: 'text-orange-400', core: 'text-yellow-400' };
    const maxBattle = content.max_battle_count ?? 10;
    const used = Math.max(0, Math.min(content.battle_count ?? 0, maxBattle));
    const remaining = Math.max(0, maxBattle - used);
    const durability = `${remaining}/${maxBattle}`;
    const troops = `${content.current_troops ?? cfg.maxTroops ?? '?'}`;
    const maxTroops = (cfg.maxTroops || 0) + (content.bonus_max_troops || 0);
    const atk = ((cfg.attack || 0) + (content.bonus_attack || 0) / 10).toFixed(0);
    const def = ((cfg.defense || 0) + (content.bonus_defense || 0) / 10).toFixed(0);
    const spd = (cfg.speed ?? 0) + (content.bonus_speed || 0);
    const mov = (cfg.movement ?? 0) + (content.bonus_movement || 0);
    const range = cfg.range ?? 1;

    // 攻击距离方格
    const rangeBlocks = Array.from({ length: range }, (_, i) => (
      <span key={i} className="inline-block rounded-[1px]"
        style={{ width: mini ? '3px' : '2px', height: mini ? '3px' : '2px', background: '#f87171' }} />
    ));

    const borderClass = isSelected
      ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
      : 'border-stone-500 hover:border-amber-500';

    // 耐久警告：最后1次使用时淡红色背景
    const isLastUse = remaining === 1;
    const bgClass = isLastUse ? 'bg-red-900/30' : 'bg-stone-800/90';

    // 竖屏64px基准字体，横屏96px用1.5倍
    const fs1 = mini ? '9px' : '6px';   // 卡牌名
    const fs2 = mini ? '9px' : '6px';   // 数据行
    const fsR = mini ? '8px' : '5.5px'; // 稀有度

    return (
      <button
        onClick={onClick}
        className={`rounded-lg border-2 ${borderClass} ${bgClass}
                    overflow-hidden transition-all duration-200 relative
                    cursor-pointer active:scale-95 flex flex-col justify-between`}
        style={{ width: `${slotW}px`, height: `${slotH}px`, padding: mini ? '4px' : '2px 3px' }}
      >
        {/* 行1：名字 + 稀有度 */}
        <div className="flex items-center justify-between w-full leading-none">
          <span className="text-white font-medium" style={{ fontSize: fs1 }}>{name}</span>
          <span className={`font-bold ${rarityColor[rarity]}`} style={{ fontSize: fsR }}>{rarityLabel[rarity]}</span>
        </div>
        {/* 行2：耐久 + 兵力 */}
        <div className="flex items-center justify-between w-full">
          <span className={isLastUse ? 'text-red-400' : 'text-stone-400'} style={{ fontSize: fs2 }}>🚩{durability}</span>
          <span className={parseInt(troops) >= maxTroops ? 'text-green-400' : 'text-yellow-400'} style={{ fontSize: fs2 }}>👥{troops}</span>
        </div>
        {/* 行3：攻击距离 */}
        <div className="flex items-center gap-0.5 w-full">
          <span className="text-stone-500" style={{ fontSize: fs2 }}>距</span>
          <div className="flex gap-[1px]">{rangeBlocks}</div>
        </div>
        {/* 行4：攻 防 */}
        <div className="flex items-center justify-between w-full">
          <span className="text-red-400" style={{ fontSize: fs2 }}>攻{atk}</span>
          <span className="text-blue-400" style={{ fontSize: fs2 }}>防{def}</span>
        </div>
        {/* 行5：速 移 */}
        <div className="flex items-center justify-between w-full">
          <span className="text-cyan-400" style={{ fontSize: fs2 }}>速{spd}</span>
          <span className="text-amber-400" style={{ fontSize: fs2 }}>移{mov}</span>
        </div>
      </button>
    );
  }

  // 已装备称号卡 — 纯文字摘要显示（复用部队卡的布局模式）
  const isTitleSlot = slot.id === 'title';
  if (!isLocked && !isEmpty && isTitleSlot) {
    const cfg = content.config || {};
    const name = cfg.name || content.card_id;
    const rarity = cfg.rarity || content.rarity || 'common';
    const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
    const rarityColor = { common: 'text-gray-300', rare: 'text-blue-400', epic: 'text-purple-400', legendary: 'text-orange-400', core: 'text-yellow-400' };

    // 解析属性加成
    const bonus = cfg.attributeBonus || {};
    const bonusLabels = { luck: '运', courage: '勇', combat: '武', command: '统', intelligence: '智', politics: '政', charm: '魅' };
    const bonusEntries = Object.entries(bonus).filter(([, v]) => v > 0);

    const borderClass = isSelected
      ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
      : 'border-stone-500 hover:border-amber-500';

    const fs1 = mini ? '9px' : '6px';
    const fs2 = mini ? '9px' : '6px';
    const fsR = mini ? '8px' : '5.5px';

    return (
      <button
        onClick={onClick}
        className={`rounded-lg border-2 ${borderClass} bg-stone-800/90
                    overflow-hidden transition-all duration-200 relative text-left
                    cursor-pointer active:scale-95 flex flex-col justify-between`}
        style={{ width: `${slotW}px`, height: `${slotH}px`, padding: mini ? '4px' : '2px 3px' }}
      >
        {/* 行1：名字 + 稀有度 */}
        <div className="flex items-center justify-between w-full leading-none">
          <span className="text-white font-medium truncate" style={{ fontSize: fs1 }}>{name}</span>
          <span className={`font-bold flex-shrink-0 ${rarityColor[rarity]}`} style={{ fontSize: fsR }}>{rarityLabel[rarity]}</span>
        </div>
        {/* 行2：特效描述 */}
        {cfg.specialEffectDesc && (
          <div className="w-full">
            <span className="text-green-400 truncate block text-left" style={{ fontSize: fs2 }}>✨{cfg.specialEffectDesc}</span>
          </div>
        )}
        {/* 行3：属性加成 */}
        {bonusEntries.length > 0 ? (
          <div className="flex items-center gap-1 w-full flex-wrap">
            {bonusEntries.slice(0, 3).map(([key, val]) => (
              <span key={key} className="text-amber-400" style={{ fontSize: fs2 }}>
                {bonusLabels[key] || key}+{(val / 10).toFixed(1)}
              </span>
            ))}
          </div>
        ) : (
          <div className="w-full text-left">
            <span className="text-stone-500" style={{ fontSize: fs2 }}>无属性加成</span>
          </div>
        )}
      </button>
    );
  }

  // 已装备官职 — 纯文字摘要显示（复用称号槽的布局模式）
  const isPositionSlot = slot.id === 'position';
  if (!isLocked && !isEmpty && isPositionSlot) {
    const rarity = content.rarity || 'common';
    const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
    const rarityColor = { common: 'text-gray-300', rare: 'text-blue-400', epic: 'text-purple-400', legendary: 'text-orange-400', core: 'text-yellow-400' };
    const bonuses = content.position_bonuses || {};
    const borderClass = isSelected
      ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
      : 'border-stone-500 hover:border-amber-500';
    const fs1 = mini ? '9px' : '6px';
    const fs2 = mini ? '9px' : '6px';
    const fsR = mini ? '8px' : '5.5px';

    return (
      <button
        onClick={onClick}
        className={`rounded-lg border-2 ${borderClass} bg-stone-800/90
                    overflow-hidden transition-all duration-200 relative text-left
                    cursor-pointer active:scale-95 flex flex-col justify-between`}
        style={{ width: `${slotW}px`, height: `${slotH}px`, padding: mini ? '4px' : '2px 3px' }}
      >
        {/* 行1：名字 + 稀有度 */}
        <div className="flex items-center justify-between w-full leading-none">
          <span className="text-white font-medium truncate" style={{ fontSize: fs1 }}>{content.name}</span>
          <span className={`font-bold flex-shrink-0 ${rarityColor[rarity]}`} style={{ fontSize: fsR }}>{rarityLabel[rarity]}</span>
        </div>
        {/* 行2：资源加成 */}
        {(bonuses.contributionBonus > 0 || bonuses.resourceBonus > 0) && (
          <div className="flex items-center gap-1 w-full flex-wrap">
            {bonuses.contributionBonus > 0 && <span className="text-cyan-400" style={{ fontSize: fs2 }}>贡+{(bonuses.contributionBonus*100).toFixed(0)}%</span>}
            {bonuses.resourceBonus > 0 && <span className="text-yellow-400" style={{ fontSize: fs2 }}>资+{(bonuses.resourceBonus*100).toFixed(0)}%</span>}
          </div>
        )}
        {/* 行3：兵种加成 */}
        {(bonuses.infantryBonus > 0 || bonuses.cavalryBonus > 0 || bonuses.archerBonus > 0) && (
          <div className="flex items-center gap-1 w-full flex-wrap">
            {bonuses.infantryBonus > 0 && <span className="text-red-400" style={{ fontSize: fs2 }}>步+{(bonuses.infantryBonus*100).toFixed(0)}%</span>}
            {bonuses.cavalryBonus > 0 && <span className="text-green-400" style={{ fontSize: fs2 }}>骑+{(bonuses.cavalryBonus*100).toFixed(0)}%</span>}
            {bonuses.archerBonus > 0 && <span className="text-blue-400" style={{ fontSize: fs2 }}>弓+{(bonuses.archerBonus*100).toFixed(0)}%</span>}
          </div>
        )}
        {/* 行4：特权 */}
        {content.permissions && content.permissions.length > 0 && (
          <div className="w-full">
            <span className="text-stone-400 truncate block" style={{ fontSize: fs2 }}>特权：{content.permissions.join('、')}</span>
          </div>
        )}
      </button>
    );
  }

  // 已装备装备卡 — 文本缩略（卡名 + 四项属性总和）
  const isEquipmentSetSlot = slot.id === 'equipmentSet';
  if (!isLocked && !isEmpty && isEquipmentSetSlot) {
    const cfg = content.config || {};
    const name = cfg.displayName || content.card_id || '装备卡';
    const rarity = cfg.rarity || content.rarity || 'common';
    const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
    const rarityColor = { common: 'text-gray-300', rare: 'text-blue-400', epic: 'text-purple-400', legendary: 'text-orange-400', core: 'text-yellow-400' };
    const bonus = cfg.attributeBonus || {};
    const ordered = [
      { label: '勇', val: Number(bonus.courage || 0) / 10 },
      { label: '智', val: Number(bonus.intelligence || 0) / 10 },
      { label: '武', val: Number(bonus.combat || 0) / 10 },
      { label: '政', val: Number(bonus.politics || 0) / 10 },
      { label: '统', val: Number(bonus.command || 0) / 10 },
      { label: '魅', val: Number(bonus.charm || 0) / 10 },
    ];

    const borderClass = isSelected
      ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
      : 'border-stone-500 hover:border-amber-500';

    const fs1 = mini ? '9px' : '6px';
    const fs2 = mini ? '9px' : '6px';
    const fsR = mini ? '8px' : '5.5px';

    return (
      <button
        onClick={onClick}
        className={`rounded-lg border-2 ${borderClass} bg-stone-800/90
                    overflow-hidden transition-all duration-200 relative text-left
                    cursor-pointer active:scale-95 flex flex-col justify-between`}
        style={{ width: `${slotW}px`, height: `${slotH}px`, padding: mini ? '4px' : '2px 3px' }}
      >
        <div className="flex items-center justify-between w-full leading-none">
          <span className="text-white font-medium truncate" style={{ fontSize: fs1 }}>{name}</span>
          <span className={`font-bold flex-shrink-0 ${rarityColor[rarity]}`} style={{ fontSize: fsR }}>{rarityLabel[rarity]}</span>
        </div>
        {ordered.length > 0 ? (
          <>
            <div className="flex items-center justify-between w-full">
              <span className="text-red-400" style={{ fontSize: fs2 }}>{ordered[0].label}{ordered[0].val >= 0 ? '+' : ''}{ordered[0].val.toFixed(1)}</span>
              <span className="text-blue-400" style={{ fontSize: fs2 }}>{ordered[1].label}{ordered[1].val >= 0 ? '+' : ''}{ordered[1].val.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between w-full">
              <span className="text-cyan-400" style={{ fontSize: fs2 }}>{ordered[2].label}{ordered[2].val >= 0 ? '+' : ''}{ordered[2].val.toFixed(1)}</span>
              <span className="text-amber-400" style={{ fontSize: fs2 }}>{ordered[3].label}{ordered[3].val >= 0 ? '+' : ''}{ordered[3].val.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between w-full">
              <span className="text-green-400" style={{ fontSize: fs2 }}>{ordered[4].label}{ordered[4].val >= 0 ? '+' : ''}{ordered[4].val.toFixed(1)}</span>
              <span className="text-purple-400" style={{ fontSize: fs2 }}>{ordered[5].label}{ordered[5].val >= 0 ? '+' : ''}{ordered[5].val.toFixed(1)}</span>
            </div>
          </>
        ) : (
          <div className="w-full text-left">
            <span className="text-stone-500" style={{ fontSize: fs2 }}>无属性加成</span>
          </div>
        )}
      </button>
    );
  }

  // 官职内容渲染
  const renderPositionContent = (data) => (
    <>
      <span className="text-lg">👑</span>
      <span className="text-[9px] text-amber-400 mt-0.5 truncate w-full text-center">{data.name}</span>
    </>
  );

  // 渲染槽位内容
  const renderContent = () => {
    if (isLocked) {
      return (
        <>
          <span className="text-lg opacity-30">🔒</span>
          <span className="text-[8px] text-stone-600 mt-0.5">尚未实装</span>
        </>
      );
    }
    if (isEmpty) {
      return (
        <>
          <span className="text-lg opacity-40">{slot.icon}</span>
          <span className="text-[8px] text-stone-500 mt-0.5">空</span>
        </>
      );
    }
    if (slot.id === 'position') {
      return renderPositionContent(content);
    }
    return <span className="text-lg">{slot.icon}</span>;
  };

  const borderClass = isSelected
    ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
    : isLocked
      ? 'border-stone-700'
      : isEmpty
        ? 'border-dashed border-stone-600 hover:border-stone-400'
        : 'border-stone-500 hover:border-amber-500';

  return (
    <button
      onClick={onClick}
      disabled={isLocked}
      className={`rounded-lg border-2 ${borderClass}
                  bg-stone-800/80 flex flex-col items-center justify-center
                  transition-all duration-200 relative
                  ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer active:scale-95'}`}
      style={{ width: `${slotW}px`, height: `${slotH}px` }}
    >
      {renderContent()}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0 
                      bg-stone-900 rounded text-[7px] text-stone-500 whitespace-nowrap">
        {slot.label}
      </div>
    </button>
  );
}

const RARITY_DOTS = [
  { key: 'common',    color: 'bg-gray-400' },
  { key: 'rare',      color: 'bg-blue-400' },
  { key: 'epic',      color: 'bg-purple-400' },
  { key: 'legendary', color: 'bg-orange-400' },
  { key: 'core',      color: 'bg-yellow-400' },
];

const RARITY_TEXT_CLASS = {
  common: 'text-white',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-orange-400',
  core: 'text-yellow-300',
};

/** 军营摘要区域：按类型显示稀有度数量，点击展开完整列表 */
function BackpackSection({
  cards,
  skillsMap,
  isLandscape = false,
  playerId,
  onAfterEncapsulateChange,
  encapsulateEquipmentPool = [],
  equipmentSetCards = [],
}) {
  const [expandedType, setExpandedType] = useState(null);
  const [previewCard, setPreviewCard] = useState(null);
  const [encapsulateOpen, setEncapsulateOpen] = useState(false);
  const [encapsulateMode, setEncapsulateMode] = useState('draft');
  const [encapsulateEditId, setEncapsulateEditId] = useState(null);
  const baseUrl = import.meta.env.BASE_URL;
  const encapsulateEquipmentCards =
    encapsulateEquipmentPool.length > 0
      ? encapsulateEquipmentPool
      : cards.filter((c) => c.card_type === 'equipment');
  const resolveEquipPiece = (instanceId) =>
    encapsulateEquipmentCards.find((c) => c.instance_id === instanceId) || null;

  /** 军营 7 行顺序：将领、部队、装备件+合成、封装+装备卡、称号、成就、宝物 */
  const SINGLE_ROW_TYPES = [
    { type: 'character',   label: '将领',   icon: '👤' },
    { type: 'troop',       label: '部队',   icon: '⚔️' },
    { type: 'title',       label: '称号',   icon: '🎖️' },
    { type: 'achievement', label: '成就',   icon: '🏆' },
    { type: 'treasure',    label: '宝物',   icon: '💎' },
  ];

  const byType = {};
  cards.forEach(card => {
    const t = card.card_type || 'troop';
    if (!byType[t]) byType[t] = [];
    byType[t].push(card);
  });

  const countByRarity = (typeCards) => {
    const counts = {};
    (typeCards || []).forEach(c => {
      const r = c.config?.rarity || c.rarity || 'common';
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  };

  const groupByRarity = (typeCards) => {
    const grouped = {};
    (typeCards || []).forEach(card => {
      const r = card.config?.rarity || card.rarity || 'common';
      if (!grouped[r]) grouped[r] = [];
      grouped[r].push(card);
    });
    return Object.keys(grouped)
      .sort((a, b) => (RARITY_ORDER[a] ?? 99) - (RARITY_ORDER[b] ?? 99))
      .map(r => ({ rarity: r, cards: grouped[r] }));
  };

  const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };

  return (
    <div className="mx-3 mt-4 mb-4">
      <h4 className="text-stone-400 text-xs font-medium mb-2">
        🏕️ 军营（{cards.length}）
      </h4>

      {/* 7 个同级按钮：将领、部队、装备件+合成、封装+装备卡、称号、成就、宝物 */}
      <div className="grid grid-cols-3 gap-2">
        {SINGLE_ROW_TYPES.slice(0, 2).map(({ type, label, icon }) => {
          const typeCards = byType[type] || [];
          const counts = countByRarity(typeCards);
          const total = typeCards.length;
          const isExpanded = expandedType === type;
          const cellBtnClass = (active, hasItems) =>
            `rounded-lg p-2 text-center transition-colors min-h-[4.5rem] flex flex-col items-center justify-center
              ${active ? 'bg-amber-900/30 border border-amber-700/40' :
                hasItems ? 'bg-stone-800/60 border border-stone-700/30 hover:border-stone-500 cursor-pointer'
                : 'bg-stone-800/30 border border-stone-800/20 opacity-50 cursor-default'}`;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setExpandedType(isExpanded ? null : (total > 0 ? type : null))}
              className={cellBtnClass(isExpanded, total > 0)}
            >
              <div className="text-lg">{icon}</div>
              <div className="text-stone-300 text-xs leading-tight">{label}</div>
              {total > 0 ? (
                <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
                  {RARITY_DOTS.map(({ key, color }) => {
                    const count = counts[key];
                    if (!count) return null;
                    return (
                      <div key={key} className="flex items-center gap-0.5">
                        <div className={`w-2 h-2 rounded-full ${color}`} />
                        <span className="text-stone-400 text-[10px]">{count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-amber-400 text-sm font-bold mt-0.5">0</div>
              )}
            </button>
          );
        })}

        {(() => {
          const eqType = 'equipment';
          const typeCards = byType[eqType] || [];
          const counts = countByRarity(typeCards);
          const total = typeCards.length;
          const isExpanded = expandedType === eqType;
          const cellBtnClass = (active, hasItems) =>
            `rounded-lg p-2 text-center transition-colors min-h-[4.5rem] flex flex-col items-center justify-center
              ${active ? 'bg-amber-900/30 border border-amber-700/40' :
                hasItems ? 'bg-stone-800/60 border border-stone-700/30 hover:border-stone-500 cursor-pointer'
                : 'bg-stone-800/30 border border-stone-800/20 opacity-50 cursor-default'}`;
          const cellInner = (
            <>
              <div className="text-lg">🛡️</div>
              <div className="text-stone-300 text-xs leading-tight">装备件</div>
              {total > 0 ? (
                <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
                  {RARITY_DOTS.map(({ key, color }) => {
                    const count = counts[key];
                    if (!count) return null;
                    return (
                      <div key={key} className="flex items-center gap-0.5">
                        <div className={`w-2 h-2 rounded-full ${color}`} />
                        <span className="text-stone-400 text-[10px]">{count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-amber-400 text-sm font-bold mt-0.5">0</div>
              )}
            </>
          );
          return (
            <div className="flex gap-2 min-w-0">
              <button
                type="button"
                className={`min-w-0 flex-[3] ${cellBtnClass(isExpanded, total > 0)}`}
                onClick={() => setExpandedType(isExpanded ? null : (total > 0 ? eqType : null))}
              >
                {cellInner}
              </button>
              <button
                type="button"
                className="min-w-0 flex-[2] rounded-lg p-2 text-center transition-colors min-h-[4.5rem] flex flex-col items-center justify-center
                  bg-stone-800/50 border border-stone-600/40 opacity-80 cursor-not-allowed"
                disabled
                title="敬请期待"
              >
                <div className="text-lg">⚗️</div>
                <div className="text-stone-400 text-xs leading-tight mt-0.5">合成</div>
              </button>
            </div>
          );
        })()}

        <div className="flex gap-2 min-w-0">
          <button
            type="button"
            className="min-w-0 flex-[2] rounded-lg p-2 text-center transition-colors min-h-[4.5rem] flex flex-col items-center justify-center
              bg-stone-800/70 border border-amber-800/40 hover:border-amber-600/60 cursor-pointer active:scale-[0.98]"
            onClick={() => {
              setEncapsulateMode('draft');
              setEncapsulateEditId(null);
              setEncapsulateOpen(true);
            }}
          >
            <div className="text-lg">📦</div>
            <div className="text-amber-200/90 text-xs leading-tight mt-0.5">封装</div>
          </button>
          <button
            type="button"
            className="min-w-0 flex-[3] rounded-lg p-2 text-center transition-colors min-h-[4.5rem] flex flex-col items-center justify-center
              bg-stone-800/70 border border-amber-800/40 hover:border-amber-600/60 cursor-pointer active:scale-[0.98]"
            onClick={() => setExpandedType(expandedType === 'equipmentSet' ? null : (equipmentSetCards.length > 0 ? 'equipmentSet' : null))}
          >
            <div className="text-lg">🎴</div>
            <div className="text-amber-200/90 text-xs leading-tight mt-0.5">装备卡</div>
            {equipmentSetCards.length > 0 ? (
              <div className="text-stone-400 text-[10px] mt-0.5">{equipmentSetCards.length}</div>
            ) : (
              <div className="text-amber-400 text-sm font-bold mt-0.5">0</div>
            )}
          </button>
        </div>

        {SINGLE_ROW_TYPES.slice(2).map(({ type, label, icon }) => {
          const typeCards = byType[type] || [];
          const counts = countByRarity(typeCards);
          const total = typeCards.length;
          const isExpanded = expandedType === type;
          const cellBtnClass = (active, hasItems) =>
            `rounded-lg p-2 text-center transition-colors min-h-[4.5rem] flex flex-col items-center justify-center
              ${active ? 'bg-amber-900/30 border border-amber-700/40' :
                hasItems ? 'bg-stone-800/60 border border-stone-700/30 hover:border-stone-500 cursor-pointer'
                : 'bg-stone-800/30 border border-stone-800/20 opacity-50 cursor-default'}`;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setExpandedType(isExpanded ? null : (total > 0 ? type : null))}
              className={cellBtnClass(isExpanded, total > 0)}
            >
              <div className="text-lg">{icon}</div>
              <div className="text-stone-300 text-xs leading-tight">{label}</div>
              {total > 0 ? (
                <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
                  {RARITY_DOTS.map(({ key, color }) => {
                    const count = counts[key];
                    if (!count) return null;
                    return (
                      <div key={key} className="flex items-center gap-0.5">
                        <div className={`w-2 h-2 rounded-full ${color}`} />
                        <span className="text-stone-400 text-[10px]">{count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-amber-400 text-sm font-bold mt-0.5">0</div>
              )}
            </button>
          );
        })}
      </div>

      {/* 展开的卡牌列表 */}
      {expandedType && (
        ((expandedType === 'equipmentSet' && equipmentSetCards.length > 0) ||
          (expandedType !== 'equipmentSet' && (byType[expandedType]?.length > 0))) && (
        <div className="mt-2 p-2 bg-stone-800/40 rounded-lg border border-stone-700/30">
          {(expandedType === 'character') ? (
            groupByRarity(byType[expandedType]).map(({ rarity, cards: rCards }) => (
              <div key={rarity} className="mb-2 last:mb-0">
                <div className="text-stone-500 text-[10px] mb-1 px-1">{rarityLabel[rarity]}（{rCards.length}）</div>
                <div className="flex flex-wrap gap-1.5">
                  {rCards.map(card => (
                    <div key={card.instance_id} style={{ width: 128, height: 192 }}
                      className="cursor-pointer overflow-hidden" onClick={() => setPreviewCard({ card, type: 'character' })}>
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        <CharacterCard character={toCharacterCardData(card)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (expandedType === 'troop') ? (
            groupByRarity(byType[expandedType]).map(({ rarity, cards: rCards }) => (
              <div key={rarity} className="mb-2 last:mb-0">
                <div className="text-stone-500 text-[10px] mb-1 px-1">{rarityLabel[rarity]}（{rCards.length}）</div>
                <div className="flex flex-wrap gap-1.5">
                  {rCards.map(card => (
                    <div key={card.instance_id} style={{ width: 128, height: 192 }}
                      className="cursor-pointer" onClick={() => setPreviewCard({ card, type: 'troop' })}>
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        <TroopCard troop={toTroopCardData(card)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (expandedType === 'equipment') ? (
            groupByRarity(byType[expandedType]).map(({ rarity, cards: rCards }) => (
              <div key={rarity} className="mb-2 last:mb-0">
                <div className="text-stone-500 text-[10px] mb-1 px-1">{rarityLabel[rarity]}（{rCards.length}）</div>
                <div className="flex flex-wrap gap-1.5">
                  {rCards.map(card => (
                    <div key={card.instance_id} style={{ width: 128, height: 96 }}
                      className="cursor-pointer" onClick={() => setPreviewCard({ card, type: 'equipment' })}>
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        <EquipmentCard equipment={toEquipmentCardData(card)} baseUrl={baseUrl} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (expandedType === 'equipmentSet') ? (
            <div className="flex flex-wrap gap-1.5">
              {equipmentSetCards.map((card) => (
                (() => {
                  const cfg = card.config || {};
                  const slots = [
                    { key: 'weaponInstanceId', tag: '攻', icon: '⚔️', pos: 'left-1/2 top-[14px] -translate-x-1/2' },
                    { key: 'accessory1InstanceId', tag: '速', icon: '✨', pos: 'left-[8px] top-1/2 -translate-y-1/2' },
                    { key: 'accessory2InstanceId', tag: '介', icon: '✨', pos: 'right-[8px] top-1/2 -translate-y-1/2' },
                    { key: 'armorInstanceId', tag: '守', icon: '🛡️', pos: 'left-1/2 bottom-[14px] -translate-x-1/2' },
                  ];
                  return (
                    <button
                      key={card.instance_id}
                      type="button"
                      className="relative cursor-pointer overflow-hidden"
                      style={{ width: 128, height: 192 }}
                      onClick={() => {
                        setEncapsulateMode('edit');
                        setEncapsulateEditId(card.instance_id);
                        setEncapsulateOpen(true);
                      }}
                    >
                      <div
                        className="relative rounded-xl border-[3px] border-stone-500/70
                          bg-gradient-to-b from-stone-700/90 via-stone-800/90 to-stone-950/95
                          shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.35)]"
                        style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256, height: 384 }}
                      >
                        <div className="pointer-events-none absolute inset-1 rounded-lg border border-stone-500/35" aria-hidden />
                        <div
                          className={`absolute left-[8px] top-[12px] text-[14px] leading-tight tracking-[1px] font-bold ${RARITY_TEXT_CLASS[card.config?.rarity || card.rarity || 'common'] || 'text-white'}`}
                          style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}
                        >
                          {card.config?.displayName || '装备卡'}
                        </div>

                        {slots.map((s) => {
                          const piece = resolveEquipPiece(cfg[s.key]);
                          const pCfg = piece?.config || {};
                          const pName = pCfg.equipmentName || '空';
                          const pRarity = pCfg.rarity || piece?.rarity || 'common';
                          const rarityLabelMap = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
                          const rarityColorMap = {
                            common: 'text-gray-300',
                            rare: 'text-blue-400',
                            epic: 'text-purple-400',
                            legendary: 'text-orange-400',
                            core: 'text-yellow-300',
                          };
                          return (
                            <div key={s.key} className={`absolute ${s.pos}`}>
                              <div
                                className={`rounded-lg border-2 ${piece ? 'border-stone-500 bg-stone-700/90' : 'border-dashed border-stone-600 bg-stone-800'} w-[96px] h-[96px] flex flex-col items-center justify-center`}
                              >
                                {piece ? (
                                  <div className="w-full h-full p-1 flex flex-col items-center justify-between text-center">
                                    <span className="text-[12px] text-stone-100 truncate w-full leading-tight">{pName}</span>
                                    <span className="text-xl opacity-45 leading-none">{s.icon}</span>
                                    <span className={`text-[12px] font-bold leading-tight ${rarityColorMap[pRarity] || 'text-gray-300'}`}>
                                      {rarityLabelMap[pRarity] || '普通'}
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-[10px] text-amber-500/90 font-bold leading-none">{s.tag}</span>
                                    <span className="text-2xl opacity-40 leading-none mt-1">{s.icon}</span>
                                    <span className="text-[10px] text-stone-500 mt-0.5">空</span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })()
              ))}
            </div>
          ) : (expandedType === 'title') ? (
            groupByRarity(byType[expandedType]).map(({ rarity, cards: rCards }) => (
              <div key={rarity} className="mb-2 last:mb-0">
                <div className="text-stone-500 text-[10px] mb-1 px-1">{rarityLabel[rarity]}（{rCards.length}）</div>
                <div className="flex flex-wrap gap-1.5">
                  {rCards.map(card => (
                    <div key={card.instance_id} style={{ width: 128, height: 96 }}
                      className="cursor-pointer" onClick={() => setPreviewCard({ card, type: 'title' })}>
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        <TitleAchievementCard item={toTitleCardData(card)} type="title" baseUrl={baseUrl} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-stone-500 text-xs text-center py-3">尚未实装</div>
          )}
        </div>
      ))}

      {/* 卡牌预览浮层 */}
      {previewCard && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
          onClick={() => setPreviewCard(null)}>
          <div onClick={e => e.stopPropagation()}>
            {previewCard.type === 'character' && (
              <CharacterCard character={toCharacterCardData(previewCard.card)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
            )}
            {previewCard.type === 'troop' && (
              <TroopCard troop={toTroopCardData(previewCard.card)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
            )}
            {previewCard.type === 'equipment' && (
              <EquipmentCard equipment={toEquipmentCardData(previewCard.card)} baseUrl={baseUrl} />
            )}
            {previewCard.type === 'title' && (
              <TitleAchievementCard item={toTitleCardData(previewCard.card)} type="title" baseUrl={baseUrl} />
            )}
          </div>
        </div>
      )}

      <EncapsulateEquipmentModal
        open={encapsulateOpen}
        onClose={() => {
          setEncapsulateOpen(false);
          setEncapsulateMode('draft');
          setEncapsulateEditId(null);
        }}
        mode={encapsulateMode}
        editInstanceId={encapsulateEditId}
        playerId={playerId}
        onAfterChange={onAfterEncapsulateChange}
        equipmentCards={encapsulateEquipmentCards}
        isLandscape={isLandscape}
      />
    </div>
  );
}

/** 底部抽屉：可装备卡牌选择（完整卡牌50%缩放，按稀有度分组） */
function CardDrawer({ slot, cards, allCards = [], skillsMap, onSelect, onClose }) {
  const baseUrl = import.meta.env.BASE_URL;
  const equipmentCards = useMemo(
    () => allCards.filter((c) => c.card_type === 'equipment'),
    [allCards]
  );
  const resolveEquipPiece = (instanceId) =>
    equipmentCards.find((c) => c.instance_id === instanceId) || null;

  // 按稀有度分组并排序
  const grouped = {};
  cards.forEach(card => {
    const rarity = card.config?.rarity || card.rarity || 'common';
    if (!grouped[rarity]) grouped[rarity] = [];
    grouped[rarity].push(card);
  });
  const sortedRarities = Object.keys(grouped).sort(
    (a, b) => (RARITY_ORDER[a] ?? 99) - (RARITY_ORDER[b] ?? 99)
  );

  const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 bg-black/50 z-[110]" onClick={onClose} />

      {/* 全屏抽屉（从子Tab下方开始） */}
      <div className="fixed left-0 right-0 bottom-0 z-[111] bg-stone-900 border-t-2 border-amber-700/50
                      rounded-t-2xl flex flex-col" style={{ top: '56px' }}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 flex-shrink-0">
          <h3 className="text-amber-400 text-sm font-bold">
            {slot.icon} 选择{slot.label}
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-white text-lg">✕</button>
        </div>

        {/* 卡牌列表 — 按稀有度分组，完整卡牌50%缩放 */}
        <div className="flex-1 overflow-y-auto p-3">
          {cards.length === 0 ? (
            <div className="text-center py-8 text-stone-500 text-sm">
              暂无可装备的{slot.label}
            </div>
          ) : (
            sortedRarities.map(rarity => (
              <div key={rarity} className="mb-3">
                <div className="text-stone-500 text-xs mb-1.5 px-1">
                  {rarityLabel[rarity] || rarity}（{grouped[rarity].length}）
                </div>
                <div className="flex flex-wrap gap-2">
                  {grouped[rarity].map(card => {
                    const isTitleSlot = slot.id === 'title';
                    const isCharacterSlot = slot.id === 'character';
                    const isEquipmentSlot = slot.id === 'equipmentSet';
                    return (
                      <div
                        key={card.instance_id}
                        onClick={() => onSelect(card)}
                        className="cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                        style={{
                          width: 128,
                          // 将领卡含详情时实际高度远大于 96px（0.5 缩放后约 180–220px），过小会导致 flex 换行重叠
                          ...(isCharacterSlot
                            ? { minHeight: 208 }
                            : { height: isEquipmentSlot ? 192 : isTitleSlot ? 96 : 192 }),
                        }}
                      >
                        <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                          {isTitleSlot ? (
                            <TitleAchievementCard
                              item={toTitleCardData(card)}
                              type="title"
                              baseUrl={baseUrl}
                            />
                          ) : isCharacterSlot ? (
                            <CharacterCard
                              character={toCharacterCardData(card)}
                              skillsMap={skillsMap}
                              showDetails={true}
                              baseUrl={baseUrl}
                            />
                          ) : isEquipmentSlot ? (
                            <div
                              className="relative rounded-xl border-[3px] border-stone-500/70
                                bg-gradient-to-b from-stone-700/90 via-stone-800/90 to-stone-950/95
                                shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.35)]"
                              style={{ width: 256, height: 384 }}
                            >
                              <div className="pointer-events-none absolute inset-1 rounded-lg border border-stone-500/35" aria-hidden />
                              <div
                                className={`absolute left-[8px] top-[12px] text-[14px] leading-tight tracking-[1px] font-bold ${RARITY_TEXT_CLASS[card.config?.rarity || card.rarity || 'common'] || 'text-white'}`}
                                style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}
                              >
                                {card.config?.displayName || '装备卡'}
                              </div>
                              {[
                                { key: 'weaponInstanceId', tag: '攻', icon: '⚔️', pos: 'left-1/2 top-[14px] -translate-x-1/2' },
                                { key: 'accessory1InstanceId', tag: '速', icon: '✨', pos: 'left-[8px] top-1/2 -translate-y-1/2' },
                                { key: 'accessory2InstanceId', tag: '介', icon: '✨', pos: 'right-[8px] top-1/2 -translate-y-1/2' },
                                { key: 'armorInstanceId', tag: '守', icon: '🛡️', pos: 'left-1/2 bottom-[14px] -translate-x-1/2' },
                              ].map((s) => {
                                const piece = resolveEquipPiece(card.config?.[s.key]);
                                const pCfg = piece?.config || {};
                                const pName = pCfg.equipmentName || '空';
                                const pRarity = pCfg.rarity || piece?.rarity || 'common';
                                const rarityLabelMap = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
                                const rarityColorMap = {
                                  common: 'text-gray-300',
                                  rare: 'text-blue-400',
                                  epic: 'text-purple-400',
                                  legendary: 'text-orange-400',
                                  core: 'text-yellow-300',
                                };
                                return (
                                  <div key={s.key} className={`absolute ${s.pos}`}>
                                    <div className={`rounded-lg border-2 ${piece ? 'border-stone-500 bg-stone-700/90' : 'border-dashed border-stone-600 bg-stone-800'} w-[96px] h-[96px] flex flex-col items-center justify-center`}>
                                      {piece ? (
                                        <div className="w-full h-full p-1 flex flex-col items-center justify-between text-center">
                                          <span className="text-[12px] text-stone-100 truncate w-full leading-tight">{pName}</span>
                                          <span className="text-xl opacity-45 leading-none">{s.icon}</span>
                                          <span className={`text-[12px] font-bold leading-tight ${rarityColorMap[pRarity] || 'text-gray-300'}`}>
                                            {rarityLabelMap[pRarity] || '普通'}
                                          </span>
                                        </div>
                                      ) : (
                                        <>
                                          <span className="text-[10px] text-amber-500/90 font-bold leading-none">{s.tag}</span>
                                          <span className="text-2xl opacity-40 leading-none mt-1">{s.icon}</span>
                                          <span className="text-[10px] text-stone-500 mt-0.5">空</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <TroopCard
                              troop={toTroopCardData(card)}
                              skillsMap={skillsMap}
                              showDetails={true}
                              baseUrl={baseUrl}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

/** 卡牌详情浮层：显示完整卡牌 + 卸下/更换按钮；将领卡传入 getCharacterLifeStage 后可点击翻面查看生涯（与 Wiki 一致） */
function CardDetailOverlay({ card, slot, skillsMap, allCards = [], getCharacterLifeStage, onClose, onReplace, onUnequip }) {
  const baseUrl = import.meta.env.BASE_URL;
  const isTroopSlot = slot.id === 'troop' || slot.id === 'troop1' || slot.id === 'troop2';
  const isTitleSlot = slot.id === 'title';
  const isEquipmentSetSlot = slot.id === 'equipmentSet' && card?.card_type === 'equipmentSet';
  const isPositionSlot = slot.id === 'position';
  const isCharacterSlot = slot.id === 'character';
  const equipmentCards = useMemo(
    () => allCards.filter((c) => c.card_type === 'equipment'),
    [allCards]
  );
  const resolveEquipPiece = (instanceId) =>
    equipmentCards.find((c) => c.instance_id === instanceId) || null;

  const characterCardPayload = isCharacterSlot ? toCharacterCardData(card) : null;
  const lifeStageForChar =
    characterCardPayload && typeof getCharacterLifeStage === 'function'
      ? getCharacterLifeStage(characterCardPayload.id)
      : null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div className="bg-stone-900 rounded-xl p-4 border border-amber-500/30 max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}>
        {/* 标题栏 */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-amber-400 text-sm font-bold">
            {isCharacterSlot ? '将领详情' : isPositionSlot ? '官职详情' : '卡牌详情'}
          </span>
          <button onClick={onClose} className="text-stone-400 hover:text-white">✕</button>
        </div>

        {/* 卡牌展示 */}
        <div className="flex flex-col items-center mb-3 gap-1">
          {lifeStageForChar ? (
            <p className="text-stone-500 text-[11px] text-center">点击卡牌可翻面查看生涯</p>
          ) : null}
          <div style={{ transform: 'scale(0.7)', transformOrigin: 'top center' }}>
            {isCharacterSlot ? (
              <CharacterCard
                character={characterCardPayload}
                skillsMap={skillsMap}
                showDetails={true}
                baseUrl={baseUrl}
                lifeStageData={lifeStageForChar}
              />
            ) : isTroopSlot ? (
              <TroopCard troop={toTroopCardData(card)} skillsMap={skillsMap}
                showDetails={true} baseUrl={baseUrl} />
            ) : isTitleSlot ? (
              <TitleAchievementCard item={toTitleCardData(card)} type="title" baseUrl={baseUrl} />
            ) : isEquipmentSetSlot ? (
              <div
                className="relative rounded-xl border-[3px] border-stone-500/70
                  bg-gradient-to-b from-stone-700/90 via-stone-800/90 to-stone-950/95
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.35)]"
                style={{ width: 256, height: 384 }}
              >
                <div className="pointer-events-none absolute inset-1 rounded-lg border border-stone-500/35" aria-hidden />
                <div
                  className={`absolute left-[8px] top-[12px] text-[14px] leading-tight tracking-[1px] font-bold ${RARITY_TEXT_CLASS[card.config?.rarity || card.rarity || 'common'] || 'text-white'}`}
                  style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}
                >
                  {card.config?.displayName || '装备卡'}
                </div>
                {[
                  { key: 'weaponInstanceId', tag: '攻', icon: '⚔️', pos: 'left-1/2 top-[14px] -translate-x-1/2' },
                  { key: 'accessory1InstanceId', tag: '速', icon: '✨', pos: 'left-[8px] top-1/2 -translate-y-1/2' },
                  { key: 'accessory2InstanceId', tag: '介', icon: '✨', pos: 'right-[8px] top-1/2 -translate-y-1/2' },
                  { key: 'armorInstanceId', tag: '守', icon: '🛡️', pos: 'left-1/2 bottom-[14px] -translate-x-1/2' },
                ].map((s) => {
                  const piece = resolveEquipPiece(card.config?.[s.key]);
                  const pCfg = piece?.config || {};
                  const pName = pCfg.equipmentName || '空';
                  const pRarity = pCfg.rarity || piece?.rarity || 'common';
                  const rarityLabelMap = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
                  const rarityColorMap = {
                    common: 'text-gray-300',
                    rare: 'text-blue-400',
                    epic: 'text-purple-400',
                    legendary: 'text-orange-400',
                    core: 'text-yellow-300',
                  };
                  return (
                    <div key={s.key} className={`absolute ${s.pos}`}>
                      <div className={`rounded-lg border-2 ${piece ? 'border-stone-500 bg-stone-700/90' : 'border-dashed border-stone-600 bg-stone-800'} w-[96px] h-[96px] flex flex-col items-center justify-center`}>
                        {piece ? (
                          <div className="w-full h-full p-1 flex flex-col items-center justify-between text-center">
                            <span className="text-[12px] text-stone-100 truncate w-full leading-tight">{pName}</span>
                            <span className="text-xl opacity-45 leading-none">{s.icon}</span>
                            <span className={`text-[12px] font-bold leading-tight ${rarityColorMap[pRarity] || 'text-gray-300'}`}>
                              {rarityLabelMap[pRarity] || '普通'}
                            </span>
                          </div>
                        ) : (
                          <>
                            <span className="text-[10px] text-amber-500/90 font-bold leading-none">{s.tag}</span>
                            <span className="text-2xl opacity-40 leading-none mt-1">{s.icon}</span>
                            <span className="text-[10px] text-stone-500 mt-0.5">空</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : isPositionSlot ? (
              <PositionCard position={card} showDetails={true} />
            ) : (
              <div className="w-[256px] h-[200px] rounded-xl bg-stone-800 border-2 border-stone-600
                flex items-center justify-center text-stone-400">{slot.label}</div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        {!isPositionSlot && (
          <div className="flex gap-2">
            <button onClick={onUnequip}
              className="flex-1 py-2 rounded-lg bg-red-900/50 border border-red-700/50 text-red-300 text-sm
                hover:bg-red-800/50 transition-colors">
              卸下
            </button>
            <button onClick={onReplace}
              className="flex-1 py-2 rounded-lg bg-amber-900/50 border border-amber-700/50 text-amber-300 text-sm
                hover:bg-amber-800/50 transition-colors">
              更换
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
