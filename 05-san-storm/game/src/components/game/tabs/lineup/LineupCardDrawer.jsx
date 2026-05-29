/**
 * 上阵编组的底部选卡抽屉
 *
 * 从子 Tab 下方铺到屏幕底部，把可装备卡按稀有度分组（白 → 蓝 → 紫 → 橙 → 金）展示，
 * 缩放到 50% 给玩家点选；按槽位类型渲染：
 *   - title       → TitleAchievementCard
 *   - character   → CharacterCard（详情模式，将领卡放大区）
 *   - equipmentSet → 4-piece 装备卡占位（共享 EquipmentSetSquares）
 *   - troop / troop1 / troop2 / 其它 → TroopCard
 *
 * 与驻地编组的简化抽屉（GarrisonDrawer）不复用——后者不画装备卡 4-piece，只显示
 * 卡名 + "装备卡"标签；按"相异不混用"原则各自维护。
 */

import { useMemo } from 'react';
import CharacterCard from '@shared/components/card/CharacterCard';
import TroopCard from '@shared/components/card/TroopCard';
import TitleAchievementCard from '@shared/components/card/TitleAchievementCard';
import { toCharCardData, toTroopCardData, toTitleCardData } from '@/utils/cardDataTransforms';
import { groupCardsByRarity, RARITY_LABEL } from './lineupSlots';
import EquipmentSetSquares from './EquipmentSetSquares';

export default function LineupCardDrawer({ slot, cards, allCards = [], skillsMap, onSelect, onClose }) {
  const baseUrl = import.meta.env.BASE_URL;
  const equipmentCards = useMemo(
    () => allCards.filter((c) => c.cardType === 'equipment'),
    [allCards]
  );
  const resolveEquipPiece = (instanceId) =>
    equipmentCards.find((c) => c.instanceId === instanceId) || null;

  const rarityGroups = groupCardsByRarity(cards);
  const isTitleSlot = slot?.id === 'title';
  const isCharacterSlot = slot?.id === 'character';
  const isEquipmentSlot = slot?.id === 'equipmentSet';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[110]" onClick={onClose} />
      <div className="fixed left-0 right-0 bottom-0 z-[111] top-[4.5rem] sm:top-14 bg-stone-900 border-t-2 border-amber-700/50
                      rounded-t-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 flex-shrink-0">
          <h3 className="text-amber-400 text-sm font-bold">
            {slot.icon} 选择{slot.label}
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-white text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {cards.length === 0 ? (
            <div className="text-center py-8 text-stone-500 text-sm">
              暂无可装备的{slot.label}
            </div>
          ) : (
            rarityGroups.map(({ rarity, cards: groupCards }) => (
              <div key={rarity} className="mb-3">
                <div className="text-stone-500 text-xs mb-1.5 px-1">
                  {RARITY_LABEL[rarity] || rarity}（{groupCards.length}）
                </div>
                <div className="flex flex-wrap gap-2">
                  {groupCards.map((card) => (
                    <div
                      key={card.instanceId}
                      onClick={() => onSelect(card)}
                      className="cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                      style={{
                        width: 128,
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
                            character={toCharCardData(card, {}, skillsMap)}
                            skillsMap={skillsMap}
                            showDetails={true}
                            baseUrl={baseUrl}
                            disableHoverScale
                          />
                        ) : isEquipmentSlot ? (
                          <EquipmentSetSquares card={card} resolveEquipPiece={resolveEquipPiece} />
                        ) : (
                          <TroopCard
                            troop={toTroopCardData(card)}
                            skillsMap={skillsMap}
                            showDetails={true}
                            baseUrl={baseUrl}
                            disableHoverScale
                          />
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
