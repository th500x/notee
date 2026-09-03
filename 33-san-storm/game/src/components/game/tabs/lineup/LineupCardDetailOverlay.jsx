/**
 * 上阵编组的卡牌详情浮层
 *
 * 已装备的卡牌点击后弹出，显示完整卡牌（按 slot 类型分支：将领 / 部队 / 称号 / 装备卡 / 官职），
 * 底部按钮：
 *   - 一般槽位：[卸下]  [更换]
 *   - 官职槽：仅 [属性重随]（如父组件提供 onOpenAttributeReroll）
 *
 * 将领卡：传 `getCharacterLifeStage(id)` 后允许翻面查看生涯（与 Wiki 一致）。
 * 装备卡：4-piece 占位渲染共享 `EquipmentSetSquares`（与抽屉同款）。
 */

import { useMemo } from 'react';
import CharacterCard from '@shared/components/card/CharacterCard';
import TroopCard from '@shared/components/card/TroopCard';
import TitleAchievementCard from '@shared/components/card/TitleAchievementCard';
import PositionCard from '@shared/components/card/PositionCard';
import LineupDetailCardScale from '@shared/components/card/LineupDetailCardScale.jsx';
import LineupCardDetailPanel from '@shared/components/card/LineupCardDetailPanel.jsx';
import EquipmentCard from '@shared/components/card/EquipmentCard';
import { toCharCardData, toTroopCardData, toTitleCardData, toTreasureCardData } from '@/utils/cardDataTransforms';
import EquipmentSetSquares from './EquipmentSetSquares';

export default function LineupCardDetailOverlay({
  card,
  slot,
  skillsMap,
  allCards = [],
  getCharacterLifeStage,
  onClose,
  onReplace,
  onUnequip,
  onOpenAttributeReroll,
}) {
  const baseUrl = import.meta.env.BASE_URL;
  const isTroopSlot = slot.id === 'troop' || slot.id === 'troop1' || slot.id === 'troop2';
  const isTitleSlot = slot.id === 'title';
  const isAchievementSlot = slot.id === 'achievement';
  const isTreasureSlot = slot.id === 'treasure';
  const isEquipmentSetSlot = slot.id === 'equipmentSet' && card?.cardType === 'equipmentSet';
  const isPositionSlot = slot.id === 'position';
  const isCharacterSlot = slot.id === 'character';

  const equipmentCards = useMemo(
    () => allCards.filter((c) => c.cardType === 'equipment'),
    [allCards]
  );
  const resolveEquipPiece = (instanceId) =>
    equipmentCards.find((c) => c.instanceId === instanceId) || null;

  const characterCardPayload = isCharacterSlot ? toCharCardData(card, {}, skillsMap) : null;
  const lifeStageForChar =
    characterCardPayload && typeof getCharacterLifeStage === 'function'
      ? getCharacterLifeStage(characterCardPayload.id)
      : null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center" onClick={onClose}>
      <LineupCardDetailPanel
        onClick={(e) => e.stopPropagation()}
        title={isCharacterSlot ? '将领详情' : isPositionSlot ? '官职详情' : '卡牌详情'}
        headerRight={
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-white">
            ✕
          </button>
        }
        footer={
          isPositionSlot && typeof onOpenAttributeReroll === 'function' ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAttributeReroll();
              }}
              className="w-full rounded-lg border border-amber-700/50 bg-amber-900/50 py-2 text-sm text-amber-300 transition-colors hover:bg-amber-800/50"
            >
              属性重随
            </button>
          ) : !isPositionSlot ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onUnequip}
                className="flex-1 rounded-lg border border-red-700/50 bg-red-900/50 py-2 text-sm text-red-300 transition-colors hover:bg-red-800/50"
              >
                卸下
              </button>
              <button
                type="button"
                onClick={onReplace}
                className="flex-1 rounded-lg border border-amber-700/50 bg-amber-900/50 py-2 text-sm text-amber-300 transition-colors hover:bg-amber-800/50"
              >
                更换
              </button>
            </div>
          ) : null
        }
      >
        {lifeStageForChar ? (
          <p className="text-center text-[11px] text-stone-500">点击卡牌可翻面查看生涯</p>
        ) : null}
        <LineupDetailCardScale>
          {isCharacterSlot ? (
            <CharacterCard
              character={characterCardPayload}
              skillsMap={skillsMap}
              showDetails={true}
              baseUrl={baseUrl}
              lifeStageData={lifeStageForChar}
              disableHoverScale
            />
          ) : isTroopSlot ? (
            <TroopCard
              troop={toTroopCardData(card)}
              skillsMap={skillsMap}
              showDetails={true}
              baseUrl={baseUrl}
              disableHoverScale
            />
          ) : isTitleSlot || isAchievementSlot ? (
            <TitleAchievementCard
              item={toTitleCardData(card)}
              type={isAchievementSlot ? 'achievement' : 'title'}
              baseUrl={baseUrl}
            />
          ) : isTreasureSlot ? (
            <EquipmentCard equipment={toTreasureCardData(card)} baseUrl={baseUrl} disableHoverScale />
          ) : isEquipmentSetSlot ? (
            <EquipmentSetSquares card={card} resolveEquipPiece={resolveEquipPiece} />
          ) : isPositionSlot ? (
            <PositionCard position={card} showDetails={true} />
          ) : (
            <div className="w-[256px] h-[200px] rounded-xl bg-stone-800 border-2 border-stone-600
                flex items-center justify-center text-stone-400">{slot.label}</div>
          )}
        </LineupDetailCardScale>
      </LineupCardDetailPanel>
    </div>
  );
}
