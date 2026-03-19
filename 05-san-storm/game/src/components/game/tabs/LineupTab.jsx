/**
 * 编组Tab（Lineup）- 暗黑破坏神风格装备界面
 * 
 * @description 将领配置页面：玩家角色 / 将领1 / 将领2 三个子Tab
 *              中央角色卡 + 左右各3个装备槽位
 *              玩家: 部队卡/官职卡/装备卡(左) + 称号卡/成就卡/宝物卡(右)
 *              将领: 部队卡1/部队卡2/装备卡(左) + 称号卡/成就卡/宝物卡(右)
 * @see 22-2-TROOP_LINEUP_SYSTEM.md
 * @see 24-EQUIPMENT_SYSTEM.md
 */

import { useState, useEffect, useCallback } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { loadSharedData } from '@/services/dataService';
import { playerAPI } from '@/services/playerApi';
import CharacterCard from '@shared/components/card/CharacterCard';
import TroopCard from '@shared/components/card/TroopCard';

const SUB_TABS = [
  { id: 'player', label: null }, // 动态生成：[玩家名]
  { id: 'char1',  label: '将领1' },
  { id: 'char2',  label: '将领2' },
];

/** 槽位定义 */
const PLAYER_SLOTS = [
  // 左侧
  { id: 'troop',     label: '部队',   icon: '⚔️', side: 'left',  implemented: true },
  { id: 'position',  label: '官职',   icon: '👑', side: 'left',  implemented: true },
  { id: 'equipment', label: '装备卡', icon: '🛡️', side: 'left',  implemented: false },
  // 右侧
  { id: 'title',       label: '称号', icon: '🎖️', side: 'right', implemented: false },
  { id: 'achievement', label: '成就', icon: '🏆', side: 'right', implemented: false },
  { id: 'treasure',    label: '宝物', icon: '💎', side: 'right', implemented: false },
];

const GENERAL_SLOTS = [
  // 左侧 — 将领用第二个部队卡替代官职卡
  { id: 'troop1',    label: '部队1',  icon: '⚔️', side: 'left',  implemented: true },
  { id: 'troop2',    label: '部队2',  icon: '⚔️', side: 'left',  implemented: true },
  { id: 'equipment', label: '装备卡', icon: '🛡️', side: 'left',  implemented: false },
  // 右侧
  { id: 'title',       label: '称号', icon: '🎖️', side: 'right', implemented: false },
  { id: 'achievement', label: '成就', icon: '🏆', side: 'right', implemented: false },
  { id: 'treasure',    label: '宝物', icon: '💎', side: 'right', implemented: false },
];

