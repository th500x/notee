/**
 * 卡池重复将领 · 三选一弹窗（21-1 §8.3）
 */

import PoolResultModalFrame from '@/components/game/PoolResultModalFrame';
import CharacterCard from '@shared/components/card/CharacterCard';

const CHOICE_META = {
  attack: {
    emoji: '⚔️',
    title: '强攻',
    body: '为这张将写入下一空槽的攻击增强（首槽 +10%，次槽 +5%）。',
  },
  defense: {
    emoji: '🛡️',
    title: '坚守',
    body: '为这张将写入下一空槽的防御增强（首槽 +10%，次槽 +5%）。',
  },
  convert: {
    emoji: '💰',
    title: '转化',
    body: '不写入增强槽；传奇发黄巾徽章 ×1，其余按稀有度补偿银两。',
  },
};

export default function DuplicateEnhanceChoiceModal({
  card,
  duplicateEnhanceState,
  pendingDuplicateDrawId,
  skillsMap,
  baseUrl,
  loading,
  error,
  onChoose,
  onClose,
}) {
  const state = duplicateEnhanceState || {};
  const poolFull = state.poolSlotsUsed >= (state.poolSlotsMax ?? 2);
  const canEnhance = !poolFull;

  return (
    <PoolResultModalFrame title="重复将领 · 请选择" onClose={onClose}>
      {poolFull && (
        <div className="mb-3 px-3 py-2.5 rounded-lg bg-amber-950/90 border-2 border-amber-500/50 text-[12px] leading-relaxed text-amber-50">
          卡池增强已满 2/2，仅可转化
        </div>
      )}

      {card && (
        <div className="flex justify-center mb-4">
          <CharacterCard character={card} skillsMap={skillsMap} showDetails baseUrl={baseUrl} disableHoverScale />
        </div>
      )}

      <p className="text-stone-300 text-xs text-center mb-3 leading-relaxed">
        再次抽到已持有的将领。选择「强攻 / 坚守」可强化该实例；选择「转化」则换取资源。
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        {(['attack', 'defense', 'convert']).map((key) => {
          const meta = CHOICE_META[key];
          const disabled = loading || (key !== 'convert' && !canEnhance);
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onChoose(key)}
              className={`rounded-xl border-2 px-3 py-3 text-left transition-all
                ${disabled
                  ? 'border-stone-700 bg-stone-800/60 text-stone-500 cursor-not-allowed opacity-60'
                  : 'border-amber-600/60 bg-stone-800 hover:border-amber-400 hover:bg-stone-750 text-stone-100 active:scale-[0.98]'}`}
            >
              <div className="text-lg mb-1">{meta.emoji} {meta.title}</div>
              <div className="text-[11px] text-stone-400 leading-snug">{meta.body}</div>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="text-red-400 text-xs text-center mb-2">{error}</div>
      )}

      {loading && (
        <div className="text-amber-300 text-xs text-center">处理中…</div>
      )}

      <div className="text-[10px] text-stone-500 text-center mt-2">
        记录 #{pendingDuplicateDrawId}
      </div>
    </PoolResultModalFrame>
  );
}
