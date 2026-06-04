/**
 * 卡池重复将领 · 残影三选一弹窗（21-1 §8.3）
 * 选项可自由切换；点「确认」时才调用 API 写入；点击幕布不关闭。
 */

import { useState, useEffect } from 'react';
import PoolResultModalFrame from '@/components/game/PoolResultModalFrame';
import CharacterCard from '@shared/components/card/CharacterCard';

const CHOICE_META = {
  attack: {
    emoji: '⚔️',
    title: '强攻',
    body: '为这张将写入下一空槽的攻击残影（首槽 +10%，次槽 +5%）。',
  },
  defense: {
    emoji: '🛡️',
    title: '坚守',
    body: '为这张将写入下一空槽的防御残影（首槽 +10%，次槽 +5%）。',
  },
  convert: {
    emoji: '💰',
    title: '转化',
    body: '不写入残影槽；传奇发黄巾徽章 ×1，其余按稀有度补偿银两。',
  },
};

export default function EchoChoiceModal({
  card,
  echoState,
  pendingEchoDrawId,
  skillsMap,
  baseUrl,
  loading,
  error,
  onConfirm,
}) {
  const state = echoState || {};
  const poolFull = state.poolSlotsUsed >= (state.poolSlotsMax ?? 2);
  const canEcho = !poolFull;
  const [selectedChoice, setSelectedChoice] = useState(null);

  useEffect(() => {
    setSelectedChoice(poolFull ? 'convert' : null);
  }, [poolFull, pendingEchoDrawId]);

  const handleConfirm = () => {
    if (!selectedChoice || loading) return;
    onConfirm?.(selectedChoice);
  };

  return (
    <PoolResultModalFrame
      title="重复将领 · 请选择"
      onClose={handleConfirm}
      confirmDisabled={!selectedChoice || loading}
      confirmLabel={loading ? '提交中…' : '确认'}
    >
      {poolFull && (
        <div className="mb-3 px-3 py-2.5 rounded-lg bg-amber-950/90 border-2 border-amber-500/50 text-[12px] leading-relaxed text-amber-50">
          卡池残影已满 2/2，仅可转化
        </div>
      )}

      {card && (
        <div className="flex justify-center mb-4">
          <CharacterCard character={card} skillsMap={skillsMap} showDetails baseUrl={baseUrl} disableHoverScale />
        </div>
      )}

      <p className="text-stone-300 text-xs text-center mb-3 leading-relaxed">
        再次抽到已持有的将领。可先切换选项，点「确认」后生效。
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        {(['attack', 'defense', 'convert']).map((key) => {
          const meta = CHOICE_META[key];
          const optionDisabled = loading || (key !== 'convert' && !canEcho);
          const selected = selectedChoice === key;
          return (
            <button
              key={key}
              type="button"
              disabled={optionDisabled}
              onClick={() => setSelectedChoice(key)}
              className={`rounded-xl border-2 px-3 py-3 text-left transition-all
                ${selected
                  ? 'border-amber-400 bg-amber-950/40 text-amber-50 ring-2 ring-amber-500/50'
                  : optionDisabled
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
        <div className="text-amber-300 text-xs text-center">正在写入…</div>
      )}

      <div className="text-[10px] text-stone-500 text-center mt-2">
        记录 #{pendingEchoDrawId}
      </div>
    </PoolResultModalFrame>
  );
}