export default function LineupTab({ onClose }) {
  const { player, cards, loading, error, refresh } = usePlayerContext();
  const [activeSubTab, setActiveSubTab] = useState('player');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailCard, setDetailCard] = useState(null); // 详情浮层：{ card, slot }
  const [skillsMap, setSkillsMap] = useState({});

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

  // 关闭抽屉/详情
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedSlot(null);
    setDetailCard(null);
  }, []);

  // 点击槽位：空槽→选择抽屉，已装备→详情浮层
  const handleSlotClick = useCallback((slot, content) => {
    if (!slot.implemented) return;
    if (slot.id === 'position') return;
    if (content) {
      // 已装备 → 打开详情浮层
      setDetailCard({ card: content, slot });
    } else {
      // 空槽 → 打开选择抽屉
      setSelectedSlot(slot);
      setDrawerOpen(true);
    }
  }, []);

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
  const playerTroops = troopCards.filter(c => c.equipped_by === 'player' && c.is_equipped);
  const char1Troops = troopCards.filter(c => c.equipped_by === 'character1' && c.is_equipped);
  const char2Troops = troopCards.filter(c => c.equipped_by === 'character2' && c.is_equipped);
  const unequippedTroops = troopCards.filter(c => !c.is_equipped);
  const allUnequipped = cards.filter(c => !c.is_equipped);

  // 获取当前子Tab的槽位配置和数据
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
        case 'position':
          return player?.current_position_name
            ? { name: player.current_position_name, level: player.position_level }
            : null;
        default:
          return null;
      }
    }
    // 将领
    const troops = subTab === 'char1' ? char1Troops : char2Troops;
    switch (slot.id) {
      case 'troop1': return troops[0] || null;
      case 'troop2': return troops[1] || null;
      default: return null;
    }
  };

  // 获取可装备的卡牌列表（用于抽屉）
  const getAvailableCards = () => {
    if (!selectedSlot) return [];
    if (selectedSlot.id === 'troop' || selectedSlot.id === 'troop1' || selectedSlot.id === 'troop2') {
      return unequippedTroops;
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
          /* 左上=玩家(卡牌|槽位+数据) | 右上=将领1 | 左下=背包 | 右下=将领2 */
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
                  statsPanel={<LineupStatsPanel player={player} troops={playerTroops} compact />}
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
                  />
                ) : (
                  <GeneralNotRecruited label="将领1" />
                )}
              </div>

              {/* 左下：背包 */}
              <div className="border-r border-stone-700/40 overflow-y-auto">
                <BackpackSection cards={allUnequipped} skillsMap={skillsMap} />
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
                  />
                ) : (
                  <GeneralNotRecruited label="将领2" />
                )}
              </div>
            </div>
          </>
        ) : (
          /* ===== 竖屏：原有单Tab布局 ===== */
          <>
            {activeSubTab !== 'player' && !isGeneralRecruited(activeSubTab) ? (
              <GeneralNotRecruited label={activeSubTab === 'char1' ? '将领1' : '将领2'} />
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
              />
            )}

            {/* 数据分析区域 */}
            {activeSubTab === 'player' && (
              <LineupStatsPanel player={player} troops={playerTroops} />
            )}

            {/* 背包区域 */}
            <BackpackSection cards={allUnequipped} skillsMap={skillsMap} />
          </>
        )}
      </div>

      {/* 详情浮层：已装备卡牌的完整展示 */}
      {detailCard && (
        <CardDetailOverlay
          card={detailCard.card}
          slot={detailCard.slot}
          skillsMap={skillsMap}
          onClose={() => setDetailCard(null)}
          onReplace={() => {
            // 关闭详情 → 打开选择抽屉
            const slot = detailCard.slot;
            setDetailCard(null);
            setSelectedSlot(slot);
            setDrawerOpen(true);
          }}
          onUnequip={async () => {
            try {
              const result = await playerAPI.unequipCard(
                player.player_id, detailCard.card.instance_id
              );
              if (result.success) {
                refresh();
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
          skillsMap={skillsMap}
          onSelect={async (card) => {
            const equippedBy = activeSubTab === 'player' ? 'player'
              : activeSubTab === 'char1' ? 'character1' : 'character2';
            try {
              const result = await playerAPI.equipCard(
                player.player_id, card.instance_id, equippedBy, selectedSlot.id
              );
              if (result.success) {
                refresh(); // 刷新玩家数据
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

/** 将领是否已招募（当前阶段都未招募） */
function isGeneralRecruited(/* subTab */) {
  return false;
}

/** 将领未招募占位 */
function GeneralNotRecruited({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-20 h-20 rounded-full border-2 border-dashed border-stone-600 
                      flex items-center justify-center mb-4">
        <span className="text-3xl opacity-40">🎴</span>
      </div>
      <p className="text-stone-500 text-sm">{label} — 尚未招募</p>
      <p className="text-stone-600 text-xs mt-1">将领招募功能尚未实装</p>
    </div>
  );
}

/** 横屏象限布局：左=角色卡 | 右=2×3槽位网格 */
function LandscapeQuadrant({ player, activeSubTab, slots, getSlotContent, onSlotClick, selectedSlot, skillsMap, statsPanel }) {
  const baseUrl = import.meta.env.BASE_URL;
  const cardScale = 0.82;
  const cardHeight = Math.round(384 * cardScale); // ~315px

  const playerCharData = player ? {
    id: player.player_id,
    name: player.character_name,
    avatar: player.avatar,
    rarity: 'common',
    luck: player.luck / 10,
    courage: player.courage / 10,
    combat: player.combat / 10,
    command: player.command / 10,
    intelligence: player.intelligence / 10,
    politics: player.politics / 10,
    charm: player.charm / 10,
    skills: [player.skill_1, player.skill_2].filter(Boolean)
  } : null;

  return (
    <div className="flex items-stretch h-full">
      {/* 左侧：角色卡（占满象限高度） */}
      <div className="flex-shrink-0 overflow-hidden">
        {activeSubTab === 'player' && playerCharData ? (
          <div style={{ transform: `scale(${cardScale})`, transformOrigin: 'top left', height: `${cardHeight}px` }}>
            <CharacterCard
              character={playerCharData}
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
                isSelected={selectedSlot?.id === slot.id}
                onClick={() => onSlotClick(slot, content)}
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
function EquipmentLayout({ player, activeSubTab, leftSlots, rightSlots, getSlotContent, onSlotClick, selectedSlot, skillsMap, compact = false }) {
  const baseUrl = import.meta.env.BASE_URL;
  const cardScale = compact ? 0.52 : 0.72;
  const cardHeight = Math.round(384 * cardScale);
  const slotHeight = compact ? `${cardHeight}px` : '276px';

  // 构建CharacterCard所需的数据
  const playerCharData = player ? {
    id: player.player_id,
    name: player.character_name,
    avatar: player.avatar,
    rarity: 'common',
    luck: player.luck / 10,
    courage: player.courage / 10,
    combat: player.combat / 10,
    command: player.command / 10,
    intelligence: player.intelligence / 10,
    politics: player.politics / 10,
    charm: player.charm / 10,
    skills: [player.skill_1, player.skill_2].filter(Boolean)
  } : null;

  return (
    <div className={compact ? 'px-1 py-2' : 'px-1 py-4'}>
      {compact ? (
        /* ===== 横屏 compact：仅角色卡（槽位在外部右侧渲染） ===== */
        <div className="flex items-start justify-center">
          <div className="flex-shrink-0" style={{ height: `${cardHeight}px`, overflow: 'hidden' }}>
            {activeSubTab === 'player' && playerCharData ? (
              <div style={{ transform: `scale(${cardScale})`, transformOrigin: 'top left' }}>
                <CharacterCard
                  character={playerCharData}
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
                  onClick={() => onSlotClick(slot, content)}
                  baseUrl={baseUrl}
                  skillsMap={skillsMap}
                />
              );
            })}
          </div>

          {/* 中央角色卡 */}
          <div className="flex-shrink-0" style={{ height: '276px', overflow: 'hidden' }}>
            {activeSubTab === 'player' && playerCharData ? (
              <div className="transform scale-[0.72] origin-top">
                <CharacterCard
                  character={playerCharData}
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
                  onClick={() => onSlotClick(slot, content)}
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
function LineupStatsPanel({ player, troops, compact = false }) {
  if (!player) return null;

  const combat = player.combat / 10;    // 武力
  const command = player.command / 10;   // 统帅
  const courage = player.courage / 10;   // 勇气
  const luck = player.luck / 10;         // 运气

  // 计算每支部队的战力
  let totalPower = 0;
  let totalDeployCost = 0;
  let totalRecoverCost = 0;

  const troopStats = troops.map(card => {
    const cfg = card.config || {};
    const atk = (cfg.attack || 0) / 10;
    const def = (cfg.defense || 0) / 10;
    const maxTroops = cfg.max_troops || 0;
    const currentTroops = card.current_troops ?? maxTroops;
    const lostTroops = maxTroops - currentTroops;

    // 攻击力 = 部队攻击 + 武力×6，勇气加成
    const unitAtk = (atk + combat * 6) * (1 + courage / 40);
    // 防御力 = 部队防御 + 统帅×5 + 武力×3
    const unitDef = def + command * 5 + combat * 3;
    // 综合战力
    const power = Math.round((unitAtk + unitDef) * currentTroops / 1000);

    // 粮草
    const deployCost = Math.ceil(currentTroops / 20);
    const recoverCost = lostTroops > 0 ? Math.ceil(lostTroops / 10) : 0;

    totalPower += power;
    totalDeployCost += deployCost;
    totalRecoverCost += recoverCost;

    return { name: cfg.troop_name || card.card_id, power, deployCost, recoverCost, currentTroops, maxTroops };
  });

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

        {/* 恢复粮草 */}
        <div className="flex items-center justify-between">
          <span className="text-stone-500">💊 恢复消耗</span>
          <span className={totalRecoverCost > 0 ? 'text-yellow-400' : 'text-stone-600'}>
            {totalRecoverCost > 0 ? `${totalRecoverCost} 粮` : '满编'}
          </span>
        </div>

        {/* TODO: 将领排名 — 需要后端API查询所有玩家编组数据，计算当前将领在所有用户中的排名 */}
        <div className="flex items-center justify-between">
          <span className="text-stone-500">🏅 将领排名</span>
          <span className="text-stone-600 text-[10px]">尚未实装</span>
        </div>
      </div>
    </div>
  );
}

/** 将卡牌原始数据转换为TroopCard组件格式 */
function toTroopCardData(card) {
  const cfg = card.config || {};
  return {
    id: cfg.troop_id || card.card_id,
    name: cfg.troop_name || card.card_id,
    rarity: cfg.rarity || card.rarity,
    troopType: cfg.troop_type,
    weaponType: cfg.weapon_type,
    faction: cfg.faction,
    attack: (cfg.attack || 0) / 10,
    defense: (cfg.defense || 0) / 10,
    speed: cfg.speed,
    movement: cfg.movement,
    range: cfg.range,
    maxTroops: cfg.max_troops,
    currentTroops: card.current_troops,
    skills: cfg.skills || [],
    description: cfg.description,
    battleCount: card.battle_count ?? 0,
    maxBattleCount: card.max_battle_count ?? 10,
    infantryCounter: cfg.infantry_counter,
    cavalryCounter: cfg.cavalry_counter,
    archerCounter: cfg.archer_counter,
    siegeCounter: cfg.siege_counter,
    plainAdapt: cfg.plain_adapt,
    hillAdapt: cfg.hill_adapt,
    forestAdapt: cfg.forest_adapt,
    siegeAdapt: cfg.siege_adapt,
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
    const name = cfg.troop_name || content.card_id;
    const rarity = cfg.rarity || content.rarity || 'common';
    const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
    const rarityColor = { common: 'text-gray-300', rare: 'text-blue-400', epic: 'text-purple-400', legendary: 'text-orange-400', core: 'text-yellow-400' };
    const maxBattle = content.max_battle_count ?? 10;
    const remaining = maxBattle - (content.battle_count ?? 0);
    const durability = `${remaining}/${maxBattle}`;
    const troops = `${content.current_troops ?? cfg.max_troops ?? '?'}`;
    const atk = ((cfg.attack || 0) / 10).toFixed(0);
    const def = ((cfg.defense || 0) / 10).toFixed(0);
    const spd = cfg.speed ?? '?';
    const mov = cfg.movement ?? '?';
    const range = cfg.range ?? 1;

    // 攻击距离方格
    const rangeBlocks = Array.from({ length: range }, (_, i) => (
      <span key={i} className="inline-block rounded-[1px]"
        style={{ width: mini ? '3px' : '2px', height: mini ? '3px' : '2px', background: '#f87171' }} />
    ));

    const borderClass = isSelected
      ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
      : 'border-stone-500 hover:border-amber-500';

    // 竖屏64px基准字体，横屏96px用1.5倍
    const fs1 = mini ? '9px' : '6px';   // 卡牌名
    const fs2 = mini ? '9px' : '6px';   // 数据行
    const fsR = mini ? '8px' : '5.5px'; // 稀有度

    return (
      <button
        onClick={onClick}
        className={`rounded-lg border-2 ${borderClass} bg-stone-800/90
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
          <span className="text-stone-400" style={{ fontSize: fs2 }}>🚩{durability}</span>
          <span className="text-green-400" style={{ fontSize: fs2 }}>👥{troops}</span>
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

/** 背包卡牌类型定义（显示顺序） */
const BACKPACK_TYPES = [
  { type: 'troop',       label: '部队',   icon: '⚔️' },
  { type: 'title',       label: '称号',   icon: '🎖️' },
  { type: 'achievement', label: '成就',   icon: '🏆' },
  { type: 'treasure',    label: '宝物',   icon: '�' },
  { type: 'equipment',   label: '装备卡', icon: '🛡️' },
];

const RARITY_DOTS = [
  { key: 'common',    color: 'bg-gray-400' },
  { key: 'rare',      color: 'bg-blue-400' },
  { key: 'epic',      color: 'bg-purple-400' },
  { key: 'legendary', color: 'bg-orange-400' },
  { key: 'core',      color: 'bg-yellow-400' },
];

/** 背包摘要区域：按类型显示稀有度数量，点击展开完整列表 */
function BackpackSection({ cards, skillsMap }) {
  const [expandedType, setExpandedType] = useState(null);
  const baseUrl = import.meta.env.BASE_URL;

  // 按类型分组
  const byType = {};
  cards.forEach(card => {
    const t = card.card_type || 'troop';
    if (!byType[t]) byType[t] = [];
    byType[t].push(card);
  });

  // 统计某类型各稀有度数量
  const countByRarity = (typeCards) => {
    const counts = {};
    (typeCards || []).forEach(c => {
      const r = c.config?.rarity || c.rarity || 'common';
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  };

  // 按稀有度分组（用于展开列表）
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
        📦 背包（{cards.length}）
      </h4>

      {/* 类型摘要行 */}
      <div className="space-y-1">
        {BACKPACK_TYPES.map(({ type, label, icon }) => {
          const typeCards = byType[type] || [];
          const counts = countByRarity(typeCards);
          const total = typeCards.length;
          const isExpanded = expandedType === type;

          return (
            <div key={type}>
              <button
                onClick={() => setExpandedType(isExpanded ? null : (total > 0 ? type : null))}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg
                           transition-colors text-left
                           ${total > 0
                             ? 'bg-stone-800/60 border border-stone-700/40 hover:border-stone-500 cursor-pointer'
                             : 'bg-stone-800/30 border border-stone-800/20 opacity-50 cursor-default'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{icon}</span>
                  <span className="text-stone-300 text-xs">{label}</span>
                </div>
                {total > 0 ? (
                  <div className="flex items-center gap-1.5">
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
                  <span className="text-stone-600 text-[10px]">暂无</span>
                )}
              </button>

              {/* 展开的卡牌列表 */}
              {isExpanded && total > 0 && (
                <div className="mt-1 ml-2 mr-1 p-2 bg-stone-800/40 rounded-lg border border-stone-700/30">
                  {type === 'troop' ? (
                    // 部队卡：完整TroopCard 50%缩放，按稀有度分组
                    groupByRarity(typeCards).map(({ rarity, cards: rCards }) => (
                      <div key={rarity} className="mb-2 last:mb-0">
                        <div className="text-stone-500 text-[10px] mb-1 px-1">
                          {rarityLabel[rarity] || rarity}（{rCards.length}）
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {rCards.map(card => (
                            <div key={card.instance_id} style={{ width: 128, height: 192 }}>
                              <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                                <TroopCard
                                  troop={toTroopCardData(card)}
                                  skillsMap={skillsMap}
                                  showDetails={true}
                                  baseUrl={baseUrl}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    // 其他类型：暂用简单列表
                    <div className="text-stone-500 text-xs text-center py-3">
                      {label}卡牌详情 — 尚未实装
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 稀有度排序权重 */
const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, core: 4 };

/** 底部抽屉：可装备卡牌选择（完整卡牌50%缩放，按稀有度分组） */
function CardDrawer({ slot, cards, skillsMap, onSelect, onClose }) {
  const baseUrl = import.meta.env.BASE_URL;

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
                  {grouped[rarity].map(card => (
                    <div
                      key={card.instance_id}
                      onClick={() => onSelect(card)}
                      className="cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                      style={{ width: 128, height: 192 }}
                    >
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        <TroopCard
                          troop={toTroopCardData(card)}
                          skillsMap={skillsMap}
                          showDetails={true}
                          baseUrl={baseUrl}
                        />
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

/** 卡牌详情浮层：显示完整卡牌 + 卸下/更换按钮 */
function CardDetailOverlay({ card, slot, skillsMap, onClose, onReplace, onUnequip }) {
  const baseUrl = import.meta.env.BASE_URL;
  const isTroopSlot = slot.id === 'troop' || slot.id === 'troop1' || slot.id === 'troop2';

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 bg-black/60 z-[110]" onClick={onClose} />

      {/* 浮层内容 — 点击空白区域关闭 */}
      <div className="fixed inset-0 z-[111] flex flex-col items-center justify-center px-4" onClick={onClose}>
        {/* 完整卡牌 */}
        <div className="mb-4" onClick={(e) => e.stopPropagation()}>
          {isTroopSlot ? (
            <TroopCard
              troop={toTroopCardData(card)}
              skillsMap={skillsMap}
              showDetails={true}
              baseUrl={baseUrl}
            />
          ) : (
            <div className="w-[256px] h-[200px] rounded-xl bg-stone-800 border-2 border-stone-600
                            flex items-center justify-center text-stone-400">
              {slot.label}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onUnequip}
            className="px-6 py-2.5 rounded-lg bg-stone-700 border border-stone-500
                       text-stone-300 text-sm font-medium
                       hover:bg-stone-600 active:scale-95 transition-all"
          >
            卸下
          </button>
          <button
            onClick={onReplace}
            className="px-6 py-2.5 rounded-lg bg-amber-700 border border-amber-500
                       text-amber-100 text-sm font-medium
                       hover:bg-amber-600 active:scale-95 transition-all"
          >
            更换
          </button>
        </div>
      </div>
    </>
  );
}
