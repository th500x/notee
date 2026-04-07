/**
 * 将领未招募占位 — 显示选将界面或"暂无可用将领"提示
 * 复用 LineupTab 的 GeneralNotRecruited 模式
 */

import CharacterCard from '@shared/components/card/CharacterCard';
import { toCharCardData } from '@/utils/cardDataTransforms';

const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, core: 4 };

function sortByRarity(cards) {
  if (!cards?.length) return [];
  return [...cards].sort(
    (a, b) =>
      (RARITY_ORDER[a.config?.rarity || a.rarity || 'common'] ?? 99) -
      (RARITY_ORDER[b.config?.rarity || b.rarity || 'common'] ?? 99)
  );
}

export default function GarrisonGeneralNotRecruited({
  label,
  unequippedCharacters,
  onEquipCharacter,
  skillsMap,
  emptyStatusText = '尚未配置',
}) {
  const baseUrl = import.meta.env.BASE_URL;

  if (!unequippedCharacters || unequippedCharacters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 rounded-full border-2 border-dashed border-stone-600 flex items-center justify-center mb-4">
          <span className="text-3xl opacity-40">🎴</span>
        </div>
        <p className="text-stone-500 text-sm">{label} — {emptyStatusText}</p>
        <p className="text-stone-600 text-xs mt-1">暂无可用将领卡</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-4">
      <p className="text-amber-400 text-sm font-bold mb-3">选择{label}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {sortByRarity(unequippedCharacters).map(card => (
          <div
            key={card.instance_id}
            className="cursor-pointer hover:brightness-110 active:scale-95 transition-all"
            style={{ width: 128, height: 192 }}
            onClick={() => onEquipCharacter(card)}
          >
            <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
              <CharacterCard character={toCharCardData(card)} skillsMap={skillsMap} showDetails={false} baseUrl={baseUrl} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
