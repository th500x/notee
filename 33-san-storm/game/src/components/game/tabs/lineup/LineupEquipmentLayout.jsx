/**
 * 上阵编组 · 角色卡 + 槽位的两套布局：
 *   - `EquipmentLayout`：竖屏（左 3 槽 + 中央角色卡 + 右 3 槽）
 *   - `LandscapeQuadrant`：横屏 4 象限内单格（左角色卡 + 右上 2×3 槽位 + 右下编组数据）
 *
 * 玩家行的角色卡数据从 `player` 直接拼装；将领行从 `generalCard` 走 `toCharCardData`。
 * 两个布局共用同一份 `charData` 计算逻辑，本文件抽到 `buildCharCardData()` 一处。
 */

import CharacterCard from '@shared/components/card/CharacterCard';
import { toCharCardData } from '@/utils/cardDataTransforms';
import LineupEquipSlot from './LineupEquipSlot';
import { getPositionRarity } from './lineupSlots';
import {
  applyPhase1CoreDeltasToCharacterProps,
  buildPhase1BundleFromSkillIds,
} from '@shared/utils/skillPhase1Passive';

/**
 * 玩家行：用 player 字段拼一个 CharacterCard 入参；
 * 将领行：用 generalCard 走共享 toCharCardData。
 */
function buildCharCardData({ activeSubTab, player, generalCard, attributeBonus, skillsMap }) {
  if (activeSubTab === 'player' && player) {
    const playerSkillIds = [player.skill1, player.skill2].filter(Boolean);
    const phase1 = skillsMap && typeof skillsMap === 'object'
      ? buildPhase1BundleFromSkillIds(playerSkillIds, skillsMap)
      : null;
    const base = {
      id: player.playerId,
      name: player.characterName,
      avatar: player.avatar,
      rarity: getPositionRarity(player.positionLevel, player.currentPositionId),
      luck: player.luck / 10,
      courage: player.courage / 10,
      combat: player.combat / 10,
      command: player.command / 10,
      intelligence: player.intelligence / 10,
      politics: (player.politics ?? 0) / 10,
      charm: (player.charm ?? 0) / 10,
      skills: playerSkillIds,
      morale: player.morale ?? 70,
      attributeBonus,
    };
    return phase1 ? applyPhase1CoreDeltasToCharacterProps(base, phase1) : base;
  }
  if (generalCard) {
    return toCharCardData(generalCard, attributeBonus, skillsMap || null);
  }
  return null;
}

/* ── 横屏象限：左 = 角色卡 | 右 = 2×3 槽位 + 编组数据 ── */
export function LandscapeQuadrant({
  player,
  activeSubTab,
  slots,
  getSlotContent,
  onSlotClick,
  selectedSlot,
  skillsMap,
  statsPanel,
  attributeBonus = {},
  generalCard = null,
  onGeneralCardClick,
}) {
  const baseUrl = import.meta.env.BASE_URL;
  const cardScale = 0.82;
  const cardHeight = Math.round(384 * cardScale); // ~315px

  const charData = buildCharCardData({ activeSubTab, player, generalCard, attributeBonus, skillsMap });

  return (
    <div className="flex items-stretch h-full">
      <div
        className="flex-shrink-0 overflow-hidden cursor-pointer"
        onClick={() => {
          if (generalCard && onGeneralCardClick) onGeneralCardClick(generalCard, activeSubTab);
        }}
      >
        {charData ? (
          <div style={{ transform: `scale(${cardScale})`, transformOrigin: 'top left', height: `${cardHeight}px` }}>
            <CharacterCard
              character={charData}
              skillsMap={skillsMap}
              showDetails={true}
              baseUrl={baseUrl}
              disableHoverScale
            />
          </div>
        ) : (
          <div
            className="rounded-lg border-2 border-dashed border-stone-600
                          flex items-center justify-center bg-stone-800/50"
            style={{ width: `${Math.round(256 * cardScale)}px`, height: '100%' }}
          >
            <span className="text-4xl opacity-30">🎴</span>
          </div>
        )}
      </div>

      <div className="ml-1">
        <div className="grid grid-cols-3 gap-3">
          {slots.map((slot) => {
            const content = getSlotContent(slot);
            return (
              <LineupEquipSlot
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

        {statsPanel && <div className="mt-3">{statsPanel}</div>}
      </div>
    </div>
  );
}

/* ── 竖屏装备布局：左 3 槽 + 中央角色卡 + 右 3 槽 ── */
export function EquipmentLayout({
  player,
  activeSubTab,
  leftSlots,
  rightSlots,
  getSlotContent,
  onSlotClick,
  selectedSlot,
  skillsMap,
  compact = false,
  attributeBonus = {},
  generalCard = null,
  onGeneralCardClick,
}) {
  const baseUrl = import.meta.env.BASE_URL;
  const cardScale = compact ? 0.52 : 0.72;
  const cardHeight = Math.round(384 * cardScale);

  const charData = buildCharCardData({ activeSubTab, player, generalCard, attributeBonus, skillsMap });

  return (
    <div className={compact ? 'px-1 py-2' : 'px-1 py-4'}>
      {compact ? (
        <div className="flex items-start justify-center">
          <div className="flex-shrink-0" style={{ height: `${cardHeight}px`, overflow: 'hidden' }}>
            {charData ? (
              <div
                style={{ transform: `scale(${cardScale})`, transformOrigin: 'top left' }}
                className={generalCard ? 'cursor-pointer' : ''}
                onClick={() => { if (generalCard && onGeneralCardClick) onGeneralCardClick(generalCard, activeSubTab); }}
              >
                <CharacterCard
                  character={charData}
                  skillsMap={skillsMap}
                  showDetails={true}
                  baseUrl={baseUrl}
                  disableHoverScale
                />
              </div>
            ) : (
              <div
                className="rounded-lg border-2 border-dashed border-stone-600
                              flex items-center justify-center bg-stone-800/50"
                style={{ width: `${Math.round(256 * cardScale)}px`, height: `${cardHeight}px` }}
              >
                <span className="text-4xl opacity-30">🎴</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-center">
          {/* 左侧槽位 */}
          <div className="flex flex-col justify-between w-[64px] -mr-4" style={{ height: '276px' }}>
            {leftSlots.map((slot) => {
              const content = getSlotContent(slot);
              return (
                <LineupEquipSlot
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
              <div
                className={`transform scale-[0.72] origin-top ${generalCard ? 'cursor-pointer' : ''}`}
                onClick={() => { if (generalCard && onGeneralCardClick) onGeneralCardClick(generalCard, activeSubTab); }}
              >
                <CharacterCard
                  character={charData}
                  skillsMap={skillsMap}
                  showDetails={true}
                  baseUrl={baseUrl}
                  disableHoverScale
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
            {rightSlots.map((slot) => {
              const content = getSlotContent(slot);
              return (
                <LineupEquipSlot
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
